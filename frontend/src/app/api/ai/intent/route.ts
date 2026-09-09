import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { BIGCITY_TEAM } from "@/utils/planModifier";
import { getConnectorPreferences, isConnectorPaused } from "@/lib/connector-preferences";
import {
  generateAIAspectPlan,
  checkZohoBooksContact,
  type AspectTask,
  type Campaign,
} from "@/app/api/campaigns/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://indigo-pelican-266513.hostingersite.com/webhook/7a7d4575-950e-4090-84b4-f5bc3a5c6017/chat";

/**
 * AI Plan Modifier: Calls Gemini 3.7 Flash via n8n to modify campaigns & tasks
 * with zero regex guessing. Returns pure, validated structured JSON.
 */
export async function modifyPlanWithAI({
  userInstruction,
  currentCampaign,
  currentTasks,
  sessionId,
}: {
  userInstruction: string;
  currentCampaign: any;
  currentTasks: AspectTask[];
  sessionId?: string;
}): Promise<{
  hasModifications: boolean;
  actionType: "reassign" | "add_task" | "delete_task" | "update_param" | "improve" | "multiple" | "none";
  updatedCampaign: any;
  updatedTasks: AspectTask[];
  modifiedTaskIds: string[];
  summaryMarkdown: string;
}> {
  const teamContext = BIGCITY_TEAM.map(
    (m) => `- ${m.name} (${m.role}, ${m.department}) [Aspects: ${m.aspects.join(", ")}]`
  ).join("\n");

  const prompt = `[AI PLAN MODIFIER ENGINE]
You are the BigCity Promotions Lead Campaign Architect & Operations SPOC.
Your job is to update an existing promotional campaign and its operational tasks based on user instructions.

User Instruction:
"${userInstruction}"

Current Campaign State:
${JSON.stringify(
  {
    name: currentCampaign?.name || "Promotional Campaign",
    client: currentCampaign?.client || "Brand Partner",
    rewardType: currentCampaign?.rewardType || "Cashback",
    budget: currentCampaign?.budget || "₹25,00,000",
    codeVolume: currentCampaign?.codeVolume || "250,000 codes",
    brief: currentCampaign?.brief || "",
  },
  null,
  2
)}

Current Tasks (${currentTasks.length} tasks):
${JSON.stringify(
  currentTasks.map((t) => ({
    id: t.id,
    sopCode: t.sopCode,
    title: t.title,
    aspect: t.aspect,
    assignee: t.assignee,
    role: t.role,
    urgency: t.urgency,
    tat: t.tat,
    status: t.status,
    details: t.details || "",
  })),
  null,
  2
)}

BigCity Promotions Team Directory:
${teamContext}

Guidelines:
1. Update Campaign Parameters:
   - name: Give a crisp, professional campaign name reflecting theme/mechanic changes (e.g. "Jaguar 2-Phase Cashback Campaign"). NEVER use markdown headers or phrases like "& Operational Plan".
   - client: Preserve the client brand name (e.g., "Jaguar Land Rover India" or "Jaguar").
   - rewardType: Update reward type/mechanic if instructed (e.g. Cashback, 2-Phase Cashback, EGV, Scratch & Win, Merchandise).
   - budget: Update budget (e.g. ₹1,50,00,000 / ₹1.5 Cr) if instructed.
   - codeVolume: Update pack/code volume if requested.
   - brief: Clean, updated summary of the campaign.

2. Update Operational Tasks:
   - For reassignments: change assignee and role according to the BigCity Team Directory (e.g. reassign legal tasks to Kavita Rao with role "Legal Associate").
   - For mechanic or phase changes (e.g. "2-phase cashback campaign"): adapt existing tasks and/or add new tasks representing Phase 1 and Phase 2 requirements (e.g. legal terms, escrow funding, OTP journey, payout integration).
   - Keep aspect strictly one of: "legal" | "compliance" | "accounting" | "implementation".
   - Keep urgency strictly one of: "HIGHEST" | "HIGH" | "MEDIUM" | "NORMAL".
   - Keep status strictly one of: "COMPLETED" | "IN_PROGRESS" | "PENDING_APPROVAL" | "PENDING_INPUT" | "PENDING_SIGN_OFF".
   - Assign appropriate SOP codes (e.g. SOP-LEG-0x, SOP-CMP-0x, SOP-ACC-0x, SOP-IMP-0x).
   - Preserve existing task IDs when modifying existing tasks. Generate unique IDs (e.g. "task-phase2-1") for new tasks.

3. Summary:
   - Provide a clear, professional markdown summary explaining all updates made.

Output ONLY a valid JSON object matching this schema (no markdown fences, pure JSON):
{
  "hasModifications": true,
  "actionType": "update_param" | "reassign" | "add_task" | "delete_task" | "multiple",
  "updatedCampaign": {
    "name": "...",
    "client": "...",
    "rewardType": "...",
    "budget": "...",
    "codeVolume": "...",
    "brief": "..."
  },
  "updatedTasks": [
    {
      "id": "...",
      "sopCode": "...",
      "title": "...",
      "aspect": "legal" | "compliance" | "accounting" | "implementation",
      "assignee": "...",
      "role": "...",
      "urgency": "HIGHEST" | "HIGH" | "MEDIUM" | "NORMAL",
      "tat": "...",
      "status": "...",
      "details": "...",
      "verificationRequirement": "...",
      "mandatoryGate": true
    }
  ],
  "modifiedTaskIds": ["..."],
  "summaryMarkdown": "..."
}`;

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "69420" },
      body: JSON.stringify({
        action: "sendMessage",
        chatInput: prompt,
        sessionId: sessionId || `mod-${Date.now()}`,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const rawText = await res.text();
      let assembled = "";
      const lines = rawText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsedLine = JSON.parse(trimmed);
          if (parsedLine.type === "item" && parsedLine.content) {
            assembled += parsedLine.content;
          } else if (parsedLine.text || parsedLine.output) {
            assembled += parsedLine.text || parsedLine.output;
          }
        } catch {
          assembled += trimmed;
        }
      }
      if (!assembled) assembled = rawText;

      const cleaned = assembled.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*"updatedCampaign"[\s\S]*\}/) || cleaned.match(/\{[\s\S]*"updatedTasks"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.updatedCampaign && Array.isArray(parsed.updatedTasks)) {
          // Clean campaign name if corrupted
          let cleanName = String(parsed.updatedCampaign.name || currentCampaign?.name || "Promotional Campaign")
            .replace(/^#+\s*/g, "")
            .replace(/\*\*/g, "")
            .trim();
          if (cleanName.startsWith("&")) {
            const clientPrefix = parsed.updatedCampaign.client || currentCampaign?.client || "Brand";
            cleanName = `${clientPrefix} ${cleanName.replace(/^&\s*/, "")}`.trim();
          }

          const sanitizedTasks: AspectTask[] = parsed.updatedTasks.map((t: any, i: number) => ({
            id: t.id || `task-${Date.now()}-${i + 1}`,
            sopCode:
              t.sopCode ||
              (t.aspect === "legal"
                ? `SOP-LEG-0${i + 1}`
                : t.aspect === "compliance"
                ? `SOP-CMP-0${i + 1}`
                : t.aspect === "accounting"
                ? `SOP-ACC-0${i + 1}`
                : `SOP-IMP-0${i + 1}`),
            title: t.title || `Task ${i + 1}`,
            aspect: ["legal", "compliance", "accounting", "implementation"].includes(t.aspect)
              ? t.aspect
              : "implementation",
            assignee: t.assignee || "Sachin (Tech Team)",
            role: t.role || "SPOC",
            urgency: ["HIGHEST", "HIGH", "MEDIUM", "NORMAL"].includes(t.urgency) ? t.urgency : "HIGH",
            tat: t.tat || "2 Days",
            status: t.status || "IN_PROGRESS",
            zohoCrmTaskId: t.zohoCrmTaskId || `ZT-${Math.floor(100000 + Math.random() * 900000)}`,
            zohoCrmTaskStatus: t.status === "COMPLETED" ? "Closed" : "In Progress",
            details: t.details || "",
            verificationRequirement: t.verificationRequirement || "Documentation sign-off",
            mandatoryGate: Boolean(t.mandatoryGate ?? true),
          }));

          return {
            hasModifications: true,
            actionType: parsed.actionType || "multiple",
            updatedCampaign: {
              ...currentCampaign,
              ...parsed.updatedCampaign,
              name: cleanName,
            },
            updatedTasks: sanitizedTasks,
            modifiedTaskIds: Array.isArray(parsed.modifiedTaskIds) ? parsed.modifiedTaskIds : sanitizedTasks.map((t) => t.id),
            summaryMarkdown: parsed.summaryMarkdown || "✨ Campaign plan updated successfully.",
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("[modifyPlanWithAI] Webhook call error/timeout:", err.message);
  }

  // Graceful fallback if webhook fails
  return {
    hasModifications: false,
    actionType: "none",
    updatedCampaign: currentCampaign,
    updatedTasks: currentTasks,
    modifiedTaskIds: [],
    summaryMarkdown: "No modifications could be applied.",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, activePlan, sessionId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const contextStr = activePlan
      ? `Active Campaign in Studio: "${activePlan.campaignData?.name || "Active Campaign"}" (Client: ${activePlan.campaignData?.client || "Unknown"}, Status: ${activePlan.status}, Tasks: ${activePlan.tasks?.length || 0})`
      : "No active campaign plan currently open.";

    const prompt = `[AI INTENT & NATURAL LANGUAGE UNDERSTANDING ENGINE]
You are the BigCity Promotions Campaign Architect & Copilot Orchestrator AI.
Analyze the user's natural language message in the context of the active workspace.

Current Context:
${contextStr}

User Message:
"${message}"

Instructions:
1. Understand the semantic intent of the user. Classify intent as ONE of:
   - "PLAN_CREATE": User has provided CONCRETE details to create a promotional campaign with a SPECIFIC brand or client name (e.g. Amul, Rangoni, Pepsi, etc.) AND offer parameters (e.g. cashback, budget, rewards).
     CRITICAL: DO NOT classify as PLAN_CREATE if the user is merely stating they have an idea or asking for help to build a plan without naming a real client or brand. Classify such exploratory statements as "CHAT" so the agent asks for the client lead first.
   - "PLAN_MODIFY": User is asking to modify, update, reassign, adjust, add tasks, or change parameters of a campaign plan.
   - "PLAN_APPROVE": User explicitly confirms, approves, or wants to push/sync the active plan to Zoho (e.g. "looks good", "approve", "push to zoho", "go live", "yes proceed").
   - "CHAT": User is asking a question, seeking knowledge, querying status/invoices, or stating they have an idea / having a general conversation.

2. If intent is "PLAN_CREATE", extract:
   - name: Campaign title or descriptive name
   - client: Brand/Client name (e.g. Amul, Puma, Coca-Cola, Nestlé, etc.)
   - category: One of FMCG, Beverages, Retail, Electronics, BFSI, QSR
   - rewardType: One of Cashback, EGV, Scratch & Win, Merchandise
   - partner: Reward partner (e.g. PhonePe, Google Pay, Swiggy, Zomato, Swiggy, Swiggy, UPI)
   - budget: Total budget (e.g. ₹35,00,000)
   - codeVolume: Pack/code volume (e.g. 400,000 PET bottles)
   - brief: Clean summary of the campaign requirement

3. If intent is "PLAN_MODIFY", extract:
   - targetBrand: Brand or client name mentioned (e.g. "Jaguar", "BMW", "Audi", "Amul", or null if referring to active campaign)
   - modificationSummary: Concise summary of requested changes

Return ONLY a valid JSON object matching this schema (no markdown fences, pure JSON):
{
  "intent": "PLAN_CREATE" | "PLAN_MODIFY" | "PLAN_APPROVE" | "CHAT",
  "reasoning": "Short 1-sentence explanation of why this intent was recognized",
  "targetBrand": "string or null",
  "campaignData": {
    "name": "...",
    "client": "...",
    "category": "...",
    "rewardType": "...",
    "partner": "...",
    "budget": "...",
    "codeVolume": "...",
    "brief": "..."
  },
  "modification": {
    "action": "reassign" | "add_task" | "update_param" | "general_edit",
    "details": "..."
  }
}`;

    let aiIntent = "CHAT";
    let extractedData: any = null;

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "69420" },
        body: JSON.stringify({
          action: "sendMessage",
          chatInput: prompt,
          sessionId: sessionId || `intent-${Date.now()}`,
        }),
        signal: AbortSignal.timeout(9000),
      });

      if (res.ok) {
        const rawText = await res.text();
        let assembled = "";
        const lines = rawText.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsedLine = JSON.parse(trimmed);
            if (parsedLine.type === "item" && parsedLine.content) {
              assembled += parsedLine.content;
            } else if (parsedLine.text || parsedLine.output) {
              assembled += parsedLine.text || parsedLine.output;
            }
          } catch {
            assembled += trimmed;
          }
        }
        if (!assembled) assembled = rawText;

        const jsonMatch = assembled.match(/\{[\s\S]*"intent"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiIntent = parsed.intent || "CHAT";
          extractedData = parsed;
        }
      }
    } catch (e: any) {
      console.warn("[AI Intent] Webhook evaluation timeout/fallback:", e.message);
    }

    // --- 1. HANDLE PLAN_CREATE ---
    if (aiIntent === "PLAN_CREATE" && extractedData?.campaignData) {
      const cData = extractedData.campaignData;
      const rawClient = String(cData.client || "").trim();
      const isPlaceholderClient =
        !rawClient ||
        rawClient.toLowerCase() === "enterprise client" ||
        rawClient.toLowerCase() === "unknown" ||
        rawClient.toLowerCase() === "client" ||
        rawClient.toLowerCase() === "a client" ||
        rawClient.toLowerCase() === "client lead";

      if (isPlaceholderClient) {
        return NextResponse.json({
          success: true,
          intent: "CHAT",
          reasoning: "User has not specified a concrete client or brand yet. Retaining CHAT mode to collect brief details.",
          extractedData,
        });
      }

      const fullPlan = await generateAIAspectPlan({
        name: cData.name || `${rawClient} Promotional Campaign`,
        client: rawClient,
        category: cData.category || "FMCG",
        rewardType: cData.rewardType || "Cashback",
        partner: cData.partner,
        budget: cData.budget || "₹25,00,000",
        codeVolume: cData.codeVolume || "250,000 packs",
        brief: cData.brief || message,
      });

      // Books pre-flight is a live Zoho lookup, skip it entirely when the
      // user has paused the Zoho Books connection (no ghost prompts).
      const cookieStore = await cookies();
      const sessionEmail = cookieStore.get("ms_user_email")?.value || null;
      const pausePrefs = await getConnectorPreferences(sessionEmail);
      const booksContact = isConnectorPaused(pausePrefs, "zoho.books")
        ? { exists: true, contact: undefined, suggestedName: `${fullPlan.client} India` }
        : await checkZohoBooksContact(fullPlan.client);

      return NextResponse.json({
        success: true,
        intent: "PLAN_CREATE",
        reasoning: extractedData.reasoning || "AI detected campaign brief and created 4-aspect operational matrix.",
        campaignData: {
          name: fullPlan.name,
          client: fullPlan.client,
          category: fullPlan.category,
          rewardType: fullPlan.rewardType,
          budget: fullPlan.budget,
          codeVolume: fullPlan.codeVolume,
          startDate: fullPlan.startDate,
          endDate: fullPlan.endDate,
          brief: fullPlan.brief,
          booksCustomerId: booksContact.contact?.contactId || undefined,
        },
        booksContact: {
          exists: booksContact.exists,
          contactId: booksContact.contact?.contactId,
          contactName: booksContact.contact?.contactName,
          suggestedName: booksContact.suggestedName,
        },
        plan: {
          tasks: fullPlan.tasks,
          aspectSummary: fullPlan.aspectSummary,
          recommendedTAT: fullPlan.recommendedTAT,
          criticalPath: fullPlan.criticalPath,
          aiAnalysis: fullPlan.aiAnalysis,
        },
      });
    }

    // --- 2. HANDLE PLAN_MODIFY (AI-Driven with Zero Regex) ---
    if (aiIntent === "PLAN_MODIFY") {
      const targetBrand = (extractedData?.targetBrand || "").trim().toLowerCase();
      let targetCampaignRow: any = null;
      let baseCampaignData: any = null;
      let baseTasks: AspectTask[] = [];

      // If activePlan is currently in Studio and matches brand (or no specific targetBrand)
      if (
        activePlan &&
        (!targetBrand ||
          (activePlan.campaignData?.client &&
            activePlan.campaignData.client.toLowerCase().includes(targetBrand)) ||
          (activePlan.campaignData?.name &&
            activePlan.campaignData.name.toLowerCase().includes(targetBrand)))
      ) {
        baseCampaignData = activePlan.campaignData;
        baseTasks = activePlan.tasks || [];
        targetCampaignRow = {
          id: activePlan.campaignId,
          zoho_crm_deal_id: activePlan.zohoCrmDealId,
          zoho_project_id: activePlan.zohoProjectId,
          zoho_books_invoice_id: activePlan.zohoBooksInvoiceId,
          books_customer_id: activePlan.booksCustomerId,
        };
      } else {
        // Find existing campaign in Supabase by brand or name
        try {
          const { data: dbCampaigns } = await supabase
            .from("campaigns")
            .select("*")
            .order("created_at", { ascending: false });

          if (dbCampaigns && dbCampaigns.length > 0) {
            if (targetBrand) {
              targetCampaignRow = dbCampaigns.find(
                (c: any) =>
                  (c.client && c.client.toLowerCase().includes(targetBrand)) ||
                  (c.name && c.name.toLowerCase().includes(targetBrand))
              );
            }
            if (!targetCampaignRow && activePlan?.campaignId) {
              targetCampaignRow = dbCampaigns.find((c: any) => c.id === activePlan.campaignId);
            }
            if (!targetCampaignRow && !activePlan) {
              targetCampaignRow = dbCampaigns[0];
            }
          }
        } catch (dbErr) {
          console.warn("[PLAN_MODIFY] Supabase lookup error:", dbErr);
        }

        if (targetCampaignRow) {
          baseCampaignData = {
            name: targetCampaignRow.name,
            client: targetCampaignRow.client,
            rewardType: targetCampaignRow.reward_type || "Cashback",
            budget: targetCampaignRow.budget || "₹25,00,000",
            codeVolume: targetCampaignRow.code_volume || "250,000 packs",
            startDate: targetCampaignRow.start_date || new Date().toISOString().split("T")[0],
            endDate:
              targetCampaignRow.end_date ||
              new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
            brief: targetCampaignRow.brief || "",
          };
          baseTasks = Array.isArray(targetCampaignRow.tasks) ? targetCampaignRow.tasks : [];
        } else if (activePlan) {
          baseCampaignData = activePlan.campaignData;
          baseTasks = activePlan.tasks || [];
        } else {
          // Dynamic initial baseline
          const displayClient = targetBrand
            ? targetBrand.charAt(0).toUpperCase() + targetBrand.slice(1)
            : "Brand Partner";
          baseCampaignData = {
            name: `${displayClient} Promotional Campaign`,
            client: displayClient,
            rewardType: "Cashback",
            budget: "₹25,00,000",
            codeVolume: "250,000 packs",
            startDate: new Date().toISOString().split("T")[0],
            endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
            brief: message,
          };
        }
      }

      // Execute AI Plan Modification Engine
      const modResult = await modifyPlanWithAI({
        userInstruction: message,
        currentCampaign: baseCampaignData,
        currentTasks: baseTasks,
        sessionId,
      });

      const aspectSummary = {
        legal: modResult.updatedTasks.filter((t) => t.aspect === "legal").length,
        compliance: modResult.updatedTasks.filter((t) => t.aspect === "compliance").length,
        accounting: modResult.updatedTasks.filter((t) => t.aspect === "accounting").length,
        implementation: modResult.updatedTasks.filter((t) => t.aspect === "implementation").length,
      };

      return NextResponse.json({
        success: true,
        intent: "PLAN_MODIFY",
        campaignId: targetCampaignRow?.id || activePlan?.campaignId,
        zohoCrmDealId: targetCampaignRow?.zoho_crm_deal_id || activePlan?.zohoCrmDealId,
        zohoProjectId: targetCampaignRow?.zoho_project_id || activePlan?.zohoProjectId,
        zohoBooksInvoiceId:
          targetCampaignRow?.zoho_books_invoice_id || activePlan?.zohoBooksInvoiceId,
        booksCustomerId: targetCampaignRow?.books_customer_id || activePlan?.booksCustomerId,
        status:
          targetCampaignRow?.zoho_crm_deal_id || activePlan?.zohoCrmDealId ? "live" : "draft",
        campaignData: modResult.updatedCampaign,
        tasks: modResult.updatedTasks,
        aspectSummary,
        modifiedTaskIds: modResult.modifiedTaskIds,
        summaryMarkdown: modResult.summaryMarkdown,
        planModification: modResult,
      });
    }

    // --- 3. HANDLE PLAN_APPROVE or CHAT ---
    return NextResponse.json({
      success: true,
      intent: aiIntent,
      reasoning: extractedData?.reasoning || "Direct conversational response",
      extractedData,
    });
  } catch (error: any) {
    console.error("[/api/ai/intent] Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
