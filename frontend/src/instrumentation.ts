/**
 * Next.js Instrumentation Hook
 *
 * `register()` runs once per server instance before it serves requests, the
 * supported way to start in-process background work in Next.js.
 *
 * Here it starts the background token-refresh loop that keeps per-user Zoho
 * vault tokens valid without the user reconnecting (lib/token-refresher.ts).
 *
 * Runtime notes:
 *  - Only schedules on the Node.js runtime (skip on Edge).
 *  - Never schedules during `next build` (NEXT_PHASE === 'phase-production-build').
 *  - Disabled with TOKEN_REFRESH_ENABLED=false; interval via
 *    TOKEN_REFRESH_INTERVAL_MS (default 15 min, min 60 s).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  try {
    const { startTokenRefreshInterval } = await import("./lib/token-refresher");
    startTokenRefreshInterval();
  } catch (err: unknown) {
    // Never block server startup on the refresher.
    console.error("[instrumentation] token refresher failed to start:", (err as Error)?.message);
  }
}
