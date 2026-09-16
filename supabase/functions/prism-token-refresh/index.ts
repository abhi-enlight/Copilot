import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Helper: parse 32-byte AES key from base64, hex, or utf-8
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
      for (let i = 0; i < 32; i++) bytes[i] = binStr.charCodeAt(i);
      return bytes;
    }
  } catch {}
  const enc = new TextEncoder().encode(trimmed);
  const out = new Uint8Array(32);
  out.set(enc.slice(0, 32));
  return out;
}

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
    try {
      const bin = atob(val);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {}
  }
  return null;
}

function toHex(bytes: Uint8Array): string {
  return "\\x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function decryptToken(encryptedBytes: Uint8Array, rawKey: string): Promise<string> {
  const keyBytes = parseVaultKey(rawKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const iv = encryptedBytes.slice(0, 12);
  const data = encryptedBytes.slice(12);
  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );
  return new TextDecoder().decode(decryptedBuf);
}

async function encryptToken(plainText: string, rawKey: string): Promise<Uint8Array> {
  const keyBytes = parseVaultKey(rawKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoded
  );
  const cipherBytes = new Uint8Array(encryptedBuf);
  const result = new Uint8Array(iv.length + cipherBytes.length);
  result.set(iv, 0);
  result.set(cipherBytes, iv.length);
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Verify x-prism-secret
  const secretHeader = req.headers.get("x-prism-secret");
  const expectedSecret = Deno.env.get("PRISM_N8N_SECRET");
  if (!secretHeader || (expectedSecret && secretHeader !== expectedSecret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const vaultKey = Deno.env.get("PRISM_VAULT_KEY") || Deno.env.get("INTEGRATION_ENCRYPTION_KEY") || "";

  if (!supabaseUrl || !serviceKey || !vaultKey) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 2. Query rows expiring in the next 1 hour (or already expired)
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: expiringRows, error: queryError } = await supabase
    .from("prism_connector_vault")
    .select("*")
    .lt("expires_at", oneHourFromNow)
    .not("refresh_token_enc", "is", null);

  if (queryError) {
    return new Response(JSON.stringify({ error: queryError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let refreshed = 0;
  let failed = 0;
  const failures: Array<{ connectorId: string; orgId: string; reason: string }> = [];

  for (const row of expiringRows || []) {
    try {
      const refreshBytes = toUint8Array(row.refresh_token_enc);
      if (!refreshBytes) {
        throw new Error("Missing refresh token ciphertext");
      }
      const refreshToken = await decryptToken(refreshBytes, vaultKey);
      let newAccessToken = "";
      let newExpiresInSec = 3600;

      if (row.connector_id.startsWith("zoho.")) {
        const dc = row.org_config?.dataCenter || "in";
        const clientId = Deno.env.get("ZOHO_CLIENT_ID") || row.org_config?.clientId;
        const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET") || row.org_config?.clientSecret;

        if (!clientId || !clientSecret) {
          throw new Error("Missing Zoho OAuth client credentials");
        }

        const refreshParams = new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
        });

        const tokenRes = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: refreshParams.toString(),
        });

        const tokenData = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error || `Zoho refresh failed with HTTP ${tokenRes.status}`);
        }

        newAccessToken = tokenData.access_token;
        newExpiresInSec = tokenData.expires_in || 3600;
      } else if (row.connector_id.startsWith("microsoft.")) {
        const tenantId = row.org_config?.tenantId || Deno.env.get("AZURE_TENANT_ID") || "common";
        const clientId = Deno.env.get("AZURE_CLIENT_ID") || row.org_config?.clientId;
        const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET") || row.org_config?.clientSecret;

        if (!clientId || !clientSecret) {
          throw new Error("Missing Microsoft OAuth client credentials");
        }

        const bodyParams = new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        });

        const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: bodyParams.toString(),
        });

        const tokenData = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description || tokenData.error || `Microsoft refresh failed with HTTP ${tokenRes.status}`);
        }

        newAccessToken = tokenData.access_token;
        newExpiresInSec = tokenData.expires_in || 3600;
      } else {
        continue;
      }

      // 4. Re-encrypt & update
      const encNewAccess = await encryptToken(newAccessToken, vaultKey);
      const newExpiresAt = new Date(Date.now() + (newExpiresInSec - 60) * 1000).toISOString();

      await supabase
        .from("prism_connector_vault")
        .update({
          access_token_enc: toHex(encNewAccess),
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      // 5. Audit log
      await supabase.from("agent_audit_logs").insert({
        organization_id: row.organization_id,
        action: "token_refresh",
        entity_type: "connector_vault",
        entity_id: row.id,
        details: { connectorId: row.connector_id, ok: true },
      });

      refreshed++;
    } catch (err: any) {
      failed++;
      failures.push({
        connectorId: row.connector_id,
        orgId: row.organization_id,
        reason: err.message,
      });

      await supabase.from("agent_audit_logs").insert({
        organization_id: row.organization_id,
        action: "token_refresh",
        entity_type: "connector_vault",
        entity_id: row.id,
        details: { connectorId: row.connector_id, ok: false, error: err.message },
      });
    }
  }

  return new Response(
    JSON.stringify({ refreshed, failed, failures }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
