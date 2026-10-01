import { Composio } from "@composio/core";
import type { SupportedToolSlug, ToolConnectionStatus, ToolConnectionState } from "@/types/integrations";

export interface PrismToolMetadata {
  slug: SupportedToolSlug;
  name: string;
  category: string;
  description: string;
}

/**
 * Supported Prism V2 MVP enterprise tool directory.
 * Aliases map transparently to live provider slugs.
 */
export const PRISM_TOOL_REGISTRY: Record<string, PrismToolMetadata> = {
  outlook: {
    slug: "outlook",
    name: "Microsoft Outlook",
    category: "Communication",
    description: "Read, draft, and triage emails and calendar events.",
  },
  "microsoft-outlook": {
    slug: "outlook",
    name: "Microsoft Outlook",
    category: "Communication",
    description: "Read, draft, and triage emails and calendar events.",
  },
  teams: {
    slug: "microsoft_teams",
    name: "Microsoft Teams",
    category: "Collaboration",
    description: "Channel messages, direct chats, and team notifications.",
  },
  "microsoft-teams": {
    slug: "microsoft_teams",
    name: "Microsoft Teams",
    category: "Collaboration",
    description: "Channel messages, direct chats, and team notifications.",
  },
  microsoft_teams: {
    slug: "microsoft_teams",
    name: "Microsoft Teams",
    category: "Collaboration",
    description: "Channel messages, direct chats, and team notifications.",
  },
  slack: {
    slug: "slack",
    name: "Slack",
    category: "Messaging",
    description: "Instant messaging, thread monitoring, and alerts.",
  },
  linear: {
    slug: "linear",
    name: "Linear",
    category: "Project Management",
    description: "Issues, cycles, team backlogs, and status tracking.",
  },
  zoho: {
    slug: "zoho",
    name: "Zoho CRM",
    category: "CRM & Deals",
    description: "Leads, deals, accounts, and customer pipelines.",
  },
  "zoho-crm": {
    slug: "zoho",
    name: "Zoho CRM",
    category: "CRM & Deals",
    description: "Leads, deals, accounts, and customer pipelines.",
  },
  github: {
    slug: "github",
    name: "GitHub",
    category: "Code & Engineering",
    description: "Inspect repositories, pull requests, issues, and stage code reviews.",
  },
  gh: {
    slug: "github",
    name: "GitHub",
    category: "Code & Engineering",
    description: "Inspect repositories, pull requests, issues, and stage code reviews.",
  },
  gmail: {
    slug: "gmail",
    name: "Google Gmail",
    category: "Communication",
    description: "Search corporate threads, review correspondence, and draft replies with Google Workspace.",
  },
  googlecalendar: {
    slug: "googlecalendar",
    name: "Google Calendar",
    category: "Scheduling",
    description: "Manage calendar events, check team availability, and organize meetings.",
  },
  "google-calendar": {
    slug: "googlecalendar",
    name: "Google Calendar",
    category: "Scheduling",
    description: "Manage calendar events, check team availability, and organize meetings.",
  },
  google_calendar: {
    slug: "googlecalendar",
    name: "Google Calendar",
    category: "Scheduling",
    description: "Manage calendar events, check team availability, and organize meetings.",
  },
  notion: {
    slug: "notion",
    name: "Notion",
    category: "Knowledge & Docs",
    description: "Search workspace pages, read team documentation, and draft notes.",
  },
  dynamics365: {
    slug: "dynamics365",
    name: "Microsoft Dynamics 365",
    category: "CRM & Pipeline",
    description: "Inspect customer accounts, pipeline opportunities, contacts, and sales engagement.",
  },
  dynamics: {
    slug: "dynamics365",
    name: "Microsoft Dynamics 365",
    category: "CRM & Pipeline",
    description: "Inspect customer accounts, pipeline opportunities, contacts, and sales engagement.",
  },
  "dynamics-365": {
    slug: "dynamics365",
    name: "Microsoft Dynamics 365",
    category: "CRM & Pipeline",
    description: "Inspect customer accounts, pipeline opportunities, contacts, and sales engagement.",
  },
  "dynamics_365": {
    slug: "dynamics365",
    name: "Microsoft Dynamics 365",
    category: "CRM & Pipeline",
    description: "Inspect customer accounts, pipeline opportunities, contacts, and sales engagement.",
  },
};

