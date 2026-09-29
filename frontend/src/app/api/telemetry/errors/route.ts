import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { ClientErrorTelemetryPayload } from "@/lib/errors/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as ClientErrorTelemetryPayload | null;

    if (!payload || !payload.referenceId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Attempt to identify user/tenant if session exists (non-blocking)
    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch {
      // Auth lookup optional
    }

    // Log structured error for system monitoring
    console.error(`[Prism Error Telemetry] [${payload.referenceId}]`, {
      category: payload.category,
      severity: payload.severity,
      pathname: payload.pathname,
      message: payload.message,
      userId,
      timestamp: payload.timestamp,
    });

    return NextResponse.json({
      success: true,
      referenceId: payload.referenceId,
    });
  } catch (err) {
    console.warn("[Prism Error Telemetry] Ingestion failed:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
