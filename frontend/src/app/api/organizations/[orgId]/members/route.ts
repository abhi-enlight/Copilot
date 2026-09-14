/**
 * GET    /api/organizations/[orgId]/members — list members
 * POST   /api/organizations/[orgId]/members — invite a member by email
 * DELETE /api/organizations/[orgId]/members?userId= — remove a member
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function getCallerRole(orgId: string, userId: string): Promise<string | null> {
  const { data } = await adminSupabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Verify caller is a member
  const myRole = await getCallerRole(orgId, auth.user.id);
  if (!myRole) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: memberRows, error } = await adminSupabase
    .from("organization_members")
    .select("id, role, joined_at, user_id")
    .eq("organization_id", orgId)
    .order("joined_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = (memberRows ?? []).map((m: any) => m.user_id).filter(Boolean);
  const { data: userProfiles } = userIds.length > 0
    ? await adminSupabase
        .from("app_users")
        .select("auth_user_id, email, display_name, role")
        .in("auth_user_id", userIds)
    : { data: [] };

  const userMap = new Map((userProfiles ?? []).map((u: any) => [u.auth_user_id, u]));

  const members = (memberRows ?? []).map((m: any) => {
    const profile = userMap.get(m.user_id);
    return {
      userId: m.user_id,
      orgRole: m.role,
      joinedAt: m.joined_at,
      email: profile?.email ?? "",
      displayName: profile?.display_name ?? null,
      appRole: profile?.role ?? "member",
    };
  });

  return NextResponse.json({ members, myRole });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const myRole = await getCallerRole(orgId, auth.user.id);
  if (!myRole || myRole === "member") {
    return NextResponse.json(
      { error: "forbidden", detail: "Only owners and admins can invite members" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    role?: string;
  };

  const email = (body.email || "").trim().toLowerCase();
  let role = ["owner", "admin", "member"].includes(body.role || "")
    ? (body.role as string)
    : "member";

  // Only owners may grant the owner role — admins elevate to admin at most.
  if (role === "owner" && myRole !== "owner") {
    return NextResponse.json(
      { error: "forbidden", detail: "Only owners can grant the owner role" },
      { status: 403 }
    );
  }
  if (role === "admin" && myRole !== "owner") role = "admin";

  if (!email) {
    return NextResponse.json(
      { error: "bad_request", detail: "email is required" },
      { status: 400 }
    );
  }

  // Look up the user by email in app_users
  const { data: appUser } = await adminSupabase
    .from("app_users")
    .select("auth_user_id, email")
    .eq("email", email)
    .maybeSingle();

  if (!appUser?.auth_user_id) {
    return NextResponse.json(
      {
        error: "user_not_found",
        detail: `No Prism account found for ${email}. They need to sign up first.`,
      },
      { status: 404 }
    );
  }

  // Add membership (upsert to handle re-invites)
  const { error } = await adminSupabase
    .from("organization_members")
    .upsert(
      { organization_id: orgId, user_id: appUser.auth_user_id, role },
      { onConflict: "organization_id,user_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, role }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId") || auth.user.id;

  const myRole = await getCallerRole(orgId, auth.user.id);

  // Can remove self, or admin/owner can remove others — but admins may never
  // remove an owner.
  if (targetUserId !== auth.user.id && myRole === "admin") {
    const { data: targetRow } = await adminSupabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetRow?.role === "owner") {
      return NextResponse.json(
        { error: "forbidden", detail: "Admins cannot remove owners" },
        { status: 403 }
      );
    }
  }

  const canRemove =
    targetUserId === auth.user.id ||
    myRole === "owner" ||
    myRole === "admin";

  if (!canRemove) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Prevent removing the last owner
  if (targetUserId === auth.user.id && myRole === "owner") {
    const { count } = await adminSupabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "last_owner", detail: "Cannot remove the last owner. Transfer ownership first." },
        { status: 409 }
      );
    }
  }

  const { error } = await adminSupabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", targetUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
