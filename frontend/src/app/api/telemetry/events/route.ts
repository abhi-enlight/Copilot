import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { ActivityEventRow, PriorityLevel } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * REST Endpoint for Telemetry Catchup & Event State Management.
 *
 * GET:
 *   Fetches telemetry feed or high-watermark delta for reconnection catchup.
 *   Enforces RLS so callers only retrieve their authorized events.
 *
 * PATCH:
 *   Updates event read status (single, batch, or mark-all-read).
 *   Triggers PostgreSQL UPDATE event which Supabase Realtime propagates to all open tabs.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized", detail: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    const source = searchParams.get("source");
    const priority = searchParams.get("priority") as PriorityLevel | null;
    const unreadOnly = searchParams.get("unread_only") === "true";
    const actionableOnly = searchParams.get("actionable_only") === "true";
    const limitParsed = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(isNaN(limitParsed) ? 50 : limitParsed, 1), 100);

    let query = supabase
      .from("activity_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (since) {
      // High-watermark catchup: only events newer than the client's last seen timestamp
      query = query.gt("created_at", since);
    }
    if (source) {
      query = query.eq("source", source);
    }
    if (priority) {
      query = query.eq("priority", priority);
    }
    if (unreadOnly) {
      query = query.eq("is_read", false);
    }
    if (actionableOnly) {
      query = query.eq("actionable", true);
    }

    const { data: events, error: queryError } = await query;

    if (queryError) {
      console.error("[Telemetry API] Query error:", queryError);
      return NextResponse.json(
        { error: "query_failed", detail: "Could not retrieve activity events" },
        { status: 500 }
      );
    }

    // Compute unread count for the active user
    const { count: unreadCount, error: countError } = await supabase
      .from("activity_events")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);

    if (countError) {
      console.warn("[Telemetry API] Count error:", countError);
    }

    const rows = (events || []) as ActivityEventRow[];
    const latestTimestamp = rows.length > 0 ? rows[0].created_at : null;

    return NextResponse.json(
      {
        events: rows,
        unreadCount: unreadCount ?? 0,
        latestTimestamp,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Telemetry API] Unexpected error:", errorMsg);
    return NextResponse.json(
      { error: "internal_error", detail: "Failed to process telemetry request" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized", detail: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { eventIds, isRead, actionable, markAllRead } = body as {
      eventIds?: string[];
      isRead?: boolean;
      actionable?: boolean;
      markAllRead?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (typeof isRead === "boolean") updates.is_read = isRead;
    if (typeof actionable === "boolean") updates.actionable = actionable;

    if (Object.keys(updates).length === 0 && !markAllRead) {
      return NextResponse.json(
        { error: "bad_request", detail: "No valid fields to update" },
        { status: 400 }
      );
    }

    let updatedCount = 0;

    if (markAllRead) {
      const { data, error } = await supabase
        .from("activity_events")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .select("id");

      if (error) {
        console.error("[Telemetry API] Mark all read error:", error);
        return NextResponse.json(
          { error: "update_failed", detail: "Could not mark all events as read" },
          { status: 500 }
        );
      }
      updatedCount = data?.length || 0;
    } else if (Array.isArray(eventIds) && eventIds.length > 0) {
      // IDOR protection: only update events belonging to caller's user_id
      const { data, error } = await supabase
        .from("activity_events")
        .update(updates)
        .in("id", eventIds)
        .eq("user_id", user.id)
        .select("id");

      if (error) {
        console.error("[Telemetry API] Batch update error:", error);
        return NextResponse.json(
          { error: "update_failed", detail: "Could not update activity events" },
          { status: 500 }
        );
      }
      updatedCount = data?.length || 0;
    }

    return NextResponse.json(
      {
        success: true,
        updatedCount,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Telemetry API] Unexpected PATCH error:", errorMsg);
    return NextResponse.json(
      { error: "internal_error", detail: "Failed to update telemetry events" },
      { status: 500 }
    );
  }
}
