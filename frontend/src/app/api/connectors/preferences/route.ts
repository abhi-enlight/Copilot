/**
 * GET  /api/connectors/preferences — current user's connector pause map
 * POST /api/connectors/preferences — { connectorId, enabled } persists one toggle
 *
 * FIXED: "Couldn't save the connection" bug.
 * The row is guaranteed to exist (created at signup via ensureAppUserByAuthId).
 * We now UPDATE directly on auth_user_id rather than UPSERT on email,
 * eliminating the 23502/23505 constraint violations that caused the 503 error.
 */

import { NextResponse } from "next/server";
import { requireAuth, ensureAppUserByAuthId } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";
import { CONNECTOR_IDS, type ConnectorId } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { data } = await adminSupabase
    .from("app_users")
    .select("connector_preferences")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  const preferences = data?.connector_preferences ?? {};
  return NextResponse.json({ preferences });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    connectorId?: string;
    enabled?: boolean;
  };

  const connectorId = (body.connectorId || "").trim() as ConnectorId;
  const enabled = body.enabled;

  if (!CONNECTOR_IDS.includes(connectorId) || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "bad_request", detail: "connectorId and enabled (boolean) required" },
      { status: 400 }
    );
  }

  // Fetch current preferences
  const { data: existing } = await adminSupabase
    .from("app_users")
    .select("connector_preferences")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  if (!existing && auth.user.email) {
    await ensureAppUserByAuthId({
      authUserId: auth.user.id,
      email: auth.user.email,
    });
  }

  const current = (existing?.connector_preferences ?? {}) as Record<string, boolean>;
  const next = { ...current, [connectorId]: enabled };

  const { error } = await adminSupabase
    .from("app_users")
    .update({ connector_preferences: next, updated_at: new Date().toISOString() })
    .eq("auth_user_id", auth.user.id);

  if (error) {
    console.error("[connector-prefs] update failed:", error.message);
    return NextResponse.json(
      { error: "save_failed", detail: "Failed to save preference. Try again." },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true, preferences: next });
}