export const CORE_PRISM_TOOL_SLUGS: SupportedToolSlug[] = [
  "outlook",
  "microsoft_teams",
  "slack",
  "linear",
  "zoho",
  "github",
  "gmail",
  "googlecalendar",
  "notion",
  "dynamics365",
];

export function normalizeToolSlug(app: string): SupportedToolSlug {
  const key = app.toLowerCase().trim();
  const entry = PRISM_TOOL_REGISTRY[key];
  if (!entry) {
    throw new Error(
      `Unsupported tool "${app}". Supported tools: ${CORE_PRISM_TOOL_SLUGS.join(", ")}`
    );
  }
  return entry.slug;
}

// ── Bounded LRU In-Memory Session Cache ──────────────────────────────
interface CacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  createdAt: number;
}

const MAX_CACHE_SIZE = 200;
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const sessionCache = new Map<string, CacheEntry>();

function getCachedSession(entityId: string) {
  const entry = sessionCache.get(entityId);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
    sessionCache.delete(entityId);
    return null;
  }

  // Refresh LRU order
  sessionCache.delete(entityId);
  sessionCache.set(entityId, entry);
  return entry.session;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setCachedSession(entityId: string, session: any) {
  if (sessionCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey) sessionCache.delete(oldestKey);
  }
  sessionCache.set(entityId, { session, createdAt: Date.now() });
}

export function clearSessionCacheForUser(userId: string) {
  sessionCache.delete(`user_${userId}`);
}

/**
 * Returns a configured Composio Platform SDK instance.
 */
export function getComposioClient(): Composio {
  const apiKey = (process.env.COMPOSIO_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is not configured in environment");
  }
  return new Composio({ apiKey });
}

/**
 * Creates or retrieves an isolated Tool Router session scoped to a user.
 * Enforces per-user entity partitioning: `user_${userId}`.
 */
export async function getComposioSessionForUser(userId: string) {
  const entityId = `user_${userId}`;
  const cached = getCachedSession(entityId);
  if (cached) {
    return { session: cached, entityId };
  }

  const composio = getComposioClient();
  const session = await composio.sessions.create(entityId, {
    manageConnections: true,
  });

  setCachedSession(entityId, session);
  return { session, entityId };
}

/**
 * Formats live provider status into clean Prism connection model.
 */
export function formatToolStatus(
  slug: SupportedToolSlug,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item?: any,
  accountDisplayName?: string
): ToolConnectionStatus {
  const meta = PRISM_TOOL_REGISTRY[slug] || {
    slug,
    name: slug,
    category: "Tool",
    description: "",
  };

  const isConnected = Boolean(item?.connection?.isActive);
  const rawStatus = (item?.connection?.connectedAccount?.status || "").toUpperCase();

  let status: ToolConnectionState = "INACTIVE";
  if (isConnected && rawStatus === "ACTIVE") {
    status = "ACTIVE";
  } else if (rawStatus === "EXPIRED" || rawStatus === "REVOKED") {
    status = "EXPIRED";
  } else if (rawStatus === "FAILED" || rawStatus === "ERROR") {
    status = "ERROR";
  }

  const accountId = item?.connection?.connectedAccount?.id;
  const resolvedName =
    accountDisplayName ||
    item?.connection?.connectedAccount?.data?.displayName ||
    item?.connection?.connectedAccount?.state?.val?.displayName ||
    item?.connection?.connectedAccount?.data?.email ||
    item?.connection?.connectedAccount?.state?.val?.email ||
    item?.connection?.connectedAccount?.params?.user_email ||
    item?.connection?.connectedAccount?.params?.email ||
    item?.connection?.connectedAccount?.alias ||
    undefined;

  return {
    slug,
    name: meta.name,
    category: meta.category,
    logo: item?.logo,
    isConnected,
    status,
    connectedAccountId: accountId,
    connectedAccountName: resolvedName,
  };
}

/**
 * Sanitizes external error messages to guarantee zero brand leakage to clients.
 */
export function sanitizeIntegrationError(err: unknown): string {
  if (!err) return "An unexpected error occurred during connection.";
  const message = err instanceof Error ? err.message : String(err);

  // Strip internal provider names, URLs, and token strings
  const sanitized = message
    .replace(/composio/gi, "Prism")
    .replace(/https?:\/\/[^\s]+/g, "[internal]")
    .replace(/ak_[a-zA-Z0-9_-]+/g, "[secret]");

  return sanitized || "Failed to process tool connection.";
}
