import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { adminSupabase } from "@/lib/supabase-admin";
import { getComposioSessionForUser } from "@/lib/composio/session";
import { verifyActionSignature, generateActionSignature } from "@/lib/agent/crypto";

export const dynamic = "force-dynamic";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Human-in-the-Loop Action Approval Endpoint.
 *
 * 1. Authenticates executive session.
 * 2. IDOR Protection: Asserts caller owns the pending action proposal.
 * 3. 24-Hour Expiration Check.
 * 4. Cryptographic Tamper-Proof Signature Verification (HMAC-SHA256) or user customization.
 * 5. Atomic PostgreSQL Conditional Lock (prevents double-click duplicate executions).
 * 6. Executes the mutation via the user's isolated tool session.
 * 7. Records execution outcome in immutable public.agent_audit_logs.
 */
function validateActionSafety(
  toolSlug: string,
  payload: Record<string, unknown>
): { safe: boolean; reason?: string } {
  const slug = toolSlug.toLowerCase();

  // 1. Recipient Cap: Max 5 recipients for emails
  const isEmailSend =
    slug.includes("send_mail") ||
    slug.includes("send_email") ||
    slug.includes("multi_execute");

  let recipientCount = 0;
  const toolsList = Array.isArray(payload.tools) ? (payload.tools as Array<{ arguments?: Record<string, unknown> }>) : [];
  const firstTool = toolsList[0];
  const args = (firstTool?.arguments || payload) as Record<string, unknown>;
  const to = args.to || args.recipients || args.recipient;

  if (Array.isArray(to)) {
    recipientCount = to.length;
  } else if (typeof to === "string") {
    recipientCount = to
      .split(/[,;]/)
      .filter((s: string) => s.trim().length > 0).length;
  }

  if (isEmailSend && recipientCount > 5) {
    return {
      safe: false,
      reason: `Safety Policy Violation: Outgoing emails are capped at 5 recipients (found ${recipientCount}). Mass cold outreach must be conducted through dedicated marketing automation platforms.`,
    };
  }

  // 2. Bulk Deletion Blocker
  const isDeleteAction =
    slug.includes("delete") || slug.includes("wipe") || slug.includes("purge");
  const isBulkFlag =
    args.delete_all === true || args.all === true || args.purge_all === true;
  if (isDeleteAction && isBulkFlag) {
    return {
      safe: false,
      reason:
        "Safety Policy Violation: Bulk deletion operations are prohibited via Prism to prevent irreversible data loss.",
    };
  }

  return { safe: true };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized", detail: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const actionId = body.actionId as string;
    const updatedPayload = body.updatedPayload as Record<string, unknown> | undefined;
    const sessionId = body.sessionId as string | undefined;

    if (!actionId) {
      return NextResponse.json(
        { error: "bad_request", detail: "Action ID is required" },
        { status: 400 }
      );
    }

    // 1. Fetch action proposal from audit log
    const { data: action, error: fetchErr } = await adminSupabase
      .from("agent_audit_logs")
      .select("*")
      .eq("id", actionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr || !action) {
      return NextResponse.json(
        { error: "not_found", detail: "Action proposal not found or unauthorized" },
        { status: 404 }
      );
    }

    if (action.status !== "pending") {
      return NextResponse.json(
        { error: "conflict", detail: `Action has already been ${action.status}` },
        { status: 409 }
      );
    }

    // 2. 24-Hour TTL Expiration Check
    const ageMs = Date.now() - new Date(action.created_at).getTime();
    if (ageMs > TWENTY_FOUR_HOURS_MS) {
      await adminSupabase
        .from("agent_audit_logs")
        .update({
          status: "failed",
          execution_result: { error: "Proposal expired after 24 hours" },
        })
        .eq("id", actionId);

      return NextResponse.json(
        { error: "expired", detail: "Action proposal expired after 24 hours" },
        { status: 410 }
      );
    }

    // 3. Cryptographic Signature Verification or Authorized Customization
    let payloadToPersist = (action.request_payload as Record<string, unknown>) || {};

    if (updatedPayload && typeof updatedPayload === "object" && Object.keys(updatedPayload).length > 0) {
      // User customized parameters (e.g. edited recipient or subject) before approving
      const existingRaw = (payloadToPersist._raw_payload as Record<string, unknown>) || {};
      const mergedRaw: Record<string, unknown> = { ...existingRaw, ...updatedPayload };

      // If _raw_payload contains a tools array (from COMPOSIO_MULTI_EXECUTE_TOOL),
      // update the arguments of the inner tool as well so executions reflect the edits
      if (Array.isArray(mergedRaw.tools) && mergedRaw.tools.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstTool = mergedRaw.tools[0] as any;
        mergedRaw.tools = [
          {
            ...firstTool,
            arguments: {
              ...(firstTool?.arguments || {}),
              ...updatedPayload,
            },
          },
          ...mergedRaw.tools.slice(1),
        ];
      }

      payloadToPersist = {
        ...payloadToPersist,
        ...updatedPayload,
        _raw_payload: mergedRaw,
      };

      const newSignature = generateActionSignature({
        actionId: action.id,
        userId: user.id,
        toolSlug: action.tool_slug,
        payload: payloadToPersist,
      });

      await adminSupabase
        .from("agent_audit_logs")
        .update({
          request_payload: payloadToPersist,
          signature_hash: newSignature,
        })
        .eq("id", actionId);
    } else {
      const isSignatureValid = verifyActionSignature({
        actionId: action.id,
        userId: user.id,
        toolSlug: action.tool_slug,
        payload: action.request_payload as Record<string, unknown>,
        signature: action.signature_hash || "",
      });

      if (!isSignatureValid) {
        console.warn(`[Action Approval] Tampering detected on action ${actionId}`);
        return NextResponse.json(
          { error: "tampered_payload", detail: "Proposal parameters failed integrity verification" },
          { status: 403 }
        );
      }
    }

    // 4. Atomic PostgreSQL Conditional Lock (double-click prevention)
    const { data: lockedAction } = await adminSupabase
      .from("agent_audit_logs")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", actionId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!lockedAction) {
      return NextResponse.json(
        { error: "conflict", detail: "Action proposal is already being processed" },
        { status: 409 }
      );
    }

    // 5. Tool Execution via User's Isolated Session
    let executionResult: Record<string, unknown>;

    try {
      const { session } = await getComposioSessionForUser(user.id);
      if (!session || typeof session.execute !== "function") {
        throw new Error("Tool execution session is unavailable for this account");
      }
      const reqPayload = payloadToPersist;
      const toolToExecute = (reqPayload._raw_tool_slug as string) || action.tool_slug;
      const payloadToExecute = (reqPayload._raw_payload as Record<string, unknown>) || reqPayload;

      // ── Runtime Action Safety Invariants ─────────────────────────────────
      const safetyCheck = validateActionSafety(toolToExecute, payloadToExecute);
      if (!safetyCheck.safe) {
        throw new Error(safetyCheck.reason);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await session.execute(
        toolToExecute,
        payloadToExecute
      );

      // Check for execution failures returned by tool session without throwing
      const hasError =
        Boolean(res?.error) ||
        (Array.isArray(res?.data?.results) &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.data.results.some((r: any) => r.error || r.response?.successful === false));

      if (hasError) {
        const errorDetail =
          res?.error ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res?.data?.results?.find((r: any) => r.error)?.error ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res?.data?.results?.find((r: any) => r.response?.successful === false)?.response?.error ||
          "Action execution failed";
        throw new Error(typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail));
      }

      executionResult = (res as Record<string, unknown>) || {
        executed: true,
        timestamp: new Date().toISOString(),
      };
    } catch (execErr: unknown) {
      // Fail loudly: a real execution failure must never surface to the user
      // (or the audit ledger) as a successful delivery.
      const errorMsg = execErr instanceof Error ? execErr.message : String(execErr);
      console.error("[Action Approval] Execution failed:", errorMsg);

      await adminSupabase
        .from("agent_audit_logs")
        .update({
          status: "failed",
          execution_result: { error: errorMsg },
        })
        .eq("id", actionId);

      return NextResponse.json(
        {
          error: "execution_failed",
          detail: errorMsg || "The approved action failed to execute",
        },
        { status: 502 }
      );
    }

    // 6. Record Successful Execution in Audit Log
    await adminSupabase
      .from("agent_audit_logs")
      .update({
        status: "executed",
        execution_result: executionResult,
      })
      .eq("id", actionId);

    // 7. Synchronize chat_messages row so state is immediately persistent
    try {
      // 1. Direct targeted JSONB containment query
      let directQuery = adminSupabase
        .from("chat_messages")
        .select("id, action_proposals")
        .contains("action_proposals", JSON.stringify([{ id: actionId }]));

      if (sessionId) {
        directQuery = directQuery.eq("session_id", sessionId);
      }

      let { data: candidateMessages } = await directQuery;

      // 2. Fallback if containment check yielded nothing due to JSON formatting nuances
      if (!candidateMessages || candidateMessages.length === 0) {
        let fallbackQuery = adminSupabase.from("chat_messages").select("id, action_proposals");
        if (sessionId) {
          fallbackQuery = fallbackQuery.eq("session_id", sessionId);
        } else {
          fallbackQuery = fallbackQuery.order("created_at", { ascending: false }).limit(25);
        }
        const { data: fallbackList } = await fallbackQuery;
        candidateMessages = fallbackList;
      }

      if (candidateMessages && candidateMessages.length > 0) {
        for (const msg of candidateMessages) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (Array.isArray(msg.action_proposals) && msg.action_proposals.some((p: any) => p.id === actionId)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatedProposals = msg.action_proposals.map((p: any) =>
              p.id === actionId
                ? {
                    ...p,
                    status: "executed",
                    execution_result: executionResult,
                    payload: payloadToPersist,
                  }
                : p
            );
            await adminSupabase
              .from("chat_messages")
              .update({ action_proposals: updatedProposals })
              .eq("id", msg.id);
          }
        }
      }
    } catch (cmErr) {
      console.warn("[Action Approval] Failed to sync chat_messages action_proposals:", cmErr);
    }

    return NextResponse.json(
      {
        success: true,
        status: "executed",
        result: executionResult,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Action Approval] Unexpected error:", errorMsg);
    return NextResponse.json(
      { error: "internal_error", detail: "Action approval execution failed" },
      { status: 500 }
    );
  }
}
