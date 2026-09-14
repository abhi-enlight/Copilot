import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase-server";
import { safeReturnTo } from "@/lib/http-utils";

const MS_OAUTH_STATE_COOKIE = "ms_oauth_state";

/**
 * Microsoft 365 Multi-Tenant OAuth Authorization Initiator
 *
 * Encodes the authenticated Supabase user ID in the OAuth state so the
 * callback can associate tokens with the correct user regardless of which
 * Microsoft account they authenticate with.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Only same-origin paths may be used as the post-auth redirect target.
  const returnTo = safeReturnTo(searchParams.get("returnTo"), "/");

  const host = request.headers.get("host") || "localhost:3000";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const REDIRECT_URI =
    isLocal && !process.env.AZURE_REDIRECT_URI?.includes("localhost")
      ? `http://${host}/api/integrations/microsoft/callback`
      : process.env.AZURE_REDIRECT_URI || `${isLocal ? "http" : "https"}://${host}/api/integrations/microsoft/callback`;

  const AZURE_CLIENT_ID =
    process.env.AZURE_CLIENT_ID ||
    process.env.MICROSOFT_CLIENT_ID ||
    "";

  if (!AZURE_CLIENT_ID) {
    return NextResponse.redirect(
      new URL(`${returnTo}?auth_error=azure_client_id_not_configured`, request.url)
    );
  }

  const DYNAMICS_CRM_ORG_URL = process.env.DYNAMICS_CRM_ORG_URL || "";
  const crmScope = DYNAMICS_CRM_ORG_URL
    ? `${DYNAMICS_CRM_ORG_URL.replace(/\/$/, "")}/user_impersonation`
    : "https://admin.services.crm.dynamics.com/user_impersonation";

  const preset = searchParams.get("preset") || "standard";
  const customScopes = searchParams.get("scopes");
  const mode = searchParams.get("mode") || "standard";
  const isAdminConsent =
    searchParams.get("admin_consent") === "1" || preset === "admin_consent";

  // Get authenticated user ID to embed in OAuth state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const authUserId = user?.id || null;

  if (isAdminConsent) {
    const adminUrl = new URL(
      "https://login.microsoftonline.com/common/adminconsent"
    );
    const adminNonce = randomBytes(24).toString("hex");
    adminUrl.searchParams.set("client_id", AZURE_CLIENT_ID);
    adminUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    adminUrl.searchParams.set(
      "state",
      Buffer.from(JSON.stringify({ authUserId, returnTo, preset: "admin_consent", nonce: adminNonce })).toString("base64")
    );
    const adminResponse = NextResponse.redirect(adminUrl.toString());
    adminResponse.cookies.set(MS_OAUTH_STATE_COOKIE, adminNonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return adminResponse;
  }

  const baseScopes = ["offline_access", "openid", "profile", "User.Read"];
  let selectedScopes: string[];

  if (customScopes) {
    selectedScopes = [...baseScopes, ...customScopes.split(" ")];
  } else {
    switch (preset) {
      case "minimal":
      case "mail_readonly":
        selectedScopes = [...baseScopes, "Mail.Read"];
        break;
      case "files_readonly":
        selectedScopes = [...baseScopes, "Files.Read"];
        break;
      case "readonly":
      case "personal_readonly":
        selectedScopes = [...baseScopes, "Mail.Read", "Files.Read"];
        break;
      case "mail":
        selectedScopes =
          mode === "write"
            ? [...baseScopes, "Mail.Read", "Mail.ReadWrite", "Mail.Send"]
            : [...baseScopes, "Mail.Read"];
        break;
      case "org_sharepoint":
        selectedScopes = [
          ...baseScopes,
          "Mail.Read", "Files.Read", "Files.ReadWrite",
          "Sites.Read.All", "Sites.ReadWrite.All",
        ];
        break;
      case "dynamics_crm":
        selectedScopes = [...baseScopes, crmScope];
        break;
      case "full":
        selectedScopes = [
          ...baseScopes,
          "Mail.Read", "Mail.ReadWrite", "Mail.Send",
          "Files.Read", "Files.ReadWrite",
          "Sites.Read.All", "Sites.ReadWrite.All",
          crmScope,
        ];
        break;
      case "personal_files":
      case "standard":
      default:
        selectedScopes =
          mode === "write"
            ? [...baseScopes, "Mail.Read", "Files.Read", "Files.ReadWrite"]
            : [...baseScopes, "Mail.Read", "Files.Read"];
        break;
    }
  }

  // CSRF nonce: issued as a short-lived HttpOnly cookie and embedded in the
  // OAuth state. The callback refuses to proceed unless both match.
  const nonce = randomBytes(24).toString("hex");
  const statePayload = Buffer.from(
    JSON.stringify({ authUserId, returnTo, preset, nonce })
  ).toString("base64");

  const scopes = Array.from(new Set(selectedScopes)).join(" ");

  const authUrl = new URL(
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  );
  authUrl.searchParams.set("client_id", AZURE_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", statePayload);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(MS_OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 minutes — one OAuth round-trip
  });
  return response;
}
