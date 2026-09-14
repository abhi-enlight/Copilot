/**
 * GET  /api/organizations — list orgs the current user belongs to
 * POST /api/organizations — create a new org (user becomes owner)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { data, error } = await adminSupabase
    .from("organization_members")
    .select("role, organizations(id, name, slug, type, created_at)")
    .eq("user_id", user.id);

  if (error) {
    console.error("[orgs] list error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orgs = (data ?? [])
    .filter((m: any) => m.organizations)
    .map((m: any) => ({
      id: m.organizations.id,
      name: m.organizations.name,
      slug: m.organizations.slug,
      type: m.organizations.type,
      createdAt: m.organizations.created_at,
      myRole: m.role,
    }));

  return NextResponse.json({ orgs, organizations: orgs });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    type?: string;
  };

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "bad_request", detail: "name is required" },
      { status: 400 }
    );
  }

  // Generate slug from name if not provided
  let slug = (body.slug || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Ensure uniqueness
  const { data: existing } = await adminSupabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const type = body.type === "team" || body.type === "enterprise" ? body.type : "team";

  // Create org
  const { data: org, error: orgErr } = await adminSupabase
    .from("organizations")
    .insert({ name, slug, owner_id: user.id, type })
    .select("id, name, slug, type, created_at")
    .single();

  if (orgErr || !org) {
    console.error("[orgs] create error:", orgErr?.message);
    return NextResponse.json(
      { error: orgErr?.message || "Failed to create org" },
      { status: 500 }
    );
  }

  // Add owner membership
  await adminSupabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  return NextResponse.json({ org }, { status: 201 });
}
