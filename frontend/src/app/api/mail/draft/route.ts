import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { resolveMicrosoftVaultTokens } from "@/lib/microsoft-vault";
import { getConnectorPreferences, isConnectorPaused } from "@/lib/connector-preferences";
import { createDraftEmail, SendEmailOptions } from "@/lib/microsoft-graph";
import { adminSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, orgId, userEmail } = auth;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const to = body.to as string | string[] | undefined;
  const cc = body.cc as string | string[] | undefined;
  const bcc = body.bcc as string | string[] | undefined;
  const subject = typeof body.subject === "string" ? body.subject : "";
  const emailBody = typeof body.body === "string" ? body.body : "";
  const isHtml = Boolean(body.isHtml);
  const campaignId = typeof body.campaignId === "string" ? body.campaignId : undefined;

  // Check connector pause state
  const prefs = await getConnectorPreferences(userEmail || user.id);
  if (isConnectorPaused(prefs, "microsoft.outlook")) {
    return NextResponse.json(
      {
        error: "Microsoft Outlook connector is currently paused. Please resume it in the Connections tab.",
        code: "CONNECTOR_PAUSED",
      },
      { status: 403 }
    );
  }

  // Resolve Microsoft OAuth token from user's vault
  const msVault = await resolveMicrosoftVaultTokens(user.id, userEmail);
  if (!msVault.accessToken) {
    return NextResponse.json(
      {
        error: "Microsoft Outlook is not connected or requires re-authentication. Please connect Outlook in the Connections tab.",
        code: "NOT_CONNECTED",
        requiresReconnect: true,
      },
      { status: 403 }
    );
  }

  const draftOpts: SendEmailOptions = {
    to: to || [],
    cc,
    bcc,
    subject: subject || "(Draft Subject)",
    body: emailBody || "",
    isHtml: Boolean(isHtml),
  };

  const result = await createDraftEmail(msVault.accessToken, draftOpts, orgId);

  // Audit logging
  try {
    const targetRecipient = Array.isArray(to) ? to.join(", ") : String(to || "");
    await adminSupabase.from("agent_audit_logs").insert({
      organization_id: orgId || null,
      actor_email: userEmail || user.email || msVault.userEmail || null,
      action: "email_draft_created",
      target_type: "microsoft.outlook",
      target_id: targetRecipient,
      payload_summary: {
        to,
        subject: draftOpts.subject,
        draftId: result.draftId,
        error: result.error || null,
      },
      outcome: result.success ? "success" : "failure",
      metadata: {
        campaignId: campaignId || null,
        draftId: result.draftId,
        webLink: result.webLink,
      },
      created_at: new Date().toISOString(),
    });
  } catch (auditErr) {
    console.warn("[mail/draft] Failed to record audit log:", auditErr);
  }

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error || "Failed to create draft in Outlook",
        code: "DRAFT_FAILED",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Draft saved to your Microsoft Outlook account",
    draftId: result.draftId,
    webLink: result.webLink,
    sender: msVault.userEmail || msVault.accountEmail || userEmail,
  });
}
