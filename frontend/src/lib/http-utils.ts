// =============================================================================
// HTTP security utilities shared by OAuth callbacks and API routes
// =============================================================================

/**
 * Validates a client-supplied post-auth redirect target ("returnTo") against
 * open-redirect attacks.
 *
 * Only same-origin PATHS are accepted:
 *   - must start with a single "/"
 *   - protocol-relative URLs ("//evil.com") are rejected
 *   - embedded schemes ("/\evil.com", "/%2F%2Fevil.com" after decode) rejected
 *   - backslashes are normalized (browsers treat "\" like "/")
 *
 * Anything invalid falls back to `fallback` (default "/").
 */
export function safeReturnTo(raw: unknown, fallback: string = "/"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) {
    return fallback;
  }

  // Normalize: decode once (catch encoded "//"), fold backslashes to slashes.
  let candidate = raw;
  try {
    candidate = decodeURIComponent(raw);
  } catch {
    // Malformed encoding — keep the raw value; the checks below still apply.
  }
  candidate = candidate.replace(/\\/g, "/");

  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  // Reject any embedded scheme like "/http:" or "/https:" tricks.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate.slice(1).split("/")[0] ?? "")) {
    return fallback;
  }
  // Control characters could smuggle header content or confuse parsers.
  if (/[\r\n\u0000-\u001f]/.test(candidate)) return fallback;

  return candidate;
}
