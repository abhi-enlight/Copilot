import { useState, useRef, useEffect, useCallback } from "react";
import type { Message, ToolStep } from "@/types";
import type { ActionProposal } from "@/types/database";
import { humanizeError } from "@/lib/errors/humanize";
import { reportError } from "@/lib/errors/monitor";

function formatApprovalOutcome(proposalTitle: string, result: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = result as any;
  if (!res) {
    return `✓ **${proposalTitle}** executed successfully.`;
  }

  // Check if result has Slack channels (as in the screenshot)
  const channels =
    res?.data?.results?.[0]?.response?.data?.channels ||
    res?.results?.[0]?.response?.data?.channels ||
    res?.channels;

  if (Array.isArray(channels) && channels.length > 0) {
    const list = channels
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => `• **#${c.name}**${c.is_general ? " *(general)*" : ""}`)
      .join("\n");
    return `✓ **${proposalTitle}** executed successfully.\n\n**Channels Found (${channels.length}):**\n${list}`;
  }

  // Check if result has emails / messages
  const emails =
    res?.data?.results?.[0]?.response?.data?.value ||
    res?.results?.[0]?.response?.data?.value ||
    res?.value;

  if (Array.isArray(emails) && emails.length > 0) {
    const list = emails
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => `• **${m.subject || "Untitled Email"}** — from *${m.from?.emailAddress?.name || m.from?.emailAddress?.address || "Sender"}*`)
      .join("\n");
    return `✓ **${proposalTitle}** executed successfully.\n\n**Retrieved Items (${emails.length}):**\n${list}`;
  }

  // Check if result has Linear issues
  const issues =
    res?.data?.results?.[0]?.response?.data?.nodes ||
    res?.results?.[0]?.response?.data?.nodes ||
    res?.nodes;

  if (Array.isArray(issues) && issues.length > 0) {
    const list = issues
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => `• **${i.identifier || i.title}**: ${i.title}`)
      .join("\n");
    return `✓ **${proposalTitle}** executed successfully.\n\n**Issues (${issues.length}):**\n${list}`;
  }

  // Check if result has Outlook batch update results
  const totalSucceeded = res?.data?.total_succeeded ?? res?.total_succeeded;
  if (typeof totalSucceeded === "number") {
    return `✓ **${proposalTitle}** completed successfully (${totalSucceeded} item${totalSucceeded === 1 ? "" : "s"} updated).`;
  }

  // Check if message or status is present
  const msg =
    res?.data?.results?.[0]?.response?.data?.message ||
    res?.data?.message ||
    res?.message;

  if (typeof msg === "string" && msg.trim()) {
    return `✓ **${proposalTitle}** executed successfully.\n\n${msg}`;
  }

  return `✓ **${proposalTitle}** executed and verified via Prism.`;
}

