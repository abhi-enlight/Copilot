import type { ActionProposal } from "@/types/database";
import { generateActionSignature } from "./crypto";

export type ToolTier = "read_only" | "mutation";

// Verbs that indicate a DELETION task (Confirmation ALWAYS required)
const DELETION_VERBS = [
  "delete",
  "remove",
  "purge",
  "drop",
  "destroy",
  "archive",
  "trash",
  "cancel",
];

// Verbs that indicate an UPDATE / MUTATION task (Confirmation ALWAYS required)
const MUTATION_VERBS = [
  "update",
  "modify",
  "patch",
  "edit",
  "put",
  "change",
  "send",
  "create",
  "post",
  "write",
  "merge",
  "comment",
  "review",
  "schedule",
  "insert",
  "submit",
  "archive",
  "close",
];

// Explicit read-only / query verbs that NEVER require confirmation
const READ_ONLY_VERBS = [
  "search",
  "get",
  "list",
  "read",
  "fetch",
  "query",
  "retrieve",
  "find",
  "lookup",
  "check",
  "inspect",
  "preview",
  "status",
  "count",
];

/**
 * Helper to extract inner tool information from multi-execute wrappers (e.g. COMPOSIO_MULTI_EXECUTE_TOOL)
 */
export function extractInnerToolDetails(
  toolSlug: string,
  payload?: Record<string, unknown>
): {
  normalizedSlug: string;
  actualToolSlug: string;
  actualPayload: Record<string, unknown>;
} {
  const slug = (toolSlug || "").trim();
  const lower = slug.toLowerCase();

  // If this is a multi-execute wrapper tool
  if (lower.includes("multi_execute") || lower.includes("multi-execute")) {
    const tools = Array.isArray(payload?.tools)
      ? (payload.tools as Array<{ tool_slug?: string; arguments?: Record<string, unknown> }>)
      : [];
    if (tools.length > 0 && tools[0]?.tool_slug) {
      const innerSlug = tools[0].tool_slug;
      const innerLower = innerSlug.toLowerCase();
      const innerArgs = (tools[0].arguments || {}) as Record<string, unknown>;

      let normalized = "system";
      if (innerLower.includes("outlook")) normalized = "outlook";
      else if (innerLower.includes("teams")) normalized = "microsoft_teams";
      else if (innerLower.includes("slack")) normalized = "slack";
      else if (innerLower.includes("linear")) normalized = "linear";
      else if (innerLower.includes("zoho")) normalized = "zoho";
      else if (innerLower.includes("github")) normalized = "github";
      else if (innerLower.includes("gmail")) normalized = "gmail";
      else if (innerLower.includes("calendar")) normalized = "googlecalendar";
      else if (innerLower.includes("notion")) normalized = "notion";
      else if (innerLower.includes("mail")) normalized = "outlook";

      return {
        normalizedSlug: normalized,
        actualToolSlug: innerSlug,
        actualPayload: innerArgs,
      };
    }
  }

  let normalized = slug;
  if (lower.includes("outlook")) normalized = "outlook";
  else if (lower.includes("teams")) normalized = "microsoft_teams";
  else if (lower.includes("slack")) normalized = "slack";
  else if (lower.includes("linear")) normalized = "linear";
  else if (lower.includes("zoho")) normalized = "zoho";
  else if (lower.includes("github")) normalized = "github";
  else if (lower.includes("gmail")) normalized = "gmail";
  else if (lower.includes("calendar")) normalized = "googlecalendar";
  else if (lower.includes("notion")) normalized = "notion";
  else if (lower.includes("mail")) normalized = "outlook";

  return {
    normalizedSlug: normalized,
    actualToolSlug: slug,
    actualPayload: payload || {},
  };
}

/**
 * Helper to determine if an operation is routine inbox triage (marking emails read/unread)
 * which should execute autonomously as a simple task rather than requiring high-friction cards.
 */
