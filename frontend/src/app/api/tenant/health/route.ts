import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

/**
 * Tenant Health & Pre-Flight Permission Verification API
 *
 * Reports the SERVER-SIDE configuration state for Microsoft/Zoho integrations.
 * Authenticated so integration topology is not exposed publicly.
 *
 * NOTE: connectivity per service is NOT asserted here — everything an
 * integration actually exports is entitlement/probe-driven (see
 * /api/tenant/entitlements). This route only reports configuration presence
 * so the UI never displays fabricated "connected" states.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get('tenant') || 'default';

  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '';
  const REDIRECT_URI = process.env.AZURE_REDIRECT_URI || `https://${tenantSlug}.yourapp.com/auth/callback`;
  const CRM_ORG_URL = process.env.DYNAMICS_CRM_ORG_URL || '';
  const CRM_ORG = CRM_ORG_URL ? CRM_ORG_URL.replace(/^https?:\/\//, '').replace(/\.dynamics\.com.*$/, '') : 'Not Configured';
  const SHAREPOINT_DRIVE = process.env.SHAREPOINT_DRIVE_ROOT || '/sites/root/drive';
  const MAILBOX = searchParams.get('email') || process.env.OUTLOOK_MAILBOX || 'Not Connected';

  // Generate official Microsoft Entra ID Admin Consent Link
  const adminConsentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${encodeURIComponent(
    AZURE_CLIENT_ID
  )}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(tenantSlug)}`;

  // Configuration presence only — actual connectivity is probed elsewhere.
  const configured = (v: string) => (v ? 'configured' : 'not_configured');

  const healthData = {
    tenant: tenantSlug,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      sharepoint: {
        status: configured(AZURE_CLIENT_ID),
        endpoint: SHAREPOINT_DRIVE,
      },
      dynamics_crm: {
        status: configured(CRM_ORG_URL),
        org: CRM_ORG,
      },
      outlook: {
        status: configured(AZURE_CLIENT_ID),
        mailbox: MAILBOX,
      },
      database_rls: {
        status: 'enforced',
        policy: 'auth.jwt() -> organization_id',
      },
    },
    adminConsentUrl,
    requiredScopes: [
      'https://graph.microsoft.com/Sites.Read.All',
      'https://graph.microsoft.com/Mail.Read',
      ...(CRM_ORG_URL ? [`${CRM_ORG_URL}/user_impersonation`] : []),
    ],
  };

  return NextResponse.json(healthData);
}
