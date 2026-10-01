import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { ensureUserTriggers } from "@/lib/composio/triggers";

export const dynamic = "force-dynamic";

/**
 * Triggers background provisioning and status synchronization of telemetry triggers.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized", detail: "Authentication required" },
        { status: 401 }
      );
    }

    const result = await ensureUserTriggers(user.id);

    return NextResponse.json({
      success: true,
      userId: user.id,
      ...result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Telemetry Sync API] Error:", errorMsg);
    return NextResponse.json(
      { error: "internal_error", detail: "Failed to synchronize telemetry triggers" },
      { status: 500 }
    );
  }
}
