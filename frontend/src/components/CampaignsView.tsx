"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Megaphone,
  Plus,
  MagnifyingGlass,
  Sparkle,
  CheckCircle,
  Clock,
  Kanban,
  Scales,
  ShieldCheck,
  Receipt,
  Cpu,
  User,
  ArrowsClockwise,
  X,
  Buildings,
  Lightning,
  CaretRight,
  Dot,
  CircleNotch,
  Trash,
  PencilSimple,
  FloppyDisk,
} from "@phosphor-icons/react";
import { type Campaign, type AspectTask } from "@/types/campaign";
import { generateAspectPlan } from "@/lib/campaign-planner";
import ZohoProjectsDrawer from "./ZohoProjectsDrawer";
import ApprovalModal from "./ApprovalModal";
import ChatMessage, { type Message } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import ThinkingProcess from "@/components/ThinkingProcess";
import { AnimatedErrorBanner } from "@/components/ui/ErrorInlineBanner";


const ASPECT_META = {
  legal: {
    icon: Scales,
    label: "Legal",
    accent: "bg-violet-500",
    light: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-l-violet-400",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
  compliance: {
    icon: ShieldCheck,
    label: "Compliance",
    accent: "bg-amber-500",
    light: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  accounting: {
    icon: Receipt,
    label: "Accounting",
    accent: "bg-emerald-500",
    light: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-l-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  implementation: {
    icon: Cpu,
    label: "Tech",
    accent: "bg-sky-500",
    light: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-l-sky-400",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
  },
};

interface CampaignsViewProps {
  onOpenChatWithPrompt?: (prompt: string) => void;
  onModifyInCopilot?: (campaignData: any, plan: any) => void;
}

export default function CampaignsView({ onOpenChatWithPrompt, onModifyInCopilot }: CampaignsViewProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"All" | "Live" | "Planning" | "In Review">("All");
  const [wizardAspectFilter, setWizardAspectFilter] = useState<"all" | "legal" | "compliance" | "accounting" | "implementation">("all");

  const [selectedCampaignForDrawer, setSelectedCampaignForDrawer] = useState<Campaign | null>(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<"input" | "ai_generating" | "plan_review" | "zoho_pushing" | "push_success">("input");
  const [generationProgress, setGenerationProgress] = useState(0);

  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    client: "",
    category: "FMCG",
    rewardType: "Cashback",
    budget: "₹25,00,000",
    codeVolume: "250,000 packs",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    brief: "",
  });

  const [generatedPlan, setGeneratedPlan] = useState<{
    tasks: AspectTask[];
    aspectSummary: Campaign["aspectSummary"];
  } | null>(null);

  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null);
  // Approval gate state, Zoho push only fires after explicit modal confirmation
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [approvingDraftId, setApprovingDraftId] = useState<string | null>(null);
  const [wizardBooksContact, setWizardBooksContact] = useState<{
    exists: boolean;
    contactId?: string;
    contactName?: string;
    suggestedName?: string;
  } | null>(null);
  const [isRegisteringBooks, setIsRegisteringBooks] = useState(false);
  const [retryingCampaignId, setRetryingCampaignId] = useState<string | null>(null);
  const [draftToApprove, setDraftToApprove] = useState<Campaign | null>(null);
  const [draftBooksContact, setDraftBooksContact] = useState<{
    exists: boolean;
    contactId?: string;
    contactName?: string;
  } | null>(null);
  const [toastNotice, setToastNotice] = useState<{
    id: string;
    text: string;
    icon?: "check" | "sparkle" | "info";
  } | null>(null);

  // Page-load error state (silent until user notices empty list)
  const [loadError, setLoadError] = useState<string | null>(null);
  // Delete confirmation modal state (replaces window.confirm)
  const [deleteConfirmCamp, setDeleteConfirmCamp] = useState<Campaign | null>(null);
  const [discardConfirmCamp, setDiscardConfirmCamp] = useState<Campaign | null>(null);

  const showToast = useCallback(
    (text: string, icon: "check" | "sparkle" | "info" = "check") => {
      setToastNotice({ id: `toast-${Date.now()}`, text, icon });
      setTimeout(() => {
        setToastNotice((prev) => (prev?.text === text ? null : prev));
      }, 4000);
    },
    []
  );

  const fetchCampaigns = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const res = await fetch("/api/campaigns?sync=true");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setLoadError(null);
        if (isManualRefresh) {
          showToast(`Live sync complete · ${data.campaigns?.length || 0} active campaigns in Zoho`, "check");
        }
      } else {
        // Non-200 from server, service issue, not user error
        setLoadError("Prism couldn't load your campaigns. This is a service issue, not lost data. Refresh to try again.");
        if (isManualRefresh) showToast("Couldn't refresh from Zoho. Try again in a moment.", "info");
      }
    } catch (e) {
      console.error("Failed to fetch campaigns from Zoho / DB", e);
      setLoadError("Couldn't load campaigns. Check your connection and refresh. Your data isn't gone.");
      if (isManualRefresh) showToast("Couldn't reach Zoho, check your connection.", "info");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  const handleRetrySync = useCallback(
    async (camp: Campaign) => {
      setRetryingCampaignId(camp.id);
      try {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_campaign_tasks",
            campaignId: camp.id,
            campaignName: camp.name,
            tasks: camp.tasks,
          }),
        });
        if (res.ok) {
          showToast("Re-sync webhook fired, polling for the Zoho deal ID…", "info");
          // Poll Supabase for deal ID writeback
          for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 3000));
            const check = await fetch(`/api/campaigns?action=get_campaign&id=${camp.id}`);
            if (check.ok) {
              const json = await check.json();
              if (json.campaign?.zohoCrmDealId) {
                showToast(`✅ Synced! Zoho Deal ID: ${json.campaign.zohoCrmDealId}`, "check");
                fetchCampaigns();
                setRetryingCampaignId(null);
                return;
              }
            }
          }
          showToast("Re-sync is in progress. Zoho can take up to 2 minutes on first approval. Check back shortly.", "info");
        } else {
          showToast("Re-sync request failed. Try again.", "info");
        }
      } catch {
        showToast("Re-sync failed, network error", "info");
      } finally {
        setRetryingCampaignId(null);
      }
    },
    [showToast, fetchCampaigns]
  );

  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);

  const handleDeleteCampaign = useCallback(
    async (camp: Campaign) => {
      // Open branded confirmation modal instead of window.confirm
      setDeleteConfirmCamp(camp);
    },
    []
  );

  const executeDeleteCampaign = useCallback(
    async (camp: Campaign) => {
      setDeleteConfirmCamp(null);
      setDeletingCampaignId(camp.id);
      showToast(`Deleting "${camp.name}" across Zoho CRM, Projects & Books...`, "info");
      try {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_campaign",
            campaignId: camp.id,
          }),
        });
        if (res.ok) {
          setCampaigns((prev) => prev.filter((c) => c.id !== camp.id));
          showToast(`Deleted "${camp.name}" from Prism & Zoho`, "check");
        } else {
          showToast("Couldn't delete this campaign. Try again or remove it directly in Zoho.", "info");
        }
      } catch {
        showToast("Network error while deleting the campaign. Check your connection.", "info");
      } finally {
        setDeletingCampaignId(null);
      }
    },
    [showToast]
  );

  // Discard a DRAFT campaign card, deletes the Supabase row only.
  // Drafts were never pushed to Zoho, so no Zoho delete webhook is involved.
  const handleDiscardDraft = useCallback(
    async (camp: Campaign) => {
      // Open branded confirmation modal instead of window.confirm
      setDiscardConfirmCamp(camp);
    },
    []
  );

  const executeDiscardDraft = useCallback(
    async (camp: Campaign) => {
      setDiscardConfirmCamp(null);
      setDeletingCampaignId(camp.id);
      try {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "discard_draft",
            campaignId: camp.id,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setCampaigns((prev) => prev.filter((c) => c.id !== camp.id));
          showToast(`Draft "${camp.name}" discarded, Zoho untouched`, "check");
        } else {
          showToast(data.error || "Couldn't discard the draft. Try again.", "info");
        }
      } catch {
        showToast("Network error while discarding the draft. Check your connection.", "info");
      } finally {
        setDeletingCampaignId(null);
      }
    },
    [showToast]
  );

  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editVolume, setEditVolume] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEditModal = (camp: Campaign) => {
    setEditingCampaign(camp);
    setEditName(camp.name);
    setEditBudget(camp.budget);
    setEditVolume(camp.codeVolume);
  };

  const handleSaveCampaignEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign || !editName.trim()) return;
    setIsSavingEdit(true);
    const isDraft = editingCampaign.status === "Draft" || !editingCampaign.zohoCrmDealId;
    showToast(
      isDraft
        ? `Saving updates for draft "${editName}" locally...`
        : `Saving updates for "${editName}" across Zoho CRM, Projects & Books...`,
      "info"
    );
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_live_campaign",
          campaignId: editingCampaign.id,
          dealId: editingCampaign.zohoCrmDealId,
          projectId: editingCampaign.zohoProjectId,
          invoiceId: editingCampaign.zohoBooksInvoiceId,
          newName: editName.trim(),
          newBudget: editBudget.trim(),
          newVolume: editVolume.trim(),
          tasks: editingCampaign.tasks,
          rewardType: editingCampaign.rewardType,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const reallyDraft = isDraft || data.skipped === "draft_not_synced";
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === editingCampaign.id
              ? {
                  ...c,
                  name: editName.trim(),
                  budget: editBudget.trim(),
                  codeVolume: editVolume.trim(),
                  ...(reallyDraft
                    ? {}
                    : { lastZohoSync: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) }),
                }
              : c
          )
        );
        showToast(
          reallyDraft
            ? `✨ Draft "${editName}" updated locally. Approve to sync it to Zoho`
            : `✨ Updated "${editName}" across Zoho CRM, Projects, and Books!`,
          "check"
        );
        setEditingCampaign(null);
      } else {
        showToast(data.error || "Couldn't save changes. If this keeps happening, it's a connection problem on our end.", "info");
      }
    } catch {
      showToast("Couldn't save changes. Check your connection and try again.", "info");
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const demoPresets = [
    {
      label: "Cadbury Silk Valentine Pool",
      name: "Mondelez Cadbury Silk Valentine's ₹100 Assured Cashback",
      client: "Mondelez India Foods Pvt Ltd",
      category: "FMCG",
      rewardType: "Cashback",
      budget: "₹35,00,000",
      codeVolume: "350,000 packs",
      brief: "Valentine season on-pack campaign with unique QR code inside pack. Users scan, verify mobile via OTP, and receive instant ₹100 UPI transfer.",
    },
    {
      label: "Pepsi UEFA Zomato Pass",
      name: "Pepsi UEFA Champions League ₹200 Zomato Dining Pass",
      client: "PepsiCo India Holdings",
      category: "Beverages",
      rewardType: "EGV",
      budget: "₹50,00,000",
      codeVolume: "500,000 cans",
      brief: "Co-branded soccer tournament promotion offering ₹200 Zomato Dineout voucher with purchase of 2 Pepsi Max cans.",
    },
    {
      label: "Tata Tea Gold Amazon EGV",
      name: "Tata Tea Gold ₹50 Amazon Pay Assured Reward",
      client: "Tata Consumer Products",
      category: "FMCG",
      rewardType: "EGV",
      budget: "₹20,00,000",
      codeVolume: "200,000 packs",
      brief: "Festive morning tea reward with instant Amazon Pay gift card code delivered via SMS post verification.",
    },
  ];

  const handleApplyPreset = (preset: typeof demoPresets[0]) => {
    setFormData({ ...formData, ...preset });
  };

  const handleRegisterBooksInWizard = async () => {
    if (!formData.client) return;
    setIsRegisteringBooks(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_books_contact",
          client: formData.client,
          companyName: wizardBooksContact?.suggestedName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.contactId) {
          setWizardBooksContact({
            exists: true,
            contactId: data.contactId,
            contactName: data.contactName,
          });
          showToast(`Registered ${data.contactName || formData.client} in Zoho Books!`, "check");
          return;
        }
      }
      showToast("Could not register customer in Zoho Books", "info");
    } catch (e) {
      console.error("Failed to register Books contact:", e);
      showToast("Failed to connect to Zoho Books", "info");
    } finally {
      setIsRegisteringBooks(false);
    }
  };

  const handleStartAIGeneration = async () => {
    if (!formData.name || !formData.client) return;
    setWizardStep("ai_generating");
    setGenerationProgress(10);

    const interval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 90) { clearInterval(interval); return 90; }
        return prev + 20;
      });
    }, 300);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_plan", campaignInput: formData }),
      });
      const data = await res.json();
      clearInterval(interval);
      setGenerationProgress(100);
      setTimeout(() => {
        const plan = data.plan || generateAspectPlan(formData);
        setGeneratedPlan(plan);
        if (data.booksContact) {
          setWizardBooksContact(data.booksContact);
        }
        const initialAssistantContent = data.aiAnalysis
          ? `I've analyzed **${formData.name}** and generated the 4-aspect plan:\n\n${data.aiAnalysis}\n\nYou can review all tasks on the left. Let me know if you'd like to refine any deadlines or add specific requirements.`
          : "I've drafted a 4-aspect plan based on your inputs. You can review the tasks on the left. Let me know if you need to add, remove, or modify any tasks before we approve & sync to Zoho.";

        setChatMessages([
          {
            id: `msg-${Date.now()}-assistant`,
            role: "assistant",
            content: initialAssistantContent,
            timestamp: new Date(),
          },
        ]);
        setWizardStep("plan_review");
        showToast(`AI generated 4-aspect plan with ${plan.tasks.length} tasks`, "sparkle");
      }, 500);
    } catch {
      clearInterval(interval);
      const plan = generateAspectPlan(formData);
      setGeneratedPlan(plan);
      setChatMessages([
        {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: "I've drafted a 4-aspect plan based on your inputs. You can review the tasks on the left. Let me know if you need to add, remove, or modify any tasks before we approve & sync to Zoho.",
          timestamp: new Date(),
        },
      ]);
      setWizardStep("plan_review");
      showToast(`AI generated 4-aspect plan with ${plan.tasks.length} tasks`, "sparkle");
    }
  };

  const handlePlanChat = (text: string) => {
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    fetch("/api/ai/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        activePlan: generatedPlan
          ? {
              campaignData: formData,
              tasks: generatedPlan.tasks,
              status: "draft",
            }
          : undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsChatLoading(false);
        if (data.intent === "PLAN_MODIFY" && data.campaignData) {
          if (data.tasks && data.tasks.length > 0) {
            setGeneratedPlan((prev) =>
              prev
                ? {
                    ...prev,
                    tasks: data.tasks,
                  }
                : null
            );
          }
          setFormData((prev: any) => ({ ...prev, ...data.campaignData }));
          showToast(`Plan updated with AI: ${(data.modifiedTaskIds || []).length} tasks updated`, "sparkle");

          const assistantMsg: Message = {
            id: `msg-${Date.now()}-assistant`,
            role: "assistant",
            content: data.summaryMarkdown || "✨ Campaign plan updated successfully.",
            timestamp: new Date(),
          };
          setChatMessages((prev) => [...prev, assistantMsg]);
        } else {
          const assistantMsg: Message = {
            id: `msg-${Date.now()}-assistant`,
            role: "assistant",
            content:
              data.reasoning ||
              `I've analyzed your instruction for **${formData.name}**. You can specify exact campaign or task modifications, or click **Open in Copilot** for split-screen studio editing.`,
            timestamp: new Date(),
          };
          setChatMessages((prev) => [...prev, assistantMsg]);
        }
      })
      .catch((err) => {
        setIsChatLoading(false);
        console.warn("AI plan modification failed:", err);
      });
  };

  const handleApproveAndPushToZoho = async () => {
    if (!generatedPlan) return;
    setWizardStep("zoho_pushing");
    // Approval modal stays open with a syncing spinner while the push runs
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_and_push_zoho",
          campaignData: formData,
          tasks: generatedPlan.tasks,
          booksCustomerId: wizardBooksContact?.contactId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.campaign) {
        setTimeout(() => {
          setCreatedCampaign(data.campaign);
          setCampaigns((prev) => [data.campaign, ...prev]);
          setWizardStep("push_success");
          setIsApprovalModalOpen(false);
          setIsNewModalOpen(true);
          showToast(`Approved & Synced to Zoho`, "check");
        }, 1200);
      } else {
        showToast(data.error || "Couldn't sync to Zoho. Your plan is preserved so you can retry.", "info");
        setWizardStep("plan_review");
        setIsApprovalModalOpen(false);
        setIsNewModalOpen(true);
      }
    } catch (e) {
      console.error("Failed to sync to Zoho", e);
      showToast("Couldn't sync to Zoho. Your plan is preserved so you can retry.", "info");
      setWizardStep("plan_review");
      setIsApprovalModalOpen(false);
      setIsNewModalOpen(true);
    }
  };

  // Save the reviewed plan as a DRAFT, Supabase only, nothing pushed to Zoho
  const handleSavePlanAsDraft = async () => {
    if (!generatedPlan) return;
    setIsSavingDraft(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          campaignData: formData,
          tasks: generatedPlan.tasks,
          booksCustomerId: wizardBooksContact?.contactId,
        }),
      });
      const data = await res.json();
      if (data.campaign) {
        setCampaigns((prev) => [data.campaign, ...prev.filter((c) => c.id !== data.campaign.id)]);
        showToast("Draft saved. Nothing is pushed to Zoho. Approve it later from this list.", "info");
        handleResetModal();
      } else {
        showToast(data.error || "Failed to save draft", "info");
      }
    } catch (e) {
      console.error("Failed to save draft", e);
      showToast("Couldn't save the draft. Check your network.", "info");
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Approve an existing DRAFT campaign card, opens the review modal before any Zoho write
  const handleApproveDraftFromCard = async () => {
    if (!draftToApprove) return;
    setApprovingDraftId(draftToApprove.id);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_and_push_zoho",
          campaignId: draftToApprove.id,
          campaignData: {
            name: draftToApprove.name,
            client: draftToApprove.client,
            category: draftToApprove.category,
            rewardType: draftToApprove.rewardType,
            budget: draftToApprove.budget,
            codeVolume: draftToApprove.codeVolume,
            startDate: draftToApprove.startDate,
            endDate: draftToApprove.endDate,
            brief: draftToApprove.brief,
          },
          tasks: draftToApprove.tasks,
          booksCustomerId: draftToApprove.booksCustomerId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.campaign) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === data.campaign.id ? data.campaign : c))
        );
        showToast(data.alreadySynced ? "Campaign was already approved & synced to Zoho" : "Approved & Synced to Zoho", "check");
        setIsApprovalModalOpen(false);
        setDraftToApprove(null);
        setDraftBooksContact(null);
      } else {
        showToast(data.error || "Failed to sync to Zoho", "info");
        setIsApprovalModalOpen(false);
        setDraftToApprove(null);
        setDraftBooksContact(null);
      }
    } catch (e) {
      console.error("Failed to sync draft to Zoho", e);
      showToast("Failed to sync to Zoho", "info");
      setIsApprovalModalOpen(false);
      setDraftToApprove(null);
      setDraftBooksContact(null);
    } finally {
      setApprovingDraftId(null);
    }
  };

  const handleResetModal = () => {
    setIsNewModalOpen(false);
    setWizardStep("input");
    setGenerationProgress(0);
    setGeneratedPlan(null);
    setWizardBooksContact(null);
    setCreatedCampaign(null);
    setChatMessages([]);
    setFormData({
      name: "",
      client: "",
      category: "FMCG",
      rewardType: "Cashback",
      budget: "₹25,00,000",
      codeVolume: "250,000 packs",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
      brief: "",
    });
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.zohoProjectId && c.zohoProjectId.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (selectedFilter === "Live") return c.status.includes("Live");
    if (selectedFilter === "Planning") return c.status === "Planning" || c.status === "Draft";
    if (selectedFilter === "In Review") return c.status === "In Review";
    return true;
  });

  const aspectColors = {
    legal: "text-violet-700 bg-violet-50 border-violet-200",
    compliance: "text-amber-700 bg-amber-50 border-amber-200",
    accounting: "text-emerald-700 bg-emerald-50 border-emerald-200",
    implementation: "text-sky-700 bg-sky-50 border-sky-200",
  };

  const getStatusStyles = (status: string) => {
    if (status.includes("Live")) return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (status === "In Review") return "bg-amber-50 text-amber-800 border-amber-200";
    if (status === "Draft") return "bg-stone-100 text-stone-700 border-stone-300";
    return "bg-stone-100 text-stone-600 border-stone-200";
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAFAF9] relative">
      {/* Top Floating Toast Notification */}
      <AnimatePresence>
        {toastNotice && (
          <motion.div
            key={toastNotice.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold shadow-xl flex items-center gap-2.5 border border-stone-700/80 backdrop-blur-md"
          >
            {toastNotice.icon === "sparkle" ? (
              <Sparkle size={14} weight="fill" className="text-amber-400 flex-shrink-0" />
            ) : (
              <CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0" />
            )}
            <span>{toastNotice.text}</span>
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="ml-1 text-stone-400 hover:text-white cursor-pointer"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Approval gate modal, the ONLY path to a Zoho push from this view */}
      <ApprovalModal
        open={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setDraftToApprove(null);
          setDraftBooksContact(null);
        }}
        campaignData={draftToApprove || formData}
        tasks={draftToApprove?.tasks || generatedPlan?.tasks || []}
        booksContact={draftToApprove ? draftBooksContact : wizardBooksContact}
        isPushing={wizardStep === "zoho_pushing" || approvingDraftId !== null}
        source={draftToApprove ? "Draft campaign card" : "New campaign wizard"}
        onConfirm={() => {
          if (draftToApprove) {
            handleApproveDraftFromCard();
          } else {
            handleApproveAndPushToZoho();
          }
        }}
      />

      {/* Top Header */}
      <header className="h-14 border-b border-stone-200/70 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-stone-900 tracking-tight">
            Campaigns
          </h1>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
            {campaigns.length} total
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setIsRefreshing(true);
              try {
                const res = await fetch("/api/campaigns", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "validate_and_sync" }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setCampaigns(data.campaigns || []);
                  if (data.deleted > 0) {
                    showToast(`Synced with Zoho CRM · Removed ${data.deleted} deleted deals · ${data.validated} active`, "info");
                  } else {
                    showToast(`Live sync complete · All ${data.validated} Zoho CRM deals verified`, "check");
                  }
                }
              } catch {
                showToast("Validation sync failed", "info");
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200 shadow-2xs transition-all duration-200 cursor-pointer"
            title="Fetch live records from Zoho CRM"
          >
            <ArrowsClockwise size={13} weight="bold" className={isRefreshing ? "animate-spin text-amber-600" : ""} />
            <span>{isRefreshing ? "Syncing..." : "Sync Zoho"}</span>
          </button>

          <button
            type="button"
            onClick={() => { setWizardStep("input"); setIsNewModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer"
          >
            <Plus size={14} weight="bold" />
            <span>New Campaign</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Search + Filter, floats directly on background */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-96">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search campaigns, clients…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-stone-800 placeholder-stone-400 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {(["All", "Live", "In Review", "Planning"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  selectedFilter === filter
                    ? "bg-stone-900 text-white shadow-sm"
                    : "bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-stone-200"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Load error banner, shown when initial fetch fails (not just manual refresh) */}
        <AnimatedErrorBanner
          show={!!loadError && !isLoading}
          severity="error"
          title="Couldn't load your campaigns"
          description={loadError ?? ""}
          action={{
            label: "Retry",
            onClick: () => { setLoadError(null); fetchCampaigns(); },
            isLoading: isLoading,
          }}
          onDismiss={() => setLoadError(null)}
          className="mb-4"
        />

        {/* Content Area: Loading / Empty / Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="p-5 rounded-2xl bg-white border border-stone-200 animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-stone-200 rounded" />
                  <div className="h-4 w-16 bg-stone-200 rounded" />
                </div>
                <div className="h-5 w-3/4 bg-stone-200 rounded" />
                <div className="h-3 w-1/2 bg-stone-100 rounded" />
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="h-10 bg-stone-50 rounded-lg" />
                  <div className="h-10 bg-stone-50 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-stone-200/80 shadow-xs my-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
              <Megaphone size={28} weight="duotone" />
            </div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight mb-1">
              {searchQuery || selectedFilter !== "All"
                ? "No Matching Campaigns"
                : "No Active Campaigns in Zoho CRM"}
            </h3>
            <p className="text-xs text-stone-500 max-w-md mb-6 leading-relaxed">
              {searchQuery || selectedFilter !== "All"
                ? "Try adjusting your search query or status filter."
                : "Your connected Zoho CRM workspace currently has 0 campaigns or deals. Generate a bespoke 4-aspect campaign plan with AI or create a new brief."}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setWizardStep("input"); setIsNewModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer"
              >
                <Plus size={14} weight="bold" />
                <span>New Campaign</span>
              </button>
              <button
                type="button"
                onClick={() => fetchCampaigns(true)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all duration-200 cursor-pointer border border-stone-200"
              >
                <ArrowsClockwise size={13} weight="bold" className={isRefreshing ? "animate-spin" : ""} />
                <span>Refresh from Zoho</span>
              </button>
            </div>
          </div>
        ) : (
          /* Campaigns Grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCampaigns.map((camp, idx) => {
              const isLive = camp.status.includes("Live");
              const totalTasks = camp.tasks?.length || 0;
              const legalSummary = `${camp.aspectSummary?.legal?.done || 0}/${camp.aspectSummary?.legal?.total || 3}`;
              const complianceSummary = `${camp.aspectSummary?.compliance?.done || 0}/${camp.aspectSummary?.compliance?.total || 3}`;
              const accountingSummary = `${camp.aspectSummary?.accounting?.done || 0}/${camp.aspectSummary?.accounting?.total || 3}`;
              const techSummary = `${camp.aspectSummary?.implementation?.done || 0}/${camp.aspectSummary?.implementation?.total || 4}`;

              return (
                <motion.div
                  key={camp.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -1 }}
                  className="p-5 rounded-2xl bg-white border border-stone-200/80 hover:border-amber-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-default"
                >
                  <div>
                    {/* Top Row: Campaign label, status, Zoho ID */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">
                          #{idx + 1}
                        </span>
                        <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${getStatusStyles(camp.status)}`}>
                          {camp.status}
                        </span>
                      </div>

                      {camp.zohoProjectId && (
                        <button
                          type="button"
                          onClick={() => setSelectedCampaignForDrawer(camp)}
                          className="inline-flex items-center gap-1 text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          <Kanban size={11} weight="fill" />
                          <span>{camp.zohoProjectId}</span>
                          <CaretRight size={10} weight="bold" className="text-emerald-500" />
                        </button>
                      )}
                    </div>

                    {/* Title & Client */}
                    <div className="mb-3">
                      <h3 className="text-sm font-bold text-stone-900 leading-snug line-clamp-2">
                        {camp.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-[11.5px] text-stone-500">
                        <span className="font-semibold text-stone-700">{camp.client}</span>
                        <span className="text-stone-300">·</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                          {camp.rewardType}
                        </span>
                      </div>
                    </div>

                    {/* 2-Metric Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3.5">
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                        <span className="text-[10px] text-stone-400 font-medium block uppercase tracking-wider">
                          Budget
                        </span>
                        <span className="text-xs font-bold text-stone-900 font-mono">
                          {camp.budget}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                        <span className="text-[10px] text-stone-400 font-medium block uppercase tracking-wider">
                          Code Volume
                        </span>
                        <span className="text-xs font-bold text-stone-900 font-mono truncate block">
                          {camp.codeVolume}
                        </span>
                      </div>
                    </div>

                    {/* Aspect Breakdown Pills */}
                    <div className="flex items-center gap-1.5 text-[11px] mb-3 flex-wrap">
                      <span>
                        <span className="text-stone-500 font-medium">Legal</span>{" "}
                        <span className={camp.aspectSummary?.legal?.done === camp.aspectSummary?.legal?.total ? "text-emerald-600" : "text-stone-400"}>
                          {legalSummary}
                        </span>
                      </span>
                      <span className="text-stone-200">·</span>
                      <span>
                        <span className="text-stone-500 font-medium">Compliance</span>{" "}
                        <span className={camp.aspectSummary?.compliance?.done === camp.aspectSummary?.compliance?.total ? "text-emerald-600" : "text-stone-400"}>
                          {complianceSummary}
                        </span>
                      </span>
                      <span className="text-stone-200">·</span>
                      <span>
                        <span className="text-stone-500 font-medium">Accounting</span>{" "}
                        <span className={camp.aspectSummary?.accounting?.done === camp.aspectSummary?.accounting?.total ? "text-emerald-600" : "text-stone-400"}>
                          {accountingSummary}
                        </span>
                      </span>
                      <span className="text-stone-200">·</span>
                      <span>
                        <span className="text-stone-500 font-medium">Tech</span>{" "}
                        <span className={camp.aspectSummary?.implementation?.done === camp.aspectSummary?.implementation?.total ? "text-emerald-600" : "text-stone-400"}>
                          {techSummary}
                        </span>
                      </span>
                    </div>


                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-stone-400 font-mono">
                      {camp.zohoSyncStatus === "Synced"
                        ? `Synced ${camp.lastZohoSync || "recently"}`
                        : camp.zohoSyncStatus === "Pending"
                        ? "⏳ Pending Zoho sync"
                        : camp.zohoSyncStatus === "Partial"
                        ? `Partial · ${camp.lastZohoSync || "recently"}`
                        : "Not synced"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {camp.status === "Draft" && !camp.zohoCrmDealId && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftToApprove(camp);
                            if (camp.booksCustomerId) {
                              setDraftBooksContact({
                                exists: true,
                                contactId: camp.booksCustomerId,
                                contactName: camp.client,
                              });
                            } else {
                              setDraftBooksContact(null);
                              fetch("/api/campaigns", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "check_books_contact", client: camp.client }),
                              })
                                .then((r) => r.json())
                                .then((d) => {
                                  if (d.exists && d.contact) {
                                    setDraftBooksContact({
                                      exists: true,
                                      contactId: d.contact.contactId,
                                      contactName: d.contact.contactName,
                                    });
                                  } else {
                                    setDraftBooksContact({ exists: false });
                                  }
                                })
                                .catch(() => {});
                            }
                            setIsApprovalModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm"
                          title="Review this draft and approve it to create the Zoho CRM Deal, Project & Invoice"
                        >
                          <CheckCircle size={13} weight="fill" />
                          <span>Approve & Push</span>
                        </button>
                      )}
                      {camp.zohoSyncStatus === "Pending" && camp.status !== "Draft" && (
                        <button
                          type="button"
                          disabled={retryingCampaignId === camp.id}
                          onClick={() => handleRetrySync(camp)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-all duration-200 cursor-pointer border border-amber-200 shadow-2xs disabled:opacity-50"
                          title="Re-fire the Zoho sync webhook and poll for deal ID"
                        >
                          <ArrowsClockwise
                            size={13}
                            weight="bold"
                            className={retryingCampaignId === camp.id ? "animate-spin" : ""}
                          />
                          <span>{retryingCampaignId === camp.id ? "Syncing…" : "Retry Sync"}</span>
                        </button>
                      )}
                      {onModifyInCopilot && (
                        <button
                          type="button"
                          onClick={() =>
                            onModifyInCopilot(camp, {
                              tasks: camp.tasks || [],
                              aspectSummary: camp.aspectSummary,
                            })
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-all duration-200 cursor-pointer border border-stone-200 shadow-2xs"
                          title="Open in Copilot Studio to reassign owners and adjust tasks"
                        >
                          <Sparkle size={13} weight="fill" className="text-amber-500" />
                          <span>Open in Copilot</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedCampaignForDrawer(camp)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm"
                      >
                        <Kanban size={13} weight="bold" />
                        <span>View Plan · {totalTasks} tasks</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(camp)}
                        className="p-2 rounded-xl bg-stone-100 hover:bg-amber-50 text-stone-400 hover:text-amber-600 transition-colors cursor-pointer border border-stone-200 shadow-2xs"
                        title="Edit campaign & sync across Zoho CRM, Projects, and Books"
                      >
                        <PencilSimple size={13} weight="bold" />
                      </button>

                      <button
                        type="button"
                        disabled={deletingCampaignId === camp.id}
                        onClick={() =>
                          camp.status === "Draft" && !camp.zohoCrmDealId
                            ? handleDiscardDraft(camp)
                            : handleDeleteCampaign(camp)
                        }
                        className="p-2 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer border border-stone-200 shadow-2xs disabled:opacity-50"
                        title={
                          camp.status === "Draft" && !camp.zohoCrmDealId
                            ? "Discard draft (removes the local plan only, no Zoho records exist)"
                            : "Delete campaign across Zoho CRM, Projects, Books & Database"
                        }
                      >
                        {deletingCampaignId === camp.id ? (
                          <ArrowsClockwise size={13} weight="bold" className="animate-spin text-rose-600" />
                        ) : (
                          <Trash size={13} weight="bold" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW CAMPAIGN MODAL */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div key="campaign-modal" className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleResetModal}
              className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`relative w-full ${wizardStep === "plan_review" ? "max-w-6xl h-[85vh]" : "max-w-3xl max-h-[90vh]"} bg-white rounded-2xl shadow-xl overflow-hidden z-10 border border-stone-200 flex flex-col transition-all duration-300`}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-sm">
                    <Sparkle size={16} weight="fill" className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-stone-900">
                      {wizardStep === "input" && "New Campaign"}
                      {wizardStep === "ai_generating" && "AI Generating Plan…"}
                      {wizardStep === "plan_review" && "Review & Approve Plan"}
                      {wizardStep === "zoho_pushing" && "Pushing to Zoho…"}
                      {wizardStep === "push_success" && "Campaign Live!"}
                    </h3>
                    <p className="text-xs text-stone-500">
                      Step {wizardStep === "input" ? "1" : wizardStep === "plan_review" ? "2" : "3"} of 3 · BigCity SOP Intelligence
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetModal}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={17} weight="bold" />
                </button>
              </div>

              {/* Modal Body */}
              <div className={`flex-1 min-h-0 flex flex-col ${wizardStep === "plan_review" ? "p-0 overflow-hidden" : "p-6 overflow-y-auto space-y-5"}`}>
                {/* STEP 1: INPUT */}
                {wizardStep === "input" && (
                  <div className="space-y-4">
                    {/* Demo Presets */}
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                          <Lightning size={12} weight="fill" className="text-amber-600" />
                          Quick Demo Presets
                        </span>
                        <span className="text-[10px] text-amber-600 font-medium">Click to auto-fill</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {demoPresets.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => handleApplyPreset(preset)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 text-[11px] font-semibold border border-amber-200 transition-all cursor-pointer shadow-sm"
                          >
                            + {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">Campaign Name *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Cadbury Silk Valentine's ₹100 Cashback"
                          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">Client / Brand *</label>
                        <input
                          type="text"
                          value={formData.client}
                          onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                          placeholder="e.g. Mondelez India Foods"
                          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">Reward Mechanism</label>
                        <select
                          value={formData.rewardType}
                          onChange={(e) => setFormData({ ...formData, rewardType: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                        >
                          <option value="Cashback">Assured UPI Cashback</option>
                          <option value="EGV">Digital EGV (Swiggy / Amazon / Zomato)</option>
                          <option value="Scratch & Win">Scratch & Win Lucky Draw</option>
                          <option value="Merchandise">Physical Merchandise</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">Total Pool Budget</label>
                        <input
                          type="text"
                          value={formData.budget}
                          onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                          placeholder="₹25,00,000"
                          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">Pack / Code Volume</label>
                        <input
                          type="text"
                          value={formData.codeVolume}
                          onChange={(e) => setFormData({ ...formData, codeVolume: e.target.value })}
                          placeholder="250,000 packs"
                          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Start Date</label>
                          <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            className="w-full px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1.5">End Date</label>
                          <input
                            type="date"
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            className="w-full px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">Campaign Brief</label>
                      <textarea
                        rows={3}
                        value={formData.brief}
                        onChange={(e) => setFormData({ ...formData, brief: e.target.value })}
                        placeholder="Describe campaign mechanics, redemption flow, client constraints…"
                        className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: AI GENERATING */}
                {wizardStep === "ai_generating" && (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-5">
                    <div className="relative w-16 h-16 rounded-2xl bg-stone-900 flex items-center justify-center shadow-lg">
                      <Sparkle size={30} weight="fill" className="text-amber-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-stone-900">Synthesizing 4-Aspect Plan…</h4>
                      <p className="text-xs text-stone-500 max-w-md mt-1.5 leading-relaxed">
                        Analyzing BigCity SOP precedents for Legal clearances, DLT compliance, Zoho Books advance verification, and tech failover setup.
                      </p>
                    </div>
                    <div className="w-full max-w-sm space-y-2">
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-amber-500 rounded-full"
                          animate={{ width: `${generationProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono">
                        <span>Legal & Compliance</span>
                        <span>Escrow & Accounting</span>
                        <span>Tech & QR</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: PLAN REVIEW */}
                {wizardStep === "plan_review" && generatedPlan && (
                  <div className="flex flex-col h-full min-h-0 flex-1 bg-white overflow-hidden">
                    {/* Plan Summary Bar */}
                    <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between flex-shrink-0 bg-stone-50/50">
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            Draft AI Plan
                          </span>
                          <span className="text-[11px] text-stone-500">
                            {formData.client} · {formData.budget} · {formData.codeVolume}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-stone-900 truncate">
                          {formData.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg bg-white text-emerald-800 border border-emerald-200 shadow-xs flex items-center gap-1.5">
                          <Clock size={13} weight="bold" />
                          Recommended TAT: 12 Working Days
                        </span>
                      </div>
                    </div>

                    {/* Zoho Books Customer Pre-Flight Notice */}
                    {wizardBooksContact && !wizardBooksContact.exists && (
                      <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between gap-3 flex-shrink-0">
                        <div className="flex items-center gap-2 text-xs text-amber-900">
                          <Receipt size={16} className="text-amber-700 flex-shrink-0" />
                          <span>
                            Client <strong>{formData.client}</strong> is not yet registered in Zoho Books.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRegisterBooksInWizard}
                          disabled={isRegisteringBooks}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                        >
                          {isRegisteringBooks ? (
                            <>
                              <CircleNotch size={13} className="animate-spin" />
                              <span>Registering…</span>
                            </>
                          ) : (
                            <>
                              <Sparkle size={13} weight="fill" />
                              <span>Register in Zoho Books</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    {wizardBooksContact && wizardBooksContact.exists && (
                      <div className="px-6 py-2 bg-emerald-50/80 border-b border-emerald-200/60 flex items-center gap-2 text-xs text-emerald-800 flex-shrink-0">
                        <CheckCircle size={15} weight="fill" className="text-emerald-600" />
                        <span>
                          Zoho Books customer verified: <strong>{wizardBooksContact.contactName || formData.client}</strong> ({wizardBooksContact.contactId})
                        </span>
                      </div>
                    )}

                    {/* Aspect Summary Filter Badges */}
                    <div className="px-6 py-2.5 border-b border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0 bg-white">
                      {[
                        {
                          key: "legal" as const,
                          label: `Legal (${generatedPlan.tasks.filter((t) => t.aspect === "legal").length} Tasks)`,
                          desc: "T&C & Consents",
                          meta: ASPECT_META.legal,
                        },
                        {
                          key: "compliance" as const,
                          label: `Compliance (${generatedPlan.tasks.filter((t) => t.aspect === "compliance").length} Tasks)`,
                          desc: "DLT & 72h UAT",
                          meta: ASPECT_META.compliance,
                        },
                        {
                          key: "accounting" as const,
                          label: `Accounting (${generatedPlan.tasks.filter((t) => t.aspect === "accounting").length} Tasks)`,
                          desc: "100% Adv Payment",
                          meta: ASPECT_META.accounting,
                        },
                        {
                          key: "implementation" as const,
                          label: `Tech (${generatedPlan.tasks.filter((t) => t.aspect === "implementation").length} Tasks)`,
                          desc: "DNS & Failover",
                          meta: ASPECT_META.implementation,
                        },
                      ].map((asp) => {
                        const Icon = asp.meta.icon;
                        const isSelected = wizardAspectFilter === asp.key;
                        return (
                          <button
                            key={asp.key}
                            type="button"
                            onClick={() =>
                              setWizardAspectFilter(
                                isSelected ? "all" : asp.key
                              )
                            }
                            className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? `${asp.meta.badge} ring-2 ring-stone-900/10 shadow-xs scale-[1.01]`
                                : "border-stone-200/80 bg-stone-50/60 hover:bg-stone-100/80 text-stone-700"
                            }`}
                          >
                            <Icon
                              size={14}
                              weight="duotone"
                              className={isSelected ? asp.meta.light : "text-stone-400"}
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold block truncate">
                                {asp.label}
                              </span>
                              <span className="text-[9.5px] opacity-75 block truncate">
                                {asp.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Task list */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <div className="divide-y divide-stone-100">
                        <AnimatePresence>
                          {generatedPlan.tasks
                            .filter(
                              (t) =>
                                wizardAspectFilter === "all" ||
                                t.aspect === wizardAspectFilter
                            )
                            .map((task, i) => {
                            const meta = ASPECT_META[task.aspect as keyof typeof ASPECT_META] || ASPECT_META.implementation;
                            const Icon = meta.icon;

                            return (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.03 }}
                                className={`flex items-center gap-3 px-6 py-3.5 hover:bg-stone-50/60 transition-colors border-l-2 ${meta.border}`}
                              >
                                {/* Aspect icon */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                                  <Icon size={14} weight="duotone" className={meta.light} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[13px] font-semibold text-stone-900 block truncate">
                                      {task.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10.5px] text-stone-500">
                                    <span className={`font-semibold ${meta.light}`}>{meta.label}</span>
                                    <Dot size={8} className="text-stone-300" />
                                    <span className="flex items-center gap-1">
                                      <User size={11} className="text-stone-400" />
                                      {task.assignee}
                                      {task.role ? ` (${task.role})` : ""}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                                  <span className="text-[10.5px] text-stone-500 font-mono flex items-center gap-1">
                                    <Clock size={11} className="text-stone-400" /> {task.tat}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: PUSHING */}
                {wizardStep === "zoho_pushing" && (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <ArrowsClockwise size={28} weight="bold" className="animate-spin" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-stone-900">Syncing to Zoho…</h4>
                      <p className="text-xs text-stone-500 max-w-sm mt-1.5 leading-relaxed">
                        Creating Deal in Zoho CRM, building 4 milestone aspects, and syncing all tasks with assignees & due dates.
                      </p>
                    </div>
                  </div>
                )}

                {/* STEP 5: SUCCESS */}
                {wizardStep === "push_success" && createdCampaign && (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                      <CheckCircle size={34} weight="fill" />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        LIVE · Zoho
                      </span>
                      <h4 className="text-lg font-bold text-stone-900 mt-2 max-w-md">{createdCampaign.name}</h4>
                      <p className="text-xs text-stone-500 max-w-md mt-1.5 leading-relaxed">
                        Synced to Zoho with 4 milestone aspects and all tasks initialized. Live synchronization active.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => { setIsNewModalOpen(false); setSelectedCampaignForDrawer(createdCampaign); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition-all"
                      >
                        <Kanban size={14} weight="bold" />
                        <span>Open Campaign Tasks</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetModal}
                        className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-all"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50/60 flex items-center justify-between flex-shrink-0">
                {wizardStep === "input" && (
                  <>
                    <button
                      type="button"
                      onClick={handleResetModal}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleStartAIGeneration}
                      disabled={!formData.name || !formData.client}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-stone-900 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <Sparkle size={14} weight="fill" className="text-amber-400" />
                      <span>Generate AI Aspect Plan</span>
                    </button>
                  </>
                )}

                {wizardStep === "plan_review" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setWizardStep("input")}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleSavePlanAsDraft}
                        disabled={isSavingDraft}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 text-xs font-semibold transition-all cursor-pointer border border-stone-200"
                        title="Save this plan as a draft. Nothing is pushed to Zoho until you approve"
                      >
                        {isSavingDraft ? (
                          <CircleNotch size={13} className="animate-spin" />
                        ) : (
                          <FloppyDisk size={13} weight="bold" />
                        )}
                        <span>{isSavingDraft ? "Saving…" : "Save as Draft"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsNewModalOpen(false);
                          if (onModifyInCopilot) {
                            onModifyInCopilot(formData, generatedPlan);
                          }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer border border-stone-800"
                        title="Open interactive Copilot chat to modify tasks and adjust plan"
                      >
                        <Sparkle size={14} weight="fill" className="text-amber-400" />
                        <span>Open in Copilot</span>
                      </button>

                      {/* Approval gate: opens the review modal, push happens only after explicit confirmation */}
                      <button
                        type="button"
                        onClick={() => setIsApprovalModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                      >
                        <CheckCircle size={16} weight="fill" />
                        <span>Approve & Push to Zoho</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT CAMPAIGN MODAL */}
      <AnimatePresence>
        {editingCampaign && (
          <div key="edit-campaign-modal" className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSavingEdit && setEditingCampaign(null)}
              className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden z-10"
            >
              <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Edit Campaign</h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Syncs changes directly to Zoho CRM, Zoho Projects, and Zoho Books
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !isSavingEdit && setEditingCampaign(null)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveCampaignEdit}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-stone-900"
                      placeholder="e.g. Cadbury Silk Valentine's Special"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Budget / Invoice Total
                      </label>
                      <input
                        type="text"
                        value={editBudget}
                        onChange={(e) => setEditBudget(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-stone-900"
                        placeholder="e.g. ₹35,00,000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Code Volume
                      </label>
                      <input
                        type="text"
                        value={editVolume}
                        onChange={(e) => setEditVolume(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-stone-900"
                        placeholder="e.g. 350,000 packs"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 text-[11px] text-stone-600 space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-stone-800">
                      <Lightning size={13} className="text-amber-600" />
                      <span>Live Multi-App Sync Targets:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-500 pl-1">
                      <li>Zoho CRM Deal: {editingCampaign.zohoCrmDealId ? `ID: ${editingCampaign.zohoCrmDealId}` : "Linked"}</li>
                      <li>Zoho Projects: {editingCampaign.zohoProjectId ? `ID: ${editingCampaign.zohoProjectId}` : "Linked"}</li>
                      <li>Zoho Books Invoice: {editingCampaign.zohoBooksInvoiceId ? `ID: ${editingCampaign.zohoBooksInvoiceId}` : "Linked"}</li>
                    </ul>
                  </div>
                </div>

                <div className="px-6 py-3.5 border-t border-stone-100 bg-stone-50/50 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingCampaign(null)}
                    disabled={isSavingEdit}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit || !editName.trim()}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-amber-700 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingEdit ? (
                      <>
                        <ArrowsClockwise size={13} className="animate-spin text-amber-400" />
                        <span>Syncing to Zoho...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={13} weight="fill" className="text-emerald-400" />
                        <span>Save & Sync Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zoho Projects Drawer */}
      {selectedCampaignForDrawer && (
        <ZohoProjectsDrawer
          campaign={selectedCampaignForDrawer}
          isOpen={!!selectedCampaignForDrawer}
          onClose={() => setSelectedCampaignForDrawer(null)}
          onTaskUpdated={(updatedCamp) => {
            setSelectedCampaignForDrawer(updatedCamp);
            setCampaigns((prev) => prev.map((c) => (c.id === updatedCamp.id ? updatedCamp : c)));
          }}
        />
      )}
      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteConfirmCamp && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              onClick={() => setDeleteConfirmCamp(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-stone-200 shadow-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
                  <Trash size={18} className="text-rose-600" weight="duotone" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-stone-900 leading-snug">Delete campaign?</h3>
                  <p className="text-[12px] text-stone-500 mt-1 leading-relaxed">
                    <span className="font-semibold text-stone-700">&ldquo;{deleteConfirmCamp.name}&rdquo;</span> will be permanently deleted from:
                  </p>
                  <ul className="mt-2 space-y-1 text-[11.5px] text-stone-600">
                    <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />Zoho CRM, Deal record</li>
                    <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />Zoho Projects, Project & tasks</li>
                    <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />Zoho Books, Invoice</li>
                    <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />Prism database</li>
                  </ul>
                  <p className="text-[11px] text-stone-400 mt-2">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmCamp(null)}
                  className="flex-1 px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => executeDeleteCampaign(deleteConfirmCamp)}
                  className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Delete permanently
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Discard Draft Confirmation Modal ── */}
      <AnimatePresence>
        {discardConfirmCamp && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              onClick={() => setDiscardConfirmCamp(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-stone-200 shadow-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <Trash size={18} className="text-amber-600" weight="duotone" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-stone-900 leading-snug">Discard draft?</h3>
                  <p className="text-[12px] text-stone-500 mt-1 leading-relaxed">
                    <span className="font-semibold text-stone-700">&ldquo;{discardConfirmCamp.name}&rdquo;</span> was never pushed to Zoho.
                  </p>
                  <p className="text-[11.5px] text-stone-500 mt-1.5 leading-relaxed">
                    Discarding removes it from the Prism database only. No Zoho records are affected.
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDiscardConfirmCamp(null)}
                  className="flex-1 px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Keep draft
                </button>
                <button
                  type="button"
                  onClick={() => executeDiscardDraft(discardConfirmCamp)}
                  className="flex-1 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Discard draft
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