export function isRoutineTriage(slug: string, payload?: Record<string, unknown>): boolean {
  const s = slug.toLowerCase();
  // Deletions are never simple triage
  if (DELETION_VERBS.some((v) => s.includes(v))) return false;

  if (s.includes("mail") || s.includes("outlook") || s.includes("message")) {
    if (s.includes("read") || s.includes("is_read") || s.includes("isread")) return true;
    if (payload) {
      if (payload.isRead !== undefined || payload.is_read !== undefined) return true;
      if (Array.isArray(payload.updates)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isReadPatch = payload.updates.some((u: any) => u?.patch?.isRead !== undefined || u?.patch?.is_read !== undefined);
        if (isReadPatch) return true;
      }
    }
  }
  return false;
}

/**
 * Classifies whether a tool execution requires user sign-off (Tier 2: Mutation)
 * or can execute autonomously inline (Tier 1: Read-Only / Simple Task).
 *
 * RULE: Confirmation is asked ONLY for:
 * 1. Deletion tasks (delete, remove, purge, destroy, archive, etc.)
 * 2. Update tasks (update, modify, patch, edit, put, etc.)
 *    EXCEPT: Routine inbox triage tasks like marking emails as read/unread.
 * 3. High-risk tasks (financial amount >= $10k, broad broadcast to all/general, etc.)
 *
 * Simple tasks (listing channels, reading emails, searching issues, status checks, marking email read)
 * execute autonomously without confirmation.
 */
export function classifyToolTier(
  toolSlug: string,
  payload?: Record<string, unknown>
): ToolTier {
  const normalized = (toolSlug || "").toLowerCase().trim();

  // Handle multi-execute wrapper tool
  if (normalized.includes("multi_execute") || normalized.includes("multi-execute")) {
    const toolsList = Array.isArray(payload?.tools)
      ? (payload.tools as Array<{ tool_slug?: string; arguments?: Record<string, unknown> }>)
      : [];

    if (toolsList.length === 0) {
      // Empty or discovery call -> simple task, autonomous
      return "read_only";
    }

    // Inspect all inner tools: if ANY requires confirmation, classify as mutation
    for (const item of toolsList) {
      const innerSlug = (item.tool_slug || "").toLowerCase();
      const innerArgs = (item.arguments || {}) as Record<string, unknown>;

      // 1. Deletion task? -> ALWAYS requires confirmation
      if (DELETION_VERBS.some((verb) => innerSlug.includes(verb))) {
        return "mutation";
      }

      // Check for routine triage before update verbs
      if (isRoutineTriage(innerSlug, innerArgs)) {
        continue;
      }

      // 2. Mutation task? -> Requires confirmation
      if (MUTATION_VERBS.some((verb) => innerSlug.includes(verb))) {
        return "mutation";
      }

      // 3. High risk task?
      if (evaluateRiskLevel(innerSlug, innerArgs) === "high") {
        return "mutation";
      }
    }

    // All tools are simple read/list/query/search/triage operations
    return "read_only";
  }

  // Meta / discovery tools (e.g. search_tools, get_tool_schemas) are always read_only
  if (
    normalized.includes("search_tool") ||
    normalized.includes("get_tool") ||
    normalized.includes("manage_connections")
  ) {
    return "read_only";
  }

  // Explicit read-only query verbs
  for (const verb of READ_ONLY_VERBS) {
    if (normalized.includes(verb)) {
      return "read_only";
    }
  }

  // Explicit deletion tasks -> ALWAYS requires confirmation
  for (const verb of DELETION_VERBS) {
    if (normalized.includes(verb)) {
      return "mutation";
    }
  }

  // Routine triage tasks (e.g. marking emails read/unread) -> autonomous execution
  if (isRoutineTriage(toolSlug, payload)) {
    return "read_only";
  }

  // Explicit mutation tasks -> ALWAYS requires confirmation
  for (const verb of MUTATION_VERBS) {
    if (normalized.includes(verb)) {
      return "mutation";
    }
  }

  // High risk evaluation
  if (evaluateRiskLevel(toolSlug, payload || {}) === "high") {
    return "mutation";
  }

  // By default, simple tasks execute autonomously without confirmation
  return "read_only";
}

