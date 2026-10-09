import { createClient } from "@/lib/supabase-server";
import {
  getComposioSessionForUser,
  normalizeToolSlug,
  clearSessionCacheForUser,
  sanitizeIntegrationError,
} from "@/lib/composio/session";
import {
  getZohoAccountsDomain,
  getZohoProjectsScopes,
} from "@/lib/integrations/zoho-projects";
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

    clearSessionCacheForUser(user.id);

    // Secure origin callback to prevent open redirect vulnerabilities
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";
    const callbackUrl = `${origin}/integrations/callback?app=${encodeURIComponent(toolkitSlug)}`;

    const authorizeOptions: Record<string, unknown> = {
      callbackUrl,
    };

    if (toolkitSlug === "dynamics365") {
      let subdomain = body.subdomain || body.data?.subdomain;
      let region = body.region || body.data?.region || "crm8.dynamics.com";
      const issuer = body.issuer || body.data?.issuer || process.env.AZURE_TENANT_ID || "common";

      if (!subdomain && process.env.DYNAMICS_CRM_ORG_URL) {
        try {
          const parsedUrl = new URL(process.env.DYNAMICS_CRM_ORG_URL.trim());
          const parts = parsedUrl.hostname.split(".");
          subdomain = parts[0];
          if (parts.length > 1) {
            region = parts.slice(1).join(".");
          }
        } catch {
          // ignore
        }
      }

      if (subdomain) {
        authorizeOptions.data = {
          subdomain,
          region,
          issuer,
        };
      }
    }

    if (toolkitSlug === "share_point") {
      const subdomain = body.subdomain || body.data?.subdomain || process.env.SHAREPOINT_TENANT_NAME;
      const issuer = body.issuer || body.data?.issuer || process.env.AZURE_TENANT_ID || "common";

      if (subdomain) {
        authorizeOptions.data = {
          subdomain,
          issuer,
        };
      }
    }

    if (toolkitSlug === "zoho_books") {
      const suffix = body["suffix.one"] || body.suffix || process.env.ZOHO_DATACENTER || "com";
      authorizeOptions.data = {
        "suffix.one": suffix,
      };
    }

    if (toolkitSlug === "zoho_projects") {
      const clientId = process.env.ZOHO_CLIENT_ID;
      if (!clientId) {
        return NextResponse.json(
          { error: "Zoho OAuth Client ID is not configured (ZOHO_CLIENT_ID)" },
          { status: 500 }
        );
      }

      const dc = body.datacenter || process.env.ZOHO_DATACENTER || "com";
      const accountsDomain = getZohoAccountsDomain(dc);
      const redirectUri =
        process.env.ZOHO_REDIRECT_URI ||
        `${origin}/api/integrations/zoho/callback`;

      const statePayload = {
        userId: user.id,
        dc,
        app: "zoho_projects",
        timestamp: Date.now(),
      };
      const state = encodeURIComponent(JSON.stringify(statePayload));
      const scopes = getZohoProjectsScopes();

      const authUrl = `${accountsDomain}/oauth/v2/auth?scope=${scopes}&client_id=${clientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}&prompt=consent&state=${state}`;

      const response: ConnectResponse = {
        success: true,
        app: "zoho_projects",
        connectionId: `zoho_proj_${user.id}`,
        redirectUrl: authUrl,
      };

      return NextResponse.json(response);
    }

    const connectionRequest = await session.authorize(toolkitSlug, authorizeOptions);

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
