/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";
import type { ActionProposal } from "@/types/database";
import { createActionProposal, classifyToolTier } from "./tools";

export interface AgentChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
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

export function truncateToolOutput(output: unknown): string {
  const str = typeof output === "string" ? output : JSON.stringify(output);
  if (str.length > MAX_TOOL_OUTPUT_CHARS) {
    return str.slice(0, MAX_TOOL_OUTPUT_CHARS) + "... [truncated]";
  }
  return str;
}

export function boundChatHistory(messages: AgentChatMessage[]): AgentChatMessage[] {
  return messages.slice(-MAX_CONTEXT_TURNS);
}

export function formatSSE(event: AgentSSEEvent | string): string {
  if (typeof event === "string") return `data: ${event}

`;
  return `data: ${JSON.stringify(event)}

`;
}

export function getOpenAIClient(): OpenAI | null {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    (process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY : null);

  if (!apiKey) return null;

  const baseURL = process.env.OPENAI_BASE_URL ||
    (process.env.GEMINI_API_KEY ? "https://generativelanguage.googleapis.com/v1beta/openai/" : undefined);

  return new OpenAI({ apiKey, baseURL });
}

const SYSTEM_PROMPT = `You are Prism, an intelligent personal assistant. The user has connected several work tools to you. Your job is to help them get things done across all of their connected tools.

IMPORTANT RULES:
1. When a user asks something that spans multiple tools, use them together. Don't ask which tool to use — figure it out from context.
2. Work step by step. Call one tool, analyze the result, then decide if you need to call another. Don't stop halfway — complete the full task.
3. When you find information from one tool that's relevant to another, connect the dots. Synthesize. Don't just dump raw data.
4. For any action that MODIFIES data (sending emails, creating tickets, updating records, posting messages), you MUST use the corresponding tool call. Never claim you did something without actually calling the tool.
5. If a tool call fails, explain what happened and suggest alternatives. Don't silently skip it.
6. Keep your responses concise and actionable. The user is busy.`;

async function executeToolWithRetry(
  session: any,
  toolName: string,
  args: any,
  signal?: AbortSignal,
  maxRetries = 2,
  timeoutMs = 15000,
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        session.execute(toolName, args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool "${toolName}" timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
        signal ? new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
        }) : new Promise(() => {}),
      ]);
      return result;
    } catch (err: unknown) {
      if (signal?.aborted) throw err;
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // exponential backoff
    }
  }
}

function summarizeResult(result: any): string {
  if (!result) return "No results.";
  if (result.error) return `Error: ${result.error}`;
  if (Array.isArray(result)) return `Returned ${result.length} items.`;
  if (typeof result === "object" && result.data && Array.isArray(result.data)) {
    return `Returned ${result.data.length} items.`;
  }
  return "Executed successfully.";
}

export async function executeSimulatedAgent(params: {
  userId: string;
  message: string;
  chatHistory?: AgentChatMessage[];
  composioSession: any;
  onEvent: (event: AgentSSEEvent) => void;
  signal?: AbortSignal;
}): Promise<{ content: string; actionProposals: ActionProposal[] }> {
  const { userId, message, chatHistory = [], composioSession, onEvent, signal } = params;

  const client = getOpenAIClient();
  if (!client) {
    onEvent({ type: "error", code: "NO_LLM", message: "No LLM API key configured." });
    return { content: "No LLM configured.", actionProposals: [] };
  }

  // Load tools
  let openAITools: any[] = [];
  try {
    if (composioSession) {
      const tools = await composioSession.tools();
      // If tools are not already in OpenAI format, this might fail, but Composio SDK usually handles it via its wrapper or tools list.
      openAITools = tools;
    }
  } catch (err: unknown) {
    console.warn("[Agent] Failed to load tools:", err);
  }

  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...boundChatHistory(chatHistory),
    { role: "user", content: message },
  ];

  const proposals: ActionProposal[] = [];
  let fullContent = "";
  let loopCount = 0;
  const MAX_LOOPS = 10;

  while (loopCount < MAX_LOOPS) {
    if (signal?.aborted) break;
    loopCount++;

    const response = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o",
      messages,
      tools: openAITools.length > 0 ? openAITools : undefined,
      stream: true,
    });

    const currentToolCalls = new Map<number, { id: string, name: string, args: string }>();
    let hasToolCalls = false;

    for await (const chunk of response) {
      if (signal?.aborted) break;
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        fullContent += delta.content;
        onEvent({ type: "text_delta", delta: delta.content });
      }

      if (delta.tool_calls) {
        hasToolCalls = true;
        for (const tc of delta.tool_calls) {
          if (!currentToolCalls.has(tc.index)) {
            currentToolCalls.set(tc.index, { id: tc.id || "", name: tc.function?.name || "", args: "" });
          }
          const acc = currentToolCalls.get(tc.index)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.args += tc.function.arguments;
        }
      }
    }

    if (!hasToolCalls) break;

    const assistantToolCallsMsg: any = { role: "assistant", content: null, tool_calls: [] };
    
    for (const [, tc] of currentToolCalls) {
      assistantToolCallsMsg.tool_calls.push({ id: tc.id, type: "function", function: { name: tc.name, arguments: tc.args } });
    }
    messages.push(assistantToolCallsMsg);

    for (const [, tc] of currentToolCalls) {
      let parsedArgs: any = {};
      try {
        parsedArgs = JSON.parse(tc.args || "{}");
      } catch {
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Invalid JSON arguments generated by LLM" }) });
        continue;
      }

      const tier = classifyToolTier(tc.name);
      if (tier === "read_only") {
        onEvent({ type: "tool_call", tool: tc.name, status: "executing" });
        let result: any;
        try {
          if (composioSession) {
            result = await executeToolWithRetry(composioSession, tc.name, parsedArgs, signal);
          } else {
            result = { error: "No tool execution session available." };
          }
          onEvent({ type: "tool_call", tool: tc.name, status: "complete", resultSummary: summarizeResult(result) });
        } catch (err: unknown) {
          result = { error: err instanceof Error ? err.message : String(err) };
          onEvent({ type: "tool_call", tool: tc.name, status: "failed", resultSummary: result.error });
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: truncateToolOutput(result) });
      } else {
        const proposal = createActionProposal({ userId, toolSlug: tc.name, payload: parsedArgs });
        proposals.push(proposal);
        onEvent({ type: "action_proposal", proposal });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ status: "pending_approval", message: "Action staged for user sign-off. Do NOT claim you executed this yet." })
        });
      }
    }
  }

  return { content: fullContent, actionProposals: proposals };
}
