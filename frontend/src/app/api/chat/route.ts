import { NextResponse } from 'next/server';
import { buildEntitlementSnapshot } from '@/lib/entitlements';
import { resolveZohoAccessToken } from '@/lib/zoho';
import { resolveMicrosoftVaultTokens } from '@/lib/microsoft-vault';
import { getConnectorPreferences, isConnectorPaused } from '@/lib/connector-preferences';
import { requireAuth } from '@/lib/auth-helpers';
import { adminSupabase } from '@/lib/supabase-admin';

// =============================================================================
// Unified /api/chat (Phase 1 consolidation)
//
// The merged app serves two chat frontends, and each posts to /api/chat with a
// different contract:
//
//   1. BCP-style shell (root page / CopilotView) sends  { message, sessionId,
//      campaignContext, conversationHistory, intent } → n8n SSE stream proxy.
//   2. Legacy Operations Cockpit (/cockpit) sends      { chatInput, tenantSlug,
//      userEmail, crmConnected, dynamicsOrg, … }      → live Microsoft Graph
//      JSON responses (unchanged legacy behavior).
//
// Dispatch happens on the payload shape. Phase 4 replaces path 2 with the
// connector/entitlement architecture; until then both paths stay functional.
// =============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const N8N_WEBHOOK_URL = process.env.N8N_COPILOT_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || '';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

// -----------------------------------------------------------------------------
// GET /api/chat, Health check (n8n reachability). Authenticated to prevent
// unauthenticated probing of backend infrastructure reachability/latency.
// -----------------------------------------------------------------------------
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const start = Date.now();
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        chatInput: '__ping__',
        sessionId: 'health-check',
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const latency = Date.now() - start;
    return NextResponse.json({
      status: res.ok ? (latency > 5000 ? 'slow' : 'connected') : 'error',
      latencyMs: latency,
      source: 'n8n',
    });
  } catch {
    const latency = Date.now() - start;
    return NextResponse.json({
      status: 'offline',
      latencyMs: latency,
      source: 'none',
    });
  }
}

// -----------------------------------------------------------------------------
// POST /api/chat, dispatcher
// -----------------------------------------------------------------------------
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, orgId, userEmail: authEmail } = auth;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const rawMessage =
    typeof body.message === 'string'
      ? body.message
      : typeof body.chatInput === 'string'
      ? body.chatInput
      : '';

  if (!rawMessage || !rawMessage.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  body.message = rawMessage.trim();
  return streamN8nChat(body as any, user.id, orgId, authEmail || user.email || null);
}

/**
 * Loads the user's live active campaigns with real task completion metrics and pending approval gates.
 * Injected as campaignContext for n8n when general chat queries campaign status.
 */
