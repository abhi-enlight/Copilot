import { NextResponse } from "next/server";

/**
 * Microsoft 365 Multi-Tenant OAuth Authorization Initiator
 *
 * Redirects the user to Microsoft's universal multi-tenant OAuth endpoint.
 * Presets now include WRITE scopes (Mail.Send / Mail.ReadWrite /
 * Files.ReadWrite) so approved copilot actions can create mail and documents, * Dataverse writes are governed by the user's CRM security role
 * (user_impersonation), which the entitlement probe verifies.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenant') || 'personal';
  const returnTo = searchParams.get('returnTo') || '/';

  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '9b9717eb-8dbf-41b1-b788-d7a3ae6f4269';
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const REDIRECT_URI = process.env.AZURE_REDIRECT_URI || `${protocol}://${host}/api/integrations/microsoft/callback`;

  const preset = searchParams.get('preset') || 'standard';
  const customScopes = searchParams.get('scopes');

  const DYNAMICS_CRM_ORG_URL = process.env.DYNAMICS_CRM_ORG_URL || '';
  const crmScope = DYNAMICS_CRM_ORG_URL
    ? `${DYNAMICS_CRM_ORG_URL.replace(/\/$/, '')}/user_impersonation`
    : 'https://admin.services.crm.dynamics.com/user_impersonation';

  const mode = searchParams.get('mode') || 'standard';
  const isAdminConsent = searchParams.get('admin_consent') === '1' || preset === 'admin_consent';

  if (isAdminConsent) {
    const adminUrl = new URL('https://login.microsoftonline.com/common/adminconsent');
    adminUrl.searchParams.set('client_id', AZURE_CLIENT_ID);
    adminUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    adminUrl.searchParams.set('state', Buffer.from(JSON.stringify({ tenantId, returnTo, preset: 'admin_consent' })).toString('base64'));
    return NextResponse.redirect(adminUrl.toString());
  }

  // Base scopes allowed for all standard users without IT admin approval
  const baseScopes = ['offline_access', 'openid', 'profile', 'User.Read'];

  let selectedScopes: string[];

  if (customScopes) {
    selectedScopes = [...baseScopes, ...customScopes.split(' ')];
  } else {
    switch (preset) {
      case 'minimal':
      case 'mail_readonly':
        // Personal mail read-only, standard delegated scope with zero admin approval required
        selectedScopes = [...baseScopes, 'Mail.Read'];
        break;
      case 'files_readonly':
        // Personal OneDrive read-only, zero admin approval required
        selectedScopes = [...baseScopes, 'Files.Read'];
        break;
      case 'readonly':
      case 'personal_readonly':
        // Safe read-only bundle for personal mail & drive
        selectedScopes = [...baseScopes, 'Mail.Read', 'Files.Read'];
        break;
      case 'mail':
        // If mode === 'write', request write/send; otherwise default to safe Mail.Read
        selectedScopes = mode === 'write'
          ? [...baseScopes, 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send']
          : [...baseScopes, 'Mail.Read'];
        break;
      case 'personal_files':
      case 'standard':
      default:
        // If mode === 'write', request write; otherwise default to safe Files.Read & Mail.Read
        selectedScopes = mode === 'write'
          ? [...baseScopes, 'Mail.Read', 'Files.Read', 'Files.ReadWrite']
          : [...baseScopes, 'Mail.Read', 'Files.Read'];
        break;
      case 'org_sharepoint':
        // Org-wide SharePoint read + write (requires IT Admin Consent)
        selectedScopes = [...baseScopes, 'Mail.Read', 'Files.Read', 'Files.ReadWrite', 'Sites.Read.All', 'Sites.ReadWrite.All'];
        break;
      case 'dynamics_crm':
        // Dataverse Dynamics CRM (requires Dynamics 365 license + CRM role)
        selectedScopes = [...baseScopes, crmScope];
        break;
      case 'full':
        // Full enterprise suite, read + write
        selectedScopes = [...baseScopes, 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send', 'Files.Read', 'Files.ReadWrite', 'Sites.Read.All', 'Sites.ReadWrite.All', crmScope];
        break;
    }
  }

  const scopes = Array.from(new Set(selectedScopes)).join(' ');
  const statePayload = Buffer.from(JSON.stringify({ tenantId, returnTo, preset })).toString('base64');

  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.searchParams.set('client_id', AZURE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', statePayload);
  authUrl.searchParams.set('prompt', 'select_account');

  return NextResponse.redirect(authUrl.toString());
}
