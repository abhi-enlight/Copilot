import {
  createHash,
  createHmac,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Returns the server-side signing secret for tamper-proof action proposals.
 *
 * There is deliberately no hardcoded fallback: a committed default secret would
 * let anyone forge an action proposal signature. If no secret is configured the
 * app must fail loudly rather than silently sign with a public constant.
 */
function getSigningSecret(): string {
  const secret = (
    process.env.PRISM_VAULT_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.COMPOSIO_API_KEY ||
    ""
  ).trim();

  if (secret.length < 16) {
    throw new Error(
      "Action proposal signing secret is not configured. Set PRISM_VAULT_KEY (or SUPABASE_SERVICE_ROLE_KEY) before starting Prism."
    );
  }

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

/**
 * Derives a 32-byte AES-256-GCM key from INTEGRATION_ENCRYPTION_KEY or PRISM_VAULT_KEY.
 */
function getIntegrationEncryptionKey(): Buffer {
  const rawKey = (
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.PRISM_VAULT_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();

  if (rawKey.length === 64) {
    return Buffer.from(rawKey, "hex");
  }
  return createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypts an OAuth token at rest using AES-256-GCM with a random IV.
 * Format: iv.authTag.ciphertext (base64)
 */
export function encryptIntegrationToken(token: string): string {
  const key = getIntegrationEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let ciphertext = cipher.update(token, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");
  return `${iv.toString("base64")}.${authTag}.${ciphertext}`;
}

/**
 * Decrypts an OAuth token using AES-256-GCM.
 */
export function decryptIntegrationToken(encrypted: string): string {
  const key = getIntegrationEncryptionKey();
  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

