import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureAppUser } from "@/lib/entitlements-server";
import { ensureAppUserByAuthId } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";
import { safeReturnTo } from "@/lib/http-utils";

const MS_OAUTH_STATE_COOKIE = "ms_oauth_state";

/**
 * Microsoft 365 OAuth Callback Handler
 *
 * Receives the authorization code from Microsoft, exchanges it for tokens,
 * and saves the session cookies. CRM entitlement is probed via the shared
 * entitlements engine (license + Dataverse WhoAmI) and cached in the
 * ms_crm_probed_at cookie so the verdict survives page navigation and is
 * re-probed after its TTL (or on explicit re-check).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const rawState = searchParams.get('state');

  let returnTo = '/';
  let authUserId: string | null = null;

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // CSRF: the state payload must carry the nonce issued (as a cookie) at
  // connect time, and the cookie value must match. Without this check an
  // attacker could forge a callback that links THEIR Microsoft account to the
  // victim's Prism session (account-linking CSRF).
  const cookieStore = await cookies();
  const issuedNonce = cookieStore.get(MS_OAUTH_STATE_COOKIE)?.value || "";

  let stateNonce: string | null = null;
  let decodedPreset: string | null = null;
  if (rawState) {
    try {
      const decoded = JSON.parse(Buffer.from(rawState, 'base64').toString('utf-8'));
      returnTo = safeReturnTo(decoded.returnTo, returnTo);
      authUserId = decoded.authUserId || null;
      stateNonce = typeof decoded.nonce === 'string' ? decoded.nonce : null;
      decodedPreset = decoded.preset || null;
    } catch {
      // Use defaults if decoding fails
    }
  }

  const stateValid =
    Boolean(issuedNonce) &&
    Boolean(stateNonce) &&
    issuedNonce.length === stateNonce!.length &&
    [...issuedNonce].every((ch, i) => ch === stateNonce![i]);
  if (!stateValid) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=state_mismatch`);
  }

  if (searchParams.get('admin_consent') === 'True') {
    return NextResponse.redirect(`${baseUrl}${returnTo}?admin_consent_granted=1`);
  }

  // Handle user cancellation or Azure authorization errors
  if (error) {
    console.error('Azure OAuth Error:', error, errorDescription);
    const isAdminApproval =
      error === 'access_denied' ||
      error === 'consent_required' ||
      /admin|consent|approval|AADSTS65004|AADSTS65005|AADSTS50076/i.test(errorDescription || '');

    if (isAdminApproval) {
      return NextResponse.redirect(`${baseUrl}${returnTo}?m365_admin_approval=1`);
    }
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=missing_authorization_code`);
  }

  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '';
  const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || '';
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const REDIRECT_URI =
    isLocal && !process.env.AZURE_REDIRECT_URI?.includes("localhost")
      ? `http://${host}/api/integrations/microsoft/callback`
      : process.env.AZURE_REDIRECT_URI || `${baseUrl}/api/integrations/microsoft/callback`;

  try {
    let userEmail = '';
    let userName = '';
    let hasCrm = false;
    let crmDetail = '';
    let m365UserId = '';
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Azure token payload shape varies */
    let tokenData: any = null;

    if (AZURE_CLIENT_SECRET) {
      // Exchange authorization code for refresh token and access token
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: AZURE_CLIENT_ID,
          client_secret: AZURE_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        console.error('Token exchange failed:', errBody);
        return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=token_exchange_failed`);
      }

      tokenData = await tokenResponse.json();
      console.log('Successfully acquired tokens for Microsoft account');

      if (tokenData.access_token) {
        // Query Microsoft Graph /v1.0/me to get the authenticated user's profile
        try {
          const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            userEmail = profile.mail || profile.userPrincipalName || '';
            userName = profile.displayName || '';
            m365UserId = profile.id || '';
          }
        } catch (profileErr) {
          console.warn('Could not fetch MS Graph user profile:', profileErr);
        }

        // CRM entitlement probe via the shared entitlements engine
        try {
          const { probeDynamicsCrmAccess, ensureAppUser } = await import('@/lib/entitlements-server');
          const probe = await probeDynamicsCrmAccess({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            userEmail: userEmail || null,
            userName: userName || null,
            expiresAt: Date.now() + ((tokenData.expires_in || 3600) * 1000),
            grantedScopes: String(tokenData.scope || '').split(' ').filter(Boolean),
            hasCrmCookie: false,
            probedAt: 0,
          });
          hasCrm = probe.ok;
          crmDetail = probe.detail;
        } catch (probeErr) {
          console.warn('CRM entitlement probe failed:', probeErr);
          hasCrm = false;
        }

        // Register / sync the app user row (role persists across logins)
        if (userEmail) {
          try {
            await ensureAppUser({ email: userEmail, displayName: userName || null, m365UserId: m365UserId || null });
          } catch (userErr) {
            console.warn('App user upsert (email-based) failed:', userErr);
          }
        }

        // If we have an authenticated Prism user, persist tokens to their encrypted vault
        if (authUserId && userEmail && tokenData.access_token) {
          try {
            const { upsertMicrosoftIntegration } = await import('@/lib/microsoft-vault');
            const targetProduct: ("mail" | "sharepoint") | undefined =
              decodedPreset === "mail" || decodedPreset === "mail_readonly"
                ? "mail"
                : decodedPreset === "files_readonly" || decodedPreset === "personal_files" || decodedPreset === "org_sharepoint"
                ? "sharepoint"
                : undefined;

            await upsertMicrosoftIntegration({
              authUserId,
              userEmail,
              displayName: userName || null,
              m365UserId: m365UserId || null,
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token || null,
              expiresIn: tokenData.expires_in || 3600,
              scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
              product: targetProduct,
            });
          } catch (authLinkErr) {
            console.warn('Auth user link failed (non-fatal):', authLinkErr);
          }
        }
      }
    }

    // Redirect user back with dynamic session and workspace information
    const redirectUrl = new URL(returnTo, baseUrl);
    redirectUrl.searchParams.set('connected', 'microsoft_365');
    if (userEmail) redirectUrl.searchParams.set('email', userEmail);
    if (userName) redirectUrl.searchParams.set('name', `${userName}'s Workspace`);
    redirectUrl.searchParams.set('has_crm', hasCrm ? '1' : '0');
    if (hasCrm) {
      redirectUrl.searchParams.set('org', 'Dataverse CRM Active');
      if (crmDetail) redirectUrl.searchParams.set('crm_check', encodeURIComponent(crmDetail));
    }

    const response = NextResponse.redirect(redirectUrl.toString());

    // One-time CSRF nonce — consumed.
    response.cookies.set(MS_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });

    // Explicitly delete/expire any legacy token cookies so they never leak across users
    ['ms_access_token', 'ms_refresh_token', 'ms_token_expires_at'].forEach((name) => {
      response.cookies.set({
        name,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    });

    // Set ONLY non-sensitive identity metadata cookies for UI display
    if (tokenData?.access_token) {
      const isProd = process.env.NODE_ENV === 'production';
      const maxAge = 60 * 60 * 24 * 30; // 30 days

      if (userEmail) {
        response.cookies.set('ms_user_email', userEmail, {
          httpOnly: false,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
          maxAge
        });
      }

      if (userName) {
        response.cookies.set('ms_user_name', userName, {
          httpOnly: false,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
          maxAge
        });
      }

      if (tokenData.scope) {
        response.cookies.set('ms_granted_scopes', tokenData.scope, {
          httpOnly: false,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
          maxAge
        });
      }

      response.cookies.set('ms_has_crm', hasCrm ? '1' : '0', {
        httpOnly: false,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge
      });

      // Probe timestamp, drives the 15-minute entitlement cache TTL
      response.cookies.set('ms_crm_probed_at', String(Date.now()), {
        httpOnly: false,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge
      });
    }

    return response;
  } catch (err) {
    console.error('OAuth Callback Exception:', err);
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=internal_server_error`);
  }
}
