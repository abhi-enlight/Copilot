/**
 * Microsoft Graph API Integration Helper
 * 
 * Provides authenticated queries to Microsoft Graph endpoints for the currently
 * authenticated user, with automatic token refresh support.
 */

export interface MicrosoftEmail {
  id: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  webLink?: string;
}

export interface MicrosoftDriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  lastModifiedDateTime?: string;
  file?: {
    mimeType?: string;
  };
  folder?: {
    childCount?: number;
  };
}

export interface TokenRefreshResult {
  accessToken: string | null;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

/**
 * Refreshes an expired Microsoft OAuth access token using the refresh token.
 */
export async function refreshMicrosoftToken(refreshToken: string): Promise<TokenRefreshResult> {
  const clientId = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '9b9717eb-8dbf-41b1-b788-d7a3ae6f4269';
  const clientSecret = process.env.AZURE_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || '';

  if (!clientSecret || !refreshToken) {
    return { accessToken: null, error: 'Missing client secret or refresh token' };
  }

  try {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'offline_access openid profile User.Read Mail.Read Sites.Read.All Files.Read.All'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Token refresh failed:', errText);
      return { accessToken: null, error: 'Token refresh rejected by Microsoft' };
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in
    };
  } catch (err: any) {
    console.error('Exception during Microsoft token refresh:', err);
    return { accessToken: null, error: err.message || 'Token refresh error' };
  }
}

/**
 * Fetches recent emails for the authenticated user from Microsoft Graph.
 */
export async function fetchUserEmails(
  accessToken: string,
  limit: number = 10
): Promise<{ emails: MicrosoftEmail[]; error?: string }> {
  try {
    const url = `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=id,from,subject,bodyPreview,receivedDateTime,hasAttachments,isRead,webLink`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="text"'
      }
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('Microsoft Graph /me/messages error:', res.status, errData);
      return { emails: [], error: `Microsoft Graph API error (${res.status}): ${res.statusText}` };
    }

    const data = await res.json();
    return { emails: data.value || [] };
  } catch (err: any) {
    console.error('Failed to fetch user emails:', err);
    return { emails: [], error: err.message || 'Failed to fetch emails' };
  }
}

/**
 * Fetches OneDrive root children / files for the authenticated user.
 */
export async function fetchUserDriveFiles(
  accessToken: string,
  limit: number = 15
): Promise<{ items: MicrosoftDriveItem[]; error?: string }> {
  try {
    const url = `https://graph.microsoft.com/v1.0/me/drive/root/children?$top=${limit}&$select=id,name,size,webUrl,lastModifiedDateTime,file,folder`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('Microsoft Graph /me/drive error:', res.status, errData);
      return { items: [], error: `Microsoft Graph API error (${res.status}): ${res.statusText}` };
    }

    const data = await res.json();
    return { items: data.value || [] };
  } catch (err: any) {
    console.error('Failed to fetch drive items:', err);
    return { items: [], error: err.message || 'Failed to fetch drive files' };
  }
}

/**
 * Fetches profile info for the authenticated user.
 */
export async function fetchUserProfile(
  accessToken: string
): Promise<{ profile: any; error?: string }> {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      return { profile: null, error: `Profile fetch error: ${res.status}` };
    }

    const profile = await res.json();
    return { profile };
  } catch (err: any) {
    return { profile: null, error: err.message };
  }
}
