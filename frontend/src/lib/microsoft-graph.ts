/**
 * Microsoft Graph API Integration Helper
 * Provides authenticated queries to Microsoft Graph endpoints for the currently
 * authenticated user, with automatic token refresh support.
 *
 * All Graph calls go through `resilientFetch` (per-tenant rate limiting +
 * circuit breaker, plan edge cases #4/#5). Timeout errors and 429/503 storms
 * trip the breaker; callers degrade gracefully instead of hanging.
 */

import { resilientFetch } from "@/lib/resilience";

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
  const clientId = process.env.AZURE_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = process.env.AZURE_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || '';

  if (!clientId || !clientSecret || !refreshToken) {
    return { accessToken: null, error: 'Missing client ID, client secret, or refresh token' };
  }

  try {
    const bodyParams: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(bodyParams)
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
    const res = await resilientFetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="text"'
      },
      signal: AbortSignal.timeout(20000)
    }, {
      tenantKey: tenantKeyFromToken(accessToken),
      provider: 'microsoft-graph'
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('Microsoft Graph /me/messages error:', res.status, errData);
      return { emails: [], error: `Microsoft Graph API error (${res.status}): ${res.statusText}` };
    }

    const data = await res.json();
    return { emails: data.value || [] };
  } catch (err: unknown) {
    console.error('Failed to fetch user emails:', err);
    const message = circuitDegradedMessage(err);
    const errorDetail = err instanceof Error ? err.message : 'Failed to fetch emails';
    return { emails: [], error: message || errorDetail };
  }
}

/**
 * Converts resilience-layer errors into user-facing degradation copy
 * (plan §5.5: keep the app functional, state clearly which source failed).
 */
export function circuitDegradedMessage(err: unknown): string | null {
  const name = (err as Error)?.name;
  if (name === 'RateLimitExceededError') {
    return 'Microsoft Graph is rate-limited for this workspace; results may be incomplete. Try again shortly.';
  }
  if (name === 'CircuitOpenError') {
    return 'Microsoft Graph is temporarily unavailable (circuit breaker open); results reflect other connected sources.';
  }
  return null;
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
    const res = await resilientFetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(20000)
    }, {
      tenantKey: tenantKeyFromToken(accessToken),
      provider: 'microsoft-graph'
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('Microsoft Graph /me/drive error:', res.status, errData);
      return { items: [], error: `Microsoft Graph API error (${res.status}): ${res.statusText}` };
    }

    const data = await res.json();
    return { items: data.value || [] };
  } catch (err: unknown) {
    console.error('Failed to fetch drive items:', err);
    const message = circuitDegradedMessage(err);
    const errorDetail = err instanceof Error ? err.message : 'Failed to fetch drive files';
    return { items: [], error: message || errorDetail };
  }
}

/**
 * Attributes Graph calls to a stable per-tenant bucket. The access token's
 * unique subject hash is process-stable per user+tenant and avoids shipping
 * an extra identity lookup per call; callers with a real org id should pass
 * it via resilientFetch options directly.
 */
function tenantKeyFromToken(accessToken: string): string {
  let hash = 0;
  for (let i = 0; i < accessToken.length; i++) {
    hash = (hash * 31 + accessToken.charCodeAt(i)) | 0;
  }
  return `msgraph-${(hash >>> 0).toString(36)}`;
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