/**
 * Evaluates the risk level of an action proposal.
 */
export function evaluateRiskLevel(
  toolSlug: string,
  payload: Record<string, unknown>
): "low" | "medium" | "high" {
  const slug = toolSlug.toLowerCase();

  // High risk: destructive operations or large financial values
  if (
    slug.includes("delete") ||
    slug.includes("remove") ||
    slug.includes("purge") ||
    slug.includes("drop") ||
    slug.includes("destroy") ||
    (typeof payload.amount === "number" && payload.amount >= 10000) ||
    (typeof payload.Amount === "number" && payload.Amount >= 10000) ||
    (typeof payload.deal_amount === "number" && payload.deal_amount >= 10000)
  ) {
    return "high";
  }

  // High risk: sending emails or team messages to broad audiences
  if (
    (slug.includes("send") || slug.includes("post")) &&
    (payload.to === "all" || payload.channel === "general" || payload.to === "company-wide")
  ) {
    return "high";
  }

  // Medium risk: creations, modifications, and updates
  if (
    slug.includes("update") ||
    slug.includes("modify") ||
    slug.includes("patch") ||
    slug.includes("edit") ||
    slug.includes("create") ||
    slug.includes("add") ||
    slug.includes("insert")
  ) {
    return "medium";
  }

  return "low";
}

/**
 * Generates an executive-friendly title and summary description for an Action Proposal Card.
 * Guarantees zero brand leakage and polished business language.
 */
