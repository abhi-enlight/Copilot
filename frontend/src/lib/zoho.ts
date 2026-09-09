/**
 * Zoho Multi-Tenant OAuth Integration Helper
 *
 * Mirrors the Microsoft integration: every user connects their own Zoho
 * account. Tokens are stored per user + product in the `user_integrations`
 * vault (AES-256-GCM encrypted with INTEGRATION_ENCRYPTION_KEY) and never
 * leave the server except as short-lived access tokens passed to n8n.
 *
 * Environment:
 *   ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET, Zoho API Console client
 *   ZOHO_DATACENTER, in | com | eu | com.au | jp | in.cn (default: in)
 *   ZOHO_REDIRECT_URI, optional explicit override
 *   ZOHO_ORG_SHARED, "true" enables the legacy org-shared
 *                                          n8n 'Zoho account' credential fallback
 *   INTEGRATION_ENCRYPTION_KEY, 32+ char secret for AES-256-GCM
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { supabase } from "@/lib/supabase";

export type ZohoProduct = "crm" | "projects" | "books";

export const ZOHO_PRODUCTS: ZohoProduct[] = ["crm", "projects", "books"];

/** Per-product OAuth scopes, a CRM-only user never consents to Books. */
export const ZOHO_PRODUCT_SCOPES: Record<ZohoProduct, string[]> = {
  crm: ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"],
  projects: ["ZohoProjects.projects.ALL", "ZohoProjects.portals.ALL"],
  books: ["ZohoBooks.fullaccess.ALL"],
};

export interface ZohoTokenSet {
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number;
  apiDomain?: string;
  error?: string;
}

export interface ZohoIntegrationRecord {
  product: ZohoProduct;
  accessToken: string | null;
  refreshToken: string | null;
  scopes: string[];
  zohoUserId: string | null;
  dataCenter: string | null;
  crmOrgId: string | null;
  portalId: string | null;
  booksOrgId: string | null;
  status: string;
  /** Epoch ms when the access token expires (null = unknown, e.g. legacy rows). */
  expiresAt: number | null;
  lastRefreshedAt: number | null;
}

// ---------------------------------------------------------------------------
// Data center helpers
// ---------------------------------------------------------------------------

export function zohoDataCenter(): string {
  return (process.env.ZOHO_DATACENTER || "in").replace(/^zoho\./, "").trim() || "in";
}

export function zohoAccountsBase(dc = zohoDataCenter()): string {
  return `https://accounts.zoho.${dc}`;
}

export function zohoApiBase(dc = zohoDataCenter()): string {
  return `https://www.zohoapis.${dc}`;
}

export function zohoProjectsApiBase(dc = zohoDataCenter()): string {
  return `https://projectsapi.zoho.${dc}`;
}

/** Legacy hard-coded values, used only as org-shared fallback defaults. */
export const ZOHO_LEGACY = {
  portalId: "60085935707",
  booksOrgId: "60085935698",
  portalName: "enlightlabdotcom",
  dataCenter: "in",
};

export function zohoRedirectUri(requestHost: string): string {
  if (process.env.ZOHO_REDIRECT_URI) return process.env.ZOHO_REDIRECT_URI;
  const protocol = requestHost.includes("localhost") ? "http" : "https";
  return `${protocol}://${requestHost}/api/integrations/zoho/callback`;
}

// ---------------------------------------------------------------------------
// Token encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

function encryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || "";
  if (!secret) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured");
  }
  // Derive a stable 32-byte key from any-length secret
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptToken(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OAuth: authorize URL + code exchange + refresh
// ---------------------------------------------------------------------------

export function buildZohoAuthorizeUrl(opts: {
  products: ZohoProduct[];
  requestHost: string;
  state: string;
  prompt?: string;
}): string {
  const scopes = Array.from(
    new Set(opts.products.flatMap((p) => ZOHO_PRODUCT_SCOPES[p]))
  ).join(" ");
  const url = new URL(`${zohoAccountsBase()}/oauth/v2/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.ZOHO_CLIENT_ID || "");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", zohoRedirectUri(opts.requestHost));
  url.searchParams.set("state", opts.state);
  url.searchParams.set("access_type", "offline");
  if (opts.prompt) url.searchParams.set("prompt", opts.prompt);
  return url.toString();
}

export async function exchangeZohoCode(code: string, requestHost: string): Promise<ZohoTokenSet> {
  try {
    const res = await fetch(`${zohoAccountsBase()}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.ZOHO_CLIENT_ID || "",
        client_secret: process.env.ZOHO_CLIENT_SECRET || "",
        redirect_uri: zohoRedirectUri(requestHost),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.error || !data.access_token) {
      return { accessToken: null, refreshToken: null, expiresIn: 0, error: String(data.error || `HTTP ${res.status}`) };
    }
    return {
      accessToken: String(data.access_token),
      refreshToken: data.refresh_token ? String(data.refresh_token) : null,
      expiresIn: Number(data.expires_in) || 3600,
      apiDomain: data.api_domain ? String(data.api_domain) : undefined,
    };
  } catch (err: unknown) {
    return { accessToken: null, refreshToken: null, expiresIn: 0, error: (err as Error)?.message || "token exchange failed" };
  }
}

