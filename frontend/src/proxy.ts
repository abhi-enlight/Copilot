import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 Multi-Tenant Host & Subdomain Proxy
 * 
 * Intercepts incoming requests, determines tenant context from host/subdomain,
 * and attaches tenant headers for downstream Server Components and API Routes.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Exclude static assets, api routes, and Next.js internal files
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Define base app domains
  const appDomains = [
    'localhost:3000',
    'localhost',
    'app.yourapp.com',
    'yourapp.com'
  ];

  // Check if current request is from a tenant subdomain or custom domain
  const isAppDomain = appDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  
  let tenantSlug: string | null = null;

  if (isAppDomain) {
    // Extract subdomain (e.g., "acme-global" from "acme-global.localhost:3000")
    const parts = hostname.split('.');
    if (parts.length > 1 && !appDomains.includes(hostname)) {
      tenantSlug = parts[0];
    }
  } else {
    // Custom domain support (e.g., "ops.acmecorp.com")
    tenantSlug = hostname.replace(/[^a-zA-Z0-9-]/g, '-');
  }

  // Clone headers and inject tenant metadata
  const requestHeaders = new Headers(request.headers);
  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }
  requestHeaders.set('x-current-host', hostname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
