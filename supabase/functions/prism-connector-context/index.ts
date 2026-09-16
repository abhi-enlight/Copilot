import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Key parsing — accepts hex (64), base64 (32 bytes), or utf-8 (<=32 bytes)
// ---------------------------------------------------------------------------

function parseVaultKey(rawKey: string): Uint8Array {
  const trimmed = rawKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  try {
    const binStr = atob(trimmed);
    if (binStr.length === 32) {
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return bytes;
    }
  } catch {}
  const enc = new TextEncoder().encode(trimmed);
  const out = new Uint8Array(32);
  out.set(enc.slice(0, 32));
  return out;
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ciphertext format A (org vault, raw):  [12-byte IV][ciphertext+16-byte tag]
// ---------------------------------------------------------------------------

function toUint8Array(val: unknown): Uint8Array | null {
  if (!val) return null;
  if (val instanceof Uint8Array) return val;
  if (typeof val === "string") {
    if (val.startsWith("\\x")) {
      const hex = val.slice(2);
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      return bytes;
    }
    return base64ToBytes(val);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ciphertext format B (frontend user_integrations): "ivB64.tagB64.dataB64"
// with key = SHA256(INTEGRATION_ENCRYPTION_KEY). Matches lib/zoho.ts
// encryptToken() exactly.
// ---------------------------------------------------------------------------

function parseFrontendFormat(payload: string): { iv: Uint8Array; data: Uint8Array } | null {
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  const iv = base64ToBytes(parts[0]);
  const tag = base64ToBytes(parts[1]);
  const data = base64ToBytes(parts[2]);
  if (!iv || !tag || !data || iv.length !== 12 || tag.length !== 16) return null;
  // WebCrypto expects ciphertext+tag contiguous
  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data, 0);
  combined.set(tag, data.length);
  return { iv, data: combined };
}

async function sha256Key(secret: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

async function decryptRaw(bytes: Uint8Array, keyBytes: Uint8Array): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(buf);
}

async function decryptFrontend(payload: string, secret: string): Promise<string> {
  const parsed = parseFrontendFormat(payload);
  if (!parsed) throw new Error("unrecognized_ciphertext_format");
  const keyBytes = await sha256Key(secret);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: parsed.iv }, cryptoKey, parsed.data);
  return new TextDecoder().decode(buf);
}

// ---------------------------------------------------------------------------
// Connector mapping: prism connectorId -> user_integrations (provider, product)
// Microsoft rows are shared across outlook/sharepoint/dynamics (the frontend
// resolves one latest Microsoft row for all three), so product is not filtered
// for microsoft.
// ---------------------------------------------------------------------------

function mapConnector(connectorId: string): { provider: string; product: string | null } | null {
  switch (connectorId) {
    case "microsoft.outlook":
    case "microsoft.sharepoint":
    case "microsoft.dynamics":
      return { provider: "microsoft", product: null };
    case "zoho.crm":
      return { provider: "zoho", product: "crm" };
    case "zoho.projects":
      return { provider: "zoho", product: "projects" };
    case "zoho.books":
      return { provider: "zoho", product: "books" };
    default:
      return null;
  }
}