export async function refreshZohoToken(refreshToken: string): Promise<ZohoTokenSet> {
  try {
    const res = await fetch(`${zohoAccountsBase()}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.ZOHO_CLIENT_ID || "",
        client_secret: process.env.ZOHO_CLIENT_SECRET || "",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.error || !data.access_token) {
      return { accessToken: null, refreshToken: null, expiresIn: 0, error: String(data.error || `HTTP ${res.status}`) };
    }
    return {
      accessToken: String(data.access_token),
      refreshToken: data.refresh_token ? String(data.refresh_token) : refreshToken,
      expiresIn: Number(data.expires_in) || 3600,
    };
  } catch (err: unknown) {
    return { accessToken: null, refreshToken: null, expiresIn: 0, error: (err as Error)?.message || "token refresh failed" };
  }
}

// ---------------------------------------------------------------------------
// Entitlement probes, verify the connected user can actually use each product
// ---------------------------------------------------------------------------

export interface ZohoProbeResult {
  ok: boolean;
  detail: string;
  /** Org identifiers discovered from the user's own account. */
  crmOrgId?: string | null;
  portalId?: string | null;
  booksOrgId?: string | null;
  zohoUserId?: string | null;
  dataCenter?: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function zohoGet(url: string, accessToken: string): Promise<{ ok: boolean; status: number; json: any }> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: {} };
  }
}

export async function probeZohoCrm(accessToken: string, dc = zohoDataCenter()): Promise<ZohoProbeResult> {
  const res = await zohoGet(`${zohoApiBase(dc)}/crm/v2/Deals?per_page=1&page=1`, accessToken);
  if (!res.ok) {
    return { ok: false, detail: `Deals probe failed (HTTP ${res.status})` };
  }
  const orgId = res.json?.org?.[0]?.zgid ?? res.json?.org?.zgid ?? null;
  const user = await zohoGet(`${zohoApiBase(dc)}/crm/v2/users?type=CurrentUser`, accessToken);
  const zohoUserId = user.ok ? String(user.json?.users?.[0]?.id || "") || null : null;
  return { ok: true, detail: "Deals module accessible", crmOrgId: orgId ? String(orgId) : null, zohoUserId, dataCenter: dc };
}

export async function probeZohoProjects(accessToken: string, dc = zohoDataCenter()): Promise<ZohoProbeResult> {
  const res = await zohoGet(`${zohoProjectsApiBase(dc)}/api/v3/portals`, accessToken);
  if (!res.ok) {
    return { ok: false, detail: `Portals probe failed (HTTP ${res.status})` };
  }
  const portals = res.json?.portals?.portal || res.json?.portals || [];
  const first = Array.isArray(portals) ? portals[0] : null;
  const portalId = first?.id ?? first?.portal_id ?? null;
  return { ok: true, detail: "Portals accessible", portalId: portalId ? String(portalId) : null, dataCenter: dc };
}

export async function probeZohoBooks(accessToken: string, dc = zohoDataCenter()): Promise<ZohoProbeResult> {
  const res = await zohoGet(`${zohoApiBase(dc)}/books/v3/organizations`, accessToken);
  if (!res.ok) {
    return { ok: false, detail: `Organizations probe failed (HTTP ${res.status})` };
  }
  const orgs = res.json?.organizations || [];
  const first = Array.isArray(orgs) ? orgs[0] : null;
  return {
    ok: Boolean(first),
    detail: first ? `Books org ${first.name || first.organization_id}` : "No Books organization on this account",
    booksOrgId: first ? String(first.organization_id || "") || null : null,
    dataCenter: dc,
  };
}

export async function probeZohoProduct(product: ZohoProduct, accessToken: string, dc = zohoDataCenter()): Promise<ZohoProbeResult> {
  if (product === "crm") return probeZohoCrm(accessToken, dc);
  if (product === "projects") return probeZohoProjects(accessToken, dc);
  return probeZohoBooks(accessToken, dc);
}

// ---------------------------------------------------------------------------
// Token store (user_integrations vault)
// ---------------------------------------------------------------------------

function vaultEnabled(): boolean {
  return Boolean(isSupabaseConfiguredExport() && process.env.INTEGRATION_ENCRYPTION_KEY);
}

function isSupabaseConfiguredExport(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
}

export interface StoredZohoIntegration {
  ok: boolean;
  record: ZohoIntegrationRecord | null;
  error?: string;
}

export async function upsertZohoIntegration(opts: {
  userEmail: string;
  product: ZohoProduct;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  probe: ZohoProbeResult;
  /** Epoch ms when the access token expires; enables the background refresh job. */
  expiresAt?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!vaultEnabled()) {
    return { ok: false, error: "Token vault not configured (Supabase or INTEGRATION_ENCRYPTION_KEY missing)" };
  }
  const row = {
    user_email: opts.userEmail,
    provider: "zoho" as const,
    product: opts.product,
    access_token_encrypted: encryptToken(opts.accessToken),
    refresh_token_encrypted: opts.refreshToken ? encryptToken(opts.refreshToken) : null,
    scopes: opts.scopes,
    zoho_user_id: opts.probe.zohoUserId || null,
    zoho_data_center: opts.probe.dataCenter || zohoDataCenter(),
    zoho_crm_org_id: opts.probe.crmOrgId || null,
    zoho_portal_id: opts.probe.portalId || null,
    zoho_books_org_id: opts.probe.booksOrgId || null,
    status: "active" as const,
    last_error_message: null,
    last_probed_at: new Date().toISOString(),
    access_token_expires_at: opts.expiresAt ? new Date(opts.expiresAt).toISOString() : null,
    last_refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("user_integrations").upsert(row, {
    onConflict: "user_email,provider,product",
  });
  if (error) {
    console.error("[zoho] Failed to store integration tokens:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Loads the stored integration and returns a fresh access token, refreshing when needed. */
export async function getFreshZohoIntegration(userEmail: string, product: ZohoProduct): Promise<StoredZohoIntegration> {
  if (!vaultEnabled()) return { ok: false, record: null, error: "Token vault not configured" };

  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_email", userEmail)
    .eq("provider", "zoho")
    .eq("product", product)
    .maybeSingle();

  if (error) return { ok: false, record: null, error: error.message };
  if (!data) return { ok: false, record: null, error: "not_connected" };

  const record: ZohoIntegrationRecord = {
    product,
    accessToken: decryptToken(data.access_token_encrypted),
    refreshToken: decryptToken(data.refresh_token_encrypted),
    scopes: data.scopes || [],
    zohoUserId: data.zoho_user_id || null,
    dataCenter: data.zoho_data_center || zohoDataCenter(),
    crmOrgId: data.zoho_crm_org_id || null,
    portalId: data.zoho_portal_id || null,
    booksOrgId: data.zoho_books_org_id || null,
    status: data.status || "active",
    expiresAt: data.access_token_expires_at ? new Date(data.access_token_expires_at).getTime() : null,
    lastRefreshedAt: data.last_refreshed_at ? new Date(data.last_refreshed_at).getTime() : null,
  };

  // Access tokens last ~1h; resolveZohoAccessToken refreshes proactively when
  // expiry is known and near, and callers invoke rotateZohoAccessToken on a
  // 401-shaped failure otherwise. Here we simply return what we have.
  return { ok: Boolean(record.accessToken), record };
}

/** Force-refreshes the stored access token and persists it. */
export async function rotateZohoAccessToken(userEmail: string, product: ZohoProduct): Promise<StoredZohoIntegration> {
  const current = await getFreshZohoIntegration(userEmail, product);
  if (!current.record?.refreshToken) {
    return { ok: false, record: current.record, error: current.error || "no_refresh_token" };
  }
  const refreshed = await refreshZohoToken(current.record.refreshToken);
  if (!refreshed.accessToken) {
    // Refresh token rejected → user must reconnect
    if (vaultEnabled()) {
      await supabase
        .from("user_integrations")
        .update({ status: "reauth_required", last_error_message: refreshed.error || "refresh_failed", updated_at: new Date().toISOString() })
        .eq("user_email", userEmail)
        .eq("provider", "zoho")
        .eq("product", product);
    }
    return { ok: false, record: current.record, error: refreshed.error || "refresh_failed" };
  }
  const persisted = await persistZohoTokenRefresh(userEmail, product, refreshed);
  if (!persisted.ok) {
    return { ok: false, record: current.record, error: persisted.error || "persist_failed" };
  }
  return {
    ok: true,
    record: { ...current.record, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken || current.record.refreshToken },
  };
}

/**
 * Persists an already-exchanged token set (from refreshZohoToken) into the
 * vault. Shared by rotateZohoAccessToken (on-demand path) and the background
 * token refresher, so a token is exchanged exactly once per refresh.
 */
export async function persistZohoTokenRefresh(
  userEmail: string,
  product: ZohoProduct,
  refreshed: ZohoTokenSet
): Promise<{ ok: boolean; error?: string }> {
  if (!vaultEnabled()) return { ok: false, error: "Token vault not configured" };
  const { error } = await supabase
    .from("user_integrations")
    .update({
      access_token_encrypted: encryptToken(refreshed.accessToken as string),
      refresh_token_encrypted: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : null,
      access_token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      last_refreshed_at: new Date().toISOString(),
      status: "active",
      last_error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_email", userEmail)
    .eq("provider", "zoho")
    .eq("product", product);
  if (error) {
    console.error("[zoho] Failed to persist refreshed token:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteZohoIntegration(userEmail: string, product?: ZohoProduct): Promise<void> {
  if (!vaultEnabled()) return;
  let query = supabase.from("user_integrations").delete().eq("user_email", userEmail).eq("provider", "zoho");
  if (product) query = query.eq("product", product);
  await query;
}

/**
 * Resolves a usable Zoho access token for a user + product: returns the stored
 * one when present; on a 401-shaped failure callers invoke rotateZohoAccessToken.
 */
/** Refresh when a token is due to expire within this window (10 minutes). */
export const TOKEN_FRESHNESS_MARGIN_MS = 10 * 60 * 1000;

/** Legacy rows without expiry: treat as stale after 50 minutes (~1h lifetime). */
export const UNKNOWN_EXPIRY_STALENESS_MS = 50 * 60 * 1000;

export async function resolveZohoAccessToken(
  userEmail: string | null | undefined,
  product: ZohoProduct
): Promise<{ accessToken: string | null; record: ZohoIntegrationRecord | null }> {
  if (!userEmail) return { accessToken: null, record: null };
  const stored = await getFreshZohoIntegration(userEmail, product);
  if (stored.ok && stored.record?.accessToken) {
    // Known-expiry tokens are refreshed *before* they lapse when the request
    // arrives inside the freshness window (proactive, no 401 round-trip).
    const expiresAt = stored.record.expiresAt;
    const nearlyExpired = expiresAt != null && expiresAt - Date.now() < TOKEN_FRESHNESS_MARGIN_MS;
    if (nearlyExpired && stored.record.refreshToken) {
      const rotated = await rotateZohoAccessToken(userEmail, product);
      if (rotated.ok && rotated.record?.accessToken) {
        return { accessToken: rotated.record.accessToken, record: rotated.record };
      }
    }
    return { accessToken: stored.record.accessToken, record: stored.record };
  }
  if (stored.record?.refreshToken) {
    const rotated = await rotateZohoAccessToken(userEmail, product);
    if (rotated.ok && rotated.record?.accessToken) {
      return { accessToken: rotated.record.accessToken, record: rotated.record };
    }
  }
  return { accessToken: null, record: stored.record };
}

// ---------------------------------------------------------------------------
// Org-shared fallback (legacy behavior, opt-in via ZOHO_ORG_SHARED=true)
// ---------------------------------------------------------------------------

export function isZohoOrgSharedEnabled(): boolean {
  return (process.env.ZOHO_ORG_SHARED || "").toLowerCase() === "true";
}

export function legacyOrgConfig(): Record<string, string> {
  return {
    dataCenter: ZOHO_LEGACY.dataCenter,
    portalId: ZOHO_LEGACY.portalId,
    organizationId: ZOHO_LEGACY.booksOrgId,
  };
}

// ---------------------------------------------------------------------------
// Background token-refresh support (consumed by lib/token-refresher.ts)
// ---------------------------------------------------------------------------

export interface VaultTokenDueForRefresh {
  userEmail: string;
  product: ZohoProduct;
  refreshToken: string;
  expiresAt: number | null;
}

/**
 * Lists vault rows whose access token is expired or expiring within the
 * freshness margin. Rows with a known-future expiry outside the window are
 * skipped (nothing to do); rows with unknown expiry are only refreshed when
 * older than the staleness threshold, mirroring the on-demand behavior.
 */
export async function getVaultTokensNeedingRefresh(opts?: {
  maxRows?: number;
}): Promise<VaultTokenDueForRefresh[]> {
  if (!vaultEnabled()) return [];
  const cutoff = Date.now() + TOKEN_FRESHNESS_MARGIN_MS;
  const staleThreshold = Date.now() - UNKNOWN_EXPIRY_STALENESS_MS;

  const { data, error } = await supabase
    .from("user_integrations")
    .select("user_email, product, refresh_token_encrypted, access_token_expires_at, updated_at")
    .eq("provider", "zoho")
    .eq("status", "active")
    .limit(opts?.maxRows ?? 200);

  if (error) {
    console.error("[zoho] Failed to list tokens for refresh:", error.message);
    return [];
  }

  const due: VaultTokenDueForRefresh[] = [];
  for (const row of data || []) {
    const refreshToken = decryptToken(row.refresh_token_encrypted);
    if (!refreshToken) continue;
    const product = row.product as ZohoProduct;
    if (!ZOHO_PRODUCTS.includes(product)) continue;

    const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : null;
    const needsRefresh =
      expiresAt == null
        ? new Date(row.updated_at).getTime() < staleThreshold // legacy row without expiry
        : expiresAt <= cutoff; // expired or inside the freshness window
    if (needsRefresh) {
      due.push({ userEmail: row.user_email, product, refreshToken, expiresAt });
    }
  }
  return due;
}

/** Marks a vault row's status after a refresh attempt (e.g. reauth_required). */
export async function markVaultTokenStatus(
  userEmail: string,
  product: ZohoProduct,
  status: "active" | "error" | "reauth_required",
  errorMessage: string | null
): Promise<void> {
  if (!vaultEnabled()) return;
  await supabase
    .from("user_integrations")
    .update({ status, last_error_message: errorMessage, updated_at: new Date().toISOString() })
    .eq("user_email", userEmail)
    .eq("provider", "zoho")
    .eq("product", product);
}
