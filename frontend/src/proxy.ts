import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy — Auth & Multi-Tenant Session Handling
 *
 * 1. Validates and refreshes Supabase session from cookies.
 * 2. Redirects unauthenticated users to /auth/login for protected pages.
 * 3. Returns 401 for unauthenticated protected API routes.
 * 4. Extracts tenant context from subdomain / custom domain.
 * 5. Injects auth & tenant headers for downstream Server Components & API routes.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // 1. Supabase Auth session refresh & validation
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let authUser = user;
  if (!authUser) {
    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      try {
        const { data: tokenAuth } = await supabase.auth.getUser(token);
        if (tokenAuth?.user) {
          authUser = tokenAuth.user;
        }
      } catch {
        // Invalid or expired bearer token
      }
    }
  }

  const { pathname } = request.nextUrl;

  // Public paths that do not require an active Supabase session
  const isPublicPath =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/integrations") || // OAuth callbacks provide their own tokens/state
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname === "/public";

  // If not authenticated and hitting a protected route:
  if (!authUser && !isPublicPath) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "not_authenticated", detail: "Valid Supabase session required" },
        { status: 401 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Tenant subdomain / custom domain extraction
  const hostname = request.headers.get("host") || "";
  const appDomains = [
    "localhost:3000",
    "localhost",
    "app.yourapp.com",
    "yourapp.com",
  ];
  const isAppDomain = appDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  let tenantSlug: string | null = null;

  if (isAppDomain) {
    const parts = hostname.split(".");
    if (parts.length > 1 && !appDomains.includes(hostname)) {
      tenantSlug = parts[0];
    }
  } else if (hostname) {
    tenantSlug = hostname.replace(/[^a-zA-Z0-9-]/g, "-");
  }

  // 3. Inject headers into request headers for downstream handlers
  const requestHeaders = new Headers(request.headers);
  if (authUser) {
    requestHeaders.set("x-supabase-user-id", authUser.id);
    requestHeaders.set("x-supabase-user-email", authUser.email ?? "");
  }
  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
  }
  requestHeaders.set("x-current-host", hostname);

  const downstreamResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Preserve any cookies set by Supabase Auth refresh
  response.cookies.getAll().forEach((cookie) => {
    downstreamResponse.cookies.set(cookie.name, cookie.value);
  });

  return downstreamResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icon.svg, public files
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
