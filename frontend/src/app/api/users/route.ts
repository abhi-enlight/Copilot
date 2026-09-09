import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
}

async function currentUser(): Promise<{ email: string; role: string } | null> {
  const cookieStore = await cookies();
  const email = cookieStore.get("ms_user_email")?.value || null;
  if (!email) return null;
  const user = await resolveAppUser(email);
  return { email, role: user?.role || "member" };
}

const VALID_ROLES = ["owner", "admin", "member"] as const;

/**
 * App Users & Roles API
 *
 * GET  → list users with their app role (any authenticated user).
 * POST → change a user's role. Only owners/admins may mutate; granting
 *        Admin instantly unlocks the CRM connection on that user's next
 *        entitlement re-check (the "given the admin privilege" path).
 */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ users: [], configured: false, me });
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("email, display_name, role, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[users] list failed:", error.message);
    return NextResponse.json({ users: [], configured: true, me, error: error.message });
  }

  return NextResponse.json({
    users: (data || []).map((u) => ({
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    })),
    configured: true,
    me,
  });
}

export async function POST(request: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const elevated = me.role === "owner" || me.role === "admin";
  if (!elevated) {
    return NextResponse.json({ error: "forbidden", detail: "Only owners and admins can change roles" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = (body.email || "").trim().toLowerCase();
  const role = (body.role || "").trim().toLowerCase();

  if (!email || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return NextResponse.json({ error: "bad_request", detail: "email and role (owner|admin|member) required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not_configured", detail: "Supabase not configured" }, { status: 503 });
  }

  // Upsert: create the user row if they haven't logged in yet
  const { error } = await supabase
    .from("app_users")
    .upsert({ email, role, updated_at: new Date().toISOString() }, { onConflict: "email" });

  if (error) {
    console.error("[users] role change failed:", error.message);
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, email, role });
}