export function useCopilotChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hey, I'm Prism — your work assistant. I can check your inbox, review deals, track issues, and handle tasks across your connected tools. What can I help with?",
      sourceBadges: ["Prism Operations"],
      timestamp: "Just now",
      action_proposals: [],
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolSteps, setToolSteps] = useState<ToolStep[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          sessionId: sessionId || undefined,
        }),
        signal: controller.signal,
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
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem("prism_explicit_new");
                  localStorage.setItem("prism_active_session_id", event.sessionId);
                  const url = new URL(window.location.href);
                  url.searchParams.set("session", event.sessionId);
                  window.history.replaceState(null, "", url.toString());
                }
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
              } else if (event.type === "error") {
                const humanized = humanizeError(event.message || event.code, "agent");
                reportError(event.message || event.code, { category: "agent" });
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: `⚠️ **${humanized.title}**\n\n${humanized.description}`,
                          sourceBadges: ["Prism Operations"],
                        }
                      : msg
                  )
                );
              } else if (event.type === "done") {
                setToolSteps([]);
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
      if (controller.signal.aborted) {
        // User pressed Stop: keep whatever streamed in, mark it as stopped, and
        // never surface an error for an intentional cancellation.
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: msg.content ? `${msg.content}\n\n_Stopped._` : "_Stopped._",
                }
              : msg
          )
        );
      } else {
        console.error("[useCopilotChat] Streaming error:", err);
        const humanized = humanizeError(err, "agent");
        reportError(err, { category: "agent" });
        const errorText = `⚠️ **${humanized.title}**\n\n${humanized.description}`;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: errorText, sourceBadges: ["Prism Operations"] }
              : msg
          )
        );
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setToolSteps([]);
    }
  };

  // Cancels the in-flight generation. The server already honors request.signal,
  // so aborting the fetch tears the stream down end to end.
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  // ── Action Proposal Approval ──────────────────────────────────────
  const approveAction = async (actionId: string, updatedPayload?: Record<string, unknown>) => {
    // Optimistic status update to "approved" (and merge edited payload if provided)
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        action_proposals: msg.action_proposals?.map((p) =>
          p.id === actionId
            ? {
                ...p,
                status: "approved" as const,
                payload: updatedPayload ? { ...p.payload, ...updatedPayload } : p.payload,
              }
            : p
        ),
      }))
    );

    try {
      const res = await fetch("/api/agent/actions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, updatedPayload, sessionId: sessionId || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Approval failed");

      // Resolve proposal title synchronously from current messages
      let targetTitle = "Action";
      for (const msg of messages) {
        const found = msg.action_proposals?.find((p) => p.id === actionId);
        if (found?.title) {
          targetTitle = found.title;
          break;
        }
      }

      // Update proposal state to "executed" and attach execution_result
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          action_proposals: msg.action_proposals?.map((p) => {
            if (p.id === actionId) {
              return { ...p, status: "executed" as const, execution_result: data.result };
            }
            return p;
          }),
        }))
      );

      // Append assistant outcome message so output is always visible to the user
      const outcomeText = formatApprovalOutcome(targetTitle, data.result);
      const followUpMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: outcomeText,
        sourceBadges: ["Prism Operations"],
        timestamp: "Just now",
      };

      setMessages((prev) => [...prev, followUpMsg]);

      // Persist to session if active
      if (sessionId) {
        fetch(`/api/chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: outcomeText,
            sourceBadges: ["Prism Operations"],
          }),
        }).catch((e) => console.warn("[useCopilotChat] Failed to persist approval message:", e));
      }

      return { success: true, result: data.result };
    } catch (err: unknown) {
      const humanized = humanizeError(err, "action");
      reportError(err, { category: "tool" });
      console.error("[useCopilotChat] Approval error:", humanized.referenceId);

      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          action_proposals: msg.action_proposals?.map((p) =>
            p.id === actionId ? { ...p, status: "failed" as const } : p
          ),
        }))
      );

      return { success: false, error: humanized.description };
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
        body: JSON.stringify({ actionId, reason, sessionId: sessionId || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Rejection failed");
      }

      return { success: true };
    } catch (err: unknown) {
      reportError(err, { category: "tool" });
      console.error("[useCopilotChat] Rejection error:", err);
      return { success: false };
    }
  };

  const startNewSession = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("prism_explicit_new", "true");
      localStorage.removeItem("prism_active_session_id");
      const url = new URL(window.location.href);
      url.searchParams.delete("session");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
    }
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hey, I'm Prism — your work assistant. I can check your inbox, review deals, track issues, and handle tasks across your connected tools. What can I help with?",
        sourceBadges: ["Prism Operations"],
        timestamp: "Just now",
        action_proposals: [],
      },
    ]);
    setInput("");
    setToolSteps([]);
    setSessionId(null);
  };

  const loadSession = useCallback(async (targetSessionId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chat/sessions/${targetSessionId}/messages`);
      if (!res.ok) throw new Error("Failed to load session messages");
      const data = await res.json();
      interface DbMessage {
        id: string;
        role: import("@/types").MessageRole;
        content: string;
        source_badges?: string[];
        created_at: string;
        tool_calls?: import("@/types").ToolInvocation[];
        action_proposals?: ActionProposal[];
      }
      const loadedMessages: Message[] = (data.messages || [])
        .filter((m: DbMessage) => {
          const text = m.content?.trim() || "";
          return !text.startsWith("[System context") && !text.includes("[System context — do not repeat this to the user]");
        })
        .map((m: DbMessage) => ({
        id: m.id,
        role: m.role,
        content: m.content?.includes("Welcome to Prism Operations")
          ? "Hey, I'm Prism — your work assistant. I can check your inbox, review deals, track issues, and handle tasks across your connected tools. What can I help with?"
          : m.content,
        sourceBadges: m.source_badges || ["Prism Operations"],
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tool_calls: m.tool_calls || undefined,
        action_proposals: m.action_proposals || [],
      }));

      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      }
      setSessionId(targetSessionId);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("prism_explicit_new");
        localStorage.setItem("prism_active_session_id", targetSessionId);
        const url = new URL(window.location.href);
        url.searchParams.set("session", targetSessionId);
        window.history.replaceState(null, "", url.toString());
      }
      setInput("");
      setToolSteps([]);
      return { success: true };
    } catch (err) {
      console.warn("[useCopilotChat] loadSession error:", err);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore active session on mount or page refresh
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isExplicitNew = sessionStorage.getItem("prism_explicit_new") === "true";
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get("session");
    const storedSessionId = localStorage.getItem("prism_active_session_id");
    const targetSessionId = urlSessionId || storedSessionId;

    if (targetSessionId) {
      let isMounted = true;
      queueMicrotask(async () => {
        const res = await loadSession(targetSessionId);
        if (!isMounted) return;
        if (!res.success) {
          localStorage.removeItem("prism_active_session_id");
          const url = new URL(window.location.href);
          url.searchParams.delete("session");
          window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
        }
      });
      return () => {
        isMounted = false;
      };
    } else if (!isExplicitNew) {
      // Fallback: If page was refreshed without explicit new session, restore most recent session
      let isMounted = true;
      queueMicrotask(async () => {
        try {
          const res = await fetch("/api/chat/sessions");
          if (!res.ok) return;
          const data = await res.json();
          const latest = data?.sessions?.[0];
          if (latest?.id && isMounted) {
            await loadSession(latest.id);
          }
        } catch {
          // ignore
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [loadSession]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    toolSteps,
    sessionId,
    handleSendMessage,
    stopGeneration,
    approveAction,
    rejectAction,
    startNewSession,
    loadSession,
    inputRef,
  };
}
