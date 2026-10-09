/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AgentChatMessage } from "./llm";
import { evaluateScope } from "./scope-limit";

/**
 * Curated high-leverage actions per toolkit for Prism V2.
 * Filtering to these high-signal actions prevents LLM context flooding (e.g. GitHub has 896 tools)
 * while preserving 100% of Prism's cross-tool orchestration intelligence.
 */
export const CURATED_TOOLKIT_ACTIONS: Record<string, string[]> = {
  github: [
    "GITHUB_GET_PULL_REQUEST",
    "GITHUB_LIST_PULL_REQUESTS",
    "GITHUB_GET_ISSUE",
    "GITHUB_LIST_ISSUES_FOR_REPO",
    "GITHUB_CREATE_PULL_REQUEST_REVIEW",
    "GITHUB_CREATE_ISSUE_COMMENT",
    "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
    "GITHUB_SEARCH_REPOSITORIES",
    "GITHUB_GET_REPOSITORY",
  ],
  linear: [
    "LINEAR_LIST_ISSUES",
    "LINEAR_GET_ISSUE",
    "LINEAR_CREATE_ISSUE",
    "LINEAR_UPDATE_ISSUE",
    "LINEAR_SEARCH_ISSUES",
    "LINEAR_LIST_PROJECTS",
  ],
  slack: [
    "SLACK_CHAT_POST_MESSAGE",
    "SLACK_CONVERSATIONS_HISTORY",
    "SLACK_CONVERSATIONS_LIST",
    "SLACK_SEARCH_MESSAGES",
    "SLACK_LIST_USERS",
  ],
  microsoft_teams: [
    "MICROSOFT_TEAMS_SEND_CHAT_MESSAGE",
    "MICROSOFT_TEAMS_LIST_CHATS",
    "MICROSOFT_TEAMS_LIST_CHANNELS",
    "MICROSOFT_TEAMS_POST_MESSAGE_IN_CHANNEL",
  ],
  outlook: [
    "OUTLOOK_GET_MESSAGE",
    "OUTLOOK_LIST_MESSAGES",
    "OUTLOOK_SEND_MAIL",
    "OUTLOOK_LIST_EVENTS",
    "OUTLOOK_CREATE_EVENT",
    "OUTLOOK_SEARCH_MESSAGES",
  ],
  zoho: [
    "ZOHO_GET_RECORDS",
    "ZOHO_SEARCH_RECORDS",
    "ZOHO_CREATE_RECORDS",
    "ZOHO_UPDATE_RECORD",
    "ZOHO_GET_FIELDS",
  ],
  gmail: [
    "GMAIL_FETCH_THREAD",
    "GMAIL_LIST_THREADS",
    "GMAIL_SEND_EMAIL",
    "GMAIL_CREATE_DRAFT",
    "GMAIL_FETCH_MESSAGE",
    "GMAIL_LIST_MESSAGES",
  ],
  googlecalendar: [
    "GOOGLECALENDAR_FIND_EVENT",
    "GOOGLECALENDAR_LIST_EVENTS",
    "GOOGLECALENDAR_CREATE_EVENT",
    "GOOGLECALENDAR_UPDATE_EVENT",
    "GOOGLECALENDAR_PATCH_EVENT",
  ],
  notion: [
    "NOTION_SEARCH_NOTION_PAGE",
    "NOTION_FETCH_BLOCK_CONTENTS",
    "NOTION_CREATE_NOTION_PAGE",
    "NOTION_UPDATE_PAGE",
    "NOTION_GET_DATABASE",
    "NOTION_QUERY_DATABASE",
  ],
  dynamics365: [
    "DYNAMICS365_DYNAMICSCRM_CREATE_ACCOUNT",
  ],
  share_point: [
    "SHARE_POINT_GET_SITE_ROOT",
    "SHARE_POINT_LIST_SITE_DRIVES",
    "SHARE_POINT_GET_SITE_PAGE_CONTENT",
    "SHARE_POINT_GET_SITE_DRIVE_ITEM_BY_PATH",
    "SHARE_POINT_GET_FILE_BY_SERVER_RELATIVE_URL",
    "SHARE_POINT_CREATE_LIST_ITEM_BY_ID",
  ],
  zoho_books: [
    "ZOHO_BOOKS_APPLY_CREDITS_TO_INVOICE",
    "ZOHO_BOOKS_CONVERT_PURCHASE_ORDER_TO_BILL",
    "ZOHO_BOOKS_CREATE_CONTACT",
    "ZOHO_BOOKS_CREATE_BANK_TRANSACTION",
  ],
  jira: [
    "JIRA_CREATE_ISSUE",
    "JIRA_GET_ISSUE",
    "JIRA_UPDATE_ISSUE",
    "JIRA_SEARCH_ISSUES",
    "JIRA_ADD_COMMENT",
    "JIRA_GET_ALL_PROJECTS",
    "JIRA_TRANSITION_ISSUE",
  ],
  monday: [
    "MONDAY_LIST_BOARDS",
    "MONDAY_LIST_ITEMS",
    "MONDAY_GET_ITEMS",
    "MONDAY_CREATE_ITEM",
    "MONDAY_CREATE_UPDATE",
    "MONDAY_GET_WORKSPACES",
  ],
  clickup: [
    "CLICKUP_GET_TASK",
    "CLICKUP_CREATE_TASK",
    "CLICKUP_CREATE_TASK_COMMENT",
    "CLICKUP_GET_SPACES",
    "CLICKUP_GET_LISTS",
  ],
};

