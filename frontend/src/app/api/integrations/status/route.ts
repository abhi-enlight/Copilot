import { createClient } from "@/lib/supabase-server";
import {
  getComposioSessionForUser,
  getComposioClient,
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

interface ComposioAccountLike {
  id?: string;
  status?: string;
  alias?: string;
  toolkit?: {
    slug?: string;
  };
  data?: {
    displayName?: string;
    email?: string;
    username?: string;
    [key: string]: unknown;
  };
  state?: {
    val?: {
      displayName?: string;
      email?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  params?: {
    user_email?: string;
    email?: string;
    [key: string]: unknown;
  };
}

interface ToolkitItemLike {
  slug?: string;
  logo?: string;
  connection?: {
    isActive?: boolean;
    connectedAccount?: {
      id?: string;
      status?: string;
    };
  };
}

function resolveAccountName(acc?: ComposioAccountLike | null): string | undefined {
  if (!acc) return undefined;
  const candidates = [
    acc.data?.displayName,
    acc.state?.val?.displayName,
    acc.data?.email,
    acc.state?.val?.email,
    acc.params?.user_email,
    acc.params?.email,
    acc.alias,
    acc.data?.username ? `@${acc.data.username}` : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim();
    }
  }
  return undefined;
}

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

    const entityId = `user_${user.id}`;
    const composio = getComposioClient();

    // Query connected accounts to resolve account display name / username / email
    const accountsPromise = composio.connectedAccounts
      .list({ userIds: [entityId] })
      .catch(() => ({ items: [] }));

    if (appQuery) {
      const toolkitSlug = normalizeToolSlug(appQuery);
      const [details, userAccounts] = await Promise.all([
        session.toolkits({ toolkits: [toolkitSlug] }),
        accountsPromise,
      ]);
      const item = (details.items || []).find(
        (t: { slug: string }) => t.slug === toolkitSlug
      );
      const userAccountsList = (userAccounts.items as ComposioAccountLike[] | undefined) || [];
      const matchedAcc = userAccountsList.find(
        (a) => a.toolkit?.slug === toolkitSlug && a.status === "ACTIVE"
      );
      const displayName = resolveAccountName(matchedAcc);
      const toolStatus = formatToolStatus(toolkitSlug, item, displayName);

      return NextResponse.json(
        { success: true, ...toolStatus },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Query status across all core MVP tools
    const [details, userAccounts] = await Promise.all([
      session.toolkits({ toolkits: [...CORE_PRISM_TOOL_SLUGS] }),
      accountsPromise,
    ]);

    const userAccountsList = (userAccounts.items as ComposioAccountLike[] | undefined) || [];
    const accountDisplayNames = new Map<string, string>();
    for (const acc of userAccountsList) {
      if (acc.status === "ACTIVE") {
        const name = resolveAccountName(acc);
        if (name) {
          if (acc.id) accountDisplayNames.set(acc.id, name);
          if (acc.toolkit?.slug) accountDisplayNames.set(acc.toolkit.slug, name);
        }
      }
    }

    const itemsMap = new Map<string, ToolkitItemLike>();
    for (const item of (details.items as ToolkitItemLike[] | undefined) || []) {
      if (item.slug) {
        itemsMap.set(item.slug, item);
      }
    }

    const tools: ToolConnectionStatus[] = CORE_PRISM_TOOL_SLUGS.map(
      (slug: SupportedToolSlug) => {
        const item = itemsMap.get(slug);
        const accountId = item?.connection?.connectedAccount?.id;
        const displayName = (accountId ? accountDisplayNames.get(accountId) : undefined) || accountDisplayNames.get(slug);
        return formatToolStatus(slug, item, displayName);
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
