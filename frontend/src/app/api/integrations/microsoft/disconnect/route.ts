import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth-helpers";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/microsoft/disconnect
 * Disconnects the user's Microsoft 365 integration by clearing tokens from
 * the database vault and clearing the session cookies.
 * Does NOT sign out the Supabase app session.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const msUserEmail = cookieStore.get("ms_user_email")?.value || null;

  // Require authenticated user
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    await adminSupabase
      .from("user_integrations")
      .delete()
      .eq("auth_user_id", user.id)
      .eq("provider", "microsoft");

    if (user.email) {
      await adminSupabase
        .from("user_integrations")
        .delete()
        .eq("user_email", user.email)
        .eq("provider", "microsoft");
    }

    const response = NextResponse.json({
      success: true,
      message: "Microsoft 365 disconnected successfully",
    });

    const msCookies = [
      "ms_access_token",
      "ms_refresh_token",
      "ms_token_expires_at",
      "ms_user_email",
      "ms_user_name",
      "ms_granted_scopes",
      "ms_has_crm",
      "ms_crm_probed_at",
    ];

    msCookies.forEach((name) => {
      response.cookies.set({
        name,
        value: "",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    });

    return response;
  } catch (err: unknown) {
    console.error("[ms-disconnect] failed:", err);
    return NextResponse.json(
      { error: "disconnect_failed", detail: "Could not disconnect Microsoft integration" },
      { status: 500 }
    );
  }
}
