import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshMicrosoftToken } from '@/lib/microsoft-graph';

/**
 * Live Tenant Session & Endpoint Status API
 * 
 * Inspects server-side session cookies to return the verified connection
 * status for Microsoft 365, SharePoint/OneDrive, and Dynamics CRM.
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

    const isPersonal = userEmail ? /@(outlook|hotmail|live|msn|gmail|yahoo)\.com$/i.test(userEmail) : false;

    const statusData = {
      authenticated: isConnected,
      m365Connected: isConnected,
      outlookConnected: isConnected && Boolean(userEmail),
      sharepointConnected: isConnected,
      crmConnected: false, // CRM requires separate Dataverse connection
      userEmail: isConnected ? userEmail : null,
      userName: isConnected ? userName : null,
      sharepointDrive: isConnected ? (isPersonal ? 'OneDrive (/me/drive)' : '/sites/root/drive') : null,
      dynamicsOrg: null,
      timestamp: new Date().toISOString()
    };

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
      userEmail: null,
      userName: null,
      sharepointDrive: null,
      dynamicsOrg: null,
      error: err.message
    });
  }
}
