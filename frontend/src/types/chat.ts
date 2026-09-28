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

export type ChatPayload = {
  chatInput: string;
  sessionId: string;
  tenantId?: string;
  tenantSlug?: string;
  userEmail?: string;
  /** @deprecated legacy v1 parameter */
  crmConnected?: boolean;
  /** @deprecated legacy v1 parameter */
  dynamicsOrg?: string;
  /** @deprecated legacy v1 parameter */
  m365Connected?: boolean;
  /** @deprecated legacy v1 parameter */
  sharepointDrive?: string;
};

/**
 * Server-Sent Events (SSE) streaming envelope for /api/agent/chat.
 * Line-buffered JSON events sent from the Next.js agent runtime to the client.
 */
export type AgentStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; tool: string; callId: string }
  | { type: 'tool_result'; tool: string; callId: string; result: unknown }
  | { type: 'action_proposal'; proposal: ActionProposal }
  | { type: 'error'; message: string }
  | { type: 'done'; messageId: string };

/**
 * Legacy n8n response shape preserved for transitional compatibility.
 * @deprecated Use AgentStreamEvent for V2 streaming agent chat.
 */
export type N8nChatResponse = {
  output?: string;
  response?: string;
  message?: string;
  text?: string;
};