export function generateProposalSummary(
  toolSlug: string,
  payload: Record<string, unknown>
): { title: string; description: string; actionType: string } {
  const slug = toolSlug.toLowerCase();

  // Outlook / Email
  if (slug.includes("outlook") || slug.includes("mail")) {
    if (slug.includes("delete")) {
      const subject = (payload.subject as string) || "Email";
      return {
        title: "Delete Email in Outlook",
        description: `Subject: "${subject}"`,
        actionType: "OUTLOOK_DELETE_EMAIL",
      };
    }
    if (
      slug.includes("update") ||
      slug.includes("patch") ||
      slug.includes("batch_update") ||
      payload.isRead !== undefined ||
      payload.is_read !== undefined
    ) {
      const isRead =
        payload.isRead ??
        payload.is_read ??
        (Array.isArray(payload.updates)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (payload.updates as any[])[0]?.patch?.isRead
          : undefined);
      return {
        title: "Update Email in Outlook",
        description:
          isRead !== undefined
            ? `Mark message as ${isRead ? "read" : "unread"}`
            : "Update email message status",
        actionType: "OUTLOOK_UPDATE_EMAIL",
      };
    }
    const to = (payload.to as string) || (payload.recipient as string) || "recipient";
    const subject = (payload.subject as string) || "Untitled Email";
    return {
      title: "Send Email via Outlook",
      description: `To: ${to} • Subject: "${subject}"`,
      actionType: "OUTLOOK_SEND_EMAIL",
    };
  }

  // Microsoft Teams
  if (slug.includes("teams")) {
    const channel = (payload.channel as string) || (payload.chatId as string) || "Teams Channel";
    const message = (payload.content as string) || (payload.message as string) || "";
    if (slug.includes("delete")) {
      return {
        title: "Delete Microsoft Teams Message",
        description: `Channel: ${channel}`,
        actionType: "TEAMS_DELETE_MESSAGE",
      };
    }
    return {
      title: "Post Message to Microsoft Teams",
      description: `Destination: ${channel} • "${message.slice(0, 80)}"`,
      actionType: "TEAMS_POST_MESSAGE",
    };
  }

  // Slack
  if (slug.includes("slack")) {
    const channel = (payload.channel as string) || "channel";
    const text = (payload.text as string) || "";
    if (slug.includes("delete")) {
      return {
        title: "Delete Slack Message",
        description: `Channel: #${channel}`,
        actionType: "SLACK_DELETE_MESSAGE",
      };
    }
    if (slug.includes("update")) {
      return {
        title: "Update Slack Message",
        description: `Channel: #${channel} • "${text.slice(0, 80)}"`,
        actionType: "SLACK_UPDATE_MESSAGE",
      };
    }
    return {
      title: "Post Message to Slack",
      description: `Channel: #${channel} • "${text.slice(0, 80)}"`,
      actionType: "SLACK_POST_MESSAGE",
    };
  }

  // Linear
  if (slug.includes("linear")) {
    const title = (payload.title as string) || (payload.issue_id as string) || "Linear Issue";
    if (slug.includes("delete")) {
      return {
        title: "Delete Linear Issue",
        description: `Issue: "${title}"`,
        actionType: "LINEAR_DELETE_ISSUE",
      };
    }
    if (slug.includes("update")) {
      const state = (payload.state as string) || (payload.status as string) || "Updated";
      return {
        title: "Update Linear Issue",
        description: `"${title}" • Status: ${state}`,
        actionType: "LINEAR_UPDATE_ISSUE",
      };
    }
    const priority = payload.priority ? `Priority ${payload.priority}` : "Default Priority";
    return {
      title: "Create Issue in Linear",
      description: `"${title}" • ${priority}`,
      actionType: "LINEAR_CREATE_ISSUE",
    };
  }

  // Zoho CRM
  if (slug.includes("zoho")) {
    const dealName = (payload.Deal_Name as string) || (payload.name as string) || "Record";
    if (slug.includes("delete")) {
      return {
        title: "Delete Zoho CRM Record",
        description: `Record: "${dealName}"`,
        actionType: "ZOHO_CRM_DELETE",
      };
    }
    const stage = (payload.Stage as string) || "Updated";
    return {
      title: "Update Zoho CRM Record",
      description: `Deal: "${dealName}" • Stage: ${stage}`,
      actionType: "ZOHO_CRM_UPDATE",
    };
  }

  // GitHub
  if (slug.includes("github")) {
    const repo =
      (payload.repo as string) ||
      (payload.repository as string) ||
      (payload.owner ? `${payload.owner}/${payload.repo}` : "") ||
      "GitHub Repository";

    if (slug.includes("delete")) {
      return {
        title: "Delete GitHub Resource",
        description: `Target: ${repo}`,
        actionType: "GITHUB_DELETE",
      };
    }
    if (slug.includes("review") || slug.includes("pull_request_review")) {
      const prNumber =
        (payload.pull_number as number | string) ||
        (payload.pr_number as number | string) ||
        "";
      const event = (payload.event as string) || "COMMENT";
      return {
        title: "Submit GitHub Pull Request Review",
        description: `Repo: ${repo}${prNumber ? ` • PR #${prNumber}` : ""} • Event: ${event}`,
        actionType: "GITHUB_REVIEW_PR",
      };
    }
    if (slug.includes("comment")) {
      const issueOrPr =
        (payload.issue_number as number | string) ||
        (payload.pull_number as number | string) ||
        "";
      const body = (payload.body as string) || "";
      return {
        title: "Post Comment on GitHub",
        description: `Repo: ${repo}${issueOrPr ? ` • #${issueOrPr}` : ""} • "${body.slice(0, 60)}"`,
        actionType: "GITHUB_CREATE_COMMENT",
      };
    }
    if (slug.includes("merge")) {
      const prNumber = (payload.pull_number as number | string) || "";
      return {
        title: "Merge GitHub Pull Request",
        description: `Repo: ${repo}${prNumber ? ` • PR #${prNumber}` : ""}`,
        actionType: "GITHUB_MERGE_PR",
      };
    }
    const title =
      (payload.title as string) ||
      (payload.issue_title as string) ||
      "GitHub Action";
    return {
      title: "Stage GitHub Action",
      description: `Target: ${repo} • "${title}"`,
      actionType: "GITHUB_ACTION",
    };
  }

  // Gmail
  if (slug.includes("gmail")) {
    const to = (payload.to as string) || (payload.recipient as string) || "recipient";
    const subject = (payload.subject as string) || "Untitled Email";
    if (slug.includes("delete")) {
      return {
        title: "Delete Email in Gmail",
        description: `Subject: "${subject}"`,
        actionType: "GMAIL_DELETE_EMAIL",
      };
    }
    return {
      title: "Send Email via Gmail",
      description: `To: ${to} • Subject: "${subject}"`,
      actionType: "GMAIL_SEND_EMAIL",
    };
  }

  // Google Calendar
  if (slug.includes("calendar") || slug.includes("googlecalendar")) {
    const summary =
      (payload.summary as string) ||
      (payload.title as string) ||
      "Calendar Event";
    const time =
      (payload.start_time as string) ||
      (payload.start as string) ||
      (payload.time as string) ||
      "";
    if (slug.includes("delete")) {
      return {
        title: "Cancel Google Calendar Event",
        description: `Event: "${summary}"`,
        actionType: "GOOGLE_CALENDAR_DELETE_EVENT",
      };
    }
    if (slug.includes("update")) {
      return {
        title: "Update Google Calendar Event",
        description: `Event: "${summary}"${time ? ` • ${time}` : ""}`,
        actionType: "GOOGLE_CALENDAR_UPDATE_EVENT",
      };
    }
    return {
      title: "Schedule Google Calendar Event",
      description: `Event: "${summary}"${time ? ` • ${time}` : ""}`,
      actionType: "GOOGLE_CALENDAR_CREATE_EVENT",
    };
  }

  // Notion
  if (slug.includes("notion")) {
    const title =
      (payload.title as string) ||
      (payload.page_name as string) ||
      "Notion Document";
    if (slug.includes("delete")) {
      return {
        title: "Archive Notion Page",
        description: `Page: "${title}"`,
        actionType: "NOTION_ARCHIVE_PAGE",
      };
    }
    if (slug.includes("update")) {
      return {
        title: "Update Notion Page",
        description: `Page: "${title}"`,
        actionType: "NOTION_UPDATE_PAGE",
      };
    }
    return {
      title: "Create Page in Notion",
      description: `Title: "${title}"`,
      actionType: "NOTION_CREATE_PAGE",
    };
  }

  // Generic executive-friendly fallback: clean name, never "COMPOSIO"
  const cleanTitle = toolSlug
    .replace(/^composio_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: cleanTitle,
    description: `Action pending executive approval`,
    actionType: toolSlug.toUpperCase(),
  };
}

