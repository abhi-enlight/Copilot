/**
 * GET  /api/chat/sessions — list resumable sessions for the current user
 * POST /api/chat/sessions — create a new chat session
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, orgId } = auth;

  let effectiveOrg = orgId;
  if (!effectiveOrg) {
    const { data: member } = await adminSupabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    effectiveOrg = member?.organization_id || null;
  }

  let query = adminSupabase
    .from("chat_sessions")
    .select("id, title, organization_id, is_archived, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (effectiveOrg) {
    query = query.eq("organization_id", effectiveOrg);
  } else {
    query = query.is("organization_id", null);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ sessions: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, orgId } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    organizationId?: string;
  };

  let targetOrgId = orgId;
  if (body.organizationId && body.organizationId !== orgId) {
    const { data: member } = await adminSupabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", body.organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (member) {
      targetOrgId = body.organizationId;
    }
  }

  const { data: session, error } = await adminSupabase
    .from("chat_sessions")
    .insert({
      user_id: user.id,
      organization_id: targetOrgId || null,
      title: body.title || null,
    })
    .select("id, title, organization_id, created_at, updated_at")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message || "Failed to create session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ session }, { status: 201 });
}
