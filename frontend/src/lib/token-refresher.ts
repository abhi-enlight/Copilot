/**
 * Background Token Refresher, keeps per-user Zoho vault tokens valid.
 *
 * Runs on an interval inside the Next.js server via `register()` in
 * src/instrumentation.ts, and can also be triggered on demand via
 * POST /api/integrations/refresh-tokens (secret header or admin session) for
 * cron-style deployments where the server sleeps.
 *
 * For every vault row whose access token is expired or expiring within the
 * freshness margin (TOKEN_FRESHNESS_MARGIN_MS), the refresh token is exchanged
 * for a new access token and persisted. A rejected refresh token marks the
 * row `reauth_required` so the UI prompts the user to reconnect, users are
 * never silently logged out of the integration without a signal.
 */

import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";
import {
  TOKEN_FRESHNESS_MARGIN_MS,
  UNKNOWN_EXPIRY_STALENESS_MS,
  getVaultTokensNeedingRefresh,
  persistZohoTokenRefresh,
  refreshZohoToken,
  type ZohoProduct,
} from "@/lib/zoho";

export interface RefreshCycleResult {
  checked: number;
  refreshed: number;
  failed: number;
  reauthRequired: number;
  skippedNoRefreshToken: number;
  durationMs: number;
}

/** Minimum spacing between two automatic cycles for the same row (guards overlapping intervals). */
const PER_ROW_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

let cycleRunning = false;

/**
 * Runs one refresh cycle over the whole vault. Safe to call concurrently, * overlapping invocations collapse into a no-op (the in-flight cycle wins).
 */
export async function runTokenRefreshCycle(opts?: { maxRows?: number }): Promise<RefreshCycleResult> {
  const startedAt = Date.now();
  const result: RefreshCycleResult = {
    checked: 0,
    refreshed: 0,
    failed: 0,
    reauthRequired: 0,
    skippedNoRefreshToken: 0,
    durationMs: 0,
  };

  if (cycleRunning) {
    result.durationMs = Date.now() - startedAt;
    return result;
  }
  cycleRunning = true;
  const cycleId = randomUUID();
  try {
    // Two populations are eligible:
    //  - rows inside the freshness window (or already expired)
    //  - legacy rows without a stored expiry that are older than the staleness threshold
    const due = await getVaultTokensNeedingRefresh({ maxRows: opts?.maxRows ?? 200 });
    result.checked = due.length;

    // Sequential on purpose: token endpoints rate-limit bursts, and the vault
    // is small. Swap to a bounded pool if the user count grows large.
    for (const entry of due) {
      // Re-check status: another cycle (or an on-demand call) may have just
      // refreshed this row; skip rows touched within the retry cooldown.
      if (await rowRecentlyTouched(entry.userEmail, entry.product)) continue;

      if (!entry.refreshToken) {
        result.skippedNoRefreshToken++;
        continue;
      }

      const outcome = await refreshOne(entry.userEmail, entry.product, entry.refreshToken, cycleId);
      if (outcome === "refreshed") result.refreshed++;
      else if (outcome === "reauth_required") result.reauthRequired++;
      else result.failed++;
    }
  } finally {
    cycleRunning = false;
    result.durationMs = Date.now() - startedAt;
  }
  return result;
}

type RefreshOutcome = "refreshed" | "reauth_required" | "failed";

async function refreshOne(
  userEmail: string,
  product: ZohoProduct,
  refreshToken: string,
  cycleId: string
): Promise<RefreshOutcome> {
  const refreshed = await refreshZohoToken(refreshToken);
  if (!refreshed.accessToken) {
    const error = refreshed.error || "refresh_failed";
    // Invalid/expired/revoked refresh tokens can never succeed again, the
    // user must reconnect. Anything else (network, 5xx) stays `active` so the
    // next cycle retries instead of forcing a reconnect.
    const permanent = /invalid|expired|revoked|no_refresh/i.test(error) || refreshed.error === "access_denied";
    if (permanent) {
      await markReauthRequired(userEmail, product, error, cycleId);
      return "reauth_required";
    }
    await markError(userEmail, product, error, cycleId);
    return "failed";
  }

  // persistZohoTokenRefresh stores the new token + expiry and clears error
  // state. The token was exchanged exactly once above, no second round-trip.
  const persisted = await persistZohoTokenRefresh(userEmail, product, refreshed);
  if (!persisted.ok) {
    await markError(userEmail, product, persisted.error || "persist_failed", cycleId);
    return "failed";
  }
  return "refreshed";
}

