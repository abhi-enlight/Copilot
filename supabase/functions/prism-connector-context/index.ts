import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Helper: parse 32-byte AES key from base64, hex, or utf-8
function parseVaultKey(rawKey: string): Uint8Array {
  const trimmed = rawKey.trim();
  // Check hex (64 chars)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  // Check base64
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
  // UTF-8 fallback
  const enc = new TextEncoder().encode(trimmed);
  const out = new Uint8Array(32);
  out.set(enc.slice(0, 32));
  return out;
}

// Convert bytea (hex '\x...' or base64 or Uint8Array) to Uint8Array
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

async function decryptToken(encryptedBytes: Uint8Array, rawKey: string): Promise<string> {
  const keyBytes = parseVaultKey(rawKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Ciphertext layout: [12-byte IV][Ciphertext + 16-byte Auth Tag]
  const iv = encryptedBytes.slice(0, 12);
  const data = encryptedBytes.slice(12);

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );

  return new TextDecoder().decode(decryptedBuf);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Auth: require x-prism-secret
  const secretHeader = req.headers.get("x-prism-secret");
  const expectedSecret = Deno.env.get("PRISM_N8N_SECRET") || "prism_sec_9d4f82a17e0b6c385fa21e4bc79d06e3";
  if (!secretHeader || secretHeader !== expectedSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { organizationId, connectorId } = await req.json().catch(() => ({}));
  if (!organizationId || !connectorId) {
    return new Response(
      JSON.stringify({ error: "organizationId and connectorId required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://ejawdvxnddgkcgkasove.supabase.co";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const vaultKey = Deno.env.get("PRISM_VAULT_KEY") || Deno.env.get("INTEGRATION_ENCRYPTION_KEY") || "48c2184bcdadf98d3b82fdd332eeb3479684b30c349ac24f04a0af05625056b1";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 2. Vault lookup
  const { data: row, error } = await supabase
    .from("prism_connector_vault")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("connector_id", connectorId)
    .maybeSingle();

  if (error || !row) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Check if expired
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return new Response(JSON.stringify({ error: "reauth_required" }), {
      status: 410,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Decrypt token
  let accessToken = "";
  if (row.access_token_enc && vaultKey) {
    try {
      const bytes = toUint8Array(row.access_token_enc);
      if (bytes) {
        accessToken = await decryptToken(bytes, vaultKey);
      }
    } catch (e: any) {
      return new Response(
        JSON.stringify({ error: "decryption_failed", message: e.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // 4. Response shape
  const responseData = {
    accessToken,
    enabled: Boolean(row.enabled),
    entitlement: Boolean(row.entitlement),
    orgConfig: row.org_config || {},
    expiresAt: row.expires_at || null,
  };

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
