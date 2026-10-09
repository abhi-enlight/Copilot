import type { ActionProposal } from "@/types/database";
import { generateActionSignature } from "./crypto";

export type ToolTier = "read_only" | "mutation";

// Verb vocabularies for the tool approval classifier.
//
// Matching is TOKEN-EXACT (slugs are split on non-alphanumeric characters and
// compared whole), never substring-based. This is deliberate: substring matching
// previously classified GMAIL_REPLY_TO_THREAD as read-only ("th-READ"),
// DYNAMICS365_..._CREATE_ACCOUNT as read-only ("ac-COUNT") and
// SHARE_POINT_CREATE_LIST_ITEM as read-only ("LIST").
const DELETION_VERBS = new Set([
  "delete",
  "remove",
  "purge",
  "drop",
  "destroy",
  "archive",
  "trash",
  "cancel",
]);

// Any of these tokens forces human approval, and they take precedence over read tokens.
const MUTATION_VERBS = new Set([
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
  "close",
  "add",
  "move",
  "copy",
  "rename",
  "convert",
  "reply",
  "forward",
  "share",
  "invite",
  "assign",
  "star",
  "unstar",
  "mark",
  "upload",
  "apply",
  "approve",
  "reject",
  "execute",
  "run",
  "mount",
  "unmount",
  "enable",
  "disable",
  "set",
  "start",
  "stop",
  "sync",
  "import",
  "export",
  "publish",
  "unpublish",
  "attach",
  "detach",
  "link",
  "unlink",
  "complete",
  "reopen",
  "subscribe",
  "unsubscribe",
  "grant",
  "revoke",
]);

// Whole-token read verbs. These only classify as read-only when no mutation or
// deletion token is present in the same slug.
const READ_ONLY_VERBS = new Set([
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
  "describe",
  "download",
]);

// Mail toolkits eligible for routine read/unread triage.
const MAIL_TOKENS = new Set([
  "mail",
  "outlook",
  "message",
  "messages",
  "gmail",
  "thread",
  "threads",
  "email",
  "emails",
  "inbox",
]);

// Meta/routing tools that only inspect data or negotiate connections and never mutate it.
const META_READ_ONLY_TOKENS = new Set(["search_tools", "get_tool_schemas", "manage_connections"]);