async function rowRecentlyTouched(userEmail: string, product: ZohoProduct): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase
      .from("user_integrations")
      .select("updated_at")
      .eq("user_email", userEmail)
      .eq("provider", "zoho")
      .eq("product", product)
      .maybeSingle();
    if (!data?.updated_at) return false;
    return Date.now() - new Date(data.updated_at).getTime() < PER_ROW_RETRY_COOLDOWN_MS;
  } catch {
    return false; // on failure, prefer refreshing over skipping
  }
}

async function markReauthRequired(userEmail: string, product: ZohoProduct, error: string, cycleId: string): Promise<void> {
  try {
    await supabase
      .from("user_integrations")
      .update({ status: "reauth_required", last_error_message: error, updated_at: new Date().toISOString() })
      .eq("user_email", userEmail)
      .eq("provider", "zoho")
      .eq("product", product);
  } catch (err: unknown) {
    console.error("[token-refresher] Failed to mark reauth_required:", (err as Error)?.message);
  }
  await audit("token_refresh", "refused", userEmail, product, error, cycleId);
}

async function markError(userEmail: string, product: ZohoProduct, error: string, cycleId: string): Promise<void> {
  try {
    await supabase
      .from("user_integrations")
      .update({ last_error_message: error, updated_at: new Date().toISOString() })
      .eq("user_email", userEmail)
      .eq("provider", "zoho")
      .eq("product", product);
  } catch (err: unknown) {
    console.error("[token-refresher] Failed to record refresh error:", (err as Error)?.message);
  }
  await audit("token_refresh", "failure", userEmail, product, error, cycleId);
}

// ---------------------------------------------------------------------------
// Audit trail, refresh outcomes land in agent_audit_logs alongside the other
// write actions, so admins can see exactly when/why a connection lapsed.
// ---------------------------------------------------------------------------

async function audit(
  action: string,
  outcome: "success" | "failure" | "refused",
  userEmail: string,
  product: ZohoProduct,
  error: string | null,
  cycleId: string
): Promise<void> {
  try {
    await supabase.from("agent_audit_logs").insert({
      actor_email: userEmail,
      action,
      target_type: "integration",
      target_id: `zoho:${product}`,
      outcome,
      payload_summary: { error, freshness_margin_ms: TOKEN_FRESHNESS_MARGIN_MS },
      metadata: { source: "background_token_refresher", cycle_id: cycleId },
    });
  } catch {
    // Audit is best-effort; never break the refresher over it.
  }
}

// ---------------------------------------------------------------------------
// Interval scheduler (wired from src/instrumentation.ts)
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
const MIN_INTERVAL_MS = 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Starts the background refresh loop. Idempotent, a second call is a no-op. */
export function startTokenRefreshInterval(): void {
  const intervalMs = Math.max(
    MIN_INTERVAL_MS,
    parseInt(process.env.TOKEN_REFRESH_INTERVAL_MS || "", 10) || DEFAULT_INTERVAL_MS
  );
  if (process.env.TOKEN_REFRESH_ENABLED === "false") {
    console.log("[token-refresher] Disabled via TOKEN_REFRESH_ENABLED=false");
    return;
  }
  if (intervalHandle) return;

  console.log(`[token-refresher] Scheduling refresh cycle every ${Math.round(intervalMs / 60000)} min`);
  intervalHandle = setInterval(() => {
    void runTokenRefreshCycle()
      .then((r) => {
        if (r.checked > 0) {
          console.log(
            `[token-refresher] cycle: checked=${r.checked} refreshed=${r.refreshed} reauth=${r.reauthRequired} failed=${r.failed} in ${r.durationMs}ms`
          );
        }
      })
      .catch((err: unknown) => console.error("[token-refresher] cycle crashed:", (err as Error)?.message));
    // Never keep the process alive just for the timer.
    (intervalHandle as unknown as { unref?: () => void })?.unref?.();
  }, intervalMs);
}

export function stopTokenRefreshInterval(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/** Introspection for the status endpoint / debugging. */
export function tokenRefresherState(): { scheduled: boolean; marginMs: number; stalenessMs: number } {
  return {
    scheduled: intervalHandle !== null,
    marginMs: TOKEN_FRESHNESS_MARGIN_MS,
    stalenessMs: UNKNOWN_EXPIRY_STALENESS_MS,
  };
}
