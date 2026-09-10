import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { requireConnectorAccess } from "@/lib/entitlements";
import { getConnectorPreferences, isConnectorPaused } from "@/lib/connector-preferences";

export const dynamic = "force-dynamic";

const PAUSED_ZOHO_MESSAGE =
  "You have paused the Zoho connection. Please go to the Connections page and turn it on.";

/** Reads the current user's server-side pause map from the session cookie. */
async function currentUserPausedMap() {
  const cookieStore = await cookies();
  const email = cookieStore.get("ms_user_email")?.value || null;
  return getConnectorPreferences(email);
}

/**
 * Audit-logs a write action into agent_audit_logs (best-effort: never blocks
 * the response when the audit table is unavailable).
 */
async function auditWrite(opts: {
  action: string;
  targetType?: string;
  targetId?: string | null;
  payloadSummary?: Record<string, unknown>;
  outcome?: "success" | "failure" | "refused";
  metadata?: Record<string, unknown>;
}) {
  try {
    const cookieStore = await cookies();
    const actorEmail = cookieStore.get("ms_user_email")?.value || null;
    await supabase.from("agent_audit_logs").insert({
      actor_email: actorEmail,
      action: opts.action,
      target_type: opts.targetType || null,
      target_id: opts.targetId || null,
      payload_summary: opts.payloadSummary || null,
      outcome: opts.outcome || "success",
      metadata: opts.metadata || null,
    });
  } catch (err) {
    console.warn("[audit] Failed to record write action:", err);
  }
}

// ---------------------------------------------------------------------------
// Types, shared, client-safe definitions live in @/types/campaign
// ---------------------------------------------------------------------------

export type { AspectTask, Campaign } from "@/types/campaign";
import type { AspectTask, Campaign } from "@/types/campaign";

// ---------------------------------------------------------------------------
// Plan generation & metadata extraction, shared with client components via
// @/lib/campaign-planner (client-safe module, no server-only imports).
// ---------------------------------------------------------------------------
export {
  extractCampaignMetadata,
  generateDynamicBespokePlan,
  generateAIAspectPlan,
  generateAspectPlan,
} from "@/lib/campaign-planner";

import {
  extractCampaignMetadata,
  generateDynamicBespokePlan,
  generateAIAspectPlan,
  generateAspectPlan,
} from "@/lib/campaign-planner";

// ---------------------------------------------------------------------------
// Zoho CRM/Books/Projects Sync Helper & Books Contact Manager
// ---------------------------------------------------------------------------

export async function checkZohoBooksContact(client: string): Promise<{
  exists: boolean;
  contact?: { contactId: string; contactName: string; companyName: string };
  suggestedName: string;
}> {
  const normClient = String(client || '').trim().toLowerCase();

  // Live lookup via n8n webhook
  try {
    const N8N_ZOHO_SYNC_WEBHOOK =
      process.env.N8N_ZOHO_SYNC_WEBHOOK ||
      "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-ingest-v2";
    const res = await fetch(N8N_ZOHO_SYNC_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_books_contact", client }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.exists && data.contact) {
        return {
          exists: true,
          contact: data.contact,
          suggestedName: data.contact.contactName,
        };
      }
    }
  } catch (e) {
    console.warn("[checkZohoBooksContact] Live check failed:", e);
  }

  return {
    exists: false,
    suggestedName: `${client.trim()} India`,
  };
}

export async function createZohoBooksContact(client: string, companyName?: string): Promise<{
  success: boolean;
  contactId?: string;
  contactName?: string;
  companyName?: string;
  error?: string;
}> {
  const N8N_ZOHO_SYNC_WEBHOOK =
    process.env.N8N_ZOHO_SYNC_WEBHOOK ||
    "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-ingest-v2";

  try {
    const contactName = companyName ? `${client} (${companyName})` : `${client} India`;
    const res = await fetch(N8N_ZOHO_SYNC_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_books_contact",
        client,
        contactName,
        companyName: companyName || client,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.contactId) {
        return {
          success: true,
          contactId: data.contactId,
          contactName: data.contactName || contactName,
          companyName: data.companyName || client,
        };
      }
      return { success: false, error: data.message || "Failed to create contact in Zoho Books" };
    }
    return { success: false, error: `Webhook returned status ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function syncCampaignToZohoCRM(
  campaignId: string | null,
  campaignName: string,
  client: string,
  budget: string,
  codeVolume: string,
  tasks: AspectTask[],
  booksCustomerId?: string | null
): Promise<{ dealId: string | null; dealUrl: string | null; invoiceId: string | null; invoiceUrl: string | null; projectId: string | null; projectUrl: string | null; writeStatus: string }> {
  const N8N_ZOHO_SYNC_WEBHOOK =
    process.env.N8N_ZOHO_SYNC_WEBHOOK ||
    "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-ingest-v2";

  const taskSummary = tasks
    .map((t, i) => `${i + 1}. [${t.aspect.toUpperCase()}] ${t.title}, Owner: ${t.assignee}, TAT: ${t.tat}, Urgency: ${t.urgency}`)
    .join("\n");

  const message =
    `APPROVE CAMPAIGN FOR ZOHO CRM: ${campaignName}\n` +
    `Client: ${client}\n` +
    `Budget: ${budget}\n` +
    `Volume: ${codeVolume}\n` +
    `Total Tasks: ${tasks.length}\n\n` +
    `Task Breakdown:\n${taskSummary}`;

  try {
    const res = await fetch(N8N_ZOHO_SYNC_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        campaignId,
        campaignName,
        client,
        budget,
        codeVolume,
        booksCustomerId: booksCustomerId || undefined,
        is_approved_by_manager: true,
        tasks,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.error(`[ZohoCRM] n8n webhook returned ${res.status}`);
      return { dealId: null, dealUrl: null, invoiceId: null, invoiceUrl: null, projectId: null, projectUrl: null, writeStatus: `WEBHOOK_ERROR_${res.status}` };
    }

    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    const dealId: string | null =
      body?.id ||
      body?.data?.[0]?.id ||
      body?.dealId ||
      body?.deal?.id ||
      null;

    const invoiceId: string | null = body?.invoice_id || body?.invoiceId || null;
    const projectId: string | null = body?.project_id || body?.projectId || null;

    const dealUrl = dealId ? `https://crm.zoho.in/crm/org/tab/Potentials/${dealId}` : null;
    const invoiceUrl = invoiceId ? `https://books.zoho.in/app#/invoices/${invoiceId}` : null;
    const projectUrl = projectId ? `https://projects.zoho.in/portal/enlightlabdotcom#project/${projectId}` : null;

    return {
      dealId,
      dealUrl,
      invoiceId,
      invoiceUrl,
      projectId,
      projectUrl,
      writeStatus: dealId ? "SYNCED" : "CREATED_NO_ID",
    };
  } catch (err: any) {
    console.error("[ZohoCRM] Sync failed:", err.message);
    return { dealId: null, dealUrl: null, invoiceId: null, invoiceUrl: null, projectId: null, projectUrl: null, writeStatus: "FAILED" };
  }
}

