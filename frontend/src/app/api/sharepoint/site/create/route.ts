import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { resolveMicrosoftVaultTokens } from "@/lib/microsoft-vault";
import { getConnectorPreferences, isConnectorPaused } from "@/lib/connector-preferences";
import { createSharePointSite, CreateSharePointSiteOptions } from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, userEmail } = auth;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  const webUrl = typeof body.webUrl === "string" ? body.webUrl.trim() : undefined;
  const siteSlug = typeof body.siteSlug === "string" ? body.siteSlug.trim() : undefined;
  const template =
    body.template === "sitepagepublishing" ? "sitepagepublishing" : "sts"; // Default to Team Site (sts)

  if (!name) {
    return NextResponse.json({ error: "SharePoint site name is required" }, { status: 400 });
  }

  // 1. Check connector pause state
  const prefs = await getConnectorPreferences(userEmail || user.id);
  if (isConnectorPaused(prefs, "microsoft.sharepoint")) {
    return NextResponse.json(
      {
        error: "SharePoint connector is currently paused. Please resume it in the Connections tab.",
        code: "CONNECTOR_PAUSED",
      },
      { status: 403 }
    );
  }

  // 2. Resolve Microsoft OAuth token for SharePoint from user vault
  const msVault = await resolveMicrosoftVaultTokens(user.id, userEmail, "sharepoint");
  if (!msVault.accessToken) {
    return NextResponse.json(
      {
        error: "SharePoint is not connected or requires re-authentication. Please connect SharePoint in the Connections tab.",
        code: "NOT_CONNECTED",
        requiresReconnect: true,
        reconnectUrl: "/api/integrations/microsoft/connect?preset=org_sharepoint&prompt=consent&returnTo=/",
      },
      { status: 403 }
    );
  }

  // 3. Pre-flight scope check for Sites.Create.All or Sites.Manage.All
  const userScopes: string[] = msVault.scopes || [];
  const hasSiteCreateScope =
    userScopes.length === 0 || // unparsed/generic fallback
    userScopes.some((s: string) => /sites\.(create|manage|fullcontrol)/i.test(s));

  if (!hasSiteCreateScope) {
    return NextResponse.json(
      {
        error: "Your Microsoft connection is missing site creation permissions (Sites.Create.All). Please authorize SharePoint with site creation access.",
        code: "INSUFFICIENT_SCOPES",
        requiresReconnect: true,
        reconnectUrl: "/api/integrations/microsoft/connect?preset=org_sharepoint&prompt=consent&returnTo=/",
      },
      { status: 403 }
    );
  }

  // 4. Create SharePoint Site via Microsoft Graph
  const options: CreateSharePointSiteOptions = {
    name,
    description,
    webUrl,
    siteSlug,
    template,
    ownerEmail: userEmail || undefined,
  };

  const result = await createSharePointSite(msVault.accessToken, options);

  if (!result.success) {
    const isAccessDenied =
      result.code === "ErrorAccessDenied" ||
      result.code === "403" ||
      /forbidden|access denied|permission/i.test(result.error || "");

    return NextResponse.json(
      {
        error: result.error || "Failed to create SharePoint site",
        code: result.code || (isAccessDenied ? "FORBIDDEN" : "GRAPH_ERROR"),
        requiresReconnect: isAccessDenied,
        reconnectUrl: isAccessDenied
          ? "/api/integrations/microsoft/connect?preset=org_sharepoint&prompt=consent&returnTo=/"
          : undefined,
      },
      { status: isAccessDenied ? 403 : 502 }
    );
  }

  return NextResponse.json({
    success: true,
    siteId: result.siteId,
    webUrl: result.webUrl,
    name: result.name,
  });
}