// Zoho org_config assembled from the per-user columns discovered at connect time
function zohoOrgConfigFromRow(row: Record<string, unknown>): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};
  const dc = row.zoho_data_center || null;
  if (dc) cfg.dataCenter = dc;
  if (row.zoho_portal_id) cfg.portalId = String(row.zoho_portal_id);
  if (row.zoho_books_org_id) cfg.booksOrgId = String(row.zoho_books_org_id);
  if (row.zoho_crm_org_id) cfg.crmOrgId = String(row.zoho_crm_org_id);
  return cfg;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // 1. Auth: require x-prism-secret
  const secretHeader = req.headers.get("x-prism-secret");
  const expectedSecret = Deno.env.get("PRISM_N8N_SECRET") || "prism_sec_9d4f82a17e0b6c385fa21e4bc79d06e3";
  if (!secretHeader || secretHeader !== expectedSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  const { organizationId, userId, connectorId } = await req.json().catch(() => ({}));
  if (!connectorId || (!organizationId && !userId)) {
    return json({ error: "connectorId and (organizationId or userId) required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://ejawdvxnddgkcgkasove.supabase.co";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const vaultKey = Deno.env.get("PRISM_VAULT_KEY") || Deno.env.get("INTEGRATION_ENCRYPTION_KEY") || "48c2184bcdadf98d3b82fdd332eeb3479684b30c349ac24f04a0af05625056b1";

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "server_misconfigured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 2. Tier A — org-scoped prism_connector_vault (org-managed connectors)
  if (organizationId) {
    const { data: row, error } = await supabase
      .from("prism_connector_vault")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("connector_id", connectorId)
      .maybeSingle();

    if (!error && row) {
      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
        return json({ error: "reauth_required" }, 410);
      }
      let accessToken = "";
      if (row.access_token_enc && vaultKey) {
        try {
          const bytes = toUint8Array(row.access_token_enc);
          if (bytes) accessToken = await decryptRaw(bytes, parseVaultKey(vaultKey));
        } catch (e: unknown) {
          return json({ error: "decryption_failed", message: (e as Error).message }, 500);
        }
      }
      return json({
        accessToken,
        enabled: Boolean(row.enabled),
        entitlement: Boolean(row.entitlement),
        orgConfig: row.org_config || {},
        expiresAt: row.expires_at || null,
        source: "org_vault",
      });
    }
  }

  // 3. Tier B — personal fallback from user_integrations (per-user connectors,
  //    written by the frontend OAuth callbacks). Keyed by the authenticated
  //    Supabase user UUID (userId) that the chat route already sends.
  const mapping = mapConnector(String(connectorId));
  if (mapping && userId) {
    let query = supabase
      .from("user_integrations")
      .select("*")
      .eq("provider", mapping.provider);

    // userId may be a Supabase auth UUID (auth_user_id) or an email string
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId));
    if (mapping.product) query = query.eq("product", mapping.product);

    if (isUUID) {
      query = query.or(`auth_user_id.eq.${userId},user_email.eq.${String(userId).toLowerCase()}`);
    } else {
      query = query.eq("user_email", String(userId).toLowerCase());
    }

    const { data: rows, error } = await query.order("updated_at", { ascending: false }).limit(1);

    if (!error && rows && rows.length > 0) {
      const row = rows[0];

      if (row.status === "reauth_required") {
        return json({ error: "reauth_required" }, 410);
      }

      let accessToken = "";
      const enc = row.access_token_encrypted || "";
      if (enc) {
        try {
          // Frontend format first (iv.tag.data); fall back to raw format
          accessToken = await decryptFrontend(enc, vaultKey);
        } catch {
          try {
            const bytes = toUint8Array(enc);
            if (bytes) accessToken = await decryptRaw(bytes, parseVaultKey(vaultKey));
          } catch {
            return json({ error: "decryption_failed" }, 500);
          }
        }
      }

      const orgConfig = mapping.provider === "zoho" ? zohoOrgConfigFromRow(row) : {};
      if (mapping.provider === "microsoft") {
        // Dynamics instance URL may be provided via env; org-managed rows
        // carry it in prism_connector_vault.org_config
        const dynUrl = Deno.env.get("DYNAMICS_CRM_ORG_URL");
        if (dynUrl) orgConfig.crmOrgUrl = dynUrl;
      }

      return json({
        accessToken,
        enabled: true,
        entitlement: row.status === "active" && Boolean(accessToken),
        orgConfig,
        expiresAt: row.access_token_expires_at || null,
        source: "user_vault",
      });
    }
  }

  // 4. Nothing found — honest 404, n8n relays missing_token
  return json({ error: "not_found" }, 404);
});
