import { useState, useRef, useEffect, useCallback } from "react";
import type { Message, ToolStep, Tenant } from "@/types";
import type { ActionProposal } from "@/types/database";
import { copyToClipboard } from "@/lib/utils";
import { getWelcomeMessage } from "@/lib/constants";

export function useCopilotChat(activeTenant?: Tenant) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: activeTenant
        ? getWelcomeMessage(activeTenant)
        : "Welcome to Prism Operations Cockpit. Connected tools: Microsoft Outlook, Microsoft Teams, Slack, Linear, and Zoho CRM. What would you like to review or execute?",
      sourceBadges: ["Prism Operations"],
      timestamp: "Just now",
      action_proposals: [],
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolSteps, setToolSteps] = useState<ToolStep[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleCopy = async (id: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  // ── Native Server-Sent Events (SSE) Streaming Dispatcher ──────────
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsgId = Date.now().toString();
    const assistantMsgId = (Date.now() + 1).toString();

    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      sourceBadges: ["Prism Operations"],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      action_proposals: [],
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setInput("");
    setIsLoading(true);
    setToolSteps([]);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          sessionId: sessionId || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: Failed to reach agent runtime`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) {
            continue;
          }

          if (trimmed === "data: [DONE]") {
            break;
          }

          if (trimmed.startsWith("data: ")) {
            try {
              const event = JSON.parse(trimmed.slice(6));

              if (event.type === "session_meta") {
                setSessionId(event.sessionId);
              } else if (event.type === "tool_call") {
                if (event.status === "executing") {
                  setToolSteps((prev) => [
                    ...prev,
                    {
                      tool: event.tool,
                      status: "executing",
                      startedAt: Date.now(),
                    },
                  ]);
                } else {
                  setToolSteps((prev) =>
                    prev.map((step) =>
                      step.tool === event.tool && step.status === "executing"
                        ? {
                            ...step,
                            status: event.status,
                            resultSummary: event.resultSummary,
                            completedAt: Date.now(),
                          }
                        : step
                    )
                  );
                }
              } else if (event.type === "text_delta") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + event.delta }
                      : msg
                  )
                );
              } else if (event.type === "action_proposal") {
                const proposal = event.proposal as ActionProposal;
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMsgId) return msg;
                    const existing = msg.action_proposals || [];
                    if (existing.some((p) => p.id === proposal.id)) return msg;
                    return { ...msg, action_proposals: [...existing, proposal] };
                  })
                );
              } else if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: event.fullContent || msg.content,
                          action_proposals: event.actionProposals || msg.action_proposals,
                        }
                      : msg
                  )
                );
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error("[useCopilotChat] Streaming error:", err);
      const errorText = "Unable to connect to the operational agent runtime. Please check your credentials and network.";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: errorText, sourceBadges: ["System Alert"] }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Action Proposal Approval ──────────────────────────────────────
  const approveAction = async (actionId: string) => {
    // Optimistic status update to "approved"
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        action_proposals: msg.action_proposals?.map((p) =>
          p.id === actionId ? { ...p, status: "approved" as const } : p
        ),
      }))
    );

    try {
      const res = await fetch("/api/agent/actions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Approval failed");

      // Update proposal state to "executed"
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          action_proposals: msg.action_proposals?.map((p) =>
            p.id === actionId ? { ...p, status: "executed" as const } : p
          ),
        }))
      );

      return { success: true, result: data.result };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[useCopilotChat] Approval error:", errMsg);

      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          action_proposals: msg.action_proposals?.map((p) =>
            p.id === actionId ? { ...p, status: "failed" as const } : p
          ),
        }))
      );

      return { success: false, error: errMsg };
    }
  };

  // ── Action Proposal Rejection ─────────────────────────────────────
  const rejectAction = async (actionId: string, reason?: string) => {
    // Optimistic status update to "rejected"
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        action_proposals: msg.action_proposals?.map((p) =>
          p.id === actionId ? { ...p, status: "rejected" as const } : p
        ),
      }))
    );

    try {
      const res = await fetch("/api/agent/actions/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Rejection failed");
      }

      return { success: true };
    } catch (err: unknown) {
      console.error("[useCopilotChat] Rejection error:", err);
      return { success: false };
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    toolSteps,
    sessionId,
    copiedId,
    handleCopy,
    handleQuickAction,
    handleSendMessage,
    approveAction,
    rejectAction,
    messagesEndRef,
    inputRef,
  };
}
