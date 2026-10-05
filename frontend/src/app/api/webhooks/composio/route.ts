import { NextResponse } from "next/server";
import { getComposioClient } from "@/lib/composio/session";
import { adminSupabase } from "@/lib/supabase-admin";
import {
  normalizeTelemetryEvent,
  type RawTelemetryEvent,
} from "@/lib/telemetry/normalizer";

export const dynamic = "force-dynamic";

// Only UUID-shaped identifiers may be used to resolve users; anything else is
// rejected before it can reach a PostgREST filter string.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Health check & diagnostic endpoint for Composio Webhook Gateway.
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "prism_live_telemetry_webhook_gateway",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Inbound Webhook Gateway for Prism V2 Live Stack Telemetry.
 *
 * 1. Cryptographic HMAC-SHA256 signature verification via Composio Triggers SDK.
 * 2. Replay attack defense with 300-second timestamp tolerance window.
 * 3. Normalizes disparate platform events (Outlook, Teams, Slack, GitHub, Gmail, Linear, Zoho) into canonical form.
 * 4. Resolves authenticated Supabase auth.users UUID and organization context.
 * 5. Idempotent insertion into public.activity_events (handled by unique partial index idx_activity_events_dedup).
 * 6. Broadcasts via Supabase Realtime to all active Live Stack Radars.
 */
