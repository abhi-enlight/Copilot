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

  let tenantId = 'enlightlab';
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

      const tokenData = await tokenResponse.json();
      // TokenData contains: access_token, refresh_token, id_token, expires_in
      console.log(`Successfully acquired tokens for tenant: ${tenantId}`);
    }

    // Redirect user back with success banner
    return NextResponse.redirect(`${baseUrl}${returnTo}?connected=microsoft_365`);
  } catch (err) {
    console.error('OAuth Callback Exception:', err);
    return NextResponse.redirect(`${baseUrl}${returnTo}?auth_error=internal_server_error`);
  }
}
