import { NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { clearSessionCacheForUser } from "@/lib/composio/session";
import {
  exchangeZohoCodeForTokens,
  fetchPortals,
} from "@/lib/integrations/zoho-projects";
import { encryptIntegrationToken } from "@/lib/agent/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    `${url.protocol}//${url.host}`;

  const failureRedirect = (msg: string) =>
    NextResponse.redirect(
      `${origin}/integrations/callback?app=zoho_projects&is_success=false&error=${encodeURIComponent(msg)}`
    );

  if (errorParam || !code) {
    return failureRedirect(
      errorParam || "Authorization was cancelled or denied by user."
    );
  }

  try {
    let state: { userId?: string; userEmail?: string; dc?: string; returnTo?: string } = {};
    if (stateRaw) {
      try {
        state = JSON.parse(stateRaw);
      } catch {
        try {
          state = JSON.parse(decodeURIComponent(stateRaw));
        } catch {
          // state might not be JSON
        }
      }
    }

    // Attempt to identify user from session cookie first
    let sessionUser: { id: string; email?: string } | null = null;
    try {
      const sessionSupabase = await createClient();
      const { data: authData } = await sessionSupabase.auth.getUser();
      if (authData?.user) {
        sessionUser = authData.user;
      }
    } catch {
      // Ignore session cookie reading errors
    }

    let userId = state.userId || sessionUser?.id;
    let userEmail = (state.userEmail || sessionUser?.email)?.toLowerCase();

    // If email is still unresolved, query DB using userId
    if (!userEmail && userId) {
      try {
        const { data: userProfile } = await adminSupabase
          .from("app_users")
          .select("email, auth_user_id")
          .eq("auth_user_id", userId)
          .maybeSingle();

        if (userProfile?.email) {
          userEmail = userProfile.email.toLowerCase();
        } else {
          const { data: authUserData } = await adminSupabase.auth.admin.getUserById(userId);
          if (authUserData?.user?.email) {
            userEmail = authUserData.user.email.toLowerCase();
          }
        }
      } catch (lookupErr) {
        console.warn("[zoho/callback] DB profile lookup fallback warning:", lookupErr);
      }
    }

    // If userId is still unresolved, resolve auth_user_id from app_users via email
    if (!userId && userEmail) {
      try {
        const { data: userProfile } = await adminSupabase
          .from("app_users")
          .select("auth_user_id")
          .eq("email", userEmail)
          .maybeSingle();

        if (userProfile?.auth_user_id) {
          userId = userProfile.auth_user_id;
        }
      } catch {
        // Ignore
      }
    }

    if (!userEmail) {
      return failureRedirect("Unable to resolve matching user profile in Prism vault.");
    }

    // Idempotently ensure user exists in app_users to satisfy FK constraint on user_integrations
    try {
      await adminSupabase.from("app_users").upsert(
        {
          email: userEmail,
          role: "member",
          ...(userId ? { auth_user_id: userId } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
    } catch (upsertErr) {
      console.warn("[zoho/callback] app_users sync notice:", upsertErr);
    }

    const dc = state.dc || process.env.ZOHO_DATACENTER || "com";
    const redirectUri =
      process.env.ZOHO_REDIRECT_URI ||
      `${origin}/api/integrations/zoho/callback`;

    // 1. Exchange code for access & refresh tokens
    const tokens = await exchangeZohoCodeForTokens(code, redirectUri, dc);

    // 2. Discover primary portal ID
    const portals = await fetchPortals(tokens.access_token, dc);
    const primaryPortal = portals.find((p) => p.is_default) || portals[0];
    const portalId = primaryPortal?.id || "";
    const portalName = primaryPortal?.name || "Zoho Projects Portal";

    // 3. Encrypt tokens at rest
    const accessTokenEncrypted = encryptIntegrationToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptIntegrationToken(tokens.refresh_token)
      : undefined;

    const expiresAt = new Date(
      Date.now() + (tokens.expires_in || 3600) * 1000
    ).toISOString();

    // 4. Upsert into public.user_integrations
    const { error: upsertError } = await adminSupabase
      .from("user_integrations")
      .upsert(
        {
          user_email: userEmail,
          auth_user_id: userId || null,
          provider: "zoho",
          product: "projects",
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          access_token_expires_at: expiresAt,
          scopes: [
            "ZohoProjects.portals.READ",
            "ZohoProjects.projects.READ",
            "ZohoProjects.projects.CREATE",
            "ZohoProjects.tasks.ALL",
            "ZohoProjects.milestones.READ",
            "ZohoProjects.bugs.READ",
          ],
          zoho_portal_id: portalId,
          zoho_user_id: portalName,
          zoho_data_center: dc,
          status: "active",
          last_refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_email,provider,product" }
      );

    if (upsertError) {
      console.error("[zoho/callback] Vault write failed:", upsertError);
      return failureRedirect("Failed to securely record credentials in vault.");
    }

    if (userId) {
      clearSessionCacheForUser(userId);
    }

    return NextResponse.redirect(
      `${origin}/integrations/callback?app=zoho_projects&is_success=true`
    );
  } catch (err: unknown) {
    console.error("[zoho/callback] Unhandled OAuth error:", err);
    const message = err instanceof Error ? err.message : "Internal OAuth processing error";
    return failureRedirect(message);
  }
}