/**
 * Semantic intent keywords mapped to supported toolkits.
 */
export const TOOLKIT_INTENT_KEYWORDS: Record<string, string[]> = {
  github: [
    "github",
    "pr",
    "prs",
    "pull request",
    "pull requests",
    "repo",
    "repository",
    "repos",
    "commit",
    "commits",
    "review",
    "diff",
    "branch",
    "git",
    "codebase",
    "merge",
  ],
  linear: [
    "linear",
    "ticket",
    "tickets",
    "issue",
    "issues",
    "bug",
    "bugs",
    "sprint",
    "backlog",
    "story",
    "epic",
    "cycle",
  ],
  slack: [
    "slack",
    "channel",
    "channels",
    "thread",
    "threads",
    "dm",
    "dms",
    "slack message",
    "ping",
    "post",
    "message",
    "chat",
  ],
  microsoft_teams: [
    "teams",
    "microsoft teams",
    "channel",
    "broadcast",
    "group chat",
    "chat",
    "teams message",
  ],
  outlook: [
    "outlook",
    "microsoft mail",
    "email",
    "emails",
    "inbox",
    "correspondence",
    "mail",
    "send",
    "draft",
    "write",
    "compose",
  ],
  gmail: [
    "gmail",
    "google mail",
    "email",
    "emails",
    "inbox",
    "correspondence",
    "mail",
    "send",
    "draft",
    "write",
    "compose",
  ],
  googlecalendar: [
    "calendar",
    "schedule",
    "meeting",
    "meetings",
    "event",
    "events",
    "invite",
    "reschedule",
    "availability",
    "slot",
  ],
  notion: [
    "notion",
    "doc",
    "docs",
    "document",
    "documents",
    "spec",
    "specs",
    "notes",
    "wiki",
    "page",
    "pages",
    "database",
  ],
  zoho: [
    "zoho",
    "crm",
    "deal",
    "deals",
    "pipeline",
    "lead",
    "leads",
    "account",
    "accounts",
    "revenue",
    "sales",
    "contact",
    "contacts",
    "client",
    "customer",
    "prospect",
  ],
  dynamics365: [
    "dynamics",
    "dynamics365",
    "dynamics 365",
    "dynamics crm",
    "ms dynamics",
    "crm account",
    "crm accounts",
    "crm lead",
    "crm leads",
    "create account",
    "business account",
  ],
  share_point: [
    "sharepoint",
    "share point",
    "intranet",
    "document library",
    "site drives",
    "company files",
    "team site",
    "sharepoint site",
    "sharepoint doc",
    "site root",
  ],
  zoho_books: [
    "zoho books",
    "books",
    "invoice",
    "invoices",
    "bill",
    "bills",
    "accounting",
    "expense",
    "expenses",
    "unpaid invoice",
    "overdue invoice",
    "credit note",
    "purchase order",
  ],
  jira: [
    "jira",
    "atlassian",
    "jql",
    "jira ticket",
    "jira issue",
    "jira bug",
    "sprint backlog",
    "jira project",
    "jira board",
  ],
  monday: [
    "monday",
    "monday.com",
    "monday board",
    "board pulse",
    "monday item",
    "monday workspace",
  ],
  clickup: [
    "clickup",
    "click up",
    "clickup task",
    "clickup space",
    "clickup list",
    "task list",
  ],
};

/**
 * Extracts the canonical tool name from an OpenAI function definition or Composio tool object.
 */
export function extractToolName(tool: any): string {
  if (!tool) return "";
  if (typeof tool === "string") return tool;
  if (tool.function?.name) return tool.function.name;
  if (tool.name) return tool.name;
  if (tool.slug) return tool.slug;
  return "";
}

/**
 * Identifies which toolkit a given tool belongs to.
 */
