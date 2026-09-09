import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const RISK_WORKFLOW_WEBHOOK =
  "https://indigo-pelican-266513.hostingersite.com/webhook/9d5c2e17-690f-4886-9430-c3d52c21966f";

export async function GET() {
  // ── Step 1: Try the live n8n Proactive Risk Nudge workflow first ──
  try {
    const res = await fetch(RISK_WORKFLOW_WEBHOOK, {
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420",
        "Bypass-Tunnel-Reminder": "true",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Risk webhook returned ${res.status}`);

    const data = await res.json();

    if (!data.criticalActionItems || !Array.isArray(data.criticalActionItems)) {
      throw new Error("Invalid response format from risk workflow");
    }

    // Live n8n data is authoritative, return it directly
    return NextResponse.json(data);
  } catch (error) {
    console.error("[risk-digest] Live n8n workflow unavailable:", error);
  }

  // ── Step 2: Fallback, query Supabase for campaigns not yet approved ──
  // Only show action items for campaigns that are genuinely still in draft status.
  // If there are no draft campaigns, return an empty array → no banner rendered.
  try {
    const { data: draftCampaigns, error: dbError } = await supabase
      .from("campaigns")
      .select("name, client, created_at")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(3);

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
      systemStatus: "degraded", // live n8n workflow was unavailable, fallback used
      dataSource: "zoho_store_fallback",
    });
  } catch (supabaseError) {
    console.error("[risk-digest] Supabase fallback also failed:", supabaseError);

    // ── Step 3: Last resort, return empty list so no false banner appears ──
    // Better to show nothing than to show incorrect hardcoded data.
    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      totalActiveDeals: 0,
      criticalActionItems: [],
      systemStatus: "unavailable",
      dataSource: "empty_safe_fallback",
    });
  }
}
