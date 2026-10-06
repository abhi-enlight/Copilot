import { getComposioClient } from "./session";

/**
 * Enterprise trigger map for Prism V2 Live Stack Telemetry.
 * Maps supported tools to their real-time event trigger slugs.
 */
export const TOOL_TRIGGER_MAP: Record<string, string[]> = {
  outlook: ["OUTLOOK_MESSAGE_TRIGGER"],
  slack: ["SLACK_RECEIVE_MESSAGE"],
  gmail: ["GMAIL_NEW_GMAIL_MESSAGE"],
  googlecalendar: ["GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_CREATED_TRIGGER"],
  notion: ["NOTION_PAGE_CREATED"],
};

export interface EnsureTriggersResult {
  attempted: number;
  created: number;
  alreadyActive: number;
  errors: string[];
}

interface TriggerAccountLike {
  id: string;
  status?: string;
  toolkit?: { slug?: string };
  app?: { name?: string };
  userId?: string;
  user?: { id?: string };
}

/**
 * Ensures active webhook triggers exist for a user's connected accounts.
 * Safe, idempotent, non-blocking.
 *
 * @param userId - Supabase auth user UUID
 * @param toolkitSlug - Optional filter to target a specific tool
 */
export async function ensureUserTriggers(
  userId: string,
  toolkitSlug?: string
): Promise<EnsureTriggersResult> {
  const entityId = `user_${userId}`;
  const composio = getComposioClient();
  const result: EnsureTriggersResult = {
    attempted: 0,
    created: 0,
    alreadyActive: 0,
    errors: [],
  };

  try {
    // 1. Fetch user's active connected accounts
    const accountsRes = await composio.connectedAccounts
      .list({ userIds: [entityId] })
      .catch(() => ({ items: [] }));

    const rawItems = (accountsRes.items || []) as unknown as TriggerAccountLike[];
    const activeAccounts = rawItems.filter(
      (a) => a.status === "ACTIVE"
    );

    if (activeAccounts.length === 0) {
      return result;
    }

    // 2. Query workspace active trigger instances
    const activeTriggersRes = await composio.triggers
      .listActive({})
      .catch(() => ({ items: [] }));

    const activeTriggerMap = new Set<string>();
    for (const t of activeTriggersRes.items || []) {
      if (t.connectedAccountId && t.triggerName) {
        activeTriggerMap.add(`${t.connectedAccountId}:${t.triggerName}`);
      }
    }

    // 3. For each active account matching relevant toolkits, ensure triggers are provisioned
    for (const acc of activeAccounts) {
      const slug = acc.toolkit?.slug || acc.app?.name;
      if (!slug) continue;
      if (toolkitSlug && slug !== toolkitSlug) continue;

      const triggerSlugs = TOOL_TRIGGER_MAP[slug];
      if (!triggerSlugs || triggerSlugs.length === 0) continue;

      for (const trigSlug of triggerSlugs) {
        result.attempted++;
        const key = `${acc.id}:${trigSlug}`;
        if (activeTriggerMap.has(key)) {
          result.alreadyActive++;
          continue;
        }

        try {
          const triggerConfig =
            trigSlug === "GMAIL_NEW_GMAIL_MESSAGE"
              ? { userId: "me", interval: 1, labelIds: "INBOX" }
              : trigSlug === "GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_CREATED_TRIGGER"
              ? { interval: 2, calendarId: "primary" }
              : {};

          await composio.triggers.create(entityId, trigSlug, {
            connectedAccountId: acc.id,
            triggerConfig,
          });
          result.created++;
          activeTriggerMap.add(key);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          // If trigger already exists or is marked active, count as alreadyActive
          if (
            errMsg.includes("already exists") ||
            errMsg.includes("duplicate") ||
            errMsg.includes("active")
          ) {
            result.alreadyActive++;
          } else {
            result.errors.push(`${trigSlug} on ${acc.id}: ${errMsg}`);
          }
        }
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`General error: ${errMsg}`);
  }

  return result;
}

/**
 * Sweeps and provisions triggers across all active connected accounts in the workspace.
 */
export async function ensureAllActiveTriggers(): Promise<EnsureTriggersResult> {
  const composio = getComposioClient();
  const result: EnsureTriggersResult = {
    attempted: 0,
    created: 0,
    alreadyActive: 0,
    errors: [],
  };

  try {
    const [accountsRes, activeTriggersRes] = await Promise.all([
      composio.connectedAccounts.list({}).catch(() => ({ items: [] })),
      composio.triggers.listActive({}).catch(() => ({ items: [] })),
    ]);

    const rawItems = (accountsRes.items || []) as unknown as TriggerAccountLike[];
    const activeAccounts = rawItems.filter(
      (a) => a.status === "ACTIVE"
    );

    const activeTriggerMap = new Set<string>();
    for (const t of activeTriggersRes.items || []) {
      if (t.connectedAccountId && t.triggerName) {
        activeTriggerMap.add(`${t.connectedAccountId}:${t.triggerName}`);
      }
    }

    for (const acc of activeAccounts) {
      const slug = acc.toolkit?.slug || acc.app?.name;
      if (!slug) continue;

      const triggerSlugs = TOOL_TRIGGER_MAP[slug];
      if (!triggerSlugs || triggerSlugs.length === 0) continue;

      const entityId =
        acc.userId ||
        (acc as unknown as Record<string, unknown>).user_id as string | undefined ||
        (acc.user?.id ? `user_${acc.user.id}` : undefined);
      if (!entityId) continue;

      for (const trigSlug of triggerSlugs) {
        result.attempted++;
        const key = `${acc.id}:${trigSlug}`;
        if (activeTriggerMap.has(key)) {
          result.alreadyActive++;
          continue;
        }

        try {
          const triggerConfig =
            trigSlug === "GMAIL_NEW_GMAIL_MESSAGE"
              ? { userId: "me", interval: 1, labelIds: "INBOX" }
              : trigSlug === "GOOGLECALENDAR_GOOGLE_CALENDAR_EVENT_CREATED_TRIGGER"
              ? { interval: 2, calendarId: "primary" }
              : {};

          await composio.triggers.create(entityId, trigSlug, {
            connectedAccountId: acc.id,
            triggerConfig,
          });
          result.created++;
          activeTriggerMap.add(key);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (
            errMsg.includes("already exists") ||
            errMsg.includes("duplicate") ||
            errMsg.includes("active")
          ) {
            result.alreadyActive++;
          } else {
            result.errors.push(`${trigSlug} on ${acc.id}: ${errMsg}`);
          }
        }
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Sweep error: ${errMsg}`);
  }

  return result;
}
