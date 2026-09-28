import { NextResponse } from "next/server";
import { getComposioClient } from "@/lib/composio/session";
import { adminSupabase } from "@/lib/supabase-admin";
import {
  normalizeTelemetryEvent,
  type RawTelemetryEvent,
} from "@/lib/telemetry/normalizer";

export const dynamic = "force-dynamic";

/**
 * Inbound Webhook Gateway for Prism V2 Live Stack Telemetry.
 *
 * 1. Cryptographic HMAC-SHA256 signature verification via Composio Triggers SDK.
 * 2. Replay attack defense with 300-second timestamp tolerance window.
 * 3. Normalizes disparate platform events (Teams, Outlook, Slack, Linear, Zoho) into canonical form.
 * 4. Resolves authenticated Supabase user and organization context.
 * 5. Idempotent insertion into public.activity_events (handled by unique partial index idx_activity_events_dedup).
 * 6. Broadcasts via Supabase Realtime to all active Live Stack Radars.
 */
export async function POST(request: Request) {
  try {
    const verifySecret = process.env.COMPOSIO_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && !verifySecret) {
      console.error("[Prism Webhook] COMPOSIO_WEBHOOK_SECRET is not configured in production");
      return NextResponse.json(
        { error: "server_misconfigured", detail: "Webhook secret missing in production" },
        { status: 500 }
      );
    }

    let rawPayload: RawTelemetryEvent;

    // 1. Cryptographic Signature Verification
    if (verifySecret) {
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
          { error: "unauthorized", detail: "Invalid or expired webhook signature" },
          { status: 401 }
        );
      }
    } else {
      // Development fallback when COMPOSIO_WEBHOOK_SECRET is not set
      try {
        const bodyText = await request.text();
        rawPayload = JSON.parse(bodyText);
      } catch {
        return NextResponse.json(
          { error: "bad_request", detail: "Invalid JSON payload" },
          { status: 400 }
        );
      }
    }

    // 2. Normalize disparate event into canonical Prism telemetry model
    const normalized = normalizeTelemetryEvent(rawPayload);

    // 3. User & Tenant Identity Resolution Gate
    let resolvedUserId: string | null = null;
    let organizationId: string | null = null;

    if (normalized.userIdRaw) {
      // Look up app_users by id or composio_entity_id
      const { data: userRow } = await adminSupabase
        .from("app_users")
        .select("id")
        .or(`id.eq.${normalized.userIdRaw},composio_entity_id.eq.user_${normalized.userIdRaw},composio_entity_id.eq.${normalized.userIdRaw}`)
        .limit(1)
        .maybeSingle();

      if (userRow?.id) {
        resolvedUserId = userRow.id;
      }
    }

    // If user cannot be resolved, quarantine event safely with 200 OK so webhooks do not endlessly loop
    if (!resolvedUserId) {
      console.warn(
        `[Prism Webhook] Dropping orphan event for unresolvable user: "${normalized.userIdRaw}"`
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
      .eq("user_id", resolvedUserId)
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
        user_id: resolvedUserId,
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
      if (insertError.code === "23505" || insertError.message?.includes("idx_activity_events_dedup")) {
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
