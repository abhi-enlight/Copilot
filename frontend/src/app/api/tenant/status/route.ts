import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshMicrosoftToken } from '@/lib/microsoft-graph';
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
export async function GET() {
  try {
    const cookieStore = await cookies();
    let accessToken = cookieStore.get('ms_access_token')?.value || null;
    const refreshToken = cookieStore.get('ms_refresh_token')?.value || null;
    const expiresAtStr = cookieStore.get('ms_token_expires_at')?.value || null;
    const userEmail = cookieStore.get('ms_user_email')?.value || null;
    const userName = cookieStore.get('ms_user_name')?.value || null;

    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
    const now = Date.now();
    let isConnected = false;
    let newAccessToken: string | null = null;
    let newRefreshToken: string | null = null;
    let newExpiresIn = 3600;
    let isRefreshed = false;

    // Check if token exists and is valid, or attempt refresh
    if (accessToken && (expiresAt === 0 || now < expiresAt - 30000)) {
      isConnected = true;
    } else if (refreshToken) {
      const refreshed = await refreshMicrosoftToken(refreshToken);
      if (refreshed.accessToken) {
        accessToken = refreshed.accessToken;
        newAccessToken = refreshed.accessToken;
        newRefreshToken = refreshed.refreshToken || refreshToken;
        newExpiresIn = refreshed.expiresIn || 3600;
        isConnected = true;
        isRefreshed = true;
      } else {
        isConnected = false;
      }
    }

    // Entitlement snapshot: role-aware verdicts + real Zoho state
    const snapshot = await buildEntitlementSnapshot();
    const dynamics = snapshot.connectors['microsoft.dynamics'];
    const zohoCrm = snapshot.connectors['zoho.crm'];
    const zohoProjects = snapshot.connectors['zoho.projects'];
    const zohoBooks = snapshot.connectors['zoho.books'];

    const session = await readMicrosoftSession();
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

    const response = NextResponse.json(statusData);

    // If token refreshed, update cookies
    if (isRefreshed && newAccessToken) {
      const isProd = process.env.NODE_ENV === 'production';
      response.cookies.set('ms_access_token', newAccessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: newExpiresIn
      });

      if (newRefreshToken) {
        response.cookies.set('ms_refresh_token', newRefreshToken, {
          httpOnly: true,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30
        });
      }

      const expiresAtMs = Date.now() + (newExpiresIn * 1000);
      response.cookies.set('ms_token_expires_at', expiresAtMs.toString(), {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30
      });
    }

    return response;
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