export async function POST(request: Request) {
  try {
    const verifySecret = (process.env.COMPOSIO_WEBHOOK_SECRET || "").trim();

    // Fail closed: without a configured secret nothing can be verified, so every
    // event is rejected instead of trusting the raw request body.
    if (verifySecret.length < 16) {
      console.error(
        "[Prism Webhook] COMPOSIO_WEBHOOK_SECRET is missing or too short; refusing all events."
      );
      return NextResponse.json(
        {
          error: "server_misconfigured",
          detail: "Webhook verification secret is not configured",
        },
        { status: 500 }
      );
    }

    let rawPayload: RawTelemetryEvent;

    // 1. Cryptographic Signature Verification — required, with no unsigned fallback.
    try {
      const composio = getComposioClient();
      const result = await composio.triggers.parse(request, {
        verifySecret,
        tolerance: 300, // Max 5 minutes age window
      });
      rawPayload = (result.payload || {}) as unknown as RawTelemetryEvent;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn("[Prism Webhook] Signature verification failed:", errorMessage);
      return NextResponse.json(
        { error: "unauthorized", detail: "Missing or invalid webhook signature" },
        { status: 401 }
      );
    }

    // 2. Normalize disparate event into canonical Prism telemetry model
    const normalized = normalizeTelemetryEvent(rawPayload);

    // Optional GitHub scope, configured per deployment via env instead of a
    // hardcoded tenant. When unset, nothing is silently dropped.
    if (normalized.source === "github") {
      const trackedRepos = (process.env.PRISM_TRACKED_GITHUB_REPOS || "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

      if (trackedRepos.length > 0) {
        const repoUrl = ((normalized.rawPayload?.repository_url as string) || "").toLowerCase();
        const authorLogin = ((normalized.rawPayload?.author_login as string) || "").toLowerCase();
        const isTracked = trackedRepos.some(
          (repo) => repoUrl.includes(repo) || authorLogin === repo
        );
        if (repoUrl && !isTracked) {
          return NextResponse.json(
            { status: "ignored", reason: "external_untracked_repo" },
            { status: 200 }
          );
        }
      }
    }

    // 3. User & Tenant Identity Resolution Gate
    let resolvedAuthUserId: string | null = null;
    let organizationId: string | null = null;

    let searchCandidate = normalized.userIdRaw;

    // Reject non-UUID identifiers before they are interpolated into `.or()`.
    if (searchCandidate && !UUID_PATTERN.test(searchCandidate)) {
      console.warn(`[Prism Webhook] Ignoring non-UUID user identifier: "${searchCandidate}"`);
      searchCandidate = null;
    }

    // Fallback: If no direct userId in payload, check connectedAccount id from metadata
    if (!searchCandidate) {
      const connectedAccountId =
        rawPayload.metadata?.connectedAccount?.id ||
        (rawPayload.metadata?.connectedAccount as Record<string, unknown> | undefined)?.uuid as string | undefined ||
        (rawPayload as Record<string, unknown>).connectedAccountId as string | undefined;

      if (connectedAccountId) {
        try {
          const composio = getComposioClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const acc = (await composio.connectedAccounts.get(connectedAccountId)) as any;
          const uid = acc?.userId || acc?.user?.id;
          if (uid && typeof uid === "string") {
            const candidate = uid.startsWith("user_") ? uid.slice(5) : uid;
            searchCandidate = UUID_PATTERN.test(candidate) ? candidate : null;
          }
        } catch {
          // ignore lookup error
        }
      }
    }

    if (searchCandidate) {
      // 1. Look up in app_users to get the linked auth.users ID
      const { data: userRow } = await adminSupabase
        .from("app_users")
        .select("id, auth_user_id")
        .or(
          `auth_user_id.eq.${searchCandidate},id.eq.${searchCandidate},composio_entity_id.eq.user_${searchCandidate},composio_entity_id.eq.${searchCandidate}`
        )
        .limit(1)
        .maybeSingle();

      if (userRow?.auth_user_id) {
        resolvedAuthUserId = userRow.auth_user_id;
      } else if (userRow?.id) {
        // If auth_user_id is not set, check if id is an auth user
        const { data: authUser } = await adminSupabase.auth.admin.getUserById(userRow.id);
        if (authUser?.user?.id) {
          resolvedAuthUserId = authUser.user.id;
        }
      }

      // 2. Direct auth.users lookup if not found in app_users
      if (!resolvedAuthUserId) {
        const { data: authUser } = await adminSupabase.auth.admin.getUserById(searchCandidate);
        if (authUser?.user?.id) {
          resolvedAuthUserId = authUser.user.id;
        }
      }
    }

    // If user cannot be resolved, quarantine event safely with 200 OK so webhooks do not endlessly retry
    if (!resolvedAuthUserId) {
      console.warn(
        `[Prism Webhook] Dropping orphan event for unresolvable user: "${normalized.userIdRaw || searchCandidate}"`
      );
      return NextResponse.json(
        { status: "ignored", reason: "unresolved_user" },
        { status: 200 }
      );
    }

    // Resolve caller's primary organization membership
    const { data: memberRow } = await adminSupabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", resolvedAuthUserId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberRow?.organization_id) {
      organizationId = memberRow.organization_id;
    }

    // 4. Idempotent Ingestion into public.activity_events
    const { data: inserted, error: insertError } = await adminSupabase
      .from("activity_events")
      .insert({
        organization_id: organizationId,
        user_id: resolvedAuthUserId,
        external_id: normalized.externalId,
        source: normalized.source,
        event_type: normalized.eventType,
        title: normalized.title,
        summary: normalized.summary,
        priority: normalized.priority,
        actionable: normalized.actionable,
        raw_payload: normalized.rawPayload,
        is_read: false,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      // PostgreSQL unique_violation error code (23505) indicates duplicate delivery
      if (
        insertError.code === "23505" ||
        insertError.message?.includes("idx_activity_events_dedup")
      ) {
        return NextResponse.json(
          { status: "duplicate_ignored", external_id: normalized.externalId },
          { status: 200 }
        );
      }

      console.error("[Prism Webhook] Ingestion error:", insertError);
      return NextResponse.json(
        { error: "database_error", detail: "Failed to persist telemetry event" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: "ingested",
        id: inserted.id,
        created_at: inserted.created_at,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Prism Webhook] Unexpected error:", errorMsg);
    return NextResponse.json(
      { error: "internal_error", detail: "Telemetry processing failed" },
      { status: 500 }
    );
  }
}
