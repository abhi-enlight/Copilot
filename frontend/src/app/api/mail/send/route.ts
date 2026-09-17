import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { resolveMicrosoftVaultTokens } from "@/lib/microsoft-vault";
import { getConnectorPreferences, isConnectorPaused } from "@/lib/connector-preferences";
import { sendUserEmail, SendEmailOptions } from "@/lib/microsoft-graph";
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

  if (!to || (Array.isArray(to) && to.length === 0)) {
    return NextResponse.json({ error: "Recipient email address ('to') is required" }, { status: 400 });
  }

  if (!emailBody && !subject) {
    return NextResponse.json({ error: "Subject or body must be provided" }, { status: 400 });
  }

  // 1. Check connector pause state
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

  // 2. Resolve Microsoft OAuth token specifically for mail from user's vault
  const msVault = await resolveMicrosoftVaultTokens(user.id, userEmail, "mail");
  if (!msVault.accessToken) {
    return NextResponse.json(
      {
        error: "Microsoft Outlook is not connected or requires re-authentication. Please connect Outlook in the Connections tab.",
        code: "NOT_CONNECTED",
        requiresReconnect: true,
        reconnectUrl: "/api/integrations/microsoft/connect?preset=mail&mode=write&prompt=consent&returnTo=/",
      },
      { status: 403 }
    );
  }

  // Pre-flight check: ensure the token includes Mail.Send permission
  const hasMailSend =
    msVault.scopes.length === 0 ||
    msVault.scopes.some((s) => /mail\.send/i.test(s));

  if (!hasMailSend) {
    return NextResponse.json(
      {
        error:
          "Your Microsoft account connection is missing email dispatch permissions (Mail.Send). Please authorize Outlook with send access.",
        code: "INSUFFICIENT_SCOPES",
        requiresReconnect: true,
        reconnectUrl: "/api/integrations/microsoft/connect?preset=mail&mode=write&prompt=consent&returnTo=/",
      },
      { status: 403 }
    );
  }

  // 3. Dispatch email via Microsoft Graph API
  const sendOpts: SendEmailOptions = {
    to,
    cc,
    bcc,
    subject: subject || "(No Subject)",
    body: emailBody || "",
    isHtml: Boolean(isHtml),
  };

  const result = await sendUserEmail(msVault.accessToken, sendOpts, orgId);

  // 4. Audit logging
  try {
    const targetRecipient = Array.isArray(to) ? to.join(", ") : String(to);
    await adminSupabase.from("agent_audit_logs").insert({
      organization_id: orgId || null,
      actor_email: userEmail || user.email || msVault.userEmail || null,
      action: "email_sent",
      target_type: "microsoft.outlook",
      target_id: targetRecipient,
      outcome: result.success ? "success" : "failure",
      // NOTE: agent_audit_logs has no error_message column; errors live in
      // payload_summary.error (same convention as campaigns route + refresher).
      payload_summary: {
        to,
        cc,
        subject: sendOpts.subject,
        bodyLength: (emailBody || "").length,
        isHtml: Boolean(isHtml),
        error: result.error || null,
      },
      metadata: {
        campaignId: campaignId || null,
        senderAccount: msVault.userEmail || msVault.accountEmail || userEmail,
      },
      created_at: new Date().toISOString(),
    });
  } catch (auditErr) {
    console.warn("[mail/send] Failed to record audit log:", auditErr);
  }

  if (!result.success) {
    const isPermissionIssue =
      result.code === "ErrorAccessDenied" ||
      result.code === "Authorization_RequestDenied" ||
      result.code === "403" ||
      /403|Forbidden|Access is denied|privilege|permission/i.test(result.error || "");

    return NextResponse.json(
      {
        error: result.error || "Failed to send email via Microsoft Outlook",
        code: result.code || "SEND_FAILED",
        requiresReconnect: isPermissionIssue,
        reconnectUrl: isPermissionIssue
          ? "/api/integrations/microsoft/connect?preset=mail&mode=write&prompt=consent&returnTo=/"
          : undefined,
      },
      { status: isPermissionIssue ? 403 : 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Email sent successfully via your Microsoft Outlook account",
    sender: msVault.userEmail || msVault.accountEmail || userEmail,
  });
}
