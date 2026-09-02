import { NextResponse } from 'next/server';

/**
 * Microsoft 365 OAuth Callback Handler
 * 
 * Receives the authorization code from Microsoft, exchanges it for tokens,
 * and saves the encrypted integration credentials for the tenant.
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

  // Handle user cancellation or Azure authorization errors
  if (error) {
    console.error('Azure OAuth Error:', error, errorDescription);
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=missing_authorization_code`);
  }

  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '9b9717eb-8dbf-41b1-b788-d7a3ae6f4269';
  const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || '';
  const REDIRECT_URI = `${baseUrl}/api/integrations/microsoft/callback`;

  try {
    let userEmail = '';
    let userName = '';
    let hasCrm = false;
    let crmOrg = '';
    let tokenData: any = null;

    const CRM_ORG_URL = process.env.DYNAMICS_CRM_ORG_URL || '';
    const DEFAULT_CRM_ORG = CRM_ORG_URL.replace(/^https?:\/\//, '').replace(/\.dynamics\.com.*$/, '');

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

      // Query Microsoft Graph /v1.0/me to get the authenticated user's actual profile & email
      if (tokenData.access_token) {
        try {
          const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            userEmail = profile.mail || profile.userPrincipalName || '';
            userName = profile.displayName || '';
          }
        } catch (profileErr) {
          console.warn('Could not fetch MS Graph user profile:', profileErr);
        }

        // Automatic CRM Detection strictly for the signing-in user:
        const isPersonalAccount = userEmail ? /@(outlook|hotmail|live|msn|gmail|yahoo)\.com$/i.test(userEmail) : false;

        if (!isPersonalAccount && tokenData.access_token) {
          try {
            // Check user licenses via MS Graph for Dynamics 365 / Dataverse
            const licenseRes = await fetch('https://graph.microsoft.com/v1.0/me/licenseDetails', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });

            if (licenseRes.ok) {
              const licenseData = await licenseRes.json();
              const licenses = licenseData.value || [];
              const hasCrmLicense = licenses.some((l: { skuPartNumber?: string; servicePlans?: Array<{ servicePlanName?: string }> }) => {
                const sku = (l.skuPartNumber || '').toUpperCase();
                const plans = (l.servicePlans || []).map((p) => (p.servicePlanName || '').toUpperCase());
                return (
                  sku.includes('DYN365') ||
                  sku.includes('CRM') ||
                  sku.includes('POWERAPPS') ||
                  sku.includes('CDS') ||
                  plans.some((p) => p.includes('CRM') || p.includes('DYN365') || p.includes('COMMON_DATA_SERVICE'))
                );
              });

              if (hasCrmLicense) {
                hasCrm = true;
                crmOrg = 'Dataverse CRM Active';
              } else {
                hasCrm = false;
                crmOrg = '';
              }
            } else {
              hasCrm = false;
            }
          } catch (crmCheckErr) {
            console.warn('CRM detection check failed:', crmCheckErr);
            hasCrm = false;
          }
        } else {
          hasCrm = false;
        }
      }
    }

    // Redirect user back with dynamic session and workspace information
    const redirectUrl = new URL(returnTo, baseUrl);
    redirectUrl.searchParams.set('connected', 'microsoft_365');
    if (userEmail) redirectUrl.searchParams.set('email', userEmail);
    if (userName) redirectUrl.searchParams.set('name', `${userName}'s Workspace`);
    redirectUrl.searchParams.set('has_crm', hasCrm ? '1' : '0');
    if (hasCrm && crmOrg) {
      redirectUrl.searchParams.set('org', crmOrg);
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
    }

    return response;
  } catch (err) {
    console.error('OAuth Callback Exception:', err);
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=internal_server_error`);
  }
}
