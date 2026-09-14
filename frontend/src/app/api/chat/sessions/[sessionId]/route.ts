/**
 * GET    /api/chat/sessions/[sessionId] — fetch session metadata
 * PATCH  /api/chat/sessions/[sessionId] — update session (e.g. title)
 * DELETE /api/chat/sessions/[sessionId] — permanently delete or archive session
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

  const { data, error } = await adminSupabase
    .from("chat_sessions")
    .select("id, title, organization_id, is_archived, created_at, updated_at")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ session: data });
}

export async function PATCH(
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
    title?: string;
    is_archived?: boolean;
  };
  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") updates.title = body.title.trim().slice(0, 100);
  if (typeof body.is_archived === "boolean") updates.is_archived = body.is_archived;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_updates_provided" }, { status: 400 });
  }

  const { data, error } = await adminSupabase
    .from("chat_sessions")
    .update(updates)
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
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

  // 1. Delete associated messages first
  try {
    await adminSupabase
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId);
  } catch (err) {
    console.warn("[DELETE /api/chat/sessions] Failed to clean messages:", err);
  }

  // 2. Delete the session row, or mark archived if foreign key restricts
  const { error: delError } = await adminSupabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (delError) {
    console.warn("[DELETE /api/chat/sessions] Hard delete failed, setting is_archived: true", delError.message);
    await adminSupabase
      .from("chat_sessions")
      .update({ is_archived: true })
      .eq("id", sessionId);
  }

  return NextResponse.json({ ok: true, deleted: true });
}
