/**
 * POST /api/auth/provision
 *
 * Called immediately after Supabase signup to create the app_users row
 * and the user's personal workspace org. Uses service role to bypass RLS
 * since the new user has no session cookies yet.
 */

import { NextResponse } from "next/server";
import { ensureAppUserByAuthId, ensurePersonalOrg } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      authUserId?: string;
      email?: string;
      displayName?: string;
    };

    let { authUserId, email } = body;
    const { displayName } = body;

    // If the caller HAS a session, they may only provision themselves — a
    // session user must never be able to create/modify another user's row.
    const { requireAuth } = await import("@/lib/auth-helpers");
    const auth = await requireAuth(request);
    if (!(auth instanceof NextResponse)) {
      if (authUserId && authUserId !== auth.user.id) {
        return NextResponse.json(
          { error: "forbidden", detail: "Cannot provision a different user's account" },
          { status: 403 }
        );
      }
      authUserId = authUserId || auth.user.id;
      email = email || auth.user.email || "";
    }

    if (!authUserId || !email) {
      return NextResponse.json(
        { error: "bad_request", detail: "authUserId and email are required" },
        { status: 400 }
      );
    }

    // Verify that authUserId actually exists in Supabase Auth
    const { adminSupabase } = await import("@/lib/supabase-admin");
    const { data: userRecord, error: userRecordErr } = await adminSupabase.auth.admin.getUserById(authUserId);
    if (userRecordErr || !userRecord?.user) {
      return NextResponse.json(
        { error: "not_found", detail: "Supabase Auth user does not exist" },
        { status: 404 }
      );
    }
    email = userRecord.user.email || email;

    // 1. Create / update app_users row
    const userResult = await ensureAppUserByAuthId({
      authUserId,
      email,
      displayName: displayName || null,
    });

    if (!userResult.ok) {
      console.warn("[provision] app_users upsert failed:", userResult.error);
      // Don't fail the whole signup for this — it will be retried on next login
    }

    // 2. Create personal workspace org
    const orgId = await ensurePersonalOrg(authUserId, displayName || email.split("@")[0]);

    return NextResponse.json({
      ok: true,
      provisioned: { appUser: userResult.ok, orgId },
    });
  } catch (err: unknown) {
    console.error("[provision] error:", err);
    return NextResponse.json(
      { error: "internal", detail: (err as Error)?.message },
      { status: 500 }
    );
  }
}
