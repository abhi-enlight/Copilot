import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { adminSupabase } from "@/lib/supabase-admin";
import type { AgentAuditLogRow } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/actions
 * Lists audit logs and action proposals for the authenticated user.
 * Supports status filtering ('all' | 'pending' | 'executed' | 'rejected' | 'failed') and pagination.
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
    const status = searchParams.get("status");
    const tool = searchParams.get("tool");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    let query = adminSupabase
      .from("agent_audit_logs")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (tool && tool !== "all") {
      query = query.eq("tool_slug", tool);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "database_error", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      actions: (data as AgentAuditLogRow[]) || [],
      totalCount: count ?? 0,
      limit,
      offset,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "internal_error", detail: msg },
      { status: 500 }
    );
  }
}
