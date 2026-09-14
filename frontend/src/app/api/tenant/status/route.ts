import { NextResponse } from 'next/server';
import { refreshMicrosoftToken } from '@/lib/microsoft-graph';
import { requireAuth } from '@/lib/auth-helpers';
import {
  buildEntitlementSnapshot,
  readMicrosoftSession,
  isM365SessionValid,
} from '@/lib/entitlements';

/**
 * Live Tenant Session & Endpoint Status API
 *
 * Returns the verified connection status for Microsoft 365 and Zoho from the
 * shared entitlements engine:
 *  - crmConnected reflects a REAL probe (license + Dataverse WhoAmI) or an
 *    Admin/Owner role override, never a hardcoded true.
 *  - zohoConnected reflects the user's own per-user Zoho connections (or the
 *    legacy org-shared fallback when ZOHO_ORG_SHARED=true), never a hardcoded true.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Read session strictly from the per-user vault
    const session = await readMicrosoftSession();
    const isConnected = Boolean(session.accessToken);
    const userEmail = session.userEmail;
    const userName = session.userName;

    // Entitlement snapshot: role-aware verdicts + real Zoho state
    const snapshot = await buildEntitlementSnapshot();
    const dynamics = snapshot.connectors['microsoft.dynamics'];
    const zohoCrm = snapshot.connectors['zoho.crm'];
    const zohoProjects = snapshot.connectors['zoho.projects'];
    const zohoBooks = snapshot.connectors['zoho.books'];

    const sessionValid = isM365SessionValid(session) || isConnected;

    const hasMailScope = session.grantedScopes.length === 0 || session.grantedScopes.some((s) => /mail\.read/i.test(s));
    const hasFilesScope = session.grantedScopes.length === 0 || session.grantedScopes.some((s) => /files\.read/i.test(s));
    const hasSitesScope = session.grantedScopes.some((s) => /sites\.read/i.test(s));

    const isPersonal = userEmail ? /@(outlook|hotmail|live|msn|gmail|yahoo)\.com$/i.test(userEmail) : false;

    const statusData = {
      authenticated: isConnected,
      m365Connected: isConnected,
      outlookConnected: isConnected && Boolean(userEmail) && hasMailScope,
      onedriveConnected: isConnected && hasFilesScope,
      sharepointConnected: isConnected && (hasSitesScope || (!isPersonal && isConnected)),
      // Entitlement-aware: probe pass OR elevated app role, no more spoofing
      crmConnected: isConnected && dynamics.access === 'granted',
      crmAccess: dynamics.access,
      crmReason: dynamics.reason,
      crmViaRoleOverride: dynamics.viaRoleOverride,
      // Real Zoho state (per-user connections)
      zohoConnected: Boolean(snapshot.zoho.crm.connected || snapshot.zoho.projects.connected || snapshot.zoho.books.connected),
      zoho: {
        crm: { connected: Boolean(snapshot.zoho.crm.connected), access: zohoCrm.access, reason: zohoCrm.reason, orgIds: snapshot.zoho.crm.orgIds },
        projects: { connected: Boolean(snapshot.zoho.projects.connected), access: zohoProjects.access, reason: zohoProjects.reason, orgIds: snapshot.zoho.projects.orgIds },
        books: { connected: Boolean(snapshot.zoho.books.connected), access: zohoBooks.access, reason: zohoBooks.reason, orgIds: snapshot.zoho.books.orgIds },
      },
      role: snapshot.role,
      userEmail: isConnected ? userEmail : null,
      userName: isConnected ? userName : null,
      sharepointDrive: isConnected ? (isPersonal ? 'OneDrive (/me/drive)' : (hasSitesScope ? '/sites/root/drive' : 'OneDrive (/me/drive)')) : null,
      dynamicsOrg: isConnected && dynamics.access === 'granted' ? (process.env.DYNAMICS_CRM_ORG_URL || 'Dataverse Active') : null,
      grantedScopes: session.grantedScopes,
      timestamp: new Date().toISOString()
    };

    void sessionValid;

    return NextResponse.json(statusData);
  } catch (err: any) {
    console.error('Status API Error:', err);
    return NextResponse.json({
      authenticated: false,
      m365Connected: false,
      outlookConnected: false,
      sharepointConnected: false,
      crmConnected: false,
      zohoConnected: false,
      userEmail: null,
      userName: null,
      sharepointDrive: null,
      dynamicsOrg: null,
      error: err.message
    });
  }
}
