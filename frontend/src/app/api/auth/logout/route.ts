import { NextResponse } from 'next/server';

/**
 * Authentication Logout API Route
 * 
 * Clears session cookies, tokens, and redirects or returns success response.
 */
export async function POST(request: Request) {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
    timestamp: new Date().toISOString()
  });

  // Clear common authentication cookies
  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token',
    'auth_token',
    'session_token',
    'tenant_session',
    'x-tenant-slug'
  ];

  cookiesToClear.forEach((cookieName) => {
    response.cookies.set({
      name: cookieName,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  });

  return response;
}

export async function GET(request: Request) {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUrl = new URL('/', `${protocol}://${host}`);
  redirectUrl.searchParams.set('auth', 'logged_out');

  const response = NextResponse.redirect(redirectUrl.toString());

  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token',
    'auth_token',
    'session_token',
    'tenant_session',
    'x-tenant-slug'
  ];

  cookiesToClear.forEach((cookieName) => {
    response.cookies.set({
      name: cookieName,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  });

  return response;
}
