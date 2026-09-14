/**
 * GET    /api/chat/sessions/[sessionId]/messages — load messages for a session
 * POST   /api/chat/sessions/[sessionId]/messages — persist a message
 * DELETE /api/chat/sessions/[sessionId]/messages — archive the session
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function verifySessionOwner(sessionId: string, userId: string, orgId?: string | null): Promise<boolean> {
  const { data } = await adminSupabase
    .from("chat_sessions")
    .select("id, organization_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return false;
  if (data.organization_id && orgId && data.organization_id !== orgId) {
    return false;
  }
  return true;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const isOwner = await verifySessionOwner(sessionId, auth.user.id, auth.orgId);
  if (!isOwner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const parsedLimit = parseInt(searchParams.get("limit") || "100", 10);
  const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100, 200);
  const before = searchParams.get("before"); // cursor-based pagination

  let query = adminSupabase
    .from("chat_messages")
    .select("id, role, content, source_badges, tool_calls, created_at")
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

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const isOwner = await verifySessionOwner(sessionId, auth.user.id, auth.orgId);
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

  const isOwner = await verifySessionOwner(sessionId, auth.user.id, auth.orgId);
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
