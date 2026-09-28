import type { ActionProposal } from './database';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolInvocation {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  sourceBadges?: string[];
  timestamp?: string;
  tool_calls?: ToolInvocation[];
  action_proposals?: ActionProposal[];
};

/**
 * Canonical Server-Sent Events (SSE) contract for /api/agent/chat.
 * Shared by the agent runtime (server) and the streaming dispatcher
 * (client); the single source of truth for the wire protocol.
 */
export type AgentSSEEvent =
  | { type: "session_meta"; sessionId: string; isNewSession: boolean }
  | { type: "tool_call"; tool: string; status: "executing" | "complete" | "failed"; resultSummary?: string }
  | { type: "text_delta"; delta: string }
  | { type: "action_proposal"; proposal: ActionProposal }
  | { type: "error"; code: string; message: string }
  | { type: "done"; fullContent: string; actionProposals: ActionProposal[] };

export interface ToolStep {
  tool: string;
  status: "executing" | "complete" | "failed";
  resultSummary?: string;
  startedAt: number;
  completedAt?: number;
}