/**
 * Creates a signed, tamper-proof ActionProposal ready for client rendering
 * and persistence into public.agent_audit_logs.
 */
export function createActionProposal(params: {
  userId: string;
  toolSlug: string;
  payload: Record<string, unknown>;
}): ActionProposal {
  const { userId, toolSlug, payload } = params;
  const actionId = crypto.randomUUID();

  // Extract inner tool if wrapped in multi-execute
  const { normalizedSlug, actualToolSlug, actualPayload } = extractInnerToolDetails(toolSlug, payload);

  const { title, description, actionType } = generateProposalSummary(
    actualToolSlug,
    actualPayload
  );
  const risk_level = evaluateRiskLevel(actualToolSlug, actualPayload);

  // Preserve execution payload: clean user payload + hidden raw metadata for approval execution
  const executionPayload: Record<string, unknown> = {
    ...actualPayload,
    _raw_tool_slug: toolSlug,
    _raw_payload: payload,
  };

  const signature_hash = generateActionSignature({
    actionId,
    userId,
    toolSlug: normalizedSlug,
    payload: executionPayload,
  });

  return {
    id: actionId,
    tool_slug: normalizedSlug,
    action_type: actionType,
    title,
    description,
    payload: executionPayload,
    status: "pending",
    risk_level,
    signature_hash,
    created_at: new Date().toISOString(),
  };
}
