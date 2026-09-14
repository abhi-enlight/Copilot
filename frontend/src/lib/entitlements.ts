/**
 * Entitlement Engine, single source of truth for connector access.
 *
 * A connector is accessible when the provider-level probe passes OR the user
 * holds an elevated app role (owner/admin, e.g. an admin privilege granted
 * after login). Verdicts are cached briefly (TTL) and re-probed on demand via
 * `?recheck=1` so a user granted access mid-session unlocks without re-login.
 *
 * Consumers:
 *   - /api/tenant/entitlements  (UI lock state)
 *   - /api/tenant/status        (connection health)
 *   - /api/chat                 (server-side entitlement override for n8n)
 *   - /api/campaigns            (write-action gating + audit)
 */

import { adminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import {
  ZOHO_PRODUCTS,
  isZohoOrgSharedEnabled,
  resolveZohoAccessToken,
  type ZohoProduct,
} from "@/lib/zoho";

export type ConnectorAccess = "granted" | "locked" | "not_connected";
export type AppRole = "owner" | "admin" | "member";

export const CONNECTOR_IDS = [
  "microsoft.outlook",
  "microsoft.sharepoint",
  "microsoft.dynamics",
  "zoho.crm",
  "zoho.projects",
  "zoho.books",
  "internal.kb",
] as const;

export type ConnectorId = (typeof CONNECTOR_IDS)[number];

export interface ConnectorVerdict {
  access: ConnectorAccess;
  reason: string;
  viaRoleOverride: boolean;
  probeOk?: boolean;
  probedNow?: boolean;
}

export interface EntitlementSnapshot {
  role: AppRole;
  userEmail: string | null;
  m365Authenticated: boolean;
  grantedScopes?: string[];
  m365?: {
    authenticated: boolean;
    userEmail: string | null;
    userName: string | null;
    hasCrmProbe: boolean;
    probedAt: number;
  };
  zoho: {
    crm: { connected: boolean; probeOk: boolean; detail: string; orgIds: Record<string, string | null> };
    projects: { connected: boolean; probeOk: boolean; detail: string; orgIds: Record<string, string | null> };
    books: { connected: boolean; probeOk: boolean; detail: string; orgIds: Record<string, string | null> };
  };
  connectors: Record<ConnectorId, ConnectorVerdict>;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// App role resolution (app_users registry; unknown users default to member)
// ---------------------------------------------------------------------------

export interface AppUser {
  email: string;
  displayName: string | null;
  role: AppRole;
}

export async function resolveAppUser(emailOrAuthId: string | null | undefined): Promise<AppUser | null> {
  if (!emailOrAuthId) return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emailOrAuthId);
    let query = adminSupabase.from("app_users").select("email, display_name, role");
    if (isUUID) {
      query = query.eq("auth_user_id", emailOrAuthId);
    } else {
      query = query.eq("email", emailOrAuthId.toLowerCase());
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    const role = (["owner", "admin", "member"] as const).includes(data.role) ? (data.role as AppRole) : "member";
    return { email: data.email, displayName: data.display_name || null, role };
  } catch {
    return null;
  }
}

export function isElevatedRole(role: AppRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
}

// ---------------------------------------------------------------------------
// Microsoft session + CRM probe (license + Dataverse WhoAmI)
// ---------------------------------------------------------------------------

export interface MicrosoftSession {
  accessToken: string | null;
  userEmail: string | null;
  userName: string | null;
  refreshToken: string | null;
  expiresAt: number;
  grantedScopes: string[];
  /** Cached probe verdict cookie from the callback (ms_has_crm). */
  hasCrmCookie: boolean;
  /** ISO timestamp of the last probe (ms_crm_probed_at). */
  probedAt: number;
}

export async function readMicrosoftSession(): Promise<MicrosoftSession> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let expiresAt = 0;
  let userEmail: string | null = null;
  let userName: string | null = null;
  let grantedScopes: string[] = [];

  try {
    const serverSupabase = await createClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (user) {
      userEmail = user.email || null;
      userName =
        (user.user_metadata?.display_name as string) ||
        (user.user_metadata?.full_name as string) ||
        null;

      const { resolveMicrosoftVaultTokens } = await import("@/lib/microsoft-vault");
      const vault = await resolveMicrosoftVaultTokens(user.id, user.email);

      if (vault.accessToken) {
        accessToken = vault.accessToken;
        refreshToken = vault.refreshToken;
        expiresAt = vault.expiresAt || 0;
        grantedScopes = vault.scopes || [];
      }
    }
  } catch (err) {
    console.warn("[entitlements] Failed to read user MS vault:", err);
  }

  // SECURITY: no ms_* cookie fallbacks here. Those cookies are client-editable
  // and previously let a caller spoof identity/scope/CRM-probe state for
  // entitlement decisions. Authenticated vault data above is the only source.
  return {
    accessToken,
    refreshToken,
    userEmail,
    userName,
    expiresAt,
    grantedScopes,
    hasCrmCookie: false,
    probedAt: 0,
  };
}

