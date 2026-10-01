import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Human-in-the-Loop Action Rejection Endpoint.
 *
 * 1. Authenticates executive session.
 * 2. IDOR Protection: Asserts caller owns the proposal.
 * 3. Atomic transition: Sets status = 'rejected' and logs reason in public.agent_audit_logs.
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
    const reason = (body.reason as string)?.trim() || "Dismissed by executive";
    const sessionId = body.sessionId as string | undefined;

    if (!actionId) {
      return NextResponse.json(
        { error: "bad_request", detail: "Action ID is required" },
        { status: 400 }
      );
    }

    // Atomic rejection
    const { data: rejectedAction } = await adminSupabase
      .from("agent_audit_logs")
      .update({
        status: "rejected",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        execution_result: { rejected_reason: reason },
      })
      .eq("id", actionId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!rejectedAction) {
      return NextResponse.json(
        { error: "conflict", detail: "Action proposal not found or already processed" },
        { status: 409 }
      );
    }

    // Synchronize chat_messages row so state is immediately persistent
    try {
      let cmQuery = adminSupabase.from("chat_messages").select("id, action_proposals");
      if (sessionId) {
        cmQuery = cmQuery.eq("session_id", sessionId);
      }
      const { data: candidateMessages } = await cmQuery;

      if (candidateMessages && candidateMessages.length > 0) {
        for (const msg of candidateMessages) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (Array.isArray(msg.action_proposals) && msg.action_proposals.some((p: any) => p.id === actionId)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatedProposals = msg.action_proposals.map((p: any) =>
              p.id === actionId
                ? {
                    ...p,
                    status: "rejected",
                    execution_result: { rejected_reason: reason },
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
      console.warn("[Action Rejection] Failed to sync chat_messages action_proposals:", cmErr);
    }

    return NextResponse.json(
      {
        success: true,
        status: "rejected",
        reason,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Action Rejection] Unexpected error:", errorMsg);
    return NextResponse.json(
      { error: "internal_error", detail: "Action rejection failed" },
      { status: 500 }
    );
  }
}
