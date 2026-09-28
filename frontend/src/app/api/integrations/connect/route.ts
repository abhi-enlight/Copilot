import { createClient } from "@/lib/supabase-server";
import {
  getComposioSessionForUser,
  normalizeToolSlug,
  sanitizeIntegrationError,
} from "@/lib/composio/session";
import type { ConnectResponse } from "@/types/integrations";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { app } = body;

    if (!app || typeof app !== "string") {
      return NextResponse.json(
        { error: "Missing required 'app' parameter in request body" },
        { status: 400 }
      );
    }

    const toolkitSlug = normalizeToolSlug(app);
    const { session, entityId } = await getComposioSessionForUser(user.id);

    // Secure origin callback to prevent open redirect vulnerabilities
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";
    const callbackUrl = `${origin}/integrations/callback`;

    const connectionRequest = await session.authorize(toolkitSlug, {
      callbackUrl,
    });

    if (!connectionRequest || !connectionRequest.redirectUrl) {
      return NextResponse.json(
        { error: "Failed to generate authorization URL for tool" },
        { status: 502 }
      );
    }

    // Sync composio_entity_id to app_users profile
    try {
      await supabase
        .from("app_users")
        .update({ composio_entity_id: entityId, updated_at: new Date().toISOString() })
        .eq("auth_user_id", user.id);
    } catch {
      // Profile sync error non-fatal to connect flow
    }

    const response: ConnectResponse = {
      success: true,
      app: toolkitSlug,
      connectionId: connectionRequest.id,
      redirectUrl: connectionRequest.redirectUrl,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("Prism connect error:", err);
    return NextResponse.json(
      { error: sanitizeIntegrationError(err) },
      { status: 500 }
    );
  }
}
