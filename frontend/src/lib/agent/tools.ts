import type { ActionProposal } from "@/types/database";
import { generateActionSignature } from "./crypto";

export type ToolTier = "read_only" | "mutation";

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
];

const MUTATION_VERBS = [
  "send",
  "create",
  "update",
  "delete",
  "post",
  "write",
  "archive",
  "close",
  "remove",
  "modify",
  "execute",
  "approve",
  "patch",
  "put",
  "insert",
];

/**
 * Classifies whether a tool is Tier 1 (Read-Only) or Tier 2 (Mutation / State-Modifying).
 */
export function classifyToolTier(toolSlug: string): ToolTier {
  const normalized = toolSlug.toLowerCase().trim();

  // Explicit mutation patterns always take precedence
  for (const verb of MUTATION_VERBS) {
    if (normalized.includes(verb)) {
      return "mutation";
    }
  }

  // Explicit read-only patterns
  for (const verb of READ_ONLY_VERBS) {
    if (normalized.includes(verb)) {
      return "read_only";
    }
  }

  // Default safe: any unrecognized tool is treated as a mutation to prevent unauthorized changes
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
    (typeof payload.amount === "number" && payload.amount >= 10000) ||
    (typeof payload.Amount === "number" && payload.Amount >= 10000)
  ) {
    return "high";
  }

  // High risk: sending emails or team messages to broad audiences
  if (
    (slug.includes("send") || slug.includes("post")) &&
    (payload.to === "all" || payload.channel === "general")
  ) {
    return "high";
  }

  // Medium risk: standard creations and updates
  if (
    slug.includes("create") ||
    slug.includes("update") ||
    slug.includes("send") ||
    slug.includes("post")
  ) {
    return "medium";
  }

  return "low";
}

/**
 * Generates an executive-friendly title and summary description for an Action Proposal Card.
 */
export function generateProposalSummary(
  toolSlug: string,
  payload: Record<string, unknown>
): { title: string; description: string; actionType: string } {
  const slug = toolSlug.toLowerCase();

  if (slug.includes("outlook") || slug.includes("email")) {
    const to = (payload.to as string) || (payload.recipient as string) || "recipient";
    const subject = (payload.subject as string) || "Untitled Email";
    return {
      title: `Send Email via Outlook`,
      description: `To: ${to} • Subject: "${subject}"`,
      actionType: "OUTLOOK_SEND_EMAIL",
    };
  }

  if (slug.includes("teams")) {
    const channel = (payload.channel as string) || (payload.chatId as string) || "chat";
    const message = (payload.content as string) || (payload.message as string) || "";
    return {
      title: `Post Message to Microsoft Teams`,
      description: `Destination: ${channel} • "${message.slice(0, 80)}"`,
      actionType: "TEAMS_POST_MESSAGE",
    };
  }

  if (slug.includes("slack")) {
    const channel = (payload.channel as string) || "channel";
    const text = (payload.text as string) || "";
    return {
      title: `Post Message to Slack`,
      description: `Channel: #${channel} • "${text.slice(0, 80)}"`,
      actionType: "SLACK_POST_MESSAGE",
    };
  }

  if (slug.includes("linear")) {
    const title = (payload.title as string) || "New Issue";
    const priority = payload.priority ? `Priority ${payload.priority}` : "Default";
    return {
      title: `Create Issue in Linear`,
      description: `"${title}" • ${priority}`,
      actionType: "LINEAR_CREATE_ISSUE",
    };
  }

  if (slug.includes("zoho")) {
    const dealName = (payload.Deal_Name as string) || (payload.name as string) || "Record";
    const stage = (payload.Stage as string) || "Update";
    return {
      title: `Update Zoho CRM Record`,
      description: `Deal: "${dealName}" • Stage: ${stage}`,
      actionType: "ZOHO_CRM_UPDATE",
    };
  }

  return {
    title: `Execute ${toolSlug.replace(/_/g, " ")}`,
    description: `Request payload: ${JSON.stringify(payload).slice(0, 100)}`,
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
  const { title, description, actionType } = generateProposalSummary(
    toolSlug,
    payload
  );
  const risk_level = evaluateRiskLevel(toolSlug, payload);

  const signature_hash = generateActionSignature({
    actionId,
    userId,
    toolSlug,
    payload,
  });

  return {
    id: actionId,
    tool_slug: toolSlug,
    action_type: actionType,
    title,
    description,
    payload,
    status: "pending",
    risk_level,
    signature_hash,
    created_at: new Date().toISOString(),
  };
}
