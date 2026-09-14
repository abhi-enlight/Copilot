import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const RISK_WORKFLOW_WEBHOOK = process.env.N8N_RISK_WORKFLOW_WEBHOOK || "";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, orgId } = auth;

  let effectiveOrgId = orgId;
  if (!effectiveOrgId) {
    const { data: memberRows } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    if (memberRows && memberRows.length > 0) {
      effectiveOrgId = memberRows[0].organization_id;
    }
  }

  // Check if Zoho CRM is connected for this user / org
  let hasZoho = false;
  if (user?.id) {
    const { data: userInteg } = await supabase
      .from("user_integrations")
      .select("id, status")
      .eq("auth_user_id", user.id)
      .eq("provider", "zoho")
      .eq("product", "crm")
      .maybeSingle();
    hasZoho = userInteg?.status === "active";
  }

  if (!hasZoho && effectiveOrgId) {
    const { data: tenantInteg } = await supabase
      .from("tenant_integrations")
      .select("id, status")
      .eq("organization_id", effectiveOrgId)
      .eq("provider", "zoho")
      .maybeSingle();
    hasZoho = tenantInteg?.status === "active";
  }

  // ── Step 1: Only query live n8n workflow if the organization actually has Zoho CRM active ──
  if (hasZoho && RISK_WORKFLOW_WEBHOOK) {
    try {
      const res = await fetch(RISK_WORKFLOW_WEBHOOK, {
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
          "Bypass-Tunnel-Reminder": "true",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.criticalActionItems && Array.isArray(data.criticalActionItems)) {
          return NextResponse.json(data);
        }
      }
    } catch (error) {
      console.error("[risk-digest] Live n8n workflow unavailable:", error);
    }
  }

  // ── Step 2: Query Supabase for draft campaigns ONLY within this organization ──
  try {
    let query = supabase
      .from("campaigns")
      .select("name, client, created_at")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(3);

    if (effectiveOrgId) {
      query = query.eq("organization_id", effectiveOrgId);
    }

    const { data: draftCampaigns, error: dbError } = await query;
    if (dbError) throw dbError;

    const criticalActionItems = (draftCampaigns || []).map((row) => ({
      type: "APPROVAL_BLOCKER",
      deal: row.name,
      owner: "Campaign Manager",
      issue: "Campaign plan not yet approved & synced to Zoho CRM",
      tatRemaining: "Pending Approval",
    }));

    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      totalActiveDeals: criticalActionItems.length,
      criticalActionItems,
      systemStatus: hasZoho ? "degraded" : "ok",
      dataSource: "zoho_store_fallback",
    });
  } catch (supabaseError) {
    console.error("[risk-digest] Supabase query failed:", supabaseError);

    // ── Step 3: Last resort, return empty list so no false banner appears ──
    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      totalActiveDeals: 0,
      criticalActionItems: [],
      systemStatus: "unavailable",
      dataSource: "empty_safe_fallback",
    });
  }
}
