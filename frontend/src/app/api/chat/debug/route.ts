import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/debug, Inspect the n8n payload without sending it
//
// Accepts the same body as POST /api/chat. Returns the constructed n8n
// payload as JSON so you can verify campaignContext, Zoho IDs,
// conversationHistory, and intent are all present and correct.
//
// Usage:
//   POST /api/chat/debug
//   {
//     "message": "Show my invoices",
//     "sessionId": "session-123",
//     "campaignContext": "[LIVE] Campaign Context\nCampaign: ...\nCRM Deal ID: ...",
//     "intent": "CHAT",
//     "conversationHistory": [...]
//   }
//
// Response:
//   {
//     "n8nPayload": { ... },
//     "payloadSize": 512,
//     "fieldSummary": { message: true, campaignContext: true, ... }
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface DebugRequestBody {
  message: string;
  sessionId?: string;
  campaignContext?: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  intent?: string;
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint echoes internal payload construction (including the n8n
    // webhook URL) — it must never be reachable unauthenticated.
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body: DebugRequestBody = await request.json();
    const { message, sessionId, campaignContext, conversationHistory, intent } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Mirror the exact payload construction from /api/chat
    const n8nPayload: Record<string, unknown> = {
      action: "sendMessage",
      chatInput: message,
      sessionId: sessionId || `web-${Date.now()}`,
    };
    if (campaignContext) n8nPayload.campaignContext = campaignContext;
    if (conversationHistory && conversationHistory.length > 0) n8nPayload.conversationHistory = conversationHistory;
    if (intent) n8nPayload.intent = intent;

    const payloadJson = JSON.stringify(n8nPayload);

    return NextResponse.json({
      n8nPayload,
      payloadSize: Buffer.byteLength(payloadJson, "utf-8"),
      fieldSummary: {
        message: !!message,
        messagePreview: message.slice(0, 80) + (message.length > 80 ? "…" : ""),
        sessionId: !!sessionId,
        campaignContextPresent: !!campaignContext,
        campaignContextPreview: campaignContext
          ? campaignContext.split("\n").slice(0, 5).join("\n") + (campaignContext.split("\n").length > 5 ? "\n…" : "")
          : null,
        conversationHistoryLength: conversationHistory?.length ?? 0,
        intentPresent: !!intent,
        intentValue: intent || null,
        zohoIdsExtracted: campaignContext
          ? {
              crmDealId: (campaignContext.match(/CRM Deal ID: (\S+)/) || [])[1] || null,
              projectsId: (campaignContext.match(/Projects ID: (\S+)/) || [])[1] || null,
              booksInvoiceId: (campaignContext.match(/Books Invoice ID: (\S+)/) || [])[1] || null,
              booksCustomerId: (campaignContext.match(/Books Customer ID: (\S+)/) || [])[1] || null,
            }
          : null,
      },
      n8nEndpoint: process.env.N8N_WEBHOOK_URL ? "(configured)" : "(not configured)",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Debug request failed: ${msg}` }, { status: 500 });
  }
}