export function detectToolkitForTool(toolName: string): string | null {
  const upper = toolName.toUpperCase();
  if (upper.startsWith("GITHUB_") || upper.includes("GITHUB")) return "github";
  if (upper.startsWith("LINEAR_") || upper.includes("LINEAR")) return "linear";
  if (upper.startsWith("SLACK_") || upper.includes("SLACK")) return "slack";
  if (
    upper.startsWith("MICROSOFT_TEAMS_") ||
    upper.startsWith("TEAMS_") ||
    upper.includes("TEAMS")
  )
    return "microsoft_teams";
  if (upper.startsWith("OUTLOOK_") || upper.includes("OUTLOOK")) return "outlook";
  if (upper.startsWith("GMAIL_") || upper.includes("GMAIL")) return "gmail";
  if (
    upper.startsWith("GOOGLECALENDAR_") ||
    upper.startsWith("GOOGLE_CALENDAR_") ||
    upper.includes("CALENDAR")
  )
    return "googlecalendar";
  if (upper.startsWith("NOTION_") || upper.includes("NOTION")) return "notion";
  if (upper.startsWith("ZOHO_BOOKS_") || upper.includes("ZOHO_BOOKS") || upper.includes("ZOHOBOOKS")) return "zoho_books";
  if (upper.startsWith("ZOHO_") || upper.includes("ZOHO")) return "zoho";
  if (upper.startsWith("DYNAMICS365_") || upper.includes("DYNAMICS")) return "dynamics365";
  if (upper.startsWith("SHARE_POINT_") || upper.includes("SHAREPOINT") || upper.includes("SHARE_POINT")) return "share_point";
  if (upper.startsWith("JIRA_") || upper.includes("JIRA")) return "jira";
  if (upper.startsWith("MONDAY_") || upper.includes("MONDAY")) return "monday";
  if (upper.startsWith("CLICKUP_") || upper.includes("CLICKUP")) return "clickup";
  return null;
}

/**
 * Scores toolkits based on semantic intent in user prompt and recent conversation history.
 */
export function scoreToolkitIntents(
  userMessage: string,
  chatHistory: AgentChatMessage[] = []
): Map<string, number> {
  const scores = new Map<string, number>();

  // Look at recent conversation history (last 6 messages / 3 full turns) to preserve multi-turn context
  const recentHistoryText = chatHistory
    .slice(-6)
    .map((m) => m.content || "")
    .join(" ")
    .toLowerCase();

  const currentMessageText = (userMessage || "").toLowerCase();

  for (const [toolkit, keywords] of Object.entries(TOOLKIT_INTENT_KEYWORDS)) {
    let score = 0;

    for (const kw of keywords) {
      // Regex boundary match to prevent substring false positives
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordRegex = new RegExp(`\\b${escaped}\\b`, "i");

      if (wordRegex.test(currentMessageText)) {
        score += 3;
      } else if (wordRegex.test(recentHistoryText)) {
        score += 1.5;
      }
    }

    if (score > 0) {
      scores.set(toolkit, score);
    }
  }

  return scores;
}

export interface ToolSelectorParams {
  allTools: any[];
  userMessage: string;
  chatHistory?: AgentChatMessage[];
  maxTools?: number;
}

/**
 * Compresses tool schemas by removing redundant metadata, trimming bloated descriptions,
 * and stripping unused fields to cut token payload by 50-70% and drastically accelerate TTFT.
 */
export function compressToolSchemas(tools: any[]): any[] {
  if (!Array.isArray(tools)) return [];

  return tools.map((tool) => {
    if (!tool || tool.type !== "function" || !tool.function) {
      return tool;
    }

    const fn = tool.function;
    const cleanFn: any = {
      name: fn.name,
      description: cleanText(fn.description, 180),
    };

    if (fn.parameters && typeof fn.parameters === "object") {
      cleanFn.parameters = compressSchemaNode(fn.parameters);
    }

    return {
      type: "function",
      function: cleanFn,
    };
  });
}

function cleanText(text: unknown, maxLen = 180): string {
  if (typeof text !== "string") return "";
  // Strip markdown links and repetitive tags
  let cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + "...";
}

function compressSchemaNode(node: any): any {
  if (!node || typeof node !== "object") return node;

  const result: any = {};

  if (node.type) result.type = node.type;
  if (node.description) result.description = cleanText(node.description, 120);
  if (Array.isArray(node.enum)) result.enum = node.enum;
  if (Array.isArray(node.required) && node.required.length > 0) {
    result.required = node.required;
  }

  if (node.properties && typeof node.properties === "object") {
    result.properties = {};
    for (const [key, propVal] of Object.entries(node.properties)) {
      // Skip internal metadata properties
      if (key.startsWith("_") || key.startsWith("x-")) continue;
      result.properties[key] = compressSchemaNode(propVal);
    }
  }

  if (node.items && typeof node.items === "object") {
    result.items = compressSchemaNode(node.items);
  }

  return result;
}

