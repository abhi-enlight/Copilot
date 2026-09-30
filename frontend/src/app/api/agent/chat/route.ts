import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { adminSupabase } from "@/lib/supabase-admin";
import { getComposioSessionForUser } from "@/lib/composio/session";
import { executeSimulatedAgent, formatSSE, type AgentChatMessage } from "@/lib/agent/llm";
import type { AgentSSEEvent } from "@/types";
import type { ActionProposal } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Direct Streaming Agent Runtime for Prism V2.
 *
 * 1. Validates authenticated Supabase session.
 * 2. Multi-tenant session resolution & message history persistence.
 * 3. 15-second SSE keep-alive heartbeats (: ping\n\n) to prevent proxy drops.
 * 4. Two-Tier Tool Execution:
 *    - Tier 1 (Read-Only): Autonomous execution via user's isolated tool session.
 *    - Tier 2 (State-Modifying): Emits tamper-proof Action Proposal Card awaiting approval.
 * 5. Commits final assistant response & proposal snapshots to PostgreSQL.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized", detail: "Active session required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const message = (body.message as string)?.trim();
    let sessionId = body.sessionId as string | undefined;

    if (!message) {
      return NextResponse.json(
        { error: "bad_request", detail: "Message is required" },
        { status: 400 }
      );
    }

    let isNewSession = false;

    // 1. Multi-Tenant Chat Session Resolution
    if (sessionId) {
      const { data: existingSession } = await adminSupabase
        .from("chat_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingSession) {
        return NextResponse.json(
          { error: "forbidden", detail: "Invalid or unauthorized session ID" },
          { status: 403 }
        );
      }
    } else {
      isNewSession = true;
      const initialTitle = message.length > 50 ? `${message.slice(0, 47)}...` : message;

      const { data: newSession, error: sessionErr } = await adminSupabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: initialTitle,
          pinned: false,
          is_archived: false,
        })
        .select("id")
        .single();

      if (sessionErr || !newSession) {
        console.error("[Agent Chat] Failed to create session:", sessionErr);
        return NextResponse.json(
          { error: "database_error", detail: "Could not create chat session" },
          { status: 500 }
        );
      }
      sessionId = newSession.id;
    }

    // 2. Fetch bounded conversation history BEFORE inserting the user message,
    // so the window is the most recent turns of prior conversation (newest-first
    // query, then reversed to chronological order for the LLM).
    let chatHistory: AgentChatMessage[] = [];
    if (!isNewSession) {
      const { data: history } = await adminSupabase
        .from("chat_messages")
        .select("role, content, action_proposals")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (history && history.length > 0) {
        chatHistory = history
          .slice()
          .reverse()
          .map((m: { role: string; content: string | null; action_proposals?: ActionProposal[] | null }) => {
            let content = m.content || "";
            // If this message included staged action proposals, append a concise summary to history
            if (m.role === "assistant" && Array.isArray(m.action_proposals) && m.action_proposals.length > 0) {
              const summaryList = m.action_proposals
                .map((p: ActionProposal) => `[Prior Staged Action: ${p.title || p.action_type || "action"}${p.description ? ` — ${p.description}` : ""}]`)
                .join("\n");
              content = content ? `${content}\n\n${summaryList}` : summaryList;
            }
            return {
              role: m.role as AgentChatMessage["role"],
              content,
            };
          });
      }
    }

    // 3. Persist User Message
    await adminSupabase.from("chat_messages").insert({
      session_id: sessionId,
      role: "user",
      content: message,
      source_badges: [],
      tool_calls: null,
      action_proposals: [],
    });

    // 4. Resolve caller's organization context
    const { data: memberRow } = await adminSupabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const organizationId = memberRow?.organization_id || null;

    // 5. Retrieve isolated user tool router session
    let composioSession = null;
    try {
      const res = await getComposioSessionForUser(user.id);
      composioSession = res.session;
    } catch (err) {
      console.warn("[Agent Chat] Composio session notice:", err);
    }

    // 6. Establish unbuffered SSE stream with 15s keep-alive heartbeats
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: AgentSSEEvent) => {
          try {
            controller.enqueue(encoder.encode(formatSSE(event)));
          } catch {
            // Controller closed by client abort
          }
        };

        // 15-second Keep-Alive Heartbeat Timer
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 15_000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeatInterval);
          try {
            controller.close();
          } catch {}
        });

        try {
          // Send session metadata
          sendEvent({
            type: "session_meta",
            sessionId: sessionId!,
            isNewSession,
          });

          // Run Agent Reasoning & Execution Loop
          const { content: fullContent, actionProposals } =
            await executeSimulatedAgent({
              userId: user.id,
              message,
              chatHistory,
              composioSession,
              onEvent: sendEvent,
              signal: request.signal,
            });

          // 6. Persist Pending Action Proposals in agent_audit_logs
          for (const proposal of actionProposals) {
            await adminSupabase.from("agent_audit_logs").insert({
              id: proposal.id,
              organization_id: organizationId,
              user_id: user.id,
              actor_email: user.email || "",
              tool_slug: proposal.tool_slug,
              action_type: proposal.action_type,
              status: "pending",
              request_payload: proposal.payload,
              signature_hash: proposal.signature_hash,
            });
          }

          // 7. Persist Assistant Response in chat_messages
          await adminSupabase.from("chat_messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: fullContent,
            source_badges: ["Prism Operations"],
            tool_calls: null,
            action_proposals: actionProposals as ActionProposal[],
          });

          // Final Done Signals
          sendEvent({
            type: "done",
            fullContent,
            actionProposals,
          });

          controller.enqueue(encoder.encode(formatSSE("[DONE]")));
          clearInterval(heartbeatInterval);
          controller.close();
        } catch (err: unknown) {
          clearInterval(heartbeatInterval);
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("[Agent Chat] Stream error:", errorMsg);

          sendEvent({
            type: "error",
            code: "EXECUTION_ERROR",
            message: errorMsg || "An error occurred while generating the operational response.",
          });

          controller.enqueue(encoder.encode(formatSSE("[DONE]")));
          try {
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Agent Chat] Unexpected error:", errorMsg);
    return NextResponse.json(
      { error: "internal_error", detail: "Agent chat failed" },
      { status: 500 }
    );
  }
}
