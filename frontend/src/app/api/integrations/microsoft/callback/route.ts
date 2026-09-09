import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/entitlements-server";

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

  let tenantId = 'personal';
  let returnTo = '/';

  if (rawState) {
    try {
      const decoded = JSON.parse(Buffer.from(rawState, 'base64').toString('utf-8'));
      tenantId = decoded.tenantId || tenantId;
      returnTo = decoded.returnTo || returnTo;
    } catch {
      // Use defaults if decoding fails
    }
  }

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

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

  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '9b9717eb-8dbf-41b1-b788-d7a3ae6f4269';
  const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || '';
  const REDIRECT_URI = process.env.AZURE_REDIRECT_URI || `${baseUrl}/api/integrations/microsoft/callback`;

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
      console.log(`Successfully acquired tokens for tenant: ${tenantId}`);

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
            console.warn('App user upsert failed:', userErr);
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

    // Securely set session cookies with the authenticated user's live tokens
    if (tokenData?.access_token) {
      const isProd = process.env.NODE_ENV === 'production';
      const maxAge = 60 * 60 * 24 * 30; // 30 days

      response.cookies.set('ms_access_token', tokenData.access_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: tokenData.expires_in || 3600
      });

      if (tokenData.refresh_token) {
        response.cookies.set('ms_refresh_token', tokenData.refresh_token, {
          httpOnly: true,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
          maxAge
        });
      }

      const expiresAt = Date.now() + ((tokenData.expires_in || 3600) * 1000);
      response.cookies.set('ms_token_expires_at', expiresAt.toString(), {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge
      });

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
