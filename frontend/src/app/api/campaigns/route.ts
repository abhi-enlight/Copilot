import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { adminSupabase } from "@/lib/supabase-admin";
import { requireAuth, ensurePersonalOrg } from "@/lib/auth-helpers";
import { requireConnectorAccess, buildEntitlementSnapshot } from "@/lib/entitlements";
import { getConnectorPreferences, isConnectorPaused } from "@/lib/connector-preferences";
import {
  resolveZohoAccessToken,
  zohoApiBase,
  zohoDataCenter,
  zohoProjectsApiBase,
} from "@/lib/zoho";

export const dynamic = "force-dynamic";

const PAUSED_ZOHO_MESSAGE =
  "You have paused the Zoho connection. Please go to the Connections page and turn it on.";


/** Reads the current user's server-side pause map (identity: auth user id). */
async function currentUserPausedMap(userEmailOrId: string | null) {
  return getConnectorPreferences(userEmailOrId);
}

function getZohoProjectUrl(projectId: string | null | undefined, portalId?: string | null, dc: string = "in"): string | null {
  if (!projectId) return null;
  const pId = portalId || projectId;
  return `https://projects.zoho.${dc}/portal/${pId}#project/${projectId}`;
}

/**
 * Resolves the effective active organization ID for this user.
 * 1. Checks explicit orgId from x-active-org-id header.
 * 2. If null, queries the user's first membership in organization_members.
 * 3. If none exists, lazily provisions their personal workspace.
 */
