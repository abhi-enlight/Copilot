import { createClient } from "@/lib/supabase-server";
import {
  getComposioClient,
  normalizeToolSlug,
  clearSessionCacheForUser,
  sanitizeIntegrationError,
} from "@/lib/composio/session";
import type { DisconnectResponse } from "@/types/integrations";
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
    const { app, accountId } = body;

    if (!app && !accountId) {
      return NextResponse.json(
        { error: "Provide either 'app' or 'accountId' to disconnect" },
        { status: 400 }
      );
    }

    const entityId = `user_${user.id}`;
    const composio = getComposioClient();

    // ── IDOR Protection Gate: Verify account ownership ────────────────
    // Only retrieve connected accounts belonging specifically to this user entity.
    const userAccounts = await composio.connectedAccounts.list({
      userIds: [entityId],
    });

    let targetAccountId = accountId;
    let targetSlug: string | undefined;

    if (targetAccountId) {
      // Assert that targetAccountId belongs to caller
      const owned = userAccounts.items?.some(
        (acc: { id: string }) => acc.id === targetAccountId
      );
      if (!owned) {
        return NextResponse.json(
          { error: "Account not found or not owned by current user" },
          { status: 403 }
        );
      }
    } else if (app) {
      targetSlug = normalizeToolSlug(app);
      const match = userAccounts.items?.find(
        (acc: { toolkit?: { slug?: string } }) => acc.toolkit?.slug === targetSlug
      );
      if (!match) {
        return NextResponse.json(
          { error: `No active connection found for ${app}` },
          { status: 404 }
        );
      }
      targetAccountId = match.id;
    }

    if (!targetAccountId) {
      return NextResponse.json(
        { error: "Unable to resolve target account for disconnection" },
        { status: 404 }
      );
    }

    // Revoke the connection
    await composio.connectedAccounts.delete(targetAccountId);

    // Invalidate cached session so subsequent status queries reflect immediate disconnection
    clearSessionCacheForUser(user.id);

    const response: DisconnectResponse = {
      success: true,
      disconnected: true,
      app: targetSlug || app,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("Prism disconnect error:", err);
    return NextResponse.json(
      { error: sanitizeIntegrationError(err) },
      { status: 500 }
    );
  }
}