/** Splits a tool slug into whole lowercase tokens (e.g. GMAIL_REPLY_TO_THREAD -> [gmail, reply, to, thread]). */
export function tokenizeToolSlug(slug: string): string[] {
  return (slug || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

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
 * Expands a top-level tool call into the concrete calls it will actually run.
 * A COMPOSIO_MULTI_EXECUTE_TOOL wrapper is split into one entry per inner tool so
 * every action gets its own approval card; a normal call is returned as-is.
 */
export function explodeToolCalls(
  toolSlug: string,
  payload: Record<string, unknown>
): Array<{ toolSlug: string; payload: Record<string, unknown> }> {
  const isMulti = /multi[_-]execute/i.test(toolSlug || "");
  if (!isMulti) {
    return [{ toolSlug, payload }];
  }

  const tools = Array.isArray(payload?.tools)
    ? (payload.tools as Array<{ tool_slug?: string; arguments?: Record<string, unknown> }>)
    : [];
  const expanded = tools
    .filter((t) => Boolean(t?.tool_slug))
    .map((t) => ({
      toolSlug: t.tool_slug as string,
      payload: (t.arguments || {}) as Record<string, unknown>,
    }));

  return expanded.length > 0 ? expanded : [{ toolSlug, payload }];
}

/**
 * Helper to determine if an operation is routine inbox triage (marking emails
 * read/unread) which should execute autonomously as a simple task rather than
 * requiring high-friction cards. Triage must be provable from whole tokens or an
 * explicit read-flag payload; anything else is treated as a mutation.
 */
export function isRoutineTriage(slug: string, payload?: Record<string, unknown>): boolean {
  const tokens = tokenizeToolSlug(slug);
  // Deletions are never simple triage
  if (tokens.some((t) => DELETION_VERBS.has(t))) return false;

  if (!tokens.some((t) => MAIL_TOKENS.has(t))) return false;

  const payloadTogglesReadFlag =
    payload?.isRead !== undefined ||
    payload?.is_read !== undefined ||
    (Array.isArray(payload?.updates) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload.updates as any[]).some(
        (u) => u?.patch?.isRead !== undefined || u?.patch?.is_read !== undefined
      ));

  if (payloadTogglesReadFlag) return true;

  // Explicit mark-as-read / mark-as-unread tools, matched on whole tokens only.
  return (
    (tokens.includes("mark") || tokens.includes("set")) &&
    (tokens.includes("read") || tokens.includes("unread"))
  );
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

  // An empty slug is not provably read-only.
  if (!normalized) return "mutation";

  // Multi-execute wrapper: a wrapper is only read-only when every inner tool is.
  if (normalized.includes("multi_execute") || normalized.includes("multi-execute")) {
    const toolsList = Array.isArray(payload?.tools)
      ? (payload.tools as Array<{ tool_slug?: string; arguments?: Record<string, unknown> }>)
      : [];

    // An empty multi-execute call is a no-op discovery call.
    if (toolsList.length === 0) return "read_only";

    return toolsList.some(
      (item) =>
        classifyToolTier(item.tool_slug || "", (item.arguments || {}) as Record<string, unknown>) ===
        "mutation"
    )
      ? "mutation"
      : "read_only";
  }

  const tokens = tokenizeToolSlug(normalized);

  // Meta / routing tools (schema search, connection negotiation) never mutate data.
  if (
    normalized.includes("search_tool") ||
    normalized.includes("get_tool") ||
    normalized.includes("manage_connection") ||
    tokens.some((t) => META_READ_ONLY_TOKENS.has(t))
  ) {
    return "read_only";
  }

  // 1. Deletion tasks always require confirmation.
  if (tokens.some((t) => DELETION_VERBS.has(t))) return "mutation";

  // 2. Routine read-flag triage may execute autonomously.
  if (isRoutineTriage(toolSlug, payload)) return "read_only";

  // 3. Any mutation token wins over read tokens (CREATE_LIST_ITEM is a mutation).
  if (tokens.some((t) => MUTATION_VERBS.has(t))) return "mutation";

  // 4. High-risk payloads (destructive verbs, large amounts, broad broadcasts).
  if (evaluateRiskLevel(toolSlug, payload || {}) === "high") return "mutation";

  // 5. Provable read-only verbs.
  if (tokens.some((t) => READ_ONLY_VERBS.has(t))) return "read_only";

  // 6. FAIL CLOSED: anything not provably read-only needs human approval.
  return "mutation";
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

  // Microsoft Dynamics 365 CRM
  if (slug.includes("dynamics") || slug.includes("dynamics365")) {
    const accountName =
      (payload.name as string) ||
      (payload.account_name as string) ||
      (payload.company as string) ||
      "Dynamics Account";

    if (slug.includes("delete")) {
      return {
        title: "Delete Dynamics CRM Account",
        description: `Account: "${accountName}"`,
        actionType: "DYNAMICS_DELETE_ACCOUNT",
      };
    }
    if (slug.includes("update")) {
      return {
        title: "Update Dynamics CRM Account",
        description: `Account: "${accountName}"`,
        actionType: "DYNAMICS_UPDATE_ACCOUNT",
      };
    }
    return {
      title: "Create Dynamics CRM Account",
      description: `Account: "${accountName}"`,
      actionType: "DYNAMICS_CREATE_ACCOUNT",
    };
  }

  // Microsoft SharePoint
  if (slug.includes("share_point") || slug.includes("sharepoint")) {
    const itemName = (payload.name as string) || (payload.path as string) || (payload.title as string) || "SharePoint Item";
    if (slug.includes("delete")) {
      return {
        title: "Delete SharePoint Item",
        description: `Target: "${itemName}"`,
        actionType: "SHAREPOINT_DELETE_ITEM",
      };
    }
    if (slug.includes("create")) {
      return {
        title: "Create SharePoint List Item",
        description: `Item: "${itemName}"`,
        actionType: "SHAREPOINT_CREATE_ITEM",
      };
    }
    return {
      title: "Update SharePoint Resource",
      description: `Target: "${itemName}"`,
      actionType: "SHAREPOINT_UPDATE_ITEM",
    };
  }

  // Zoho Books
  if (slug.includes("zoho_books") || slug.includes("zohobooks")) {
    const target =
      (payload.customer_name as string) ||
      (payload.invoice_number as string) ||
      (payload.contact_name as string) ||
      (payload.reference_number as string) ||
      "Zoho Books Entry";
    if (slug.includes("delete")) {
      return {
        title: "Delete Zoho Books Record",
        description: `Target: "${target}"`,
        actionType: "ZOHO_BOOKS_DELETE",
      };
    }
    if (slug.includes("convert")) {
      return {
        title: "Convert Purchase Order to Bill",
        description: `PO: "${target}"`,
        actionType: "ZOHO_BOOKS_CONVERT_PO",
      };
    }
    if (slug.includes("credit")) {
      return {
        title: "Apply Credits to Invoice",
        description: `Invoice: "${target}"`,
        actionType: "ZOHO_BOOKS_APPLY_CREDIT",
      };
    }
    return {
      title: "Create Zoho Books Entry",
      description: `Target: "${target}"`,
      actionType: "ZOHO_BOOKS_CREATE",
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

  // Jira
  if (slug.includes("jira")) {
    const summary =
      (payload.summary as string) ||
      (payload.issue_key as string) ||
      (payload.issue_id as string) ||
      (payload.title as string) ||
      "Jira Issue";
    if (slug.includes("delete")) {
      return {
        title: "Delete Jira Issue",
        description: `Issue: "${summary}"`,
        actionType: "JIRA_DELETE_ISSUE",
      };
    }
    if (slug.includes("comment")) {
      const comment = (payload.comment as string) || (payload.body as string) || "";
      return {
        title: "Add Comment to Jira Issue",
        description: `Issue: "${summary}" • "${comment.slice(0, 60)}"`,
        actionType: "JIRA_ADD_COMMENT",
      };
    }
    if (slug.includes("transition") || slug.includes("update")) {
      const status = (payload.status as string) || (payload.transition as string) || "Updated";
      return {
        title: "Update Jira Issue",
        description: `"${summary}" • Status: ${status}`,
        actionType: "JIRA_UPDATE_ISSUE",
      };
    }
    const issueType = (payload.issue_type as string) || (payload.type as string) || "Task";
    return {
      title: "Create Jira Issue",
      description: `"${summary}" • Type: ${issueType}`,
      actionType: "JIRA_CREATE_ISSUE",
    };
  }

  // Monday.com
  if (slug.includes("monday")) {
    const itemName =
      (payload.item_name as string) ||
      (payload.name as string) ||
      (payload.board_name as string) ||
      "Monday Item";
    if (slug.includes("delete") || slug.includes("archive")) {
      return {
        title: "Delete Monday Item",
        description: `Item: "${itemName}"`,
        actionType: "MONDAY_DELETE_ITEM",
      };
    }
    if (slug.includes("update") || slug.includes("comment")) {
      const body = (payload.body as string) || (payload.update_text as string) || "";
      return {
        title: "Post Update on Monday.com",
        description: `Item: "${itemName}" • "${body.slice(0, 60)}"`,
        actionType: "MONDAY_CREATE_UPDATE",
      };
    }
    return {
      title: "Create Monday Item",
      description: `Item: "${itemName}"`,
      actionType: "MONDAY_CREATE_ITEM",
    };
  }

  // ClickUp
  if (slug.includes("clickup")) {
    const taskName =
      (payload.name as string) ||
      (payload.task_name as string) ||
      (payload.title as string) ||
      "ClickUp Task";
    if (slug.includes("delete")) {
      return {
        title: "Delete ClickUp Task",
        description: `Task: "${taskName}"`,
        actionType: "CLICKUP_DELETE_TASK",
      };
    }
    if (slug.includes("comment")) {
      const comment = (payload.comment_text as string) || (payload.comment as string) || "";
      return {
        title: "Comment on ClickUp Task",
        description: `Task: "${taskName}" • "${comment.slice(0, 60)}"`,
        actionType: "CLICKUP_CREATE_COMMENT",
      };
    }
    if (slug.includes("update")) {
      const status = (payload.status as string) || "Updated";
      return {
        title: "Update ClickUp Task",
        description: `"${taskName}" • Status: ${status}`,
        actionType: "CLICKUP_UPDATE_TASK",
      };
    }
    const priority = payload.priority ? `Priority ${payload.priority}` : "Normal";
    return {
      title: "Create ClickUp Task",
      description: `"${taskName}" • ${priority}`,
      actionType: "CLICKUP_CREATE_TASK",
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