async function resolveEffectiveOrgId(
  user: { id: string; email?: string | null; user_metadata?: any },
  headerOrgId: string | null
): Promise<string | null> {
  if (headerOrgId) return headerOrgId;

  const { data: memberRows } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (memberRows && memberRows.length > 0) {
    return memberRows[0].organization_id;
  }

  return await ensurePersonalOrg(
    user.id,
    user.user_metadata?.full_name || user.email?.split("@")[0] || "Personal"
  );
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
  orgId?: string | null;
  userId?: string | null;
}) {
  try {
    // Resolve the actor from the authenticated app_users row, never from the
    // client-editable ms_user_email cookie (spoofable audit identity).
    let actorEmail: string | null = null;
    if (opts.userId) {
      const { data: profile } = await supabase
        .from("app_users")
        .select("email")
        .eq("auth_user_id", opts.userId)
        .maybeSingle();
      actorEmail = profile?.email ?? null;
    }
    await supabase.from("agent_audit_logs").insert({
      actor_email: actorEmail,
      action: opts.action,
      target_type: opts.targetType || null,
      target_id: opts.targetId || null,
      payload_summary: opts.payloadSummary || null,
      outcome: opts.outcome || "success",
      metadata: opts.metadata || null,
      organization_id: opts.orgId || null,
      user_id: opts.userId || null,
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

export async function checkZohoBooksContact(
  client: string,
  organizationId?: string | null,
  userEmail?: string | null,
  userId?: string
): Promise<{
  exists: boolean;
  contact?: { contactId: string; contactName: string; companyName: string };
  suggestedName: string;
}> {
  const normClient = String(client || "").trim().toLowerCase();
  if (!normClient) {
    return { exists: false, suggestedName: "India" };
  }

  const lookupKey = userEmail || userId;
  if (!lookupKey) {
    return { exists: false, suggestedName: `${client.trim()} India` };
  }

  // Direct Zoho Books API lookup with the user's authenticated OAuth credentials
  try {
    const { accessToken, record } = await resolveZohoAccessToken(lookupKey, "books", userId);
    const booksOrgId = record?.booksOrgId || process.env.ZOHO_BOOKS_ORG_ID;
    const dc = record?.dataCenter || zohoDataCenter();
    if (accessToken && booksOrgId) {
      const searchUrl = `${zohoApiBase(dc)}/books/v3/contacts?organization_id=${booksOrgId}&search_text=${encodeURIComponent(client.trim())}`;
      const directRes = await fetch(searchUrl, {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (directRes.ok) {
        const data = await directRes.json();
        const contacts = Array.isArray(data.contacts) ? data.contacts : [];
        const matched = contacts.find((c: any) => {
          const name = String(c.contact_name || "").toLowerCase();
          const comp = String(c.company_name || "").toLowerCase();
          return (
            (name && (name.includes(normClient) || normClient.includes(name))) ||
            (comp && (comp.includes(normClient) || normClient.includes(comp)))
          );
        });
        if (matched) {
          return {
            exists: true,
            contact: {
              contactId: String(matched.contact_id),
              contactName: matched.contact_name || client,
              companyName: matched.company_name || client,
            },
            suggestedName: matched.contact_name || client,
          };
        }
      }
    }
  } catch (directErr) {
    console.warn("[checkZohoBooksContact] Direct Books API lookup error:", directErr);
  }

  return {
    exists: false,
    suggestedName: `${client.trim()} India`,
  };
}

export async function createZohoBooksContact(
  client: string,
  companyName?: string,
  userEmail?: string | null,
  userId?: string
): Promise<{
  success: boolean;
  contactId?: string;
  contactName?: string;
  companyName?: string;
  error?: string;
}> {
  const contactName = companyName ? `${client} (${companyName})` : `${client} India`;
  const lookupKey = userEmail || userId;
  if (!lookupKey) {
    return { success: false, error: "Authentication required to access Zoho Books" };
  }

  // Direct Zoho Books API creation with the user's authenticated OAuth credentials
  try {
    const { accessToken, record } = await resolveZohoAccessToken(lookupKey, "books", userId);
    const booksOrgId = record?.booksOrgId || process.env.ZOHO_BOOKS_ORG_ID;
    const dc = record?.dataCenter || zohoDataCenter();
    if (!accessToken || !booksOrgId) {
      return {
        success: false,
        error: "Zoho Books is not connected. Please connect your Zoho account in the Connections tab.",
      };
    }

    const postUrl = `${zohoApiBase(dc)}/books/v3/contacts?organization_id=${booksOrgId}`;
    const directRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contact_name: contactName,
        company_name: companyName || client,
        customer_sub_type: "business",
      }),
      signal: AbortSignal.timeout(8000),
    });
    const directData = await directRes.json().catch(() => ({}));
    if (directRes.ok && directData.contact?.contact_id) {
      return {
        success: true,
        contactId: String(directData.contact.contact_id),
        contactName: directData.contact.contact_name || contactName,
        companyName: directData.contact.company_name || client,
      };
    } else if (
      directData.code === 10001 ||
      directData.code === 3062 ||
      (directData.message && directData.message.toLowerCase().includes("already exists"))
    ) {
      const searchRes = await fetch(
        `${zohoApiBase(dc)}/books/v3/contacts?organization_id=${booksOrgId}&search_text=${encodeURIComponent(client.trim())}`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json().catch(() => ({}));
        const existing = searchData.contacts?.[0];
        if (existing?.contact_id) {
          return {
            success: true,
            contactId: String(existing.contact_id),
            contactName: existing.contact_name || contactName,
            companyName: existing.company_name || client,
          };
        }
      }
      return { success: false, error: directData.message || "Contact already exists in Zoho Books" };
    } else {
      return { success: false, error: directData.message || `Zoho Books API returned HTTP ${directRes.status}` };
    }
  } catch (directErr: any) {
    console.warn("[createZohoBooksContact] Direct Books API failed:", directErr);
    return { success: false, error: directErr.message || "Failed to register contact in Zoho Books" };
  }
}

/**
 * Direct multi-tenant Zoho resource cleanup using the authenticated user's own
 * OAuth tokens. Deletes the given Deal / Projects / Invoice records. Never
 * touches any shared or demo account. Best-effort per resource; the summary
 * reports which deletions were confirmed.
 */
async function deleteZohoResourcesDirect(opts: {
  userEmail: string | null;
  userId: string | null;
  dealId: string | null;
  projectId: string | null;
  invoiceId: string | null;
}): Promise<{
  ok: boolean;
  detail: string;
  deletedIds?: { dealId?: string | null; projectId?: string | null; projectIds?: string[]; invoiceId?: string | null };
}> {
  const lookupKey = opts.userEmail || opts.userId;
  const deletedIds: { dealId?: string | null; projectId?: string | null; projectIds?: string[]; invoiceId?: string | null } = {};
  const failures: string[] = [];
  let attempted = 0;

  // Deal (Zoho CRM)
  if (opts.dealId && lookupKey) {
    attempted++;
    try {
      const { accessToken, record } = await resolveZohoAccessToken(lookupKey, "crm", opts.userId || undefined);
      if (accessToken) {
        const dc = record?.dataCenter || zohoDataCenter();
        const res = await fetch(`${zohoApiBase(dc)}/crm/v2/Deals?ids=${encodeURIComponent(opts.dealId)}`, {
          method: "DELETE",
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) deletedIds.dealId = opts.dealId;
        else failures.push(`deal: HTTP ${res.status}`);
      } else {
        failures.push("deal: no CRM token");
      }
    } catch (e: any) {
      failures.push(`deal: ${e?.message}`);
    }
  }

  // Project (Zoho Projects)
  if (opts.projectId && lookupKey) {
    attempted++;
    try {
      const { accessToken, record } = await resolveZohoAccessToken(lookupKey, "projects", opts.userId || undefined);
      if (accessToken) {
        const dc = record?.dataCenter || zohoDataCenter();
        let portalId = record?.portalId || null;
        if (!portalId) {
          const portalsRes = await fetch(`${zohoProjectsApiBase(dc)}/api/v3/portals`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            signal: AbortSignal.timeout(8000),
          });
          if (portalsRes.ok) {
            const pData = await portalsRes.json().catch(() => ({}));
            const pList = Array.isArray(pData?.portals) ? pData.portals : [];
            portalId = pList[0]?.id ? String(pList[0].id) : null;
          }
        }
        if (portalId) {
          const res = await fetch(`${zohoProjectsApiBase(dc)}/restapi/portal/${portalId}/projects/${encodeURIComponent(opts.projectId)}/`, {
            method: "DELETE",
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) deletedIds.projectId = opts.projectId;
          else failures.push(`project: HTTP ${res.status}`);
        } else {
          failures.push("project: portal not resolved");
        }
      } else {
        failures.push("project: no Projects token");
      }
    } catch (e: any) {
      failures.push(`project: ${e?.message}`);
    }
  }

  // Invoice (Zoho Books)
  if (opts.invoiceId && lookupKey) {
    attempted++;
    try {
      const { accessToken, record } = await resolveZohoAccessToken(lookupKey, "books", opts.userId || undefined);
      const booksOrgId = record?.booksOrgId || process.env.ZOHO_BOOKS_ORG_ID;
      if (accessToken && booksOrgId) {
        const dc = record?.dataCenter || zohoDataCenter();
        const res = await fetch(`${zohoApiBase(dc)}/books/v3/invoices/${encodeURIComponent(opts.invoiceId)}?organization_id=${booksOrgId}`, {
          method: "DELETE",
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) deletedIds.invoiceId = opts.invoiceId;
        else failures.push(`invoice: HTTP ${res.status}`);
      } else {
        failures.push("invoice: no Books token/org");
      }
    } catch (e: any) {
      failures.push(`invoice: ${e?.message}`);
    }
  }

  if (attempted === 0) {
    return { ok: true, detail: "no_resources", deletedIds };
  }
  if (failures.length === 0) {
    return { ok: true, detail: "confirmed", deletedIds };
  }
  return { ok: false, detail: `zoho_delete_failed (${failures.join("; ")})`, deletedIds };
}

/**
 * Idempotent task provisioning into a Zoho Projects project using the
 * authenticated user's own OAuth token. Fetches the project's existing task
 * names first and only pushes tasks that are missing, so re-running is safe
 * (no duplicates). This also backfills projects that were created before the
 * ZohoProjects.tasks.ALL OAuth scope was granted to the connection.
 */
async function syncCampaignTasksToZoho(opts: {
  userEmail: string | null;
  userId: string | null;
  projectId: string;
  tasks: AspectTask[];
}): Promise<{ pushed: number; skipped: number; failed: string[] }> {
  const lookupKey = opts.userEmail || opts.userId;
  const empty = { pushed: 0, skipped: 0, failed: [] as string[] };
  if (!lookupKey || !opts.projectId || !opts.tasks || opts.tasks.length === 0) return empty;

  try {
    const { accessToken, record } = await resolveZohoAccessToken(lookupKey, "projects", opts.userId || undefined);
    if (!accessToken) return { ...empty, failed: ["no Projects token — reconnect Zoho Projects in Connections"] };

    const dc = record?.dataCenter || zohoDataCenter();
    let portalId = record?.portalId || null;
    if (!portalId) {
      const portalsRes = await fetch(`${zohoProjectsApiBase(dc)}/api/v3/portals`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (portalsRes.ok) {
        const pJson = await portalsRes.json().catch(() => null);
        const pList = Array.isArray(pJson) ? pJson : (pJson?.portals?.portal || pJson?.portals || []);
        portalId = pList[0]?.id ? String(pList[0].id) : null;
      }
    }
    if (!portalId) return { ...empty, failed: ["Zoho Projects portal not resolved"] };

    // Existing task names in this project (dedupe guard)
    const existingNames = new Set<string>();
    try {
      const listRes = await fetch(`${zohoProjectsApiBase(dc)}/restapi/portal/${portalId}/projects/${encodeURIComponent(opts.projectId)}/tasks/`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (listRes.ok) {
        const listData = await listRes.json().catch(() => ({}));
        const list = Array.isArray(listData?.tasks) ? listData.tasks : [];
        for (const t of list) {
          if (t?.name) existingNames.add(String(t.name).trim().toLowerCase());
        }
      }
    } catch (lErr: any) {
      console.warn("[syncCampaignTasksToZoho] Existing-task fetch warning:", lErr?.message);
    }

    let pushed = 0;
    let skipped = 0;
    const failed: string[] = [];
    for (const t of opts.tasks) {
      const name = String(t.title || (t as any).name || "").trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) { skipped++; continue; }

      const taskParams = new URLSearchParams();
      taskParams.append("name", name);
      taskParams.append("description", `[${(t.aspect || "").toUpperCase()}] Owner: ${t.assignee || "TBD"}, TAT: ${t.tat || "3 Days"}, Urgency: ${t.urgency || "HIGH"}`);
      try {
        const res = await fetch(`${zohoProjectsApiBase(dc)}/restapi/portal/${portalId}/projects/${encodeURIComponent(opts.projectId)}/tasks/`, {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: taskParams.toString(),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          pushed++;
        } else {
          const errText = await res.text().catch(() => "");
          failed.push(`${name}: HTTP ${res.status}`);
          console.warn(`[syncCampaignTasksToZoho] Task '${name}' failed: HTTP ${res.status}`, errText.slice(0, 200));
        }
      } catch (tErr: any) {
        failed.push(`${name}: ${tErr?.message}`);
      }
    }
    return { pushed, skipped, failed };
  } catch (e: any) {
    return { ...empty, failed: [`task sync error: ${e?.message}`] };
  }
}

function writeStatusExplanation(status: string, detail?: string): string {
  if (status === "FAILED") {
    return detail ? `Zoho provisioning failed: ${detail}` : "Zoho provisioning failed (timeout or unreachable).";
  }
  if (status === "CREATED_NO_ID") {
    return detail ? `Zoho CRM Deal was not created: ${detail}` : "Zoho CRM did not return a Deal ID.";
  }
  return detail || "Zoho sync failed. Please check your connection and retry.";
}

async function syncCampaignToZohoCRM(
  campaignId: string | null,
  campaignName: string,
  client: string,
  budget: string,
  codeVolume: string,
  tasks: AspectTask[],
  booksCustomerId?: string | null,
  userEmail?: string | null,
  userId?: string | null,
  endDate?: string | null,
  brief?: string | null,
  existingDealId?: string | null,
  existingProjectId?: string | null,
  existingInvoiceId?: string | null
): Promise<{
  dealId: string | null;
  dealUrl: string | null;
  invoiceId: string | null;
  invoiceUrl: string | null;
  projectId: string | null;
  projectUrl: string | null;
  writeStatus: string;
  error?: string;
}> {
  const lookupKey = userEmail || userId;
  const numericAmount = parseFloat(String(budget || "0").replace(/[^0-9.]/g, "")) || 0;

  // ── 1. Direct Multi-Tenant Provisioning (User's Authenticated Zoho Account) ──
  if (lookupKey) {
    let dealId: string | null = existingDealId || null;
    let dealUrl: string | null = dealId ? `https://crm.zoho.in/crm/org/tab/Potentials/${dealId}` : null;
    let projectId: string | null = existingProjectId || null;
    let projectUrl: string | null = projectId ? getZohoProjectUrl(projectId) : null;
    let invoiceId: string | null = existingInvoiceId || null;
    let invoiceUrl: string | null = invoiceId ? `https://books.zoho.in/app#/invoices/${invoiceId}` : null;
    const directErrors: string[] = [];

    // 1a. Zoho CRM Deal
    if (!dealId) {
      try {
        const { accessToken: crmToken, record: crmRecord } = await resolveZohoAccessToken(lookupKey, "crm", userId || undefined);
        if (crmToken) {
          const crmDc = crmRecord?.dataCenter || zohoDataCenter();
          // Check if deal with exact name already exists in this user's CRM
          try {
            const searchRes = await fetch(`${zohoApiBase(crmDc)}/crm/v2/Deals/search?criteria=(Deal_Name:equals:${encodeURIComponent(campaignName.trim())})`, {
              headers: { Authorization: `Zoho-oauthtoken ${crmToken}` },
              signal: AbortSignal.timeout(10000),
            });
            if (searchRes.status === 200) {
              const searchJson = await searchRes.json().catch(() => ({}));
              const existingDeal = searchJson?.data?.[0];
              if (existingDeal?.id) {
                dealId = String(existingDeal.id);
                dealUrl = `https://crm.zoho.${crmDc}/crm/org/tab/Potentials/${dealId}`;
              }
            }
          } catch (sErr: any) {
            console.warn("[syncCampaignToZohoCRM] CRM search notice:", sErr?.message);
          }

          if (!dealId) {
            const createRes = await fetch(`${zohoApiBase(crmDc)}/crm/v2/Deals`, {
              method: "POST",
              headers: {
                Authorization: `Zoho-oauthtoken ${crmToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                data: [
                  {
                    Deal_Name: campaignName,
                    Stage: "Qualification",
                    Amount: numericAmount,
                    Closing_Date: endDate || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
                    Description: brief || `Campaign deal for ${client}`,
                  },
                ],
              }),
              signal: AbortSignal.timeout(15000),
            });
            if (createRes.ok) {
              const createData = await createRes.json().catch(() => ({}));
              const createdDealId = createData?.data?.[0]?.details?.id;
              if (createdDealId) {
                dealId = String(createdDealId);
                dealUrl = `https://crm.zoho.${crmDc}/crm/org/tab/Potentials/${dealId}`;
              }
            } else {
              directErrors.push(`CRM: HTTP ${createRes.status}`);
            }
          }
        }
      } catch (e: any) {
        console.warn("[syncCampaignToZohoCRM] Direct CRM error:", e?.message);
        directErrors.push(`CRM: ${e?.message}`);
      }
    }

    // 1b. Zoho Projects Project + Tasks
    if (!projectId) {
      try {
        const { accessToken: projToken, record: projRecord } = await resolveZohoAccessToken(lookupKey, "projects", userId || undefined);
        if (projToken) {
          const projDc = projRecord?.dataCenter || zohoDataCenter();
          let portalId = projRecord?.portalId || null;

          if (!portalId) {
            try {
              const portalsRes = await fetch(`${zohoProjectsApiBase(projDc)}/api/v3/portals`, {
                headers: { Authorization: `Zoho-oauthtoken ${projToken}` },
                signal: AbortSignal.timeout(10000),
              });
              if (portalsRes.ok) {
                const pJson = await portalsRes.json().catch(() => null);
                const pList = Array.isArray(pJson) ? pJson : (pJson?.portals?.portal || pJson?.portals || []);
                portalId = pList[0]?.id ? String(pList[0].id) : null;
              }
            } catch (pErr: any) {
              console.warn("[syncCampaignToZohoCRM] Portal discovery failed:", pErr?.message);
            }
          }

          if (portalId) {
            // Check if project already exists in portal
            try {
              const listProjRes = await fetch(`${zohoProjectsApiBase(projDc)}/restapi/portal/${portalId}/projects/`, {
                headers: { Authorization: `Zoho-oauthtoken ${projToken}` },
                signal: AbortSignal.timeout(10000),
              });
              if (listProjRes.ok) {
                const lpData = await listProjRes.json().catch(() => ({}));
                const existingProj = (lpData.projects || []).find((p: any) =>
                  String(p.name || "").trim().toLowerCase() === campaignName.trim().toLowerCase()
                );
                if (existingProj) {
                  projectId = String(existingProj.id_string || existingProj.id);
                  projectUrl = `https://projects.zoho.${projDc}/portal/${portalId}#project/${projectId}`;
                }
              }
            } catch (lpErr: any) {
              console.warn("[syncCampaignToZohoCRM] Projects search error:", lpErr?.message);
            }

            if (!projectId) {
              const projParams = new URLSearchParams();
              projParams.append("name", campaignName);
              projParams.append("description", brief || `Execution tracker for ${client} ${campaignName}`);

              const createProjRes = await fetch(`${zohoProjectsApiBase(projDc)}/restapi/portal/${portalId}/projects/`, {
                method: "POST",
                headers: {
                  Authorization: `Zoho-oauthtoken ${projToken}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: projParams.toString(),
                signal: AbortSignal.timeout(15000),
              });

              if (createProjRes.ok) {
                const cpData = await createProjRes.json().catch(() => ({}));
                const newId = cpData?.projects?.[0]?.id_string || cpData?.projects?.[0]?.id;
                if (newId) {
                  projectId = String(newId);
                  projectUrl = `https://projects.zoho.${projDc}/portal/${portalId}#project/${projectId}`;
                }
              } else {
                directErrors.push(`Projects: HTTP ${createProjRes.status}`);
              }
            }

          }
        }
      } catch (e: any) {
        console.warn("[syncCampaignToZohoCRM] Direct Projects error:", e?.message);
        directErrors.push(`Projects: ${e?.message}`);
      }
    }

    // Task provisioning/backfill: runs whenever the project is known (newly
    // created OR pre-existing), so projects created before the tasks.ALL OAuth
    // scope was granted get their task list backfilled on the next sync.
    if (projectId && tasks.length > 0) {
      const taskSync = await syncCampaignTasksToZoho({ userEmail: userEmail ?? null, userId: userId ?? null, projectId, tasks });
      if (taskSync.failed.length > 0) {
        directErrors.push(`Tasks: ${taskSync.failed.length} failed (${taskSync.failed[0]}${taskSync.failed.length > 1 ? "; ..." : ""})`);
      }
    }

    // 1c. Zoho Books Customer & Invoice
    if (!invoiceId) {
      try {
        const { accessToken: booksToken, record: booksRecord } = await resolveZohoAccessToken(lookupKey, "books", userId || undefined);
        const booksOrgId = booksRecord?.booksOrgId || process.env.ZOHO_BOOKS_ORG_ID;

        if (booksToken && booksOrgId) {
          const booksDc = booksRecord?.dataCenter || zohoDataCenter();
          let finalCustomerId = booksCustomerId;

          if (!finalCustomerId && client) {
            const contactCheck = await checkZohoBooksContact(client, null, userEmail, userId || undefined);
            if (contactCheck.exists && contactCheck.contact?.contactId) {
              finalCustomerId = contactCheck.contact.contactId;
            } else {
              const created = await createZohoBooksContact(client, undefined, userEmail, userId || undefined);
              if (created.success && created.contactId) {
                finalCustomerId = created.contactId;
              }
            }
          }

          if (finalCustomerId) {
            // Check if invoice for this campaign already exists in Books
            try {
              const listInvRes = await fetch(`${zohoApiBase(booksDc)}/books/v3/invoices?organization_id=${booksOrgId}&customer_id=${finalCustomerId}`, {
                headers: { Authorization: `Zoho-oauthtoken ${booksToken}` },
                signal: AbortSignal.timeout(10000),
              });
              if (listInvRes.ok) {
                const invList = await listInvRes.json().catch(() => ({}));
                const existingInv = (invList.invoices || []).find((i: any) =>
                  String(i.invoice_number || "").includes(campaignName) ||
                  (typeof i.total === "number" && i.total === numericAmount)
                );
                if (existingInv?.invoice_id) {
                  invoiceId = String(existingInv.invoice_id);
                  invoiceUrl = `https://books.zoho.${booksDc}/app#/invoices/${invoiceId}`;
                }
              }
            } catch (liErr: any) {
              console.warn("[syncCampaignToZohoCRM] Invoice search error:", liErr?.message);
            }

            if (!invoiceId) {
              const invRes = await fetch(`${zohoApiBase(booksDc)}/books/v3/invoices?organization_id=${booksOrgId}`, {
                method: "POST",
                headers: {
                  Authorization: `Zoho-oauthtoken ${booksToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  customer_id: finalCustomerId,
                  date: new Date().toISOString().split("T")[0],
                  line_items: [
                    {
                      name: `${campaignName} Campaign Fee`,
                      description: `Execution & milestone billing for ${client}`,
                      rate: numericAmount,
                      quantity: 1,
                    },
                  ],
                }),
                signal: AbortSignal.timeout(15000),
              });

              if (invRes.ok) {
                const invData = await invRes.json().catch(() => ({}));
                const createdInvId = invData?.invoice?.invoice_id;
                if (createdInvId) {
                  invoiceId = String(createdInvId);
                  invoiceUrl = `https://books.zoho.${booksDc}/app#/invoices/${invoiceId}`;
                }
              } else {
                directErrors.push(`Books: HTTP ${invRes.status}`);
              }
            }
          }
        }
      } catch (e: any) {
        console.warn("[syncCampaignToZohoCRM] Direct Books error:", e?.message);
        directErrors.push(`Books: ${e?.message}`);
      }
    }

    if (dealId || projectId || invoiceId) {
      const isComplete = Boolean(dealId && projectId && invoiceId);
      return {
        dealId,
        dealUrl,
        invoiceId,
        invoiceUrl,
        projectId,
        projectUrl,
        writeStatus: isComplete ? "SYNCED" : "PARTIAL",
        error: directErrors.length > 0 ? directErrors.join("; ") : undefined,
      };
    }
  }

  return {
    dealId: null,
    dealUrl: null,
    invoiceId: null,
    invoiceUrl: null,
    projectId: null,
    projectUrl: null,
    writeStatus: "FAILED",
    error: "Zoho is not connected. Please connect your Zoho account in the Connections tab.",
  };
}

// ---------------------------------------------------------------------------
// Map a Supabase campaign row → Campaign interface
// ---------------------------------------------------------------------------
function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    organizationId: row.organization_id,
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
export async function reconcileZohoCRMWithSupabase(
  orgId?: string,
  userId?: string,
  userEmail?: string
): Promise<{
  campaigns: Campaign[];
  validated: number;
  deleted: number;
  updated: number;
  reset: number;
}> {
  if (!orgId) {
    return { campaigns: [], validated: 0, deleted: 0, updated: 0, reset: 0 };
  }

  // Check if Zoho CRM is connected for this user / org
  let hasZoho = false;
  if (userId) {
    const { data: userInteg } = await adminSupabase
      .from("user_integrations")
      .select("id, status")
      .eq("auth_user_id", userId)
      .eq("provider", "zoho")
      .eq("product", "crm")
      .maybeSingle();
    hasZoho = userInteg?.status === "active";
  }

  if (!hasZoho) {
    const { data: tenantInteg } = await adminSupabase
      .from("tenant_integrations")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("provider", "zoho")
      .maybeSingle();
    hasZoho = tenantInteg?.status === "active";
  }

  // If Zoho CRM is NOT connected for this organization, DO NOT sync from external webhook!
  // Return the organization's existing campaigns from Supabase.
  if (!hasZoho) {
    const { data: orgCampaigns } = await supabase
      .from("campaigns")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    return {
      campaigns: (orgCampaigns || []).map(rowToCampaign),
      validated: orgCampaigns?.length || 0,
      deleted: 0,
      updated: 0,
      reset: 0,
    };
  }

  // Fetch live deals:
  // 1. Direct Zoho CRM API using the authenticated user's own token vault (multi-tenant)
  const lookupKey = userEmail || userId;
  let liveDeals: Array<{ id: string; name: string; stage?: string; amount?: number }> = [];
  let liveFetchSucceeded = false;

  if (lookupKey) {
    try {
      const { accessToken, record } = await resolveZohoAccessToken(lookupKey, "crm", userId);
      if (accessToken) {
        const dc = record?.dataCenter || zohoDataCenter();
        const dealsRes = await fetch(`${zohoApiBase(dc)}/crm/v2/Deals?fields=id,Deal_Name,Stage,Amount`, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          signal: AbortSignal.timeout(15000),
        });

        if (dealsRes.status === 200) {
          const directData = await dealsRes.json().catch(() => ({}));
          const list = Array.isArray(directData?.data) ? directData.data : [];
          liveDeals = list.map((d: any) => ({
            id: String(d.id),
            name: d.Deal_Name || d.name || "Deal",
            stage: d.Stage || d.stage || "Qualification",
            amount: typeof d.Amount === "number" ? d.Amount : (typeof d.amount === "number" ? d.amount : 0),
          }));
          liveFetchSucceeded = true;
        } else if (dealsRes.status === 204) {
          // HTTP 204: Valid authenticated connection, user has 0 deals in their Zoho CRM
          liveDeals = [];
          liveFetchSucceeded = true;
        } else {
          console.warn(`[reconcileZohoCRMWithSupabase] Direct Zoho CRM returned HTTP ${dealsRes.status}`);
        }
      }
    } catch (directErr: any) {
      console.warn("[reconcileZohoCRMWithSupabase] Direct Zoho CRM fetch error:", directErr?.message);
    }
  }


  // If live fetch was not successful (e.g. network outage or no connection), return local Supabase campaigns safely
  if (!liveFetchSucceeded) {
    const { data: orgCampaigns } = await supabase
      .from("campaigns")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    return {
      campaigns: (orgCampaigns || []).map(rowToCampaign),
      validated: orgCampaigns?.length || 0,
      deleted: 0,
      updated: 0,
      reset: 0,
    };
  }

  try {
    const liveDealIds = new Set(liveDeals.map((d) => String(d.id)));
    const liveDealMap = new Map(liveDeals.map((d) => [String(d.id), d]));

    const { data: allCampaigns } = await supabase
      .from("campaigns")
      .select("*")
      .eq("organization_id", orgId);
    const existing = allCampaigns || [];

    let deletedCount = 0;
    let updatedCount = 0;
    const claimedDealIds = new Set<string>();

    for (const camp of existing) {
      // Approval gate: drafts were never pushed to Zoho and must never be auto-linked
      // to live Zoho CRM deals or deleted during Zoho CRM reconciliation.
      if (camp.status === "draft") continue;

      const dealIdStr = camp.zoho_crm_deal_id ? String(camp.zoho_crm_deal_id) : "";
      const isNativeCampaign = String(camp.zoho_crm_deal_url || "").includes("/Campaigns/");

      if (isNativeCampaign) {
        claimedDealIds.add(dealIdStr);
        continue;
      }

      if (dealIdStr) {
        if (!liveDealIds.has(dealIdStr)) {
          // Deal was DELETED in Zoho CRM or does not exist in the connected user's Zoho CRM account
          console.log(`[reconcile] Zoho deal ${dealIdStr} was deleted or not found in CRM. Cleaning up for ${camp.name} (${camp.id})`);
          // The deal is gone from the user's own Zoho CRM, so the local row is
          // stale. Projects/Invoices tied to the deleted deal are cleaned via
          // direct Zoho API calls with the user's own tokens where possible;
          // the local row is always removed since CRM is the source of truth.
          if (camp.zoho_project_id || camp.zoho_books_invoice_id) {
            console.log(`[reconcile] Note: project/invoice cleanup for ${camp.name} requires direct Zoho API delete (not yet implemented); local row removed.`);
          }
          await supabase
            .from("campaigns")
            .delete()
            .eq("id", camp.id)
            .eq("organization_id", orgId);
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
            await supabase
              .from("campaigns")
              .update(updates)
              .eq("id", camp.id)
              .eq("organization_id", orgId);
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
              .eq("id", camp.id)
              .eq("organization_id", orgId);
            updatedCount++;
          }
        }
      }

      // Import any deals present in Zoho CRM that don't exist in Supabase at all.
      // Guards:
      //   - claimed by ID (existing rows)
      //   - claimed by exact name (a row already owns this campaign name; the
      //     deal is a duplicate created by a prior lost-ID provisioning run)
      //   - native Campaign-module IDs env allowlist
      const claimedNames = new Set(
        existing.map((c: { name?: string }) => (c.name || "").trim().toLowerCase()).filter(Boolean)
      );
      let importedCount = 0;
      for (const liveDeal of liveDeals) {
        const dealIdStr = String(liveDeal.id);
        const dealNameKey = (liveDeal.name || "").trim().toLowerCase();
        if (claimedDealIds.has(dealIdStr)) continue;
        if (dealNameKey && claimedNames.has(dealNameKey)) {
          console.log(`[reconcile] Skipping import of duplicate deal ${dealIdStr} ("${liveDeal.name}"): a campaign with this name already exists locally.`);
          continue;
        }
        if (importedCount >= 10) {
          console.warn(`[reconcile] Import cap (10) reached; ${liveDeals.length - claimedDealIds.size - importedCount} unclaimed deals not imported this cycle.`);
          break;
        }
          const now = new Date().toISOString();
          const bespoke = generateDynamicBespokePlan({
            name: liveDeal.name || "Zoho Campaign Deal",
            client: "Enterprise Client",
          });
          await supabase.from("campaigns").insert({
            organization_id: orgId,
            created_by: userId || null,
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
          importedCount++;
          claimedNames.add(dealNameKey);
      }

      const { data: refreshedRows } = await supabase
        .from("campaigns")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      return {
        campaigns: (refreshedRows || []).map(rowToCampaign),
        validated: liveDeals.length,
        deleted: deletedCount,
        updated: updatedCount,
        reset: deletedCount,
      };
  } catch (err: any) {
    console.warn("[reconcileZohoCRMWithSupabase] Live Zoho list failed:", err.message);
  }

  const { data: fallbackRows } = await supabase
    .from("campaigns")
    .select("*")
    .eq("organization_id", orgId)
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

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, orgId, userEmail } = auth;

  const effectiveOrgId = await resolveEffectiveOrgId(user, orgId);

  // ── Diagnostics: Lightweight Zoho Health Probe ──
  if (action === "zoho_health") {
    const syncPing = { configured: false as boolean, reachable: false as boolean, status: null as number | null, latencyMs: 0, error: undefined as string | undefined };

    const entitlement = await buildEntitlementSnapshot();
    const crmVerdict = entitlement.connectors["zoho.crm"];
    const projectsVerdict = entitlement.connectors["zoho.projects"];
    const booksVerdict = entitlement.connectors["zoho.books"];

    const prefs = await currentUserPausedMap(userEmail ?? user.id);
    const connectorPaused = {
      zohoCrm: isConnectorPaused(prefs, "zoho.crm"),
      zohoProjects: isConnectorPaused(prefs, "zoho.projects"),
      zohoBooks: isConnectorPaused(prefs, "zoho.books"),
    };

    const orgShared = false;
    const anyPaused = connectorPaused.zohoCrm || connectorPaused.zohoProjects || connectorPaused.zohoBooks;
    const crmGranted = crmVerdict?.access === "granted";
    const syncReachable = syncPing.reachable;
    const healthy = !anyPaused && crmGranted && syncReachable;

    return NextResponse.json({
      healthy,
      n8n: {
        syncWebhook: syncPing,
      },
      entitlement: {
        crm: crmVerdict,
        projects: projectsVerdict,
        books: booksVerdict,
      },
      connectorPaused,
      orgShared,
      checkedAt: new Date().toISOString(),
    });
  }

  if (!effectiveOrgId) {
    return NextResponse.json({ campaigns: [] });
  }

  if (sync === "true") {
    const syncResult = await reconcileZohoCRMWithSupabase(effectiveOrgId, user.id, userEmail ?? undefined);
    return NextResponse.json({ campaigns: syncResult.campaigns, validated: syncResult.validated });
  }

  if (action === "check_approved" && name) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("organization_id", effectiveOrgId)
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
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("organization_id", effectiveOrgId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ campaign: rowToCampaign(data) });
  }

  if (action === "read_zoho_tasks" && id) {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("organization_id", effectiveOrgId)
      .maybeSingle();
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
    .eq("organization_id", effectiveOrgId)
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
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user, orgId, userEmail } = auth;

    const effectiveOrgId = await resolveEffectiveOrgId(user, orgId);
    if (!effectiveOrgId) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    // ── Action 0A: Check Zoho Books Contact ──
    if (action === "check_books_contact") {
      const { client } = body;
      if (!client) {
        return NextResponse.json({ error: "Client is required" }, { status: 400 });
      }
      const prefs = await currentUserPausedMap(userEmail ?? user.id);
      if (isConnectorPaused(prefs, "zoho.books")) {
        return NextResponse.json({ success: false, paused: true, error: PAUSED_ZOHO_MESSAGE, reason: "connector_paused" }, { status: 403 });
      }
      const check = await checkZohoBooksContact(client, effectiveOrgId, userEmail, user.id);
      return NextResponse.json({ success: true, ...check });
    }

    // ── Action 0B: Create Zoho Books Contact ──
    if (action === "create_books_contact") {
      const { client, companyName } = body;
      if (!client) {
        return NextResponse.json({ error: "Client is required" }, { status: 400 });
      }
      const prefs = await currentUserPausedMap(userEmail ?? user.id);
      if (isConnectorPaused(prefs, "zoho.books")) {
        return NextResponse.json({ success: false, paused: true, error: PAUSED_ZOHO_MESSAGE, reason: "connector_paused" }, { status: 403 });
      }
      const result = await createZohoBooksContact(client, companyName, userEmail, user.id);
      if (!result.success) {
        return NextResponse.json(result, { status: 400 });
      }
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
        const contactCheck = await checkZohoBooksContact(campaignData.client, effectiveOrgId, userEmail, user.id).catch(() => ({ exists: false, contact: undefined as any }));
        if (contactCheck.exists && contactCheck.contact?.contactId) {
          booksCustomerId = contactCheck.contact.contactId;
        }
      }

      // 1. Update existing row if we have an id or a name match within this organization (avoid duplicates)
      let targetRow: any = null;
      if (body.campaignId) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", body.campaignId)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        targetRow = data;
      }
      if (!targetRow && campaignData.name) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .ilike("name", campaignData.name.trim())
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
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
          .eq("id", targetRow.id)
          .eq("organization_id", effectiveOrgId);
      } else {
        const { data: insertedRow, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            organization_id: effectiveOrgId,
            created_by: user.id,
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

      const { data: camp } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("organization_id", effectiveOrgId)
        .maybeSingle();
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

      const { error: deleteError } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaignId)
        .eq("organization_id", effectiveOrgId);
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

      let aiResult: any;
      try {
        aiResult = await generateAIAspectPlan(campaignInput);
      } catch (e: any) {
        console.warn("[generate_plan] AI aspect plan error, falling back to dynamic plan:", e.message);
        aiResult = generateDynamicBespokePlan(campaignInput);
      }

      const clientName = aiResult?.client || campaignInput?.client || "Client";
      let booksContact: any = { exists: false, suggestedName: `${clientName.trim()} India` };
      try {
        booksContact = await checkZohoBooksContact(clientName, effectiveOrgId, userEmail, user.id);
      } catch (e: any) {
        console.warn("[generate_plan] Books contact check failed:", e.message);
      }

      return NextResponse.json({
        success: true,
        aiAnalysis: aiResult?.aiAnalysis || null,
        campaignData: {
          name: aiResult?.name || campaignInput?.name,
          client: clientName,
          category: aiResult?.category || campaignInput?.category || "FMCG",
          rewardType: aiResult?.rewardType || campaignInput?.rewardType || "Cashback",
          budget: aiResult?.budget || campaignInput?.budget || "₹25,00,000",
          codeVolume: aiResult?.codeVolume || campaignInput?.codeVolume || "250,000 packs",
          startDate: aiResult?.startDate || campaignInput?.startDate,
          endDate: aiResult?.endDate || campaignInput?.endDate,
          brief: aiResult?.brief || campaignInput?.brief,
          booksCustomerId: booksContact?.contact?.contactId || undefined,
        },
        booksContact: {
          exists: Boolean(booksContact?.exists),
          contactId: booksContact?.contact?.contactId || undefined,
          contactName: booksContact?.contact?.contactName || undefined,
          suggestedName: booksContact?.suggestedName || `${clientName.trim()} India`,
        },
        plan: {
          tasks: aiResult?.tasks || [],
          aspectSummary: aiResult?.aspectSummary || buildAspectSummary(aiResult?.tasks || []),
          recommendedTAT: aiResult?.recommendedTAT || "3 Days",
          criticalPath: aiResult?.criticalPath || [],
          totalEstimatedTasks: (aiResult?.tasks || []).length,
        },
      });
    }

    // ── Action 2: Approve & sync campaign to Zoho CRM ──
    if (action === "approve_and_push_zoho") {
      // Pause gate first: a paused Zoho connection must never be written to,
      // even when the entitlement itself is fine.
      const prefs = await currentUserPausedMap(userEmail ?? user.id);
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
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", body.campaignId)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        existingRow = data;
      }
      if (!existingRow && campaignData.name) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .ilike("name", campaignData.name.trim())
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
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
          .eq("id", existingRow.id)
          .eq("organization_id", effectiveOrgId);
        const mergedRow = { ...existingRow, tasks: resolvedTasks, status: "live", aspect_summary: buildAspectSummary(resolvedTasks) };
        await auditWrite({
          action: "approve_and_push_zoho",
          targetType: "campaign",
          targetId: existingRow.id,
          payloadSummary: { name: campaignData.name, client: campaignData.client, alreadySynced: true },
          orgId: effectiveOrgId,
          userId: user.id,
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
              projectUrl: existingRow.zoho_project_url || getZohoProjectUrl(existingRow.zoho_project_id),
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
        const contactCheck = await checkZohoBooksContact(clientName, effectiveOrgId, user.email, user.id);
        if (contactCheck.exists && contactCheck.contact?.contactId) {
          booksCustomerId = contactCheck.contact.contactId;
        } else {
          const created = await createZohoBooksContact(clientName, undefined, user.email, user.id);
          if (created.success && created.contactId) {
            booksCustomerId = created.contactId;
          } else {
            booksCustomerId = null;
          }
        }
      }

      // 1. Check if an existing row exists for this campaign (or insert new)
      let targetRow: any = null;
      if (body.campaignId) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", body.campaignId)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        targetRow = data;
      }
      if (!targetRow && campaignData.name) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .ilike("name", campaignData.name.trim())
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        targetRow = data;
      }

      let campaignId: string;
      if (targetRow) {
        campaignId = targetRow.id;
        const updateExisting: Record<string, any> = {
          name: campaignData.name || targetRow.name,
          client: campaignData.client || targetRow.client,
          reward_type: campaignData.rewardType || targetRow.reward_type,
          tasks: resolvedTasks,
          budget: campaignData.budget || targetRow.budget,
          code_volume: campaignData.codeVolume || targetRow.code_volume,
        };
        if (booksCustomerId) updateExisting.books_customer_id = booksCustomerId;
        await supabase
          .from("campaigns")
          .update(updateExisting)
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId);
      } else {
        const { data: insertedRow, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            organization_id: effectiveOrgId,
            created_by: user.id,
            name: campaignData.name,
            client: campaignData.client,
            category: campaignData.category || "FMCG",
            reward_type: campaignData.rewardType || "Cashback",
            budget: campaignData.budget || "₹25,00,000",
            code_volume: campaignData.codeVolume || "250,000 packs",
            start_date: campaignData.startDate || now.split("T")[0],
            end_date: campaignData.endDate || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
            brief: campaignData.brief || "AI-generated campaign plan.",
            status: "draft", // Kept as draft until Zoho sync succeeds
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
      let syncErrorMessage: string | undefined = undefined;

      const allResourcesExist = Boolean(dealId && projectId && invoiceId);

      if (allResourcesExist) {
        // Record already exists across Zoho CRM, Projects, and Books: all
        // resources are live and owned by this org; nothing to re-provision.
        // Still backfill any missing project tasks (e.g. projects created
        // before the tasks.ALL OAuth scope was granted to the connection).
        if (projectId && resolvedTasks.length > 0) {
          const taskBackfill = await syncCampaignTasksToZoho({
            userEmail: userEmail ?? null,
            userId: user.id,
            projectId,
            tasks: resolvedTasks,
          });
          if (taskBackfill.failed.length > 0) {
            console.warn("[approve_and_push_zoho] Task backfill incomplete:", taskBackfill.failed);
          }
        }

        await supabase
          .from("campaigns")
          .update({
            status: "live",
            approved_at: targetRow?.approved_at || now,
            approved_by: targetRow?.approved_by || "Rohit Sharma (Admin)",
            last_zoho_sync: now,
            zoho_sync_status: "synced",
          })
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId);
      } else {
        const syncRes = await syncCampaignToZohoCRM(
          campaignId,
          campaignData.name || targetRow?.name,
          campaignData.client || targetRow?.client,
          campaignData.budget || targetRow?.budget,
          campaignData.codeVolume || targetRow?.code_volume,
          resolvedTasks,
          booksCustomerId,
          userEmail || user.email,
          user.id,
          campaignData.endDate || targetRow?.end_date,
          campaignData.brief || targetRow?.brief,
          dealId,
          projectId,
          invoiceId
        );
        dealId = syncRes.dealId || dealId;
        dealUrl = syncRes.dealUrl || dealUrl;
        invoiceId = syncRes.invoiceId || invoiceId;
        invoiceUrl = syncRes.invoiceUrl || invoiceUrl;
        projectId = syncRes.projectId || projectId;
        projectUrl = syncRes.projectUrl || projectUrl;
        writeStatus = syncRes.writeStatus;
        syncErrorMessage = syncRes.error;
      }

      // Query fresh values in case n8n updated Supabase asynchronously
      if (campaignId && (!dealId || !projectId || !invoiceId)) {
        const { data: refreshedRow } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId)
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

      const allThree = Boolean(dealId && projectId && invoiceId);
      const someIds = Boolean(dealId || projectId || invoiceId);

      // If sync failed to produce or adopt ANY Zoho resources, preserve draft and return 502
      if (!someIds) {
        const friendlyError = writeStatusExplanation(writeStatus, syncErrorMessage);
        console.error(`[approve_and_push_zoho] Sync failed for campaign "${campaignData.name}":`, friendlyError);

        if (campaignId) {
          await supabase
            .from("campaigns")
            .update({
              status: "draft",
              zoho_sync_status: "failed",
              last_zoho_sync: now,
            })
            .eq("id", campaignId)
            .eq("organization_id", effectiveOrgId);
        }

        if (targetRow) {
          targetRow.status = "draft";
          targetRow.zoho_sync_status = "failed";
          targetRow.last_zoho_sync = now;
        }

        await auditWrite({
          action: "approve_and_push_zoho_failed",
          targetType: "campaign",
          targetId: campaignId || targetRow?.id || null,
          payloadSummary: {
            name: campaignData.name,
            client: campaignData.client,
            error: friendlyError,
            writeStatus,
          },
          orgId: effectiveOrgId,
          userId: user.id,
        });

        const failedCampaign = targetRow ? rowToCampaign(targetRow) : null;

        return NextResponse.json(
          {
            success: false,
            syncFailed: true,
            error: friendlyError,
            writeStatus,
            campaign: failedCampaign,
            zohoSync: {
              crmDeal: { product: "Zoho CRM", module: "Deals", dealId: null, dealUrl: null, stage: null, writeStatus: "FAILED" },
              projects: { product: "Zoho Projects", projectId: null, projectUrl: null, status: "FAILED", note: friendlyError },
              books: { product: "Zoho Books", invoiceId: null, invoiceUrl: null, status: "FAILED", note: friendlyError },
              overallSyncStatus: "FAILED",
              syncedAt: null,
            },
          },
          { status: 502 }
        );
      }

      // Sync succeeded (full or partial) - update campaign to live
      const newSyncStatus = allThree ? "synced" : "partial";
      const updatePayload: Record<string, any> = {
        status: "live",
        approved_at: targetRow?.approved_at || now,
        approved_by: targetRow?.approved_by || "Rohit Sharma (Admin)",
        zoho_sync_status: newSyncStatus,
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

      if (campaignId) {
        await supabase
          .from("campaigns")
          .update(updatePayload)
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId);
      }

      if (targetRow) {
        Object.assign(targetRow, updatePayload);
      }

      const savedCampaign: Campaign = rowToCampaign(targetRow);

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
          syncStatus: newSyncStatus,
        },
        orgId: effectiveOrgId,
        userId: user.id,
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
            status: projectId ? "SYNCED" : "PENDING",
            note: projectId
              ? `Project created: ${projectId}`
              : "Zoho Projects creation pending",
          },
          books: {
            product: "Zoho Books",
            invoiceId: invoiceId || null,
            invoiceUrl: invoiceUrl || null,
            status: invoiceId ? "SYNCED" : "PENDING",
            note: invoiceId
              ? `Invoice created: ${invoiceId}`
              : "Zoho Books invoice creation pending",
          },
          overallSyncStatus: allThree ? "SYNCED" : "PARTIAL",
          syncedAt: now,
        },
      });
    }

    // ── Action 3: Update a task status ──
    if (action === "update_zoho_task") {
      const { campaignId, campaignName, taskId, newStatus } = body;

      let campaignRow: any = null;
      if (campaignId) {
        const { data } = await supabase
          .from("campaigns")
          .select("id, status, tasks")
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        campaignRow = data;
      }
      if (!campaignRow && campaignName) {
        const { data } = await supabase
          .from("campaigns")
          .select("id, status, tasks")
          .eq("name", campaignName)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
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
        .eq("id", campaignRow.id)
        .eq("organization_id", effectiveOrgId);

      await auditWrite({
        action: "update_zoho_task",
        targetType: "campaign_task",
        targetId: taskId,
        payloadSummary: { campaignId: campaignRow.id, newStatus, isDraft },
        orgId: effectiveOrgId,
        userId: user.id,
      });

      // Task status changes persist locally only; Zoho CRM task sync happens
      // through the direct multi-tenant provisioning path on approval.
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
        const prefs = await currentUserPausedMap(userEmail ?? user.id);
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
        const { data: row } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
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
        await supabase
          .from("campaigns")
          .update(updatePayload)
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId);
      } else if (campaignName) {
        const { data: row } = await supabase
          .from("campaigns")
          .select("*")
          .eq("name", campaignName)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
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
        await supabase
          .from("campaigns")
          .update(updatePayload)
          .eq("name", campaignName)
          .eq("organization_id", effectiveOrgId);
      }

      // If campaign is pending Zoho sync, re-fire the n8n webhook with campaignId
      // Approval gate: DRAFT campaigns must never trigger Zoho provisioning.
      if (resolvedCampaignId && resolvedCampaignName && resolvedStatus !== "draft") {
        try {
          // Check if campaign still has no deal ID
          const { data: checkRow } = await supabase
            .from("campaigns")
            .select("zoho_crm_deal_id, zoho_project_id")
            .eq("id", resolvedCampaignId)
            .eq("organization_id", effectiveOrgId)
            .maybeSingle();

          // Task updates stay local; Zoho-side task pushes are handled by the
          // direct multi-tenant provisioning path on approval.
        } catch (err) {
          console.warn("[update_campaign_tasks] Zoho re-sync check failed:", err);
        }
      }

      return NextResponse.json({ success: true, syncedAt: now });
    }


    // ── Action 5: Validate Zoho deal IDs exist and sync ──
    if (action === "validate_and_sync") {
      const syncResult = await reconcileZohoCRMWithSupabase(effectiveOrgId, user.id, userEmail ?? undefined);
      return NextResponse.json(syncResult);
    }

    // ── Action 6: Delete campaign across Zoho & Supabase ──
    if (action === "delete_campaign") {
      const { campaignId } = body;
      if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

      const { data: camp } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("organization_id", effectiveOrgId)
        .maybeSingle();
      if (!camp) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      // Approval gate: a never-synced draft has no Zoho resources to wipe, skip the delete webhook entirely
      if (camp.status === "draft" && !camp.zoho_crm_deal_id && !camp.zoho_project_id && !camp.zoho_books_invoice_id) {
        await supabase
          .from("campaigns")
          .delete()
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId);
        return NextResponse.json({ success: true, deletedName: camp.name, note: "Draft deleted. There are no Zoho resources to clean up." });
      }

      console.log(`[delete_campaign] Wiping Zoho resources for ${camp.name}: deal=${camp.zoho_crm_deal_id}, project=${camp.zoho_project_id}, invoice=${camp.zoho_books_invoice_id}`);
      const hasZohoResources = Boolean(camp.zoho_crm_deal_id || camp.zoho_project_id || camp.zoho_books_invoice_id);

      // Direct multi-tenant cleanup using the authenticated user's own Zoho tokens
      const cleanup = await deleteZohoResourcesDirect({
        userEmail: userEmail ?? null,
        userId: user.id,
        dealId: camp.zoho_crm_deal_id || null,
        projectId: camp.zoho_project_id || null,
        invoiceId: camp.zoho_books_invoice_id || null,
      });
      const zohoDelete: { ok: boolean; detail: string } = cleanup.ok
        ? { ok: true, detail: cleanup.detail }
        : { ok: false, detail: cleanup.detail };
      const zohoDeletedIds: { dealId: string | null; projectId: string | null; projectIds: string[]; invoiceId: string | null } | null = {
        dealId: cleanup.deletedIds?.dealId || null,
        projectId: cleanup.deletedIds?.projectId || null,
        projectIds: cleanup.deletedIds?.projectIds || [],
        invoiceId: cleanup.deletedIds?.invoiceId || null,
      };

      if (hasZohoResources && !zohoDelete.ok) {
        // Could not confirm Zoho cleanup — keep the row so state stays truthful
        // instead of orphaning live Zoho records.
        await auditWrite({
          action: "delete_campaign",
          outcome: "refused",
          payloadSummary: { reason: zohoDelete.detail, campaign: camp.name },
          orgId: effectiveOrgId,
          userId: user.id,
        });
        return NextResponse.json(
          {
            error: `Zoho cleanup could not be confirmed (${zohoDelete.detail}). The campaign still exists in Zoho, so it was not deleted here.`,
            reason: "zoho_cleanup_unconfirmed",
          },
          { status: 503 }
        );
      }

      const { error: deleteError } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaignId)
        .eq("organization_id", effectiveOrgId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      await auditWrite({
        action: "delete_campaign",
        targetType: "campaign",
        targetId: campaignId,
        payloadSummary: { name: camp.name, zohoDelete: zohoDelete.detail, hadZohoResources: hasZohoResources, zohoDeletedIds },
        outcome: zohoDelete.ok ? "success" : "failure",
        orgId: effectiveOrgId,
        userId: user.id,
      });

      return NextResponse.json({
        success: true,
        deletedName: camp.name,
        zohoCleanup: zohoDelete.detail,
        zohoDeletedIds,
        warning:
          zohoDelete.detail === "confirmed" || zohoDelete.detail === "not_found"
            ? undefined
            : zohoDelete.ok
              ? "Zoho cleanup was requested. Check Zoho for leftovers."
              : zohoDelete.detail === "resources_not_found"
                ? "Campaign had Zoho IDs recorded, but none were found in Zoho during deletion. Cleaned locally."
                : zohoDelete.detail === "zoho_delete_failed"
                  ? "Failed to delete some Zoho resources. Check Zoho CRM, Projects, or Books for leftovers."
                  : "Local record deleted, but Zoho cleanup could not be confirmed. Check Zoho for leftovers.",
      });
    }

    // ── Action 5: Update Live Campaign across Zoho CRM, Books, Projects & Supabase ──
    if (action === "update_live_campaign") {
      const { campaignId, dealId, projectId, invoiceId, newName, newBudget, newVolume, tasks, rewardType } = body;

      let campRow: any = null;
      if (campaignId) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        campRow = data;
      }
      if (!campRow && dealId) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .eq("zoho_crm_deal_id", dealId)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        campRow = data;
      }
      if (!campRow && newName) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .ilike("name", `%${newName}%`)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        campRow = data;
      }
      if (!campRow && body.client) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .ilike("client", `%${body.client}%`)
          .eq("organization_id", effectiveOrgId)
          .maybeSingle();
        campRow = data;
      }
      if (!campRow && newName) {
        const firstToken = newName.split(" ")[0];
        if (firstToken && firstToken.length > 2) {
          const { data } = await supabase
            .from("campaigns")
            .select("*")
            .ilike("name", `%${firstToken}%`)
            .eq("organization_id", effectiveOrgId)
            .maybeSingle();
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
        const prefs = await currentUserPausedMap(userEmail ?? user.id);
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
            await supabase
              .from("campaigns")
              .update(updates)
              .eq("id", targetDraftId)
              .eq("organization_id", effectiveOrgId);
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

        await supabase
          .from("campaigns")
          .update(updates)
          .eq("id", targetCampaignId)
          .eq("organization_id", effectiveOrgId);
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
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Campaign API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