// ---------------------------------------------------------------------------
// Map a Supabase campaign row → Campaign interface
// ---------------------------------------------------------------------------
function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    category: row.category || "FMCG",
    rewardType: row.reward_type || "Cashback",
    budget: row.budget || "₹0",
    budgetNumeric: parseFloat(String(row.budget || "0").replace(/[^0-9.]/g, "")) || 0,
    codeVolume: row.code_volume || "0 packs",
    codeVolumeNumeric: parseFloat(String(row.code_volume || "0").replace(/[^0-9.]/g, "")) || 0,
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status: row.status === "live" ? "Live" : "Draft",
    completionRate: 20,
    zohoCrmDealId: row.zoho_crm_deal_id,
    zohoCrmDealUrl: row.zoho_crm_deal_url,
    zohoCrmDealStage: row.zoho_crm_deal_stage,
    zohoProjectId: row.zoho_project_id,
    zohoProjectUrl: row.zoho_project_url,
    zohoBooksInvoiceId: row.zoho_books_invoice_id,
    zohoBooksInvoiceUrl: row.zoho_books_invoice_url,
    zohoSyncStatus: row.zoho_sync_status ? row.zoho_sync_status.charAt(0).toUpperCase() + row.zoho_sync_status.slice(1) : "Pending",
    lastZohoSync: row.last_zoho_sync
      ? new Date(row.last_zoho_sync).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : undefined,
    booksCustomerId: row.books_customer_id,
    brief: row.brief || "",
    aspectSummary: row.aspect_summary || {
      legal: { total: 0, done: 0, status: "Pending" },
      compliance: { total: 0, done: 0, status: "Pending" },
      accounting: { total: 0, done: 0, status: "Pending" },
      implementation: { total: 0, done: 0, status: "Pending" },
    },
    tasks: row.tasks || [],
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
  };
}

