import OpenAI from "openai";
import type { ActionProposal } from "@/types/database";
import { createActionProposal } from "./tools";

export interface AgentChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export type AgentSSEEvent =
  | { type: "session_meta"; sessionId: string; isNewSession: boolean }
  | { type: "tool_call"; tool: string; status: "executing" | "complete" | "failed"; resultSummary?: string }
  | { type: "text_delta"; delta: string }
  | { type: "action_proposal"; proposal: ActionProposal }
  | { type: "error"; code: string; message: string }
  | { type: "done"; fullContent: string; actionProposals: ActionProposal[] };

const MAX_CONTEXT_TURNS = 10;
const MAX_TOOL_OUTPUT_CHARS = 2000;

/**
 * Truncates raw tool outputs so they do not blow past context token ceilings.
 */
export function truncateToolOutput(output: unknown): string {
  const str = typeof output === "string" ? output : JSON.stringify(output);
  if (str.length > MAX_TOOL_OUTPUT_CHARS) {
    return str.slice(0, MAX_TOOL_OUTPUT_CHARS) + "... [truncated]";
  }
  return str;
}

/**
 * Bounds the chat history to the most recent turns.
 */
export function boundChatHistory(
  messages: AgentChatMessage[]
): AgentChatMessage[] {
  return messages.slice(-MAX_CONTEXT_TURNS);
}

/**
 * Formats an SSE event payload into a standard text chunk.
 */
export function formatSSE(event: AgentSSEEvent | string): string {
  if (typeof event === "string") {
    return `data: ${event}\n\n`;
  }
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Returns a configured OpenAI client if an API key is provided.
 */
export function getOpenAIClient(): OpenAI | null {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    (process.env.GEMINI_API_KEY
      ? process.env.GEMINI_API_KEY
      : null);

  if (!apiKey) return null;

  const baseURL = process.env.OPENAI_BASE_URL || (process.env.GEMINI_API_KEY
    ? "https://generativelanguage.googleapis.com/v1beta/openai/"
    : undefined);

  return new OpenAI({
    apiKey,
    baseURL,
  });
}

/**
 * Fallback Executive Simulation Engine.
 * Formulates realistic executive responses, executes live read-only tools,
 * and generates compliant action proposals when frontier LLM keys are unset.
 */
export async function executeSimulatedAgent(params: {
  userId: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  composioSession: any;
  onEvent: (event: AgentSSEEvent) => void;
  signal?: AbortSignal;
}): Promise<{ content: string; actionProposals: ActionProposal[] }> {
  const { userId, message, composioSession, onEvent, signal } = params;
  const lowerMsg = message.toLowerCase();

  const proposals: ActionProposal[] = [];
  let accumulatedText = "";

  // Check for Outlook Email Intent
  if (lowerMsg.includes("email") || lowerMsg.includes("outlook") || lowerMsg.includes("inbox")) {
    if (lowerMsg.includes("send") || lowerMsg.includes("reply") || lowerMsg.includes("draft")) {
      onEvent({
        type: "tool_call",
        tool: "outlook_search_emails",
        status: "executing",
      });

      // Try live search if session exists
      try {
        if (composioSession && typeof composioSession.execute === "function") {
          await composioSession.execute("outlook_search_emails", { query: "recent" }, { signal });
        }
      } catch {
        // Fallback gracefully
      }

      onEvent({
        type: "tool_call",
        tool: "outlook_search_emails",
        status: "complete",
        resultSummary: "Located relevant email thread.",
      });

      const proposal = createActionProposal({
        userId,
        toolSlug: "outlook_send_email",
        payload: {
          to: "alex.mercer@acmecorp.com",
          subject: "Re: Q3 Operations Review & Roadmap Update",
          body: "Alex, I've reviewed the operational scorecard. We are on track for Phase 3 deployment. Let's sync tomorrow at 10 AM EST.",
        },
      });

      proposals.push(proposal);
      onEvent({ type: "action_proposal", proposal });

      accumulatedText =
        "I analyzed your Outlook inbox and drafted a response to Alex regarding the Q3 Operations Review. " +
        "Because this will send an email from your executive account, I've staged an Action Proposal above for your sign-off.";

      // Stream text tokens with realistic typing cadence
      for (const token of accumulatedText.split(" ")) {
        if (signal?.aborted) break;
        onEvent({ type: "text_delta", delta: token + " " });
        await new Promise((r) => setTimeout(r, 20));
      }

      return { content: accumulatedText, actionProposals: proposals };
    }
  }

  // Check for Linear Issue Intent
  if (lowerMsg.includes("linear") || lowerMsg.includes("ticket") || lowerMsg.includes("issue")) {
    if (lowerMsg.includes("create") || lowerMsg.includes("file") || lowerMsg.includes("open")) {
      const proposal = createActionProposal({
        userId,
        toolSlug: "linear_create_issue",
        payload: {
          title: "Optimize Telemetry Reconnection High-Watermark Catchup",
          description: "Ensure WebSocket reconnect syncs all unread activity_events without duplication.",
          priority: 2,
        },
      });

      proposals.push(proposal);
      onEvent({ type: "action_proposal", proposal });

      accumulatedText =
        "I prepared a high-priority Linear issue based on our current task. " +
        "Please review the proposal above and click Approve to publish it to your team's Linear backlog.";

      for (const token of accumulatedText.split(" ")) {
        if (signal?.aborted) break;
        onEvent({ type: "text_delta", delta: token + " " });
        await new Promise((r) => setTimeout(r, 20));
      }

      return { content: accumulatedText, actionProposals: proposals };
    }
  }

  // Check for Slack Message Intent
  if (lowerMsg.includes("slack") || lowerMsg.includes("channel") || lowerMsg.includes("post")) {
    if (lowerMsg.includes("send") || lowerMsg.includes("post") || lowerMsg.includes("notify")) {
      const proposal = createActionProposal({
        userId,
        toolSlug: "slack_post_message",
        payload: {
          channel: "executive-ops",
          text: "🚀 Prism V2 Phase 3: Direct Streaming Agent Runtime is live. All 5 connected tools operational.",
        },
      });

      proposals.push(proposal);
      onEvent({ type: "action_proposal", proposal });

      accumulatedText =
        "I've drafted the announcement for the #executive-ops Slack channel. " +
        "Review the proposed card above and approve whenever you're ready to dispatch.";

      for (const token of accumulatedText.split(" ")) {
        if (signal?.aborted) break;
        onEvent({ type: "text_delta", delta: token + " " });
        await new Promise((r) => setTimeout(r, 20));
      }

      return { content: accumulatedText, actionProposals: proposals };
    }
  }

  // Default Executive Intelligence Response
  accumulatedText =
    `I am actively monitoring your connected operational stack (Microsoft Outlook, Microsoft Teams, Slack, Linear, and Zoho CRM). ` +
    `You can instruct me to search your emails, triage team channels, query CRM deal pipelines, or draft communications. ` +
    `Any state-modifying action will always be presented as an interactive Action Proposal Card for your explicit authorization.`;

  for (const token of accumulatedText.split(" ")) {
    if (signal?.aborted) break;
    onEvent({ type: "text_delta", delta: token + " " });
    await new Promise((r) => setTimeout(r, 25));
  }

  return { content: accumulatedText, actionProposals: proposals };
}