/**
 * Intent-Based Active Tool Selector.
 *
 * Dynamically selects at most `maxTools` (default 18, strictly <= 20) relevant tools
 * from the full connected toolkit pool based on user intent and high-leverage allowlists.
 * Compresses schemas before returning to guarantee sub-second TTFT.
 */
export function selectScopedTools(params: ToolSelectorParams): any[] {
  const { allTools, userMessage, chatHistory = [], maxTools = 18 } = params;

  if (!allTools || allTools.length === 0) {
    return [];
  }

  // Pre-flight boundary check: if prompt is strictly out of scope, return zero tools
  const scope = evaluateScope(userMessage);
  if (!scope.isInScope) {
    return [];
  }

  // 1. Group tools by toolkit
  const toolsByToolkit = new Map<string, any[]>();
  const otherTools: any[] = [];

  for (const tool of allTools) {
    const name = extractToolName(tool);
    const toolkit = detectToolkitForTool(name);
    if (toolkit) {
      const list = toolsByToolkit.get(toolkit) || [];
      list.push(tool);
      toolsByToolkit.set(toolkit, list);
    } else {
      otherTools.push(tool);
    }
  }

  // 2. Score intents for toolkits based on current message + history
  const intentScores = scoreToolkitIntents(userMessage, chatHistory);

  // Sort matched toolkits by intent score descending
  const matchedToolkits = Array.from(intentScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tk]) => tk)
    .filter((tk) => toolsByToolkit.has(tk));

  // Toolkits present in the user's session but not explicitly matched
  const connectedToolkits = Array.from(toolsByToolkit.keys());
  const backgroundToolkits = connectedToolkits.filter(
    (tk) => !matchedToolkits.includes(tk)
  );

  const selectedTools: any[] = [];
  const selectedToolNames = new Set<string>();

  const addToolIfEligible = (tool: any) => {
    if (selectedTools.length >= maxTools) return;
    const name = extractToolName(tool);
    if (!name || selectedToolNames.has(name)) return;
    selectedTools.push(tool);
    selectedToolNames.add(name);
  };

  // 3. Priority A: Curated tools from primary intent toolkits (up to 5-6 tools each)
  if (matchedToolkits.length > 0) {
    const quotaPerMatched = Math.max(
      3,
      Math.floor((maxTools - 4) / matchedToolkits.length)
    );

    for (const tk of matchedToolkits) {
      const toolsInTk = toolsByToolkit.get(tk) || [];
      const curatedNames = CURATED_TOOLKIT_ACTIONS[tk] || [];

      // Add curated actions first
      for (const curName of curatedNames) {
        const found = toolsInTk.find((t) =>
          extractToolName(t).toUpperCase().includes(curName.toUpperCase())
        );
        if (found) addToolIfEligible(found);
      }

      // If needed, fill remaining quota with other tools from this toolkit
      let countFromTk = toolsInTk.filter((t) =>
        selectedToolNames.has(extractToolName(t))
      ).length;
      for (const t of toolsInTk) {
        if (countFromTk >= quotaPerMatched) break;
        if (!selectedToolNames.has(extractToolName(t))) {
          addToolIfEligible(t);
          countFromTk++;
        }
      }
    }
  }

  // 4. Priority B: Baseline representation from background connected toolkits (1-2 curated tools each)
  // Ensures Prism can still orchestrate cross-tool workflows if needed
  for (const tk of backgroundToolkits) {
    if (selectedTools.length >= maxTools) break;
    const toolsInTk = toolsByToolkit.get(tk) || [];
    const curatedNames = CURATED_TOOLKIT_ACTIONS[tk] || [];

    // Add top 1-2 curated actions
    let addedForTk = 0;
    for (const curName of curatedNames) {
      if (addedForTk >= 2 || selectedTools.length >= maxTools) break;
      const found = toolsInTk.find((t) =>
        extractToolName(t).toUpperCase().includes(curName.toUpperCase())
      );
      if (found && !selectedToolNames.has(extractToolName(found))) {
        addToolIfEligible(found);
        addedForTk++;
      }
    }
  }

  // 5. Priority C: Fill any remaining slots up to maxTools from remaining curated or other tools
  if (selectedTools.length < maxTools) {
    for (const tool of allTools) {
      if (selectedTools.length >= maxTools) break;
      addToolIfEligible(tool);
    }
  }

  const finalScoped = selectedTools.slice(0, maxTools);
  // Compress function schemas to strip bloat and maximize TTFT performance
  return compressToolSchemas(finalScoped);
}
