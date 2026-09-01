import { NextResponse } from 'next/server';

/**
 * Microsoft 365 Multi-Tenant OAuth Authorization Initiator
 * 
 * Redirects the user to Microsoft's universal multi-tenant OAuth endpoint.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenant') || 'enlightlab';
  const returnTo = searchParams.get('returnTo') || '/';

  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || 'b57c7fae-47d2-4b5c-88b4-8ce306efd4fa';
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const REDIRECT_URI = `${protocol}://${host}/api/integrations/microsoft/callback`;

  // Required scopes for Microsoft Graph & offline refresh tokens
  const scopes = [
    'offline_access',
    'openid',
    'profile',
    'User.Read',
    'Mail.Read',
    'Sites.Read.All',
    'Files.Read.All'
  ].join(' ');

  const statePayload = Buffer.from(JSON.stringify({ tenantId, returnTo })).toString('base64');

  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.searchParams.set('client_id', AZURE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', statePayload);
  authUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(authUrl.toString());
}
