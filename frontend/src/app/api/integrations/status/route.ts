import { createClient } from "@/lib/supabase-server";
import {
  getComposioSessionForUser,
  normalizeToolSlug,
  formatToolStatus,
  clearSessionCacheForUser,
  sanitizeIntegrationError,
  CORE_PRISM_TOOL_SLUGS,
} from "@/lib/composio/session";
import type { SupportedToolSlug, ToolConnectionStatus } from "@/types/integrations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(request.url);
    const appQuery = searchParams.get("app");
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) {
      clearSessionCacheForUser(user.id);
    }

    const { session } = await getComposioSessionForUser(user.id);

    if (appQuery) {
      const toolkitSlug = normalizeToolSlug(appQuery);
      const details = await session.toolkits({ toolkits: [toolkitSlug] });
      const item = (details.items || []).find(
        (t: { slug: string }) => t.slug === toolkitSlug
      );
      const toolStatus = formatToolStatus(toolkitSlug, item);

      return NextResponse.json(
        { success: true, ...toolStatus },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Query status across all core MVP tools
    const details = await session.toolkits({
      toolkits: [...CORE_PRISM_TOOL_SLUGS],
    });

    const itemsMap = new Map<string, unknown>();
    for (const item of details.items || []) {
      itemsMap.set(item.slug, item);
    }

    const tools: ToolConnectionStatus[] = CORE_PRISM_TOOL_SLUGS.map(
      (slug: SupportedToolSlug) => {
        return formatToolStatus(slug, itemsMap.get(slug));
      }
    );

    return NextResponse.json({ success: true, tools }, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    console.error("Prism status error:", err);
    return NextResponse.json(
      { error: sanitizeIntegrationError(err) },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
