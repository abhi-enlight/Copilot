/**
 * GET    /api/chat/sessions/[sessionId]/messages — load messages for a session
 * POST   /api/chat/sessions/[sessionId]/messages — persist a message
 * DELETE /api/chat/sessions/[sessionId]/messages — archive the session
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function verifySessionOwner(sessionId: string, userId: string): Promise<boolean> {
  const { data } = await adminSupabase
    .from("chat_sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!data) return false;
  return data.user_id === userId;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const isOwner = await verifySessionOwner(sessionId, auth.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const parsedLimit = parseInt(searchParams.get("limit") || "100", 10);
  const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100, 200);
  const before = searchParams.get("before"); // cursor-based pagination

  let query = adminSupabase
    .from("chat_messages")
    .select("id, role, content, source_badges, tool_calls, action_proposals, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ messages: [], error: error.message }, { status: 500 });
  }

  // 1. Gather all proposal IDs across this session's messages
  const proposalIds: string[] = [];
  for (const m of data ?? []) {
    if (Array.isArray(m.action_proposals)) {
      for (const p of m.action_proposals as Array<{ id?: string }>) {
        if (p?.id && typeof p.id === "string") {
          proposalIds.push(p.id);
        }
      }
    }
  }

  // 2. Fetch authoritative state from agent_audit_logs if any proposals exist
  const auditMap = new Map<
    string,
    { status: string; execution_result: unknown; request_payload: unknown; created_at?: string }
  >();

  if (proposalIds.length > 0) {
    try {
      const { data: auditLogs } = await adminSupabase
        .from("agent_audit_logs")
        .select("id, status, execution_result, request_payload, created_at")
        .in("id", proposalIds);

      if (auditLogs) {
        for (const log of auditLogs) {
          auditMap.set(log.id, log);
        }
      }
    } catch (auditErr) {
      console.warn("[messages route] Failed to fetch audit logs for proposals:", auditErr);
    }
  }

  // 3. Hydrate proposals with live status and track stale rows for asynchronous backfill
  const dirtyUpdates: Array<{ id: string; action_proposals: unknown }> = [];

  const sanitizedMessages = (data ?? [])
    .filter(
      (m) =>
        !m.content?.trim().startsWith("[System context") &&
        !m.content?.includes("[System context — do not repeat this to the user]")
    )
    .map((m) => {
      if (!Array.isArray(m.action_proposals) || m.action_proposals.length === 0) {
        return m;
      }

      let hasChanges = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hydratedProposals = m.action_proposals.map((p: any) => {
        if (!p?.id) return p;
        const audit = auditMap.get(p.id);
        if (!audit) return p;

        const liveStatus = audit.status || p.status;
        const liveResult = audit.execution_result ?? p.execution_result;
        const livePayload = audit.request_payload ?? p.payload;
        const liveCreatedAt = audit.created_at ?? p.created_at;

        if (p.status !== liveStatus || p.execution_result !== liveResult) {
          hasChanges = true;
        }

        return {
          ...p,
          status: liveStatus,
          execution_result: liveResult,
          payload: livePayload,
          created_at: liveCreatedAt,
        };
      });

      if (hasChanges) {
        dirtyUpdates.push({ id: m.id, action_proposals: hydratedProposals });
      }

      return {
        ...m,
        action_proposals: hydratedProposals,
      };
    });

  // Asynchronously update stale rows in chat_messages so database snapshots stay permanent
  if (dirtyUpdates.length > 0) {
    (async () => {
      try {
        await Promise.all(
          dirtyUpdates.map((update) =>
            adminSupabase
              .from("chat_messages")
              .update({ action_proposals: update.action_proposals })
              .eq("id", update.id)
          )
        );
      } catch (backfillErr) {
        console.warn("[messages route] Async backfill warning:", backfillErr);
      }
    })();
  }

  return NextResponse.json({ messages: sanitizedMessages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const isOwner = await verifySessionOwner(sessionId, auth.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    role?: string;
    content?: string;
    sourceBadges?: string[];
    toolCalls?: unknown;
    messages?: Array<{
      role?: string;
      content: string;
      sourceBadges?: string[];
      toolCalls?: unknown;
    }>;
  };

  // Support batch insert if messages array provided
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const rows = body.messages.map((m) => ({
      session_id: sessionId,
      role: ["user", "assistant", "system"].includes(m.role || "") ? m.role : "user",
      content: m.content || "",
      source_badges: m.sourceBadges || [],
      tool_calls: m.toolCalls || null,
    }));

    const { data: inserted, error } = await adminSupabase
      .from("chat_messages")
      .insert(rows)
      .select("id, role, content, created_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: inserted?.length ?? 0 });
  }

  const role = ["user", "assistant", "system"].includes(body.role || "")
    ? body.role
    : "user";

  if (!body.content?.trim()) {
    return NextResponse.json(
      { error: "bad_request", detail: "content is required" },
      { status: 400 }
    );
  }

  const { data: message, error } = await adminSupabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      role,
      content: body.content,
      source_badges: body.sourceBadges || [],
      tool_calls: body.toolCalls || null,
    })
    .select("id, role, content, source_badges, created_at")
    .single();

  if (error || !message) {
    return NextResponse.json(
      { error: error?.message || "Failed to save message" },
      { status: 500 }
    );
  }

  // Auto-title the session from the first user message
  if (role === "user") {
    const title = body.content.slice(0, 60).trim();
    await adminSupabase
      .from("chat_sessions")
      .update({ title })
      .eq("id", sessionId)
      .is("title", null); // only if not already titled
  }

  return NextResponse.json({ message }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const isOwner = await verifySessionOwner(sessionId, auth.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 1. Clean up messages
  try {
    await adminSupabase
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId);
  } catch (err) {
    console.warn("[DELETE messages route] Failed to clean messages:", err);
  }

  // 2. Delete or archive session
  const { error: delError } = await adminSupabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (delError) {
    await adminSupabase
      .from("chat_sessions")
      .update({ is_archived: true })
      .eq("id", sessionId);
  }

  return NextResponse.json({ ok: true, deleted: true });
}