export function isM365SessionValid(session: MicrosoftSession): boolean {
  return Boolean(session.accessToken && (session.expiresAt === 0 || Date.now() < session.expiresAt - 30000));
}

const CRM_PROBE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface CrmProbeResult {
  ok: boolean;
  detail: string;
  probedNow: boolean;
}

/**
 * Live CRM entitlement probe: Dynamics 365 license (Graph licenseDetails)
 * plus a Dataverse WhoAmI call that verifies an actual CRM security role.
 * Cached for CRM_PROBE_TTL_MS via the ms_crm_probed_at cookie so login-time
 * results are reused; `force` re-probes immediately.
 */
export async function probeDynamicsCrmAccess(
  session: MicrosoftSession,
  opts: { force?: boolean } = {}
): Promise<CrmProbeResult> {
  if (!isM365SessionValid(session)) {
    return { ok: false, detail: "No valid Microsoft session", probedNow: false };
  }
  const fresh = opts.force || !session.probedAt || Date.now() - session.probedAt > CRM_PROBE_TTL_MS;
  if (!fresh) {
    return { ok: session.hasCrmCookie, detail: session.hasCrmCookie ? "Cached license + role check passed" : "Cached check: no CRM entitlement", probedNow: false };
  }

  const isPersonal = session.userEmail
    ? /@(outlook|hotmail|live|msn|gmail|yahoo)\.com$/i.test(session.userEmail)
    : false;
  if (isPersonal) {
    return { ok: false, detail: "Personal Microsoft accounts cannot access Dynamics CRM", probedNow: true };
  }

  // Step 1: license check via Graph
  let hasLicense = false;
  try {
    const licenseRes = await fetch("https://graph.microsoft.com/v1.0/me/licenseDetails", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (licenseRes.ok) {
      const licenseData = await licenseRes.json();
      const licenses = licenseData.value || [];
      hasLicense = licenses.some((l: { skuPartNumber?: string; servicePlans?: Array<{ servicePlanName?: string }> }) => {
        const sku = (l.skuPartNumber || "").toUpperCase();
        const plans = (l.servicePlans || []).map((p) => (p.servicePlanName || "").toUpperCase());
        return (
          sku.includes("DYN365") ||
          sku.includes("CRM") ||
          sku.includes("POWERAPPS") ||
          sku.includes("CDS") ||
          plans.some((p) => p.includes("CRM") || p.includes("DYN365") || p.includes("COMMON_DATA_SERVICE"))
        );
      });
    }
  } catch {
    hasLicense = false;
  }
  if (!hasLicense) {
    return { ok: false, detail: "No Dynamics 365 license on this account", probedNow: true };
  }

  // Step 2: Dataverse WhoAmI, proves a real CRM security role
  const orgUrl = (process.env.DYNAMICS_CRM_ORG_URL || "").replace(/\/$/, "");
  if (!orgUrl) {
    // No org configured: license alone is treated as sufficient (legacy behavior)
    return { ok: true, detail: "Dynamics 365 license detected (no Dataverse org configured)", probedNow: true };
  }
  try {
    const whoAmIRes = await fetch(`${orgUrl}/api/data/v9.2/WhoAmI`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (whoAmIRes.ok) {
      return { ok: true, detail: "Dataverse WhoAmI OK, CRM security role active", probedNow: true };
    }
    return { ok: false, detail: `Dataverse WhoAmI rejected (HTTP ${whoAmIRes.status}), no CRM security role`, probedNow: true };
  } catch {
    return { ok: false, detail: "Dataverse WhoAmI unreachable", probedNow: true };
  }
}

// ---------------------------------------------------------------------------
// Zoho entitlement evaluation
// ---------------------------------------------------------------------------

function zohoVerdictFor(product: ZohoProduct, zoho: EntitlementSnapshot["zoho"][ZohoProduct], role: AppRole): ConnectorVerdict {
  const connectorId = `zoho.${product}` as ConnectorId;
  if (zoho.connected && zoho.probeOk) {
    return { access: "granted", reason: `Connected to the user's own Zoho account (${zoho.detail})`, viaRoleOverride: false, probeOk: true, probedNow: false };
  }
  if (zoho.connected && !zoho.probeOk) {
    // Connected but the product probe failed, elevated roles may still pass
    if (isElevatedRole(role)) {
      return { access: "granted", reason: `${role === "admin" ? "Admin" : "Owner"} override over failed probe`, viaRoleOverride: true, probeOk: false, probedNow: false };
    }
    return { access: "locked", reason: zoho.detail, viaRoleOverride: false, probeOk: false, probedNow: false };
  }
  // Not connected: org-shared fallback keeps legacy access alive
  if (isZohoOrgSharedEnabled()) {
    return { access: "granted", reason: "Org-shared Zoho connection (legacy fallback)", viaRoleOverride: false, probeOk: false, probedNow: false };
  }
  void connectorId;
  return { access: "not_connected", reason: "Connect your own Zoho account to enable this connector", viaRoleOverride: false, probeOk: false, probedNow: false };
}

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

export async function buildEntitlementSnapshot(opts: { forceReprobe?: boolean } = {}): Promise<EntitlementSnapshot> {
  const session = await readMicrosoftSession();
  const m365Authenticated = isM365SessionValid(session);
  const appUser = await resolveAppUser(session.userEmail);
  const role: AppRole = appUser?.role || "member";

  // Microsoft connectors
  const crmProbe = await probeDynamicsCrmAccess(session, { force: opts.forceReprobe });
  const mailScopeOk = session.grantedScopes.length === 0 || session.grantedScopes.some((s) => /mail\.read/i.test(s));
  const filesScopeOk = session.grantedScopes.length === 0 || session.grantedScopes.some((s) => /files\.read/i.test(s));

  const dynamicsVerdict: ConnectorVerdict = (() => {
    if (crmProbe.ok) {
      return { access: "granted", reason: crmProbe.detail, viaRoleOverride: false, probeOk: true, probedNow: crmProbe.probedNow };
    }
    if (isElevatedRole(role)) {
      return { access: "granted", reason: `${role === "admin" ? "Admin" : "Owner"} privilege grants CRM access (provider probe: ${crmProbe.detail})`, viaRoleOverride: true, probeOk: false, probedNow: crmProbe.probedNow };
    }
    return { access: "locked", reason: "Requires a Dynamics 365 license and CRM security role", viaRoleOverride: false, probeOk: false, probedNow: crmProbe.probedNow };
  })();

  // Zoho connectors (per-user integrations; probes stored at connect time)
  const zohoState: EntitlementSnapshot["zoho"] = {
    crm: { connected: false, probeOk: false, detail: "Not connected", orgIds: {} },
    projects: { connected: false, probeOk: false, detail: "Not connected", orgIds: {} },
    books: { connected: false, probeOk: false, detail: "Not connected", orgIds: {} },
  };

  // SECURITY: identity for Zoho vault lookups comes only from the authenticated
  // Supabase session (plus the vault-backed Microsoft session email). The
  // zoho_user_email cookie is client-influenced and must not select vault rows.
  let effectiveEmail = session.userEmail || null;
  let authUserId: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const serverSupabase = await createClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        effectiveEmail = effectiveEmail || user.email || null;
        authUserId = user.id;
      }
    } catch {}
  }

  const lookupKey = authUserId || effectiveEmail;
  if (lookupKey && isSupabaseConfigured()) {
    await Promise.all(
      ZOHO_PRODUCTS.map(async (product) => {
        try {
          const resolved = await resolveZohoAccessToken(lookupKey, product);
          if (resolved.record) {
            zohoState[product] = {
              connected: true,
              probeOk: Boolean(resolved.accessToken),
              detail: resolved.accessToken ? "Token valid" : resolved.record.status === "reauth_required" ? "Reconnection required" : "Token refresh failed",
              orgIds: {
                crmOrgId: resolved.record.crmOrgId,
                portalId: resolved.record.portalId,
                booksOrgId: resolved.record.booksOrgId,
              },
            };
          }
        } catch {
          // Vault unavailable, treat as not connected
        }
      })
    );
  }

  const connectors: Record<ConnectorId, ConnectorVerdict> = {
    "microsoft.outlook": {
      access: m365Authenticated && mailScopeOk ? "granted" : m365Authenticated ? "locked" : "not_connected",
      reason: m365Authenticated ? (mailScopeOk ? "Mail.Read granted" : "Mail.Read scope missing") : "Connect your Microsoft account",
      viaRoleOverride: false,
      probeOk: m365Authenticated && mailScopeOk,
      probedNow: false,
    },
    "microsoft.sharepoint": {
      access: m365Authenticated && filesScopeOk ? "granted" : m365Authenticated ? "locked" : "not_connected",
      reason: m365Authenticated ? (filesScopeOk ? "Files.Read granted" : "Files.Read scope missing") : "Connect your Microsoft account",
      viaRoleOverride: false,
      probeOk: m365Authenticated && filesScopeOk,
      probedNow: false,
    },
    "microsoft.dynamics": dynamicsVerdict,
    "zoho.crm": zohoVerdictFor("crm", zohoState.crm, role),
    "zoho.projects": zohoVerdictFor("projects", zohoState.projects, role),
    "zoho.books": zohoVerdictFor("books", zohoState.books, role),
    "internal.kb": { access: "granted", reason: "Internal knowledge base", viaRoleOverride: false, probeOk: true, probedNow: false },
  };

  return {
    userEmail: m365Authenticated ? session.userEmail : null,
    role,
    m365Authenticated,
    grantedScopes: session.grantedScopes,
    connectors,
    zoho: zohoState,
    checkedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers for downstream routes
// ---------------------------------------------------------------------------

export function isConnectorGranted(snapshot: EntitlementSnapshot, id: ConnectorId): boolean {
  return snapshot.connectors[id]?.access === "granted";
}

export function hasCrmAccess(snapshot: EntitlementSnapshot): boolean {
  return isConnectorGranted(snapshot, "microsoft.dynamics") || isConnectorGranted(snapshot, "zoho.crm");
}

/**
 * Convenience wrapper for write-action routes: resolves the current user's
 * snapshot and returns null (with a 403-shaped reason) when a required
 * connector is not granted.
 */
export async function requireConnectorAccess(
  id: ConnectorId
): Promise<{ snapshot: EntitlementSnapshot; ok: true } | { snapshot: EntitlementSnapshot; ok: false; reason: string }> {
  const snapshot = await buildEntitlementSnapshot();
  const verdict = snapshot.connectors[id];
  if (verdict?.access === "granted") return { snapshot, ok: true };
  return { snapshot, ok: false, reason: verdict?.reason || "You don't have access to the CRM." };
}
