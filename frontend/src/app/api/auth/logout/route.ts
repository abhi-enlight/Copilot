import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { clearSessionCacheForUser } from '@/lib/composio/session';

/**
 * POST /api/auth/logout
 * Signs out of Supabase + clears legacy MS/Zoho cookies.
 */
export async function POST() {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      clearSessionCacheForUser(user.id);
    }
  } catch {}

  await supabase.auth.signOut();

  const response = NextResponse.json({
    success: true,
    message: 'Logged out',
    timestamp: new Date().toISOString(),
  });

  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token',
    'auth_token',
    'session_token',
    'tenant_session',
    'x-tenant-slug',
    'ms_access_token',
    'ms_refresh_token',
    'ms_token_expires_at',
    'ms_user_email',
    'ms_user_name',
    'ms_granted_scopes',
    'ms_has_crm',
    'ms_crm_probed_at',
    'zoho_user_email',
    'zoho_oauth_state',
  ];

  cookiesToClear.forEach((name) => {
    response.cookies.set({ name, value: '', path: '/', maxAge: 0, expires: new Date(0) });
  });

  return response;
}

/**
 * GET /api/auth/logout — browser redirect logout
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      clearSessionCacheForUser(user.id);
    }
  } catch {}

  await supabase.auth.signOut();

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const safeBase = configuredAppUrl || new URL(request.url).origin;
  const redirectUrl = new URL('/auth/login', safeBase);

  const response = NextResponse.redirect(redirectUrl);

  const cookiesToClear = [
    'sb-access-token', 'sb-refresh-token', 'ms_access_token',
    'ms_refresh_token', 'ms_token_expires_at', 'ms_user_email',
    'ms_user_name', 'ms_granted_scopes', 'ms_has_crm',
    'ms_crm_probed_at', 'zoho_user_email', 'zoho_oauth_state',
  ];

  cookiesToClear.forEach((name) => {
    response.cookies.set({ name, value: '', path: '/', maxAge: 0, expires: new Date(0) });
  });

  return response;
}