async function buildActiveCampaignsContext(userId: string, orgId: string | null): Promise<string | null> {
  try {
    let query = adminSupabase
      .from("campaigns")
      .select("id, name, client, status, budget, start_date, end_date, zoho_crm_deal_id, zoho_crm_deal_stage, zoho_project_id, tasks, aspect_summary")
      .eq("status", "live");

    if (orgId) {
      query = query.or(`organization_id.eq.${orgId},created_by.eq.${userId}`);
    } else {
      query = query.eq("created_by", userId);
    }

    const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(10);
    if (error || !rows || rows.length === 0) return null;

    const sections: string[] = ["[ACTIVE MARKETING PROMOTION CAMPAIGNS (PRISM & ZOHO CRM)]"];
    for (const c of rows) {
      const tasks: any[] = Array.isArray(c.tasks) ? c.tasks : [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
      const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
      const pendingApprovalTasks = tasks.filter((t) => typeof t.status === "string" && t.status.includes("PENDING"));

      let campaignStr = `Campaign: ${c.name}\n` +
        `Client: ${c.client || "N/A"} | Status: ${c.status.toUpperCase()} | Budget: ${c.budget || "N/A"}\n` +
        `Zoho CRM Deal ID: ${c.zoho_crm_deal_id || "N/A"} (Stage: ${c.zoho_crm_deal_stage || "Qualification"})\n` +
        `Tasks Completion: ${completedTasks}/${totalTasks} completed, ${inProgressTasks} in progress, ${pendingApprovalTasks.length} pending approval`;

      if (pendingApprovalTasks.length > 0) {
        campaignStr += `\nPending Approvals (${pendingApprovalTasks.length}):\n` +
          pendingApprovalTasks
            .map((t) => `  - [${t.aspect?.toUpperCase() || "GATE"}] ${t.title} (Status: ${t.status}, Assignee: ${t.assignee || "Unassigned"}, Urgency: ${t.urgency || "NORMAL"})`)
            .join("\n");
      }

      sections.push(campaignStr);
    }

    return sections.join("\n\n");
  } catch (err) {
    console.warn("[chat] Failed to load active campaigns context:", err);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Path 1, n8n SSE stream proxy (BCP / Prism shell)
// Pure live proxy: no cache, no fallback. Streams tool frames + text chunks.
// -----------------------------------------------------------------------------
async function streamN8nChat(
  body: {
    message: string;
    sessionId?: string;
    campaignContext?: string;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    intent?: string;
    activeConnectors?: Record<string, boolean>;
  },
  userId: string,
  orgId: string | null,
  authUserEmail: string | null
) {
  // campaignContext & intent from the client are deliberately ignored —
  // context is built server-side (see below) to prevent prompt injection.
  let { message, sessionId, conversationHistory, activeConnectors } = body;

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // Strictly verify sessionId belongs to this user
  if (sessionId) {
    const { data: sessionRow } = await adminSupabase
      .from("chat_sessions")
      .select("id, organization_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!sessionRow) {
      sessionId = undefined;
    }
  }

  // Resolve Microsoft tokens strictly from the authenticated user's vault in user_integrations per product.
  // Never read tokens from cookies to prevent cross-user token leaks.
  const [msMailVault, msSharepointVault] = await Promise.all([
    resolveMicrosoftVaultTokens(userId, authUserEmail, "mail"),
    resolveMicrosoftVaultTokens(userId, authUserEmail, "sharepoint"),
  ]);
  const mailAccessToken = msMailVault.accessToken || msSharepointVault.accessToken || '';
  const sharepointAccessToken = msSharepointVault.accessToken || msMailVault.accessToken || '';
  const userEmail = authUserEmail || msMailVault.userEmail || msSharepointVault.userEmail || null;

  // -------------------------------------------------------------------
  // Server-side entitlement engine, the client's toggles can never grant
  // access the provider didn't. Locked connectors are forced off and their
  // entitlement stays false no matter what activeConnectors says.
  // -------------------------------------------------------------------
  const snapshot = await buildEntitlementSnapshot();
  const can = (id: keyof typeof snapshot.connectors) =>
    snapshot.connectors[id]?.access === 'granted';

  // -------------------------------------------------------------------
  // Server-side pause enforcement, the user's pause toggles live in the
  // database (app_users.connector_preferences), NOT in the client payload.
  // A paused connector is disabled here no matter what activeConnectors says.
  // -------------------------------------------------------------------
  const pausedPrefs = await getConnectorPreferences(userEmail);
  const paused = (id: keyof typeof snapshot.connectors) => isConnectorPaused(pausedPrefs, id);

  // Resolve granular active states from client payload or defaults, then
  // clamp by entitlement AND server-side pause.
  const active = activeConnectors || {};
  const isOutlookEnabled = active['microsoft.outlook'] !== false && can('microsoft.outlook') && !paused('microsoft.outlook');
  const isSharepointEnabled = active['microsoft.sharepoint'] !== false && can('microsoft.sharepoint') && !paused('microsoft.sharepoint');
  const isDynamicsEnabled = active['microsoft.dynamics'] === true && can('microsoft.dynamics') && !paused('microsoft.dynamics');
  const isZohoCrmEnabled = active['zoho.crm'] !== false && can('zoho.crm') && !paused('zoho.crm');
  const isZohoProjectsEnabled = active['zoho.projects'] !== false && can('zoho.projects') && !paused('zoho.projects');
  const isZohoBooksEnabled = active['zoho.books'] !== false && can('zoho.books') && !paused('zoho.books');

  // Per-user Zoho tokens (multi-tenant: the user's OWN Zoho, not a shared org)
  const [zohoCrmToken, zohoProjectsToken, zohoBooksToken] = await Promise.all([
    resolveZohoAccessToken(userEmail, 'crm', userId),
    resolveZohoAccessToken(userEmail, 'projects', userId),
    resolveZohoAccessToken(userEmail, 'books', userId),
  ]);

  const connectorContext = {
    'microsoft.outlook': {
      enabled: isOutlookEnabled,
      paused: paused('microsoft.outlook'),
      entitlement: Boolean(mailAccessToken) && can('microsoft.outlook') && !paused('microsoft.outlook'),
      accessToken: isOutlookEnabled ? mailAccessToken : '',
      writeEnabled: can('microsoft.outlook') && !paused('microsoft.outlook'),
    },
    'microsoft.sharepoint': {
      enabled: isSharepointEnabled,
      paused: paused('microsoft.sharepoint'),
      entitlement: Boolean(sharepointAccessToken) && can('microsoft.sharepoint') && !paused('microsoft.sharepoint'),
      accessToken: isSharepointEnabled ? sharepointAccessToken : '',
      writeEnabled: can('microsoft.sharepoint') && !paused('microsoft.sharepoint'),
    },
    'microsoft.dynamics': {
      enabled: isDynamicsEnabled,
      paused: paused('microsoft.dynamics'),
      entitlement: Boolean(sharepointAccessToken || mailAccessToken) && can('microsoft.dynamics') && !paused('microsoft.dynamics'),
      accessToken: isDynamicsEnabled ? (sharepointAccessToken || mailAccessToken) : '',
      writeEnabled: can('microsoft.dynamics') && !paused('microsoft.dynamics'),
    },
    'zoho.crm': {
      enabled: isZohoCrmEnabled,
      paused: paused('zoho.crm'),
      entitlement: can('zoho.crm') && !paused('zoho.crm'),
      accessToken: isZohoCrmEnabled ? zohoCrmToken.accessToken || undefined : undefined,
      writeEnabled: can('zoho.crm') && !paused('zoho.crm'),
    },
    'zoho.projects': {
      enabled: isZohoProjectsEnabled,
      paused: paused('zoho.projects'),
      entitlement: can('zoho.projects') && !paused('zoho.projects'),
      accessToken: isZohoProjectsEnabled ? zohoProjectsToken.accessToken || undefined : undefined,
      writeEnabled: can('zoho.projects') && !paused('zoho.projects'),
    },
    'zoho.books': {
      enabled: isZohoBooksEnabled,
      paused: paused('zoho.books'),
      entitlement: can('zoho.books') && !paused('zoho.books'),
      accessToken: isZohoBooksEnabled ? zohoBooksToken.accessToken || undefined : undefined,
      writeEnabled: can('zoho.books') && !paused('zoho.books'),
    },
  };

  const orgConfig: Record<string, string> = {
    crmOrgUrl: process.env.DYNAMICS_CRM_ORG_URL || '',
  };

  // Zoho org context: prefer the connected user's own org IDs / data center;
  // fall back to the legacy org-shared values only when explicitly enabled.
  const zohoRecord = zohoCrmToken.record || zohoProjectsToken.record || zohoBooksToken.record;
  if (zohoRecord) {
    orgConfig.dataCenter = zohoRecord.dataCenter || "in";
    if (zohoRecord.portalId) orgConfig.portalId = zohoRecord.portalId;
    if (zohoRecord.booksOrgId) orgConfig.organizationId = zohoRecord.booksOrgId;
    if (zohoRecord.crmOrgId) orgConfig.crmOrgId = zohoRecord.crmOrgId;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendSSE = (payload: object | string) => {
        try {
          if (typeof payload === 'string') {
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
        } catch {
          // Client closed connection
        }
      };

      try {
        // Send initial tool indicator for the UI loader
        sendSSE({ toolCall: 'AI Copilot Agent' });

        // SECURITY: campaign context is ALWAYS built server-side from the
        // caller's own campaigns. The client-supplied campaignContext/intent
        // are ignored — a malicious client could otherwise inject forged
        // "Campaign: ... CRM Deal ID: ..." context (LLM prompt injection that
        // steers which Zoho records the agent reads/writes).
        const serverCampaignContext = await buildActiveCampaignsContext(userId, orgId);

        // conversationHistory is client-supplied but is sanitized: roles are
        // clamped to user/assistant and the window is capped to keep a
        // malicious payload from bloating the n8n request.
        const sanitizedHistory = (conversationHistory || [])
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

        let effectiveChatInput = message;
        if (/(?:create|provision|setup|set up|new|add)\s+.*sharepoint\s+(?:site|team|portal)|sharepoint\s+(?:site|team|portal)\s+(?:create|provision|setup)/i.test(message)) {
          effectiveChatInput = `${message}\n\n[INSTRUCTION: The user wants to create a SharePoint site. Output a structured site creation draft block formatted exactly like: [SHAREPOINT_SITE_DRAFT]{"name": "Proposed Site Name", "description": "Brief description", "siteSlug": "site-slug", "template": "sts"}[/SHAREPOINT_SITE_DRAFT] followed by a concise summary. The UI will render this as an interactive SharePoint Site Action Card.]`;
        }

        const n8nPayload: Record<string, unknown> = {
          action: 'sendMessage',
          chatInput: effectiveChatInput,
          sessionId: sessionId || `web-${Date.now()}`,
          userId,
          organizationId: orgId,
          connectorContext,
          orgConfig,
        };
        if (serverCampaignContext) n8nPayload.campaignContext = serverCampaignContext;
        if (sanitizedHistory.length > 0) n8nPayload.conversationHistory = sanitizedHistory;

        const n8nRes = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream, text/plain, */*',
            'ngrok-skip-browser-warning': '69420',
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: JSON.stringify(n8nPayload),
          signal: AbortSignal.timeout(60_000),
        });

        if (!n8nRes.ok || !n8nRes.body) {
          // Structured error event, client renders as ErrorInlineBanner, NOT as a chat message.
          const isServerError = n8nRes.status >= 500;
          sendSSE({
            error: true,
            code: isServerError ? 'BACKEND_ERROR' : 'BACKEND_UNAVAILABLE',
            userMessage: isServerError
              ? 'The AI service encountered a problem on our end. Your message wasn\'t lost. Please try again in a moment.'
              : 'The AI service is temporarily unreachable. Check your connection and try again.',
          });
          sendSSE('[DONE]');
          controller.close();
          return;
        }

        const reader = n8nRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          // Filter tool-calling log strings and convert them into clean toolCall SSE frames
          const forwardText = (raw: string) => {
            if (!raw) return;
            const callingMatch = raw.match(/^Calling tools?:\s*([^\n\r]+)([\s\S]*)$/i);
            if (callingMatch) {
              const tools = callingMatch[1].trim();
              const remainder = callingMatch[2].trim();
              const firstTool = tools.split(/,\s*/)[0] || tools;
              sendSSE({ toolCall: firstTool });
              if (remainder) sendSSE({ text: remainder });
              return;
            }
            if (/Calling tools?:/i.test(raw)) {
              const parts = raw.split(/Calling tools?:/i);
              if (parts[0].trim()) sendSSE({ text: parts[0].trim() });
              const after = parts[1] || "";
              const afterMatch = after.match(/^([^\n\r\.\!]+)([\.\!\n\r][\s\S]*)$/);
              if (afterMatch) {
                const tools = afterMatch[1].trim();
                sendSSE({ toolCall: tools.split(/,\s*/)[0] || tools });
                const rest = afterMatch[2].trim();
                if (rest) sendSSE({ text: rest });
              } else {
                sendSSE({ toolCall: after.trim().split(/,\s*/)[0] || after.trim() });
              }
              return;
            }
            sendSSE({ text: raw });
          };

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // SSE format: data: ...
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.content || parsed.output || parsed.text || '';
                if (text) forwardText(text);
              } catch {
                if (data) forwardText(data);
              }
            } else {
              // Direct NDJSON format from n8n
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.type === 'begin') {
                  let nodeName: string = parsed.metadata?.nodeName ?? 'AI Agent';
                  if (/supabase|vector/i.test(nodeName)) {
                    nodeName = 'Knowledge Base';
                  }
                  sendSSE({ toolCall: nodeName });
                } else if (parsed.type === 'item' && parsed.content) {
                  forwardText(parsed.content);
                } else if (parsed.type === 'end') {
                  // Tool finished; main agent continues streaming
                } else if (parsed.output || parsed.text || parsed.content) {
                  const t = parsed.output || parsed.text || parsed.content;
                  if (t) forwardText(t);
                }
              } catch {
                if (trimmed && !trimmed.startsWith('{')) {
                  forwardText(trimmed);
                }
              }
            }
          }
        }

        // Flush remaining buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim());
            const text = parsed.content || parsed.output || parsed.text || '';
            if (text) {
              const callingMatch = text.match(/^Calling tools?:\s*([^\n\r]+)([\s\S]*)$/i);
              if (callingMatch && callingMatch[2].trim()) {
                sendSSE({ text: callingMatch[2].trim() });
              } else if (!callingMatch) {
                sendSSE({ text });
              }
            }
          } catch {
            if (buffer.trim() && !buffer.includes('[DONE]') && !buffer.includes('Calling tools:')) {
              sendSSE({ text: buffer.trim() });
            }
          }
        }

        sendSSE('[DONE]');
        controller.close();
      } catch (err) {
        // Distinguish timeout from general network/execution errors.
        const isTimeout =
          err instanceof Error &&
          (err.name === 'TimeoutError' || err.message.includes('timed out') || err.message.includes('timeout'));
        sendSSE({
          error: true,
          code: isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR',
          userMessage: isTimeout
            ? 'The AI took too long to respond. This is a service issue, not a duplicate send. Try again.'
            : 'An unexpected error occurred on our end. Your message wasn\'t sent twice. Please try again.',
        });
        sendSSE('[DONE]');
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