// ---------------------------------------------------------------------------
// Reconcile Zoho CRM with Supabase (Single source of truth)
// ---------------------------------------------------------------------------
export async function reconcileZohoCRMWithSupabase(): Promise<{
  campaigns: Campaign[];
  validated: number;
  deleted: number;
  updated: number;
  reset: number;
}> {
  const N8N_ZOHO_SYNC_WEBHOOK =
    process.env.N8N_ZOHO_SYNC_WEBHOOK ||
    "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-ingest-v2";

  try {
    const listRes = await fetch(N8N_ZOHO_SYNC_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_deals" }),
      signal: AbortSignal.timeout(15000),
    });

    if (listRes.ok) {
      const listData = (await listRes.json().catch(() => ({}))) as Record<string, any>;
      const liveDeals: Array<{ id: string; name: string; stage?: string; amount?: number }> =
        Array.isArray(listData?.deals) ? listData.deals : [];
      const liveDealIds = new Set(
        (Array.isArray(listData?.dealIds) ? listData.dealIds : liveDeals.map((d) => d.id)).map(String)
      );
      const liveDealMap = new Map(liveDeals.map((d) => [String(d.id), d]));

      const { data: allCampaigns } = await supabase.from("campaigns").select("*");
      const existing = allCampaigns || [];

      let deletedCount = 0;
      let updatedCount = 0;
      const claimedDealIds = new Set<string>();

      // Native Zoho CRM Campaign module IDs that must always be preserved
      const nativeZohoCampaignIds = new Set([
        "1418411000000549005",
        "1418411000000549004",
        "1418411000000549003",
        "1418411000000549002",
        "1418411000000549001",
      ]);

      for (const camp of existing) {
        // Approval gate: drafts were never pushed to Zoho and must never be auto-linked
        // to live Zoho CRM deals or deleted during Zoho CRM reconciliation.
        if (camp.status === "draft") continue;

        const dealIdStr = camp.zoho_crm_deal_id ? String(camp.zoho_crm_deal_id) : "";
        const isNativeCampaign = nativeZohoCampaignIds.has(dealIdStr) || String(camp.zoho_crm_deal_url || "").includes("/Campaigns/");

        if (isNativeCampaign) {
          claimedDealIds.add(dealIdStr);
          continue;
        }

        if (dealIdStr) {
          if (liveDealIds.size > 0 && !liveDealIds.has(dealIdStr)) {
            // Deal was DELETED in Zoho CRM, cascade cleanup in Projects and Books
            console.log(`[reconcile] Zoho deal ${dealIdStr} was deleted in CRM. Cleaning up Projects, Books & Supabase for ${camp.name} (${camp.id})`);
            const N8N_ZOHO_DELETE_WEBHOOK =
              process.env.N8N_ZOHO_DELETE_WEBHOOK ||
              "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-delete-zoho-resources";
            await fetch(N8N_ZOHO_DELETE_WEBHOOK, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dealId: dealIdStr,
                projectId: camp.zoho_project_id,
                invoiceId: camp.zoho_books_invoice_id,
                campaignName: camp.name,
              }),
              signal: AbortSignal.timeout(8000),
            }).catch(() => {});
            await supabase.from("campaigns").delete().eq("id", camp.id);
            deletedCount++;
          } else {
            claimedDealIds.add(dealIdStr);
            const live = liveDealMap.get(dealIdStr);
            const updates: Record<string, any> = {
              zoho_sync_status: "synced",
              last_zoho_sync: new Date().toISOString(),
            };
            if (live?.name && live.name !== camp.name) {
              updates.name = live.name;
            }
            if (live?.stage && live.stage !== camp.zoho_crm_deal_stage) {
              updates.zoho_crm_deal_stage = live.stage;
            }
            if (live?.amount && typeof live.amount === "number") {
              const formatted = `₹${live.amount.toLocaleString("en-IN")}`;
              if (formatted !== camp.budget) {
                updates.budget = formatted;
              }
            }
            await supabase.from("campaigns").update(updates).eq("id", camp.id);
            updatedCount++;
          }
        } else {
          // Campaign has no deal ID, check if any unclaimed live deal matches by name
          const match = liveDeals.find(
            (d) => !claimedDealIds.has(String(d.id)) && d.name && d.name.trim().toLowerCase() === camp.name.trim().toLowerCase()
          );
          if (match) {
            claimedDealIds.add(String(match.id));
            await supabase
              .from("campaigns")
              .update({
                zoho_crm_deal_id: String(match.id),
                zoho_crm_deal_url: `https://crm.zoho.in/crm/org/tab/Potentials/${match.id}`,
                zoho_crm_deal_stage: match.stage || "Qualification",
                zoho_sync_status: "synced",
                last_zoho_sync: new Date().toISOString(),
              })
              .eq("id", camp.id);
            updatedCount++;
          }
        }
      }

      // Import any deals present in Zoho CRM that don't exist in Supabase at all
      for (const liveDeal of liveDeals) {
        const dealIdStr = String(liveDeal.id);
        if (!claimedDealIds.has(dealIdStr)) {
          const now = new Date().toISOString();
          const bespoke = generateDynamicBespokePlan({
            name: liveDeal.name || "Zoho Campaign Deal",
            client: "Enterprise Client",
          });
          await supabase.from("campaigns").insert({
            name: liveDeal.name || "Zoho Campaign Deal",
            client: "Enterprise Client",
            category: "FMCG",
            reward_type: "Cashback",
            budget: liveDeal.amount ? `₹${liveDeal.amount.toLocaleString("en-IN")}` : "₹25,00,000",
            code_volume: "250,000 packs",
            start_date: now.split("T")[0],
            end_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
            brief: `Live campaign imported directly from Zoho CRM Deal ${dealIdStr}.`,
            status: "live",
            tasks: bespoke.tasks,
            aspect_summary: bespoke.aspectSummary,
            zoho_crm_deal_id: dealIdStr,
            zoho_crm_deal_url: `https://crm.zoho.in/crm/org/tab/Potentials/${dealIdStr}`,
            zoho_crm_deal_stage: liveDeal.stage || "Qualification",
            zoho_sync_status: "synced",
            last_zoho_sync: now,
            approved_at: now,
            approved_by: "Zoho CRM Sync",
          });
        }
      }

      const { data: refreshedRows } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      return {
        campaigns: (refreshedRows || []).map(rowToCampaign),
        validated: liveDeals.length,
        deleted: deletedCount,
        updated: updatedCount,
        reset: deletedCount,
      };
    }
  } catch (err: any) {
    console.warn("[reconcileZohoCRMWithSupabase] Live Zoho list failed:", err.message);
  }

  const { data: fallbackRows } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  return {
    campaigns: (fallbackRows || []).map(rowToCampaign),
    validated: 0,
    deleted: 0,
    updated: 0,
    reset: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers shared by draft / approve actions
// ---------------------------------------------------------------------------
function buildAspectSummary(tasks: any[]): Campaign["aspectSummary"] {
  const aspects = ["legal", "compliance", "accounting", "implementation"] as const;
  const seed: Campaign["aspectSummary"] = {
    legal: { total: 0, done: 0, status: "Pending" },
    compliance: { total: 0, done: 0, status: "Pending" },
    accounting: { total: 0, done: 0, status: "Pending" },
    implementation: { total: 0, done: 0, status: "Pending" },
  };
  return aspects.reduce<Campaign["aspectSummary"]>((acc, aspect) => {
    const aspectTasks = (tasks || []).filter((t: any) => (t.aspect || "").toLowerCase() === aspect);
    acc[aspect] = {
      total: aspectTasks.length,
      done: aspectTasks.filter((t: any) => t.status === "COMPLETED").length,
      status: aspectTasks.length === 0 ? "Pending" : "In Review",
    };
    return acc;
  }, seed);
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const id = searchParams.get("id");
  const name = searchParams.get("name");
  const sync = searchParams.get("sync");

  if (sync === "true") {
    const syncResult = await reconcileZohoCRMWithSupabase();
    return NextResponse.json({ campaigns: syncResult.campaigns, validated: syncResult.validated });
  }

  if (action === "check_approved" && name) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("name", name)
      .eq("status", "live")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[check_approved] Supabase error:", error);
      return NextResponse.json({ found: false });
    }
    if (!data) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, campaign: rowToCampaign(data) });
  }

  if (action === "get_campaign" && id) {
    const { data } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ campaign: rowToCampaign(data) });
  }

  if (action === "read_zoho_tasks" && id) {
    const { data } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    const campaign = rowToCampaign(data);

    return NextResponse.json({
      zohoCrmDealId: campaign.zohoCrmDealId || "N/A",
      zohoCrmDealUrl: campaign.zohoCrmDealUrl,
      zohoProjectId: campaign.zohoProjectId || "N/A",
      zohoProjectUrl: campaign.zohoProjectUrl,
      zohoBooksInvoiceId: campaign.zohoBooksInvoiceId || "N/A",
      zohoBooksInvoiceUrl: campaign.zohoBooksInvoiceUrl,
      syncTimestamp: new Date().toISOString(),
      tasks: campaign.tasks,
      metrics: {
        totalTasks: campaign.tasks.length,
        closedTasks: campaign.tasks.filter((t) => t.status === "COMPLETED").length,
        inProgressTasks: campaign.tasks.filter((t) => t.status === "IN_PROGRESS").length,
        pendingApproval: campaign.tasks.filter((t) => t.status.includes("PENDING")).length,
      },
    });
  }

  const { data: supabaseRows, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET campaigns] Supabase error:", error);
    return NextResponse.json({ campaigns: [] });
  }

  const allCampaigns = (supabaseRows || []).map(rowToCampaign);
  return NextResponse.json({ campaigns: allCampaigns });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // ── Action 0A: Check Zoho Books Contact ──
    if (action === "check_books_contact") {
      const { client } = body;
      if (!client) {
        return NextResponse.json({ error: "Client is required" }, { status: 400 });
      }
      const prefs = await currentUserPausedMap();
      if (isConnectorPaused(prefs, "zoho.books")) {
        return NextResponse.json({ success: false, paused: true, error: PAUSED_ZOHO_MESSAGE, reason: "connector_paused" }, { status: 403 });
      }
      const check = await checkZohoBooksContact(client);
      return NextResponse.json({ success: true, ...check });
    }

    // ── Action 0B: Create Zoho Books Contact ──
    if (action === "create_books_contact") {
      const { client, companyName } = body;
      if (!client) {
        return NextResponse.json({ error: "Client is required" }, { status: 400 });
      }
      const prefs = await currentUserPausedMap();
      if (isConnectorPaused(prefs, "zoho.books")) {
        return NextResponse.json({ success: false, paused: true, error: PAUSED_ZOHO_MESSAGE, reason: "connector_paused" }, { status: 403 });
      }
      const result = await createZohoBooksContact(client, companyName);
      return NextResponse.json(result);
    }

    // ── Action 0C: Save campaign as draft (Supabase ONLY, no Zoho writes) ──
    // Human-in-the-loop gate: a draft can be reviewed and approved later;
    // nothing is pushed to Zoho CRM / Projects / Books until explicit approval.
    if (action === "save_draft") {
      const { campaignData, tasks } = body;
      if (!campaignData?.name || !campaignData?.client) {
        return NextResponse.json({ error: "Campaign name and client are required" }, { status: 400 });
      }

      const now = new Date().toISOString();
      const resolvedTasks = tasks && tasks.length > 0 ? tasks : generateDynamicBespokePlan(campaignData).tasks;
      const aspectSummary = buildAspectSummary(resolvedTasks);

      // Resolve Zoho Books Customer ID if already verified (read-only lookup, safe for drafts)
      let booksCustomerId = body.booksCustomerId || campaignData.booksCustomerId || null;
      if (!booksCustomerId && campaignData.client) {
        const contactCheck = await checkZohoBooksContact(campaignData.client).catch(() => ({ exists: false, contact: undefined as any }));
        if (contactCheck.exists && contactCheck.contact?.contactId) {
          booksCustomerId = contactCheck.contact.contactId;
        }
      }

      // 1. Update existing row if we have an id or a name match (avoid duplicates)
      let targetRow: any = null;
      if (body.campaignId) {
        const { data } = await supabase.from("campaigns").select("*").eq("id", body.campaignId).maybeSingle();
        targetRow = data;
      }
      if (!targetRow && campaignData.name) {
        const { data } = await supabase.from("campaigns").select("*").ilike("name", campaignData.name.trim()).maybeSingle();
        targetRow = data;
      }

      if (targetRow) {
        await supabase
          .from("campaigns")
          .update({
            name: campaignData.name || targetRow.name,
            client: campaignData.client || targetRow.client,
            category: campaignData.category || targetRow.category,
            reward_type: campaignData.rewardType || targetRow.reward_type,
            budget: campaignData.budget || targetRow.budget,
            code_volume: campaignData.codeVolume || targetRow.code_volume,
            start_date: campaignData.startDate || targetRow.start_date,
            end_date: campaignData.endDate || targetRow.end_date,
            brief: campaignData.brief || targetRow.brief,
            tasks: resolvedTasks,
            aspect_summary: aspectSummary,
            status: "draft",
            zoho_sync_status: "pending",
            books_customer_id: booksCustomerId || targetRow.books_customer_id || null,
          })
          .eq("id", targetRow.id);
      } else {
        const { data: insertedRow, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            name: campaignData.name,
            client: campaignData.client,
            category: campaignData.category || "FMCG",
            reward_type: campaignData.rewardType || "Cashback",
            budget: campaignData.budget || "₹25,00,000",
            code_volume: campaignData.codeVolume || "250,000 packs",
            start_date: campaignData.startDate || now.split("T")[0],
            end_date: campaignData.endDate || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
            brief: campaignData.brief || "Draft campaign plan awaiting approval.",
            status: "draft",
            tasks: resolvedTasks,
            aspect_summary: aspectSummary,
            zoho_crm_deal_id: null,
            zoho_crm_deal_url: null,
            zoho_crm_deal_stage: null,
            zoho_project_id: null,
            zoho_project_url: null,
            zoho_books_invoice_id: null,
            zoho_books_invoice_url: null,
            books_customer_id: booksCustomerId,
            zoho_sync_status: "pending",
            last_zoho_sync: null,
            approved_at: null,
            approved_by: null,
          })
          .select()
          .single();
        if (insertError) {
          console.error("[save_draft] Supabase insert error:", insertError);
          return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
        }
        targetRow = insertedRow;
      }

      return NextResponse.json({
        success: true,
        campaign: rowToCampaign(targetRow),
        campaignId: targetRow.id,
        note: "Saved as draft. Nothing is pushed to Zoho until you approve.",
      });
    }

    // ── Action 0D: Discard a draft campaign (Supabase ONLY, no Zoho calls) ──
    // Drafts were never pushed to Zoho, so discarding must not fire the Zoho
    // delete webhook. Guarded: refuses to touch rows that have Zoho records.
    if (action === "discard_draft") {
      const { campaignId } = body;
      if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

      const { data: camp } = await supabase.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
      if (!camp) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      // Safety net: never discard anything that already has Zoho resources
      if (camp.zoho_crm_deal_id || camp.zoho_project_id || camp.zoho_books_invoice_id) {
        return NextResponse.json(
          {
            error: "Refusing to discard: campaign already has Zoho records. Use delete_campaign instead.",
            hasZohoResources: true,
          },
          { status: 409 }
        );
      }

      const { error: deleteError } = await supabase.from("campaigns").delete().eq("id", campaignId);
      if (deleteError) {
        console.error("[discard_draft] Supabase delete error:", deleteError);
        return NextResponse.json({ error: "Failed to discard draft" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        deletedName: camp.name,
        note: "Draft discarded. The record was deleted and there is nothing to clean up in Zoho.",
      });
    }

    // ── Action 1: Dynamic AI Plan Generation from Brief / Prompt ──
    if (action === "generate_plan") {
      const { campaignInput } = body;
      if (!campaignInput) {
        return NextResponse.json({ error: "Campaign data or brief is required" }, { status: 400 });
      }

      // Call the AI Brain decomposition engine
      const aiResult = await generateAIAspectPlan(campaignInput);
      const booksContact = await checkZohoBooksContact(aiResult.client);

      return NextResponse.json({
        success: true,
        aiAnalysis: aiResult.aiAnalysis,
        campaignData: {
          name: aiResult.name,
          client: aiResult.client,
          category: aiResult.category,
          rewardType: aiResult.rewardType,
          budget: aiResult.budget,
          codeVolume: aiResult.codeVolume,
          startDate: aiResult.startDate,
          endDate: aiResult.endDate,
          brief: aiResult.brief,
          booksCustomerId: booksContact.contact?.contactId || undefined,
        },
        booksContact: {
          exists: booksContact.exists,
          contactId: booksContact.contact?.contactId,
          contactName: booksContact.contact?.contactName,
          suggestedName: booksContact.suggestedName,
        },
        plan: {
          tasks: aiResult.tasks,
          aspectSummary: aiResult.aspectSummary,
          recommendedTAT: aiResult.recommendedTAT,
          criticalPath: aiResult.criticalPath,
          totalEstimatedTasks: aiResult.tasks.length,
        },
      });
    }

    // ── Action 2: Approve & sync campaign to Zoho CRM ──
    if (action === "approve_and_push_zoho") {
      // Pause gate first: a paused Zoho connection must never be written to,
      // even when the entitlement itself is fine.
      const prefs = await currentUserPausedMap();
      const zohoPaused =
        isConnectorPaused(prefs, "zoho.crm") ||
        isConnectorPaused(prefs, "zoho.projects") ||
        isConnectorPaused(prefs, "zoho.books");
      if (zohoPaused) {
        const pausedList = ([
          ["zoho.crm", "Zoho CRM"],
          ["zoho.projects", "Zoho Projects"],
          ["zoho.books", "Zoho Books"],
        ] as const)
          .filter(([id]) => isConnectorPaused(prefs, id))
          .map(([, label]) => label)
          .join(", ");
        await auditWrite({ action: "approve_and_push_zoho", outcome: "refused", payloadSummary: { reason: "connector_paused", paused: pausedList } });
        return NextResponse.json(
          { error: PAUSED_ZOHO_MESSAGE, reason: "connector_paused", paused: pausedList },
          { status: 403 }
        );
      }

      // Entitlement gate: Zoho CRM access is required to provision Zoho records
      const zohoAccess = await requireConnectorAccess("zoho.crm");
      if (!zohoAccess.ok) {
        await auditWrite({ action: "approve_and_push_zoho", outcome: "refused", payloadSummary: { reason: zohoAccess.reason } });
        return NextResponse.json(
          { error: "You don't have access to the CRM.", reason: zohoAccess.reason },
          { status: 403 }
        );
      }

      const { campaignData, tasks } = body;
      const now = new Date().toISOString();
      const resolvedTasks =
        tasks && tasks.length > 0 ? tasks : generateDynamicBespokePlan(campaignData).tasks;

      // Guard: resolve the target row up-front. If it already has a Zoho CRM Deal,
      // it was already approved & provisioned, never re-run full provisioning.
      // (Prevents duplicate Deals / Projects / Invoices when a draft is approved twice.)
      let existingRow: any = null;
      if (body.campaignId) {
        const { data } = await supabase.from("campaigns").select("*").eq("id", body.campaignId).maybeSingle();
        existingRow = data;
      }
      if (!existingRow && campaignData.name) {
        const { data } = await supabase.from("campaigns").select("*").ilike("name", campaignData.name.trim()).maybeSingle();
        existingRow = data;
      }
      const isFullyProvisioned = Boolean(
        existingRow?.zoho_crm_deal_id &&
        existingRow?.zoho_project_id &&
        existingRow?.zoho_books_invoice_id
      );

      if (isFullyProvisioned) {
        // Already provisioned in all 3 apps: persist any plan edits, keep status live, no new Zoho writes
        await supabase
          .from("campaigns")
          .update({
            tasks: resolvedTasks,
            aspect_summary: buildAspectSummary(resolvedTasks),
            budget: campaignData.budget || existingRow.budget,
            code_volume: campaignData.codeVolume || existingRow.code_volume,
            status: "live",
          })
          .eq("id", existingRow.id);
        const mergedRow = { ...existingRow, tasks: resolvedTasks, status: "live", aspect_summary: buildAspectSummary(resolvedTasks) };
        await auditWrite({
          action: "approve_and_push_zoho",
          targetType: "campaign",
          targetId: existingRow.id,
          payloadSummary: { name: campaignData.name, client: campaignData.client, alreadySynced: true },
        });
        return NextResponse.json({
          success: true,
          campaign: rowToCampaign(mergedRow),
          alreadySynced: true,
          zohoSync: {
            crmDeal: {
              product: "Zoho CRM",
              module: "Deals",
              dealId: existingRow.zoho_crm_deal_id,
              dealUrl: existingRow.zoho_crm_deal_url || `https://crm.zoho.in/crm/org/tab/Potentials/${existingRow.zoho_crm_deal_id}`,
              stage: existingRow.zoho_crm_deal_stage || "Qualification",
              writeStatus: "SYNCED",
            },
            projects: {
              product: "Zoho Projects",
              projectId: existingRow.zoho_project_id,
              projectUrl: existingRow.zoho_project_url || `https://projects.zoho.in/portal/enlightlabdotcom#project/${existingRow.zoho_project_id}`,
              taskCount: (resolvedTasks || []).length,
              writeStatus: "SYNCED",
            },
            books: {
              product: "Zoho Books",
              invoiceId: existingRow.zoho_books_invoice_id,
              invoiceUrl: existingRow.zoho_books_invoice_url || `https://books.zoho.in/app#/invoices/${existingRow.zoho_books_invoice_id}`,
              writeStatus: "SYNCED",
            },
          },
          note: "Campaign already approved and provisioned in Zoho. No duplicate records were created.",
        });
      }

      // Resolve Zoho Books Customer ID (or auto-create if missing)
      let booksCustomerId = body.booksCustomerId || campaignData.booksCustomerId || existingRow?.books_customer_id || null;
      const clientName = campaignData.client || existingRow?.client || "Enterprise Client";
      if (!booksCustomerId && clientName) {
        const contactCheck = await checkZohoBooksContact(clientName);
        if (contactCheck.exists && contactCheck.contact?.contactId) {
          booksCustomerId = contactCheck.contact.contactId;
        } else {
          const created = await createZohoBooksContact(clientName);
          if (created.success && created.contactId) {
            booksCustomerId = created.contactId;
          } else {
            booksCustomerId = "4157605000000113019";
          }
        }
      }

      // 1. Check if an existing row exists for this campaign (or insert new)
      let targetRow: any = null;
      if (body.campaignId) {
        const { data } = await supabase.from("campaigns").select("*").eq("id", body.campaignId).maybeSingle();
        targetRow = data;
      }
      if (!targetRow && campaignData.name) {
        const { data } = await supabase.from("campaigns").select("*").ilike("name", campaignData.name.trim()).maybeSingle();
        targetRow = data;
      }

      let campaignId: string;
      if (targetRow) {
        campaignId = targetRow.id;
        const updateExisting: Record<string, any> = {
          name: campaignData.name || targetRow.name,
          client: campaignData.client || targetRow.client,
          reward_type: campaignData.rewardType || targetRow.reward_type,
          status: "live",
          tasks: resolvedTasks,
          budget: campaignData.budget || targetRow.budget,
          code_volume: campaignData.codeVolume || targetRow.code_volume,
          approved_at: now,
          approved_by: "Rohit Sharma (Admin)",
        };
        if (booksCustomerId) updateExisting.books_customer_id = booksCustomerId;
        await supabase.from("campaigns").update(updateExisting).eq("id", campaignId);
      } else {
        const { data: insertedRow, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            name: campaignData.name,
            client: campaignData.client,
            category: campaignData.category || "FMCG",
            reward_type: campaignData.rewardType || "Cashback",
            budget: campaignData.budget || "₹25,00,000",
            code_volume: campaignData.codeVolume || "250,000 packs",
            start_date: campaignData.startDate || now.split("T")[0],
            end_date: campaignData.endDate || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
            brief: campaignData.brief || "AI-generated campaign plan.",
            status: "live",
            tasks: resolvedTasks,
            aspect_summary: buildAspectSummary(resolvedTasks),
            zoho_crm_deal_id: null,
            zoho_crm_deal_url: null,
            zoho_crm_deal_stage: "Qualification",
            zoho_project_id: null,
            zoho_project_url: null,
            zoho_books_invoice_id: null,
            zoho_books_invoice_url: null,
            books_customer_id: booksCustomerId,
            zoho_sync_status: "pending",
            last_zoho_sync: null,
            approved_at: now,
            approved_by: "Rohit Sharma (Admin)",
          })
          .select()
          .single();

        if (insertError) {
          console.error("[approve_and_push_zoho] Supabase insert error:", insertError);
        }
        targetRow = insertedRow;
        campaignId = insertedRow?.id;
      }

      // 2. Call Zoho CRM sync or update
      let dealId = targetRow?.zoho_crm_deal_id || null;
      let dealUrl = targetRow?.zoho_crm_deal_url || null;
      let invoiceId = targetRow?.zoho_books_invoice_id || null;
      let invoiceUrl = targetRow?.zoho_books_invoice_url || null;
      let projectId = targetRow?.zoho_project_id || null;
      let projectUrl = targetRow?.zoho_project_url || null;
      let writeStatus = dealId ? "SYNCED" : "PENDING";

      // Only route to update webhook if ALL 3 resources already exist in Zoho!
      const allResourcesExist = Boolean(dealId && projectId && invoiceId);

      if (allResourcesExist) {
        // Record already exists across Zoho CRM, Projects, and Books: Update existing resources
        const N8N_ZOHO_UPDATE_WEBHOOK =
          process.env.N8N_ZOHO_UPDATE_WEBHOOK ||
          "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-update-resources";

        const numericAmount = parseFloat(String(campaignData.budget || targetRow.budget || "0").replace(/[^0-9.]/g, "")) || 0;
        const taskSummary = resolvedTasks
          .map((t: any, i: number) => `${i + 1}. [${(t.aspect || "").toUpperCase()}] ${t.title || t.name}, Owner: ${t.assignee || "TBD"}, TAT: ${t.tat || "2 Days"}, Urgency: ${t.urgency || "HIGH"}`)
          .join("\n");

        await fetch(N8N_ZOHO_UPDATE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId,
            projectId,
            invoiceId,
            customerId: booksCustomerId || targetRow.books_customer_id,
            client: campaignData.client || targetRow.client,
            campaignName: campaignData.name || targetRow.name,
            amount: numericAmount,
            budget: campaignData.budget || targetRow.budget,
            rewardType: campaignData.rewardType || targetRow.reward_type,
            tasks: resolvedTasks,
            taskSummary,
          }),
          signal: AbortSignal.timeout(12000),
        }).catch((err) => console.warn("[approve_and_push_zoho] Update webhook failed:", err));

        await supabase
          .from("campaigns")
          .update({
            last_zoho_sync: now,
            zoho_sync_status: "synced",
          })
          .eq("id", campaignId);
      } else if (dealId && (!projectId || !invoiceId)) {
        // Deal already exists in Zoho CRM, but missing Zoho Projects Project or Zoho Books Invoice!
        // Call sync_missing_products to provision missing resources without duplicate deal:
        const N8N_ZOHO_SYNC_WEBHOOK =
          process.env.N8N_ZOHO_SYNC_WEBHOOK ||
          "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-ingest-v2";

        try {
          const res = await fetch(N8N_ZOHO_SYNC_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "sync_missing_products",
              dealId,
              campaignId,
              campaignName: campaignData.name || targetRow?.name,
              client: campaignData.client || targetRow?.client,
              budget: campaignData.budget || targetRow?.budget,
              codeVolume: campaignData.codeVolume || targetRow?.code_volume,
              booksCustomerId: booksCustomerId || targetRow?.books_customer_id || "4157605000000113019",
              tasks: resolvedTasks,
            }),
            signal: AbortSignal.timeout(20000),
          });

          if (res.ok) {
            const body = await res.json().catch(() => ({}));
            projectId = body?.project_id || body?.projectId || projectId;
            invoiceId = body?.invoice_id || body?.invoiceId || invoiceId;
            writeStatus = "SYNCED";
          }
        } catch (e) {
          console.error("[approve_and_push_zoho] Sync missing products failed:", e);
        }
      } else {
        // Missing ANY resource (Deal, Project, or Invoice):
        // Trigger full ingestion to provision missing Zoho CRM deal, Zoho Projects project, and Zoho Books invoice!
        const syncRes = await syncCampaignToZohoCRM(
          campaignId,
          campaignData.name || targetRow?.name,
          campaignData.client || targetRow?.client,
          campaignData.budget || targetRow?.budget,
          campaignData.codeVolume || targetRow?.code_volume,
          resolvedTasks,
          booksCustomerId
        );
        dealId = syncRes.dealId || dealId;
        dealUrl = syncRes.dealUrl || dealUrl;
        invoiceId = syncRes.invoiceId || invoiceId;
        invoiceUrl = syncRes.invoiceUrl || invoiceUrl;
        projectId = syncRes.projectId || projectId;
        projectUrl = syncRes.projectUrl || projectUrl;
        writeStatus = syncRes.writeStatus;
      }

        // In case n8n updated Supabase asynchronously during the flow, query fresh values
        if (campaignId && (!dealId || !projectId || !invoiceId)) {
          const { data: refreshedRow } = await supabase
            .from("campaigns")
            .select("*")
            .eq("id", campaignId)
            .maybeSingle();

          if (refreshedRow) {
            dealId = refreshedRow.zoho_crm_deal_id || dealId;
            dealUrl = refreshedRow.zoho_crm_deal_url || dealUrl;
            projectId = refreshedRow.zoho_project_id || projectId;
            projectUrl = refreshedRow.zoho_project_url || projectUrl;
            invoiceId = refreshedRow.zoho_books_invoice_id || invoiceId;
            invoiceUrl = refreshedRow.zoho_books_invoice_url || invoiceUrl;
          }
        }

        // 3. Update the Supabase record with all returned IDs and mark as synced
        if (campaignId) {
          const updatePayload: Record<string, any> = {
            zoho_sync_status: dealId || projectId || invoiceId ? "synced" : "pending",
            last_zoho_sync: now,
          };
          if (dealId) {
            updatePayload.zoho_crm_deal_id = dealId;
            updatePayload.zoho_crm_deal_url = dealUrl;
            updatePayload.zoho_crm_deal_stage = "Qualification";
          }
          if (invoiceId) {
            updatePayload.zoho_books_invoice_id = invoiceId;
            updatePayload.zoho_books_invoice_url = invoiceUrl;
          }
          if (projectId) {
            updatePayload.zoho_project_id = projectId;
            updatePayload.zoho_project_url = projectUrl;
          }
          if (booksCustomerId) {
            updatePayload.books_customer_id = booksCustomerId;
          }

          await supabase
            .from("campaigns")
            .update(updatePayload)
            .eq("id", campaignId);

          if (targetRow) {
            Object.assign(targetRow, updatePayload);
          }
        }

      // 4. Fallback: if initial webhook didn't return dealId, fire background re-sync with campaignId
      if (!dealId && targetRow?.id) {
        const N8N_ZOHO_SYNC_WEBHOOK =
          process.env.N8N_ZOHO_SYNC_WEBHOOK ||
          "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-ingest-v2";
        fetch(N8N_ZOHO_SYNC_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: targetRow.id,
            campaignName: campaignData.name,
            client: campaignData.client,
            budget: campaignData.budget,
            codeVolume: campaignData.codeVolume,
            is_approved_by_manager: true,
            tasks: resolvedTasks,
          }),
        }).catch((err) => console.warn("[approve_and_push_zoho] Re-fire webhook failed:", err));
      }

      if (targetRow) {
        if (dealId) targetRow.zoho_crm_deal_id = dealId;
        if (dealUrl) targetRow.zoho_crm_deal_url = dealUrl;
        if (projectId) targetRow.zoho_project_id = projectId;
        if (projectUrl) targetRow.zoho_project_url = projectUrl;
        if (invoiceId) targetRow.zoho_books_invoice_id = invoiceId;
        if (invoiceUrl) targetRow.zoho_books_invoice_url = invoiceUrl;
        if (dealId || projectId || invoiceId) targetRow.zoho_sync_status = "synced";
      }

      const savedCampaign: Campaign = targetRow
        ? rowToCampaign(targetRow)
        : {
            id: `camp-${Date.now()}`,
            name: campaignData.name,
            client: campaignData.client,
            category: campaignData.category || "FMCG",
            rewardType: campaignData.rewardType || "Cashback",
            budget: campaignData.budget,
            budgetNumeric: parseFloat(String(campaignData.budget).replace(/[^0-9.]/g, "")) || 0,
            codeVolume: campaignData.codeVolume,
            codeVolumeNumeric: parseFloat(String(campaignData.codeVolume).replace(/[^0-9.]/g, "")) || 0,
            startDate: campaignData.startDate,
            endDate: campaignData.endDate,
            status: "Live",
            completionRate: 20,
            zohoCrmDealId: dealId || undefined,
            zohoCrmDealUrl: dealUrl || undefined,
            zohoCrmDealStage: "Qualification",
            zohoProjectId: projectId || undefined,
            zohoProjectUrl: projectUrl || undefined,
            zohoBooksInvoiceId: invoiceId || undefined,
            zohoBooksInvoiceUrl: invoiceUrl || undefined,
            zohoSyncStatus: dealId && projectId && invoiceId ? "Synced" : dealId ? "Partial" : "Pending",
            lastZohoSync: dealId ? "Just now" : undefined,
            brief: campaignData.brief,
            aspectSummary: buildAspectSummary(resolvedTasks),
            tasks: resolvedTasks,
            createdAt: now,
            approvedAt: now,
            approvedBy: "Rohit Sharma (Admin)",
          };

      await auditWrite({
        action: "approve_and_push_zoho",
        targetType: "campaign",
        targetId: campaignId || targetRow?.id || null,
        payloadSummary: {
          name: campaignData.name,
          client: campaignData.client,
          dealId: dealId || null,
          projectId: projectId || null,
          invoiceId: invoiceId || null,
          writeStatus,
        },
      });

      return NextResponse.json({
        success: true,
        campaign: savedCampaign,
        zohoSync: {
          crmDeal: {
            product: "Zoho CRM",
            module: "Deals",
            dealId: dealId || null,
            dealUrl: dealUrl || null,
            stage: "Qualification",
            writeStatus,
          },
          projects: {
            product: "Zoho Projects",
            projectId: projectId || null,
            projectUrl: projectUrl || null,
            status: projectId ? "SYNCED" : dealId ? "INITIATED" : "PENDING",
            note: projectId
              ? `Project created: ${projectId}`
              : dealId
              ? "n8n workflow triggered, awaiting Zoho Projects confirmation"
              : "Awaiting Zoho CRM deal creation",
          },
          books: {
            product: "Zoho Books",
            invoiceId: invoiceId || null,
            invoiceUrl: invoiceUrl || null,
            status: invoiceId ? "SYNCED" : dealId ? "INITIATED" : "PENDING",
            note: invoiceId
              ? `Invoice created: ${invoiceId}`
              : dealId
              ? "n8n workflow triggered, awaiting Zoho Books confirmation"
              : "Awaiting Zoho CRM deal creation",
          },
          overallSyncStatus: dealId ? "SYNCED" : "PENDING",
          syncedAt: dealId ? now : null,
        },
      });
    }

    // ── Action 3: Update a task status ──
    if (action === "update_zoho_task") {
      const { campaignId, campaignName, taskId, newStatus } = body;

      let campaignRow: any = null;
      if (campaignId) {
        const { data } = await supabase.from("campaigns").select("id, status, tasks").eq("id", campaignId).maybeSingle();
        campaignRow = data;
      }
      if (!campaignRow && campaignName) {
        const { data } = await supabase.from("campaigns").select("id, status, tasks").eq("name", campaignName).maybeSingle();
        campaignRow = data;
      }

      if (!campaignRow) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      const tasks: AspectTask[] = campaignRow.tasks || [];
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

      task.status = newStatus;
      if (newStatus === "COMPLETED") task.zohoCrmTaskStatus = "Closed";
      else if (newStatus === "IN_PROGRESS") task.zohoCrmTaskStatus = "In Progress";

      const completed = tasks.filter((t) => t.status === "COMPLETED").length;
      const completionRate = Math.round((completed / tasks.length) * 100);
      const isDraft = campaignRow.status === "draft";
      const aspectSummary = buildAspectSummary(tasks);

      const updatePayload: Record<string, any> = {
        tasks,
        aspect_summary: aspectSummary,
      };
      if (!isDraft) {
        updatePayload.last_zoho_sync = new Date().toISOString();
      }

      await supabase
        .from("campaigns")
        .update(updatePayload)
        .eq("id", campaignRow.id);

      await auditWrite({
        action: "update_zoho_task",
        targetType: "campaign_task",
        targetId: taskId,
        payloadSummary: { campaignId: campaignRow.id, newStatus, isDraft },
      });

      // Approval gate: DRAFT tasks have no Zoho CRM record, skip webhook entirely.
      if (!isDraft && task.zohoCrmTaskId) {
        try {
          const N8N_ZOHO_TASK_UPDATE_WEBHOOK = process.env.N8N_ZOHO_TASK_UPDATE_WEBHOOK || "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-update";
          await fetch(N8N_ZOHO_TASK_UPDATE_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaignId: campaignRow.id,
              taskId,
              newStatus,
              zohoCrmTaskId: task.zohoCrmTaskId
            }),
            signal: AbortSignal.timeout(5000),
          });
        } catch (err) {
          console.warn("[update_zoho_task] Webhook failed:", err);
        }
      }

      return NextResponse.json({
        success: true,
        task,
        completionRate,
        zohoUpdate: isDraft
          ? {
              product: "Local Store",
              status: "SAVED_LOCAL_DRAFT",
              skipped: "draft_not_synced",
              note: "Task status saved locally. It syncs to Zoho once the campaign is approved.",
            }
          : {
              product: "Zoho CRM",
              module: "Tasks (sub-record of Deal)",
              zohoCrmTaskId: task.zohoCrmTaskId,
              newStatus: task.zohoCrmTaskStatus,
              timestamp: new Date().toISOString(),
            },
      });
    }

    // ── Action 4: Batch update tasks for approved campaign + re-fire Zoho sync if pending ──
    if (action === "update_campaign_tasks") {
      const { campaignId, campaignName, tasks } = body;
      const now = new Date().toISOString();

      // Pause gate: this action re-fires the Zoho sync webhook for live
      // campaigns. Local (draft) saves stay allowed; live Zoho writes don't.
      {
        const prefs = await currentUserPausedMap();
        if (isConnectorPaused(prefs, "zoho.crm")) {
          return NextResponse.json(
            { success: false, paused: true, error: PAUSED_ZOHO_MESSAGE, reason: "connector_paused" },
            { status: 403 }
          );
        }
      }

      let resolvedCampaignId = campaignId;
      let resolvedCampaignName = campaignName;
      let resolvedClient = "";
      let resolvedBudget = "";
      let resolvedCodeVolume = "";

      let resolvedStatus: string | null = null;
      if (campaignId) {
        const { data: row } = await supabase.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
        if (row) {
          resolvedCampaignName = row.name;
          resolvedClient = row.client || "";
          resolvedBudget = row.budget || "";
          resolvedCodeVolume = row.code_volume || "";
          resolvedStatus = row.status;
        }
        const updatePayload: Record<string, any> = {
          tasks,
          aspect_summary: buildAspectSummary(tasks),
        };
        if (resolvedStatus !== "draft") {
          updatePayload.last_zoho_sync = now;
        }
        await supabase.from("campaigns").update(updatePayload).eq("id", campaignId);
      } else if (campaignName) {
        const { data: row } = await supabase.from("campaigns").select("*").eq("name", campaignName).maybeSingle();
        if (row) {
          resolvedCampaignId = row.id;
          resolvedCampaignName = row.name;
          resolvedClient = row.client || "";
          resolvedBudget = row.budget || "";
          resolvedCodeVolume = row.code_volume || "";
          resolvedStatus = row.status;
        }
        const updatePayload: Record<string, any> = {
          tasks,
          aspect_summary: buildAspectSummary(tasks),
        };
        if (resolvedStatus !== "draft") {
          updatePayload.last_zoho_sync = now;
        }
        await supabase.from("campaigns").update(updatePayload).eq("name", campaignName);
      }

      // If campaign is pending Zoho sync, re-fire the n8n webhook with campaignId
      // Approval gate: DRAFT campaigns must never trigger Zoho provisioning.
      if (resolvedCampaignId && resolvedCampaignName && resolvedStatus !== "draft") {
        try {
          // Check if campaign still has no deal ID
          const { data: checkRow } = await supabase
            .from("campaigns")
            .select("zoho_crm_deal_id")
            .eq("id", resolvedCampaignId)
            .maybeSingle();

          if (!checkRow?.zoho_crm_deal_id) {
            const N8N_ZOHO_SYNC_WEBHOOK =
              process.env.N8N_ZOHO_SYNC_WEBHOOK ||
              "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-ingest-v2";
            try {
              const syncRes = await fetch(N8N_ZOHO_SYNC_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "approve_and_sync",
                  campaignId: resolvedCampaignId,
                  campaignName: resolvedCampaignName,
                  client: resolvedClient,
                  budget: resolvedBudget,
                  codeVolume: resolvedCodeVolume,
                  is_approved_by_manager: true,
                  tasks: tasks || [],
                }),
                signal: AbortSignal.timeout(15000),
              });
              if (syncRes.ok) {
                const syncData = (await syncRes.json().catch(() => ({}))) as Record<string, any>;
                const dealId = syncData?.id || syncData?.deal_id;
                if (dealId) {
                  await supabase
                    .from("campaigns")
                    .update({
                      zoho_crm_deal_id: String(dealId),
                      zoho_crm_deal_url: `https://crm.zoho.in/crm/org/tab/Potentials/${dealId}`,
                      zoho_crm_deal_stage: "Qualification",
                      zoho_books_invoice_id: syncData.invoice_id || null,
                      zoho_books_invoice_url: syncData.invoice_id ? `https://books.zoho.in/app#/invoices/${syncData.invoice_id}` : null,
                      zoho_project_id: syncData.project_id || null,
                      zoho_project_url: syncData.project_id ? `https://projects.zoho.in/portal/enlightlabdotcom#project/${syncData.project_id}` : null,
                      zoho_sync_status: "synced",
                      last_zoho_sync: new Date().toISOString(),
                    })
                    .eq("id", resolvedCampaignId);
                }
              }
            } catch (err) {
              console.warn("[update_campaign_tasks] Zoho re-sync failed:", err);
            }
          } else {
            // Already synced to Zoho, push updated tasks to Zoho Projects via n8n webhook
            const N8N_ZOHO_SYNC_WEBHOOK =
              process.env.N8N_ZOHO_SYNC_WEBHOOK ||
              "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-task-ingest-v2";
            try {
              await fetch(N8N_ZOHO_SYNC_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "update_campaign_tasks",
                  campaignId: resolvedCampaignId,
                  projectId: (checkRow as any)?.zoho_project_id || null,
                  campaignName: resolvedCampaignName,
                  tasks: tasks || [],
                }),
                signal: AbortSignal.timeout(10000),
              }).catch((e) => console.warn("[update_campaign_tasks] Push to Zoho webhook warning:", e));
            } catch (err) {
              console.warn("[update_campaign_tasks] Post-approval task push failed:", err);
            }
          }
        } catch (err) {
          console.warn("[update_campaign_tasks] Zoho re-sync check failed:", err);
        }
      }

      return NextResponse.json({ success: true, syncedAt: now });
    }


    // ── Action 5: Validate Zoho deal IDs exist and sync ──
    if (action === "validate_and_sync") {
      const syncResult = await reconcileZohoCRMWithSupabase();
      return NextResponse.json(syncResult);
    }

    // ── Action 6: Delete campaign across Zoho & Supabase ──
    if (action === "delete_campaign") {
      const { campaignId } = body;
      if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

      const { data: camp } = await supabase.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
      if (camp) {
        // Approval gate: a never-synced draft has no Zoho resources to wipe, // skip the delete webhook entirely so we never send null/empty payloads.
        if (camp.status === "draft" && !camp.zoho_crm_deal_id && !camp.zoho_project_id && !camp.zoho_books_invoice_id) {
          await supabase.from("campaigns").delete().eq("id", campaignId);
          return NextResponse.json({ success: true, deletedName: camp.name, note: "Draft deleted. There are no Zoho resources to clean up." });
        }

        const N8N_ZOHO_DELETE_WEBHOOK =
          process.env.N8N_ZOHO_DELETE_WEBHOOK ||
          "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-delete-zoho-resources";

        console.log(`[delete_campaign] Wiping Zoho resources for ${camp.name}: deal=${camp.zoho_crm_deal_id}, project=${camp.zoho_project_id}, invoice=${camp.zoho_books_invoice_id}`);
        await fetch(N8N_ZOHO_DELETE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId: camp.zoho_crm_deal_id,
            projectId: camp.zoho_project_id,
            invoiceId: camp.zoho_books_invoice_id,
            campaignName: camp.name,
          }),
          signal: AbortSignal.timeout(10000),
        }).catch((err) => console.error("Error in delete webhook:", err));

        await supabase.from("campaigns").delete().eq("id", campaignId);
        return NextResponse.json({ success: true, deletedName: camp.name });
      }

      return NextResponse.json({ success: true });
    }

    // ── Action 5: Update Live Campaign across Zoho CRM, Books, Projects & Supabase ──
    if (action === "update_live_campaign") {
      const { campaignId, dealId, projectId, invoiceId, newName, newBudget, newVolume, tasks, rewardType } = body;

      let campRow: any = null;
      if (campaignId) {
        const { data } = await supabase.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
        campRow = data;
      }
      if (!campRow && dealId) {
        const { data } = await supabase.from("campaigns").select("*").eq("zoho_crm_deal_id", dealId).maybeSingle();
        campRow = data;
      }
      if (!campRow && newName) {
        const { data } = await supabase.from("campaigns").select("*").ilike("name", `%${newName}%`).maybeSingle();
        campRow = data;
      }
      if (!campRow && body.client) {
        const { data } = await supabase.from("campaigns").select("*").ilike("client", `%${body.client}%`).maybeSingle();
        campRow = data;
      }
      if (!campRow && newName) {
        const firstToken = newName.split(" ")[0];
        if (firstToken && firstToken.length > 2) {
          const { data } = await supabase.from("campaigns").select("*").ilike("name", `%${firstToken}%`).maybeSingle();
          campRow = data;
        }
      }

      const resolvedDealId = dealId || campRow?.zoho_crm_deal_id;
      const resolvedProjectId = projectId || campRow?.zoho_project_id;
      const resolvedInvoiceId = invoiceId || campRow?.zoho_books_invoice_id;
      const resolvedName = newName || campRow?.name;
      const resolvedBudget = newBudget || campRow?.budget;
      const numericAmount = parseFloat(String(resolvedBudget || "0").replace(/[^0-9.]/g, "")) || 0;
      const resolvedTasks = Array.isArray(tasks) && tasks.length > 0 ? tasks : (campRow?.tasks || []);
      const resolvedRewardType = rewardType || campRow?.reward_type || "Cashback";

      // Pause gate: the live-campaign path fires the Zoho update webhook.
      // Drafts still persist to Supabase below; live Zoho writes refuse.
      {
        const prefs = await currentUserPausedMap();
        if (isConnectorPaused(prefs, "zoho.crm")) {
          return NextResponse.json(
            { success: false, paused: true, error: PAUSED_ZOHO_MESSAGE, reason: "connector_paused" },
            { status: 403 }
          );
        }
      }

      // Approval gate: drafts (no Zoho deal) must only persist to Supabase, // never fire the Zoho update webhook. Zoho writes require prior approval.
      const isDraftCampaign =
        (campRow?.status === "draft") ||
        (!resolvedDealId && !resolvedProjectId && !resolvedInvoiceId);
      if (isDraftCampaign) {
        const targetDraftId = campRow?.id || campaignId;
        if (targetDraftId) {
          const updates: Record<string, any> = {};
          if (resolvedName) updates.name = resolvedName;
          if (resolvedBudget) updates.budget = resolvedBudget;
          if (newVolume) updates.code_volume = newVolume;
          if (resolvedRewardType) updates.reward_type = resolvedRewardType;
          if (resolvedTasks && resolvedTasks.length > 0) {
            updates.tasks = resolvedTasks;
            updates.aspect_summary = buildAspectSummary(resolvedTasks);
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from("campaigns").update(updates).eq("id", targetDraftId);
          }
        }
        return NextResponse.json({
          success: true,
          campaignName: resolvedName,
          budget: resolvedBudget,
          tasksCount: resolvedTasks.length,
          skipped: "draft_not_synced",
          note: "Draft campaign updated in the local store only. Approve the plan to sync the changes to Zoho.",
        });
      }

      const taskSummary = resolvedTasks
        .map((t: any, i: number) => `${i + 1}. [${(t.aspect || "").toUpperCase()}] ${t.title || t.name}, Owner: ${t.assignee || "TBD"}, TAT: ${t.tat || "2 Days"}, Urgency: ${t.urgency || "HIGH"}`)
        .join("\n");

      const N8N_ZOHO_UPDATE_WEBHOOK =
        process.env.N8N_ZOHO_UPDATE_WEBHOOK ||
        "https://indigo-pelican-266513.hostingersite.com/webhook/bcp-update-resources";

      const updateRes = await fetch(N8N_ZOHO_UPDATE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: resolvedDealId,
          projectId: resolvedProjectId,
          invoiceId: resolvedInvoiceId,
          customerId: campRow?.books_customer_id,
          client: campRow?.client,
          campaignName: resolvedName,
          amount: numericAmount,
          budget: resolvedBudget,
          rewardType: resolvedRewardType,
          tasks: resolvedTasks,
          taskSummary,
        }),
        signal: AbortSignal.timeout(12000),
      }).catch((err) => {
        console.warn("[update_live_campaign] Webhook call failed:", err);
        return null;
      });

      const updateData = updateRes && updateRes.ok ? await updateRes.json().catch(() => ({})) : null;

      const targetCampaignId = campRow?.id || campaignId;
      if (targetCampaignId) {
        const updates: Record<string, any> = {
          last_zoho_sync: new Date().toISOString(),
        };
        if (resolvedName) updates.name = resolvedName;
        if (resolvedBudget) updates.budget = resolvedBudget;
        if (newVolume) updates.code_volume = newVolume;
        if (resolvedRewardType) updates.reward_type = resolvedRewardType;
        if (resolvedTasks && resolvedTasks.length > 0) {
          updates.tasks = resolvedTasks;
          const legal = resolvedTasks.filter((t: any) => (t.aspect || "").toLowerCase() === "legal");
          const compliance = resolvedTasks.filter((t: any) => (t.aspect || "").toLowerCase() === "compliance");
          const accounting = resolvedTasks.filter((t: any) => (t.aspect || "").toLowerCase() === "accounting");
          const implementation = resolvedTasks.filter((t: any) => (t.aspect || "").toLowerCase() === "implementation");
          updates.aspect_summary = {
            legal: { total: legal.length, done: legal.filter((t: any) => t.status === "COMPLETED").length, status: legal.some((t: any) => t.status !== "COMPLETED") ? "In Review" : "Approved" },
            compliance: { total: compliance.length, done: compliance.filter((t: any) => t.status === "COMPLETED").length, status: compliance.some((t: any) => t.status !== "COMPLETED") ? "In Review" : "Approved" },
            accounting: { total: accounting.length, done: accounting.filter((t: any) => t.status === "COMPLETED").length, status: accounting.some((t: any) => t.status !== "COMPLETED") ? "In Review" : "Approved" },
            implementation: { total: implementation.length, done: implementation.filter((t: any) => t.status === "COMPLETED").length, status: implementation.some((t: any) => t.status !== "COMPLETED") ? "In Review" : "Approved" },
          };
        }

        await supabase.from("campaigns").update(updates).eq("id", targetCampaignId);
      }

      return NextResponse.json({
        success: true,
        campaignName: resolvedName,
        budget: resolvedBudget,
        amount: numericAmount,
        rewardType: resolvedRewardType,
        tasksCount: resolvedTasks.length,
        dealId: resolvedDealId,
        projectId: resolvedProjectId,
        invoiceId: resolvedInvoiceId,
        zohoResponse: updateData,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Campaign API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
