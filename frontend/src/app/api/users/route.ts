/**
 * GET  /api/users — list members of the active org
 * POST /api/users — change a member's org role (owner/admin only)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["owner", "admin", "member"] as const;

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  let orgId = auth.orgId;

  // If no active org header was sent, fallback to the user's personal org
  if (!orgId) {
    const { data: membership } = await adminSupabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = membership?.organization_id ?? null;
  }

  if (!orgId) {
    return NextResponse.json({ users: [], me: null });
  }

  const { data: memberRows, error } = await adminSupabase
    .from("organization_members")
    .select("id, role, joined_at, user_id")
    .eq("organization_id", orgId)
    .order("joined_at", { ascending: true });

  if (error) {
    console.error("[users] list failed:", error.message);
    return NextResponse.json({ users: [], error: error.message }, { status: 500 });
  }

  const userIds = (memberRows ?? []).map((m: any) => m.user_id).filter(Boolean);
  const { data: userProfiles } = userIds.length > 0
    ? await adminSupabase
        .from("app_users")
        .select("auth_user_id, email, display_name, role, created_at, updated_at")
        .in("auth_user_id", userIds)
    : { data: [] };

  const userMap = new Map((userProfiles ?? []).map((u: any) => [u.auth_user_id, u]));

  const users = (memberRows ?? []).map((m: any) => {
    const profile = userMap.get(m.user_id);
    return {
      userId: m.user_id,
      email: profile?.email ?? "",
      displayName: profile?.display_name ?? null,
      orgRole: m.role,
      appRole: profile?.role ?? "member",
      joinedAt: m.joined_at,
      isMe: m.user_id === user.id,
    };
  });

  // Determine caller's org role
  const me = users.find((u: any) => u.isMe) || null;

  return NextResponse.json({ users, me, configured: true });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  let orgId = auth.orgId;

  if (!orgId) {
    const { data: membership } = await adminSupabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = membership?.organization_id ?? null;
  }

  if (!orgId) {
    return NextResponse.json(
      { error: "bad_request", detail: "Active organization required" },
      { status: 400 }
    );
  }

  // Check caller's role
  const { data: myMembership } = await adminSupabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  const myRole = myMembership?.role ?? "member";
  if (myRole === "member") {
    return NextResponse.json(
      { error: "forbidden", detail: "Only owners and admins can change roles" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    email?: string;
    role?: string;
  };

  let targetUserId = (body.userId || "").trim();
  const role = (body.role || "").trim().toLowerCase();

  // Only owners may grant the owner role.
  if (role === "owner" && myRole !== "owner") {
    return NextResponse.json(
      { error: "forbidden", detail: "Only owners can grant the owner role" },
      { status: 403 }
    );
  }

  // Admins may never change an owner's role.
  if (myRole === "admin") {
    const { data: targetRow } = await adminSupabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetRow?.role === "owner") {
      return NextResponse.json(
        { error: "forbidden", detail: "Admins cannot change an owner's role" },
        { status: 403 }
      );
    }
  }

  // Demoting an owner requires another owner to remain.
  if (role !== "owner") {
    const { data: targetRow } = await adminSupabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetRow?.role === "owner") {
      const { count } = await adminSupabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", "owner");
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "last_owner", detail: "Cannot demote the last owner. Transfer ownership first." },
          { status: 409 }
        );
      }
    }
  }

  // If email was passed instead of userId, resolve targetUserId
  if (!targetUserId && body.email) {
    const { data: appUser } = await adminSupabase
      .from("app_users")
      .select("auth_user_id")
      .eq("email", body.email.trim().toLowerCase())
      .maybeSingle();
    targetUserId = appUser?.auth_user_id || "";
  }

  if (!targetUserId || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return NextResponse.json(
      { error: "bad_request", detail: "Valid user identifier and role (owner|admin|member) required" },
      { status: 400 }
    );
  }

  const { error } = await adminSupabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId);

  if (error) {
    console.error("[users] role change failed:", error.message);
    return NextResponse.json(
      { error: "update_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, userId: targetUserId, role });
}
