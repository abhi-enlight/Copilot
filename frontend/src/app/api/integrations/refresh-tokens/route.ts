import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveAppUser } from "@/lib/entitlements";
import { runTokenRefreshCycle, tokenRefresherState } from "@/lib/token-refresher";

export const dynamic = "force-dynamic";

/**
 * Manual / cron trigger for the background token refresh job.
 *
 * The refresh loop also runs inside the server via src/instrumentation.ts;
 * this endpoint exists for deployments where the server sleeps (e.g. serverless
 * or a nightly restart) or for on-demand runs after operations changes.
 *
 * Authorization (any one of):
 *   - `x-refresh-secret` header matching TOKEN_REFRESH_SECRET
 *   - an authenticated session with an owner/admin app role
 *
 * GET  → scheduler introspection (no side effects)
 * POST → run one refresh cycle now
 */

/** Header extraction (the secret never touches session code). */
function getHeaderSecret(request: Request): string | null {
  return request.headers.get("x-refresh-secret");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET() {
  return NextResponse.json({
    scheduler: tokenRefresherState(),
    intervalConfigured: Boolean(process.env.TOKEN_REFRESH_INTERVAL_MS),
    secretConfigured: Boolean(process.env.TOKEN_REFRESH_SECRET),
  });
}

export async function POST(request: Request) {
  const secret = process.env.TOKEN_REFRESH_SECRET || "";
  const provided = getHeaderSecret(request);
  const secretOk = Boolean(secret && provided && timingSafeEqual(secret, provided));

  if (!secretOk) {
    // Fall back to session-based authorization.
    const cookieStore = await cookies();
    const email = cookieStore.get("ms_user_email")?.value || null;
    if (!email) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const user = await resolveAppUser(email);
    const elevated = user?.role === "owner" || user?.role === "admin";
    if (!elevated) {
      return NextResponse.json({ error: "forbidden", detail: "Requires owner/admin role or TOKEN_REFRESH_SECRET" }, { status: 403 });
    }
  }

  const result = await runTokenRefreshCycle();
  return NextResponse.json({ success: true, ...result });
}
