import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Returns the server-side signing secret for tamper-proof action proposals.
 * Uses PRISM_VAULT_KEY or SUPABASE_SERVICE_ROLE_KEY as fallback.
 */
function getSigningSecret(): string {
  const secret =
    process.env.PRISM_VAULT_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.COMPOSIO_API_KEY ||
    "prism_default_local_secret_key_v2";
  return secret;
}

/**
 * Normalizes an arbitrary JSON payload into a deterministic canonical string.
 * Recursively sorts object keys so identical payloads produce identical hashes.
 */
export function canonicalizePayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object") {
    return JSON.stringify(payload);
  }

  if (Array.isArray(payload)) {
    return `[${payload.map(canonicalizePayload).join(",")}]`;
  }

  const record = payload as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalizePayload(record[key])}`
  );
  return `{${pairs.join(",")}}`;
}

/**
 * Computes a SHA-256 hash of the canonical request payload.
 */
export function hashPayload(payload: unknown): string {
  const canonical = canonicalizePayload(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Generates an HMAC-SHA256 cryptographic signature for an action proposal.
 * Binds: actionId + userId + toolSlug + payloadHash.
 */
export function generateActionSignature(params: {
  actionId: string;
  userId: string;
  toolSlug: string;
  payload: Record<string, unknown>;
}): string {
  const { actionId, userId, toolSlug, payload } = params;
  const pHash = hashPayload(payload);
  const dataToSign = `${actionId}:${userId}:${toolSlug}:${pHash}`;

  const secret = getSigningSecret();
  return createHmac("sha256", secret).update(dataToSign).digest("hex");
}

/**
 * Verifies an action proposal signature using constant-time comparison
 * to eliminate timing attack vulnerabilities.
 */
export function verifyActionSignature(params: {
  actionId: string;
  userId: string;
  toolSlug: string;
  payload: Record<string, unknown>;
  signature: string;
}): boolean {
  const { actionId, userId, toolSlug, payload, signature } = params;

  if (!signature || typeof signature !== "string" || signature.length !== 64) {
    return false;
  }

  const expectedSignature = generateActionSignature({
    actionId,
    userId,
    toolSlug,
    payload,
  });

  try {
    const bufActual = Buffer.from(signature, "hex");
    const bufExpected = Buffer.from(expectedSignature, "hex");

    if (bufActual.length !== bufExpected.length) {
      return false;
    }

    return timingSafeEqual(bufActual, bufExpected);
  } catch {
    return false;
  }
}
