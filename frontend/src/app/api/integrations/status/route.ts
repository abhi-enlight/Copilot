import { createClient } from "@/lib/supabase-server";
import { adminSupabase } from "@/lib/supabase-admin";
import {
  getComposioSessionForUser,
  getComposioClient,
  normalizeToolSlug,
  formatToolStatus,
  clearSessionCacheForUser,
  sanitizeIntegrationError,
  CORE_PRISM_TOOL_SLUGS,
} from "@/lib/composio/session";
import { ensureUserTriggers } from "@/lib/composio/triggers";
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

      if (toolkitSlug === "zoho_projects") {
        const filter = user.email
          ? `auth_user_id.eq.${user.id},user_email.eq.${user.email.toLowerCase()}`
          : `auth_user_id.eq.${user.id}`;

        const { data: zohoIntegration } = await adminSupabase
          .from("user_integrations")
          .select("status, zoho_user_id, zoho_portal_id, updated_at")
          .or(filter)
          .eq("provider", "zoho")
          .eq("product", "projects")
          .maybeSingle();

        const isConnected = !!zohoIntegration && zohoIntegration.status === "active";
        const toolStatus: ToolConnectionStatus = {
          slug: "zoho_projects",
          name: "Zoho Projects",
          category: "Project Management",
          isConnected,
          status: isConnected ? "ACTIVE" : "INACTIVE",
          connectedAccountId: isConnected ? `zoho_proj_${user.id}` : undefined,
          connectedAccountName: zohoIntegration?.zoho_user_id || (isConnected ? "Connected Account" : undefined),
        };

        return NextResponse.json(
          { success: true, ...toolStatus },
          { headers: NO_CACHE_HEADERS }
        );
      }

      const [details, userAccounts] = await Promise.all([
        session.toolkits({ toolkits: [toolkitSlug] }),
        accountsPromise,
      ]);
      const item = (details.items || []).find(
        (t: { slug: string }) => t.slug === toolkitSlug
      );
      const userAccountsList = (userAccounts.items as ComposioAccountLike[] | undefined) || [];
      const matchedAcc =
        userAccountsList.find(
          (a) => (a.toolkit?.slug || "").toLowerCase() === toolkitSlug.toLowerCase() && a.status === "ACTIVE"
        ) ||
        userAccountsList.find(
          (a) => (a.toolkit?.slug || "").toLowerCase() === toolkitSlug.toLowerCase()
        );
      const displayName = resolveAccountName(matchedAcc);
      const toolStatus = formatToolStatus(toolkitSlug, item, displayName, matchedAcc);

      if (toolStatus.isConnected && toolStatus.status === "ACTIVE") {
        void ensureUserTriggers(user.id, toolkitSlug);
      }

      return NextResponse.json(
        { success: true, ...toolStatus },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Background sweep of triggers if user has active accounts
    void ensureUserTriggers(user.id);

    // Query status across all core MVP tools
    const composioSlugs = CORE_PRISM_TOOL_SLUGS.filter((s) => s !== "zoho_projects");
    const [details, userAccounts, zohoRes] = await Promise.all([
      session.toolkits({ toolkits: [...composioSlugs] }),
      accountsPromise,
      Promise.resolve(
        adminSupabase
          .from("user_integrations")
          .select("status, zoho_user_id, zoho_portal_id, updated_at")
          .or(
            user.email
              ? `auth_user_id.eq.${user.id},user_email.eq.${user.email.toLowerCase()}`
              : `auth_user_id.eq.${user.id}`
          )
          .eq("provider", "zoho")
          .eq("product", "projects")
          .maybeSingle()
      ).catch(() => ({ data: null })),
    ]);

    const zohoIntegration = zohoRes?.data;
    const userAccountsList = (userAccounts.items as ComposioAccountLike[] | undefined) || [];
    const accountDisplayNames = new Map<string, string>();
    const userAccountBySlug = new Map<string, ComposioAccountLike>();

    for (const acc of userAccountsList) {
      const slugKey = (acc.toolkit?.slug || "").toLowerCase();
      if (!slugKey) continue;

      const existing = userAccountBySlug.get(slugKey);
      if (!existing || (existing.status !== "ACTIVE" && acc.status === "ACTIVE")) {
        userAccountBySlug.set(slugKey, acc);
      }

      if (acc.status === "ACTIVE") {
        const name = resolveAccountName(acc);
        if (name) {
          if (acc.id) accountDisplayNames.set(acc.id, name);
          accountDisplayNames.set(slugKey, name);
        }
      }
    }

    const itemsMap = new Map<string, ToolkitItemLike>();
    for (const item of (details.items as ToolkitItemLike[] | undefined) || []) {
      if (item.slug) {
        itemsMap.set(item.slug.toLowerCase(), item);
      }
    }

    const tools: ToolConnectionStatus[] = CORE_PRISM_TOOL_SLUGS.map(
      (slug: SupportedToolSlug) => {
        if (slug === "zoho_projects") {
          const isConnected = !!zohoIntegration && zohoIntegration.status === "active";
          return {
            slug: "zoho_projects",
            name: "Zoho Projects",
            category: "Project Management",
            isConnected,
            status: isConnected ? "ACTIVE" : "INACTIVE",
            connectedAccountId: isConnected ? `zoho_proj_${user.id}` : undefined,
            connectedAccountName: zohoIntegration?.zoho_user_id || (isConnected ? "Connected Account" : undefined),
          };
        }

        const slugKey = slug.toLowerCase();
        const item = itemsMap.get(slugKey) || itemsMap.get(slug);
        const directAcc = userAccountBySlug.get(slugKey) || userAccountBySlug.get(slug);
        const accountId = item?.connection?.connectedAccount?.id || directAcc?.id;
        const displayName =
          (accountId ? accountDisplayNames.get(accountId) : undefined) ||
          accountDisplayNames.get(slugKey) ||
          accountDisplayNames.get(slug) ||
          resolveAccountName(directAcc);
        return formatToolStatus(slug, item, displayName, directAcc);
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
