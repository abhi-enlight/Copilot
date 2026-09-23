/**
 * Utility for mapping raw API error messages, status codes, and entitlement reasons
 * into friendly, clear, user-facing English text.
 */

const ERROR_MAP: Record<string, string> = {
  // Auth errors
  "Invalid login credentials": "The email or password you entered is incorrect. Please try again.",
  "Email not confirmed": "Your email address has not been confirmed yet. Please check your inbox for the verification link.",
  "User not found": "No account was found with this email address.",

  // Connector / Entitlement errors
  "zoho_not_configured": "Zoho connection is currently not configured on this server. Please contact your administrator.",
  "token_exchange_failed": "Failed to authenticate with Zoho. Please check your account region and try again.",
  "access_denied": "Access was denied during authorization. Please try connecting again.",
  "reauth_required": "Your session with this service expired. Please reconnect your account.",
  "m365_admin_approval_required": "Microsoft requires an IT administrator to approve access for your organization account.",

  // General server errors
  "Failed to fetch": "Unable to connect to the server. Please check your internet connection.",
  "Internal Server Error": "An unexpected server error occurred. Please try again in a few moments.",
  "Network Error": "Network connection error. Please check your connection and retry.",
};

export function formatUserErrorMessage(rawError?: string | null, fallback = "An unexpected error occurred. Please try again."): string {
  if (!rawError) return fallback;

  // Direct match
  if (ERROR_MAP[rawError]) return ERROR_MAP[rawError];

  // Pattern matching
  if (/zoho_not_configured/i.test(rawError)) {
    return ERROR_MAP["zoho_not_configured"];
  }
  if (/token_exchange_failed|access_denied/i.test(rawError)) {
    return "Authorization was not completed. Please try connecting your account again.";
  }
  if (/.env.local/i.test(rawError)) {
    return "This integration is pending configuration by your system administrator.";
  }
  if (/Failed to fetch|NetworkError/i.test(rawError)) {
    return ERROR_MAP["Failed to fetch"];
  }

  // If raw message is reasonably concise and clean (no stack traces or file paths)
  if (rawError.length < 150 && !rawError.includes("http://") && !rawError.includes("https://") && !rawError.includes("/")) {
    return rawError;
  }

  return fallback;
}
