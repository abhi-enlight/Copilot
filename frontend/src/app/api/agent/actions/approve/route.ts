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
      const mergedRaw = { ...existingRaw, ...updatedPayload };
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

      const res = await session.execute(
        toolToExecute,
        payloadToExecute
      );
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
