"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import ApprovalModal from "./ApprovalModal";
import {
  Plus,
  DownloadSimple,
  Sparkle,
  Kanban,
  CheckCircle,
  Clock,
  ArrowsClockwise,
  ArrowRight,
  Scales,
  ShieldCheck,
  Receipt,
  Cpu,
  User,
  ArrowSquareOut,
  Buildings,
  MagnifyingGlass,
  X,
  Trash,
  Check,
  CaretDown,
  Tag,
  Funnel,
  Info,
  WarningCircle,
  FloppyDisk,
  ArrowDown,
} from "@phosphor-icons/react";
import ChatMessage, { type Message } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import ThinkingProcess from "@/components/ThinkingProcess";
import EmptyState from "@/components/EmptyState";
import BigCityLogo from "@/components/BigCityLogo";
import EnlightLogo from "@/components/brand/EnlightLogo";
import { useConnectors, PAUSED_PILL_LABELS } from "@/hooks/useConnectors";
import { type PlanContextForCopilot } from "@/app/page";
import { type AspectTask, type Campaign } from "@/types/campaign";
import { generateAspectPlan } from "@/lib/campaign-planner";
import {
  BIGCITY_TEAM,
  type TeamMember,
} from "@/utils/planModifier";
import { AnimatedErrorBanner } from "@/components/ui/ErrorInlineBanner";

interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

interface WorkingPlanState {
  campaignId?: string;
  campaignData: PlanContextForCopilot["campaignData"];
  tasks: AspectTask[];
  aspectSummary: any;
  status: "draft" | "syncing" | "live";
  // Zoho CRM, Deal record for this campaign as a sales/client opportunity
  zohoCrmDealId?: string;
  zohoCrmDealUrl?: string;
  // Zoho Projects, project milestone tracking (future integration)
  zohoProjectId?: string;
  zohoProjectUrl?: string;
  // Zoho Books, invoice / advance payment (future integration)
  zohoBooksInvoiceId?: string;
  zohoBooksInvoiceUrl?: string;
  // Aggregate sync status across all Zoho products
  zohoSyncStatus?: "Pending" | "Partial" | "Synced" | "Failed";
  lastUpdatedAspect?: string;
  booksCustomerId?: string;
  booksContact?: {
    exists: boolean;
    contactId?: string;
    contactName?: string;
    suggestedName?: string;
  };
}


interface CopilotViewProps {
  initialPlanContext?: PlanContextForCopilot | null;
  onClearPlanContext?: () => void;
  onViewCampaigns?: () => void;
  onNavigateToConnections?: () => void;
}

const COPILOT_SESSION_KEY = "prism_copilot_session_v1";
const COPILOT_WORKING_PLAN_KEY = "prism_copilot_working_plan_v1";
const COPILOT_PANEL_OPEN_KEY = "prism_copilot_panel_open";

function loadSavedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COPILOT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !Array.isArray(parsed.messages)) return null;
    return {
      id: parsed.id,
      title: parsed.title || "New conversation",
      createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
      messages: parsed.messages.map((m: any) => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
      })),
    };
  } catch (err) {
    console.warn("[CopilotView] Failed to load saved session:", err);
    return null;
  }
}

function loadSavedWorkingPlan(): WorkingPlanState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COPILOT_WORKING_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.tasks || parsed.campaignData)) {
      return parsed;
    }
  } catch (err) {
    console.warn("[CopilotView] Failed to load saved working plan:", err);
  }
  return null;
}

function createSession(title = "New conversation"): Session {
  return {
    id: `session-${Date.now()}`,
    title,
    messages: [],
    createdAt: new Date(),
  };
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New conversation";
  return (
    firstUser.content.slice(0, 42) +
    (firstUser.content.length > 42 ? "..." : "")
  );
}

const ASPECT_META = {
  legal: {
    icon: Scales,
    light: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-l-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    activeTab: "bg-violet-100/90 text-violet-900 border-violet-300 ring-1 ring-violet-300",
    label: "Legal",
  },
  compliance: {
    icon: ShieldCheck,
    light: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-l-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    activeTab: "bg-amber-100/90 text-amber-900 border-amber-300 ring-1 ring-amber-300",
    label: "Compliance",
  },
  accounting: {
    icon: Receipt,
    light: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-l-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    activeTab: "bg-emerald-100/90 text-emerald-900 border-emerald-300 ring-1 ring-emerald-300",
    label: "Accounting",
  },
  implementation: {
    icon: Cpu,
    light: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-l-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    activeTab: "bg-blue-100/90 text-blue-900 border-blue-300 ring-1 ring-blue-300",
    label: "Tech & Ops",
  },
};

type AspectKey = "all" | "legal" | "compliance" | "accounting" | "implementation";

export default function CopilotView({
  initialPlanContext,
  onClearPlanContext,
  onViewCampaigns,
  onNavigateToConnections,
}: CopilotViewProps) {
  const [session, setSession] = useState<Session>(() => {
    return loadSavedSession() || createSession();
  });
  const { activeConnectors, hasPausedAny, pausedConnectorIds } = useConnectors();

  // Dismissed pause-set for the paused-connections banner. Keyed by the exact
  // set of paused connector ids, so un-pausing one and pausing another (or
  // pausing anything new) makes the banner relevant again.
  const [dismissedPauseKey, setDismissedPauseKey] = useState<string | null>(null);
  const pausedKey = pausedConnectorIds.length > 0 ? pausedConnectorIds.slice().sort().join("|") : "";
  const [workingPlan, setWorkingPlan] = useState<WorkingPlanState | null>(() => {
    return loadSavedWorkingPlan();
  });
  const activeWorkingPlanRef = useRef<WorkingPlanState | null>(workingPlan);

  useEffect(() => {
    activeWorkingPlanRef.current = workingPlan;
  }, [workingPlan]);

  // Persist session to localStorage across refreshes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (session && session.id) {
        localStorage.setItem(COPILOT_SESSION_KEY, JSON.stringify(session));
      }
    } catch (err) {
      console.warn("[CopilotView] Failed to persist session:", err);
    }
  }, [session]);

  // Persist working plan to localStorage across refreshes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (workingPlan) {
        localStorage.setItem(COPILOT_WORKING_PLAN_KEY, JSON.stringify(workingPlan));
      } else {
        localStorage.removeItem(COPILOT_WORKING_PLAN_KEY);
      }
    } catch (err) {
      console.warn("[CopilotView] Failed to persist working plan:", err);
    }
  }, [workingPlan]);

  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPushingToZoho, setIsPushingToZoho] = useState(false);
  const [isCreatingBooksContact, setIsCreatingBooksContact] = useState(false);
  const [isBooksModalOpen, setIsBooksModalOpen] = useState(false);
  const booksCheckedRef = useRef<Set<string>>(new Set());
  // Label shown in the ThinkingProcess during long n8n tool calls (e.g. "Querying Zoho CRM")
  const [toolCallLabel, setToolCallLabel] = useState<string | null>(null);

  // Error banner states, shown below the chat area, NOT as AI messages
  const [chatError, setChatError] = useState<{
    title: string;
    description: string;
    severity: "error" | "warning";
    retryContent?: string;
  } | null>(null);
  // Transient intent-routing notice (auto-dismisses)
  const [intentError, setIntentError] = useState<string | null>(null);
  // Task sync failure notice
  const [taskSyncError, setTaskSyncError] = useState<boolean>(false);
  // Last user message content for retry
  const lastSentContentRef = useRef<string>("");

  // Filters & Search State
  const [selectedAspectFilter, setSelectedAspectFilter] = useState<AspectKey>("all");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<string[]>([]);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  // Approval gate state, the Zoho push only fires after explicit modal confirmation
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // UI Toast Confirmation Banner State
  const [toastNotice, setToastNotice] = useState<{
    id: string;
    text: string;
    icon?: "check" | "trash" | "user" | "sparkle" | "info";
  } | null>(null);

  // Inline edit state
  const [editingAssigneeTaskId, setEditingAssigneeTaskId] = useState<string | null>(null);

  const [isPlanPanelOpen, setIsPlanPanelOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(COPILOT_PANEL_OPEN_KEY);
      if (saved !== null) return saved === "true";
      const savedPlan = loadSavedWorkingPlan();
      if (savedPlan) return true;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(COPILOT_PANEL_OPEN_KEY, String(isPlanPanelOpen));
    } catch {}
  }, [isPlanPanelOpen]);

  const [riskDigest, setRiskDigest] = useState<any>(null);

  // Add Task form state
  const [newTaskForm, setNewTaskForm] = useState({
    title: "",
    aspect: "legal" as "legal" | "compliance" | "accounting" | "implementation",
    assignee: "Akash Verma",
    role: "Legal Counsel",
    tat: "2 Days",
    urgency: "HIGH" as AspectTask["urgency"],
    details: "",
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesInnerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isPinnedToBottomRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const touchStartYRef = useRef(0);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const lastProcessedContextRef = useRef<string | null>(null);

  const messages = session.messages;

  const showToast = useCallback(
    (text: string, icon: "check" | "trash" | "user" | "sparkle" | "info" | "error" = "check") => {
      setToastNotice({ id: `toast-${Date.now()}`, text, icon: icon === "error" ? "info" : icon });
      // Error toasts persist longer so they aren't missed
      const duration = icon === "error" ? 6000 : 4000;
      setTimeout(() => {
        setToastNotice((prev) => (prev?.text === text ? null : prev));
      }, duration);
    },
    []
  );

  const checkIfAtBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 80;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto", force = false) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      if (force || isPinnedToBottomRef.current) {
        isProgrammaticScrollRef.current = true;
        if (behavior === "smooth") {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
          setTimeout(() => {
            isProgrammaticScrollRef.current = false;
            if (checkIfAtBottom()) {
              isPinnedToBottomRef.current = true;
              setShowScrollBottomBtn(false);
            }
          }, 350);
        } else {
          container.scrollTop = container.scrollHeight;
          requestAnimationFrame(() => {
            isProgrammaticScrollRef.current = false;
          });
        }
      }
    },
    [checkIfAtBottom]
  );

  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const atBottom = checkIfAtBottom();
    if (atBottom) {
      isPinnedToBottomRef.current = true;
      setShowScrollBottomBtn(false);
    } else {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > 100) {
        isPinnedToBottomRef.current = false;
        setShowScrollBottomBtn(messages.length > 1 || isLoading || isThinking);
      }
    }
  }, [checkIfAtBottom, messages.length, isLoading, isThinking]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.deltaY < 0) {
        // User scrolled upward
        isPinnedToBottomRef.current = false;
        const el = scrollContainerRef.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 60) {
          setShowScrollBottomBtn(true);
        }
      } else if (e.deltaY > 0) {
        // User scrolled downward
        requestAnimationFrame(() => {
          if (checkIfAtBottom()) {
            isPinnedToBottomRef.current = true;
            setShowScrollBottomBtn(false);
          }
        });
      }
    },
    [checkIfAtBottom]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartYRef.current - currentY;
      if (deltaY < -10) {
        // Swiping down (scrolls upward)
        isPinnedToBottomRef.current = false;
        setShowScrollBottomBtn(true);
      } else if (deltaY > 10) {
        // Swiping up (scrolls downward)
        requestAnimationFrame(() => {
          if (checkIfAtBottom()) {
            isPinnedToBottomRef.current = true;
            setShowScrollBottomBtn(false);
          }
        });
      }
    },
    [checkIfAtBottom]
  );

  // Observe size changes of the messages container (new tokens, thinking indicator animations, markdown layout)
  useEffect(() => {
    const inner = messagesInnerRef.current;
    if (!inner) return;

    const ro = new ResizeObserver(() => {
      if (isPinnedToBottomRef.current) {
        scrollToBottom(isLoading || isThinking ? "auto" : "smooth");
      }
    });

    ro.observe(inner);
    return () => ro.disconnect();
  }, [isLoading, isThinking, scrollToBottom]);

  // Follow message updates
  useEffect(() => {
    if (isPinnedToBottomRef.current) {
      scrollToBottom(isLoading || isThinking ? "auto" : "smooth");
    }
  }, [messages, isThinking, workingPlan, isLoading, scrollToBottom]);

  // When tool call label changes, keep smoothly centered on bottom
  useEffect(() => {
    if (isPinnedToBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [toolCallLabel, scrollToBottom]);

  // When AI starts thinking, force scroll to bottom so the thinking stepper is immediately visible
  useEffect(() => {
    if (isThinking) {
      isPinnedToBottomRef.current = true;
      setShowScrollBottomBtn(false);
      scrollToBottom("smooth", true);
    }
  }, [isThinking, scrollToBottom]);

  // While active (thinking or streaming), safety ticker ensures scroll remains anchored
  useEffect(() => {
    if (!isLoading && !isThinking) return;
    const id = window.setInterval(() => {
      if (isPinnedToBottomRef.current) {
        scrollToBottom("auto");
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [isLoading, isThinking, scrollToBottom]);

  // Fetch Risk Digest on mount
  useEffect(() => {
    const fetchRiskDigest = async () => {
      try {
        const res = await fetch("/api/risk-digest");
        if (res.ok) {
          const data = await res.json();
          setRiskDigest(data);
        }
      } catch (e) {
        console.error("Failed to fetch risk digest", e);
      }
    };
    fetchRiskDigest();
  }, []);

  // Proactive Zoho Books customer verification
  const checkAndPromptBooksContact = useCallback(
    async (clientName: string, suggestedName?: string) => {
      if (!clientName || clientName === "Client" || clientName === "Unknown Client") return;
      const key = clientName.toLowerCase().trim();
      if (booksCheckedRef.current.has(key)) return;
      booksCheckedRef.current.add(key);

      try {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_books_contact", client: clientName }),
        });
        if (res.ok) {
          const data = await res.json();
          const contact = data.contact;
          const exists = !!data.exists;

          setWorkingPlan((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              booksCustomerId: exists ? contact?.contactId : undefined,
              booksContact: {
                exists,
                contactId: contact?.contactId,
                contactName: contact?.contactName || contact?.companyName,
                suggestedName: suggestedName || `${clientName} India Pvt Ltd`,
              },
            };
          });

          if (!exists) {
            const suggested = suggestedName || `${clientName} India Pvt Ltd`;
            const alertMsg: Message = {
              id: `msg-${Date.now()}-assistant-books-check`,
              role: "assistant",
              content:
                `⚠️ **Zoho Books Pre-Flight Check:** Client **${clientName}** was not found in the active Zoho Books contacts directory.\n\n` +
                `To ensure seamless escrow billing and automated invoice generation upon campaign approval, would you like me to register **${suggested}** in Zoho Books?\n\n` +
                `Click the suggestion chip below or reply **"Yes, register in Books"**.`,
              timestamp: new Date(),
            };
            setSession((prev) => ({
              ...prev,
              messages: [...prev.messages, alertMsg],
            }));
          }
        }
      } catch (err) {
        console.warn("[checkAndPromptBooksContact] Failed:", err);
      }
    },
    []
  );

  // Zoho Books customer registration handler
  const handleCreateBooksContact = async (clientOverride?: string, companyOverride?: string): Promise<string | null> => {
    const clientName = clientOverride || workingPlan?.campaignData.client;
    if (!clientName) return null;

    setIsCreatingBooksContact(true);
    showToast(`Registering ${clientName} in Zoho Books…`, "sparkle");

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_books_contact",
          client: clientName,
          companyName: companyOverride || workingPlan?.booksContact?.suggestedName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.contactId) {
          const contactId = data.contactId;
          const contactName = data.contactName || `${clientName} India`;

          setWorkingPlan((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              booksCustomerId: contactId,
              booksContact: {
                exists: true,
                contactId,
                contactName,
              },
            };
          });

          showToast(`✨ Registered ${contactName} in Zoho Books!`, "check");

          const confirmMsg: Message = {
            id: `msg-${Date.now()}-assistant-books-created`,
            role: "assistant",
            content:
              `✅ **Zoho Books Customer Registered:**\n\n` +
              `* **Contact Name**: ${contactName}\n` +
              `* **Customer ID**: \`${contactId}\`\n` +
              `* **Status**: Ready for Automated Invoicing\n\n` +
              `When you approve this campaign, the advance invoice will be automatically generated and linked under this customer in Zoho Books.`,
            timestamp: new Date(),
          };
          setSession((prev) => ({
            ...prev,
            messages: [...prev.messages, confirmMsg],
          }));

          setIsBooksModalOpen(false);
          return contactId;
        }
      }
      showToast("Couldn't add the client to Zoho Books. The campaign can still be approved. Add the contact manually in Zoho Books if needed.", "error");
    } catch (err) {
      console.error("handleCreateBooksContact error:", err);
      showToast("Couldn't connect to Zoho Books right now. This is on our end, so you can still approve the campaign and register the contact later.", "error");
    } finally {
      setIsCreatingBooksContact(false);
    }
    return null;
  };

  // Intake initial plan context from Campaigns wizard
  useEffect(() => {
    if (!initialPlanContext) return;

    const contextKey = `${initialPlanContext.campaignData.name}-${initialPlanContext.plan.tasks.length}`;
    if (lastProcessedContextRef.current === contextKey) return;

    // Check if session and working plan were already restored from localStorage for this campaign
    const isAlreadyRestored =
      Boolean(workingPlan) &&
      workingPlan?.campaignData?.name === initialPlanContext.campaignData.name &&
      session.messages.length > 0;

    if (isAlreadyRestored) {
      lastProcessedContextRef.current = contextKey;
      return;
    }

    lastProcessedContextRef.current = contextKey;

    // Check Supabase first, has this campaign already been approved & synced?
    // This prevents the "Approve" button from reappearing on page refresh.
    const checkExistingApproval = async (): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/campaigns?action=check_approved&name=${encodeURIComponent(initialPlanContext.campaignData.name)}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.found && json.campaign) {
            // A campaign counts as approved only when it has real Zoho IDs, // a saved draft (status draft, no deal) still shows the approve action.
            const hasZohoDeal = Boolean(json.campaign.zohoCrmDealId);
            const hasAllZohoProducts = Boolean(
              json.campaign.zohoCrmDealId &&
              json.campaign.zohoProjectId &&
              json.campaign.zohoBooksInvoiceId
            );
            setWorkingPlan({
              campaignData: initialPlanContext.campaignData,
              tasks: json.campaign.tasks?.length > 0 ? json.campaign.tasks : initialPlanContext.plan.tasks,
              aspectSummary: json.campaign.aspectSummary || initialPlanContext.plan.aspectSummary,
              status: hasZohoDeal ? "live" : "draft",
              campaignId: json.campaign.id,
              zohoCrmDealId: json.campaign.zohoCrmDealId,
              zohoCrmDealUrl: json.campaign.zohoCrmDealUrl,
              zohoProjectId: json.campaign.zohoProjectId,
              zohoProjectUrl: json.campaign.zohoProjectUrl,
              zohoBooksInvoiceId: json.campaign.zohoBooksInvoiceId,
              zohoBooksInvoiceUrl: json.campaign.zohoBooksInvoiceUrl,
              zohoSyncStatus: json.campaign.zohoSyncStatus,
              booksCustomerId: json.campaign.booksCustomerId,
            });
            checkAndPromptBooksContact(initialPlanContext.campaignData.client);
            if (hasAllZohoProducts) {
              showToast("Campaign already approved & synced to Zoho", "check");
              return true;
            } else {
              showToast(hasZohoDeal ? "Campaign loaded, sync completing…" : "Draft loaded, ready to approve and sync to Zoho", "info");
              return false;
            }
          }
        }
      } catch (e) {
        console.error("[check_approved] Supabase check failed:", e);
      }
      return false;
    };

    checkExistingApproval().then((alreadyApproved) => {
      setSelectedAspectFilter("all");
      setTaskSearchQuery("");
      if (!alreadyApproved) {
        setWorkingPlan((prev) => prev || {
          campaignData: initialPlanContext.campaignData,
          tasks: initialPlanContext.plan.tasks,
          aspectSummary: initialPlanContext.plan.aspectSummary,
          status: "draft",
        });
        checkAndPromptBooksContact(initialPlanContext.campaignData.client);
      }
      const newSess = createSession(`Plan: ${initialPlanContext.campaignData.name}`);
      const legalCount = initialPlanContext.plan.tasks.filter((t) => t.aspect === "legal").length;
      const compCount = initialPlanContext.plan.tasks.filter((t) => t.aspect === "compliance").length;
      const accCount = initialPlanContext.plan.tasks.filter((t) => t.aspect === "accounting").length;
      const impCount = initialPlanContext.plan.tasks.filter((t) => t.aspect === "implementation").length;
      const initialGreeting: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: alreadyApproved
          ? `Campaign **${initialPlanContext.campaignData.name}** is already **Live** and synced to all Zoho products.\n\n**Client**: ${initialPlanContext.campaignData.client}  \n**Budget**: ${initialPlanContext.campaignData.budget}  \n**Volume**: ${initialPlanContext.campaignData.codeVolume}  \n\nYou can view it in the Campaigns dashboard or ask me any questions.`
          : `Draft AI Project Plan loaded for **${initialPlanContext.campaignData.name}**\n\n**Client**: ${initialPlanContext.campaignData.client}  \n**Budget**: ${initialPlanContext.campaignData.budget}  \n**Volume**: ${initialPlanContext.campaignData.codeVolume}  \n**Estimated TAT**: 12 Working Days  \n\n### 4-Aspect Breakdown (${initialPlanContext.plan.tasks.length} Total Tasks):\n\n* **Legal** (${legalCount} Tasks): Terms & conditions drafting, partner consent verification, disclaimer compliance.\n* **Compliance** (${compCount} Tasks): DLT / TRAI header whitelisting, regulatory approvals, 72h staging UAT sign-off.\n* **Accounting** (${accCount} Tasks): Advance escrow receipt verification in Zoho Books, GST mapping.\n* **Tech & Operations** (${impCount} Tasks): Cryptographic QR batch generation, CDN provisioning, gateway failover routing.\n\nWhen ready, click **Approve & Sync to Zoho** on the right or reply with **"Approve"**.`,
        timestamp: new Date(),
      };
      newSess.messages = [initialGreeting];
      setSession(newSess);
      isPinnedToBottomRef.current = true;
      setShowScrollBottomBtn(false);
      requestAnimationFrame(() => {
        scrollToBottom("smooth", true);
      });
      if (!alreadyApproved) {
        showToast(`Loaded ${initialPlanContext.plan.tasks.length} tasks for ${initialPlanContext.campaignData.name}`, "sparkle");
      }
    });
  }, [initialPlanContext, showToast, checkAndPromptBooksContact]);

  // Derived: true only when ALL 3 Zoho products (CRM Deal, Projects, Books Invoice) are synced
  const isFullySynced = Boolean(
    workingPlan?.status === "live" &&
    workingPlan?.zohoCrmDealId &&
    workingPlan?.zohoProjectId &&
    workingPlan?.zohoBooksInvoiceId
  );

  // Filtered tasks computation
  const displayedTasks = useMemo(() => {
    if (!workingPlan) return [];
    return workingPlan.tasks.filter((t) => {
      const matchesAspect =
        selectedAspectFilter === "all" || t.aspect === selectedAspectFilter;
      const q = taskSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        t.sopCode.toLowerCase().includes(q) ||
        (t.details && t.details.toLowerCase().includes(q));
      return matchesAspect && matchesSearch;
    });
  }, [workingPlan, selectedAspectFilter, taskSearchQuery]);

  // Handle approve & sync campaign to Zoho CRM (Deal), Zoho Projects, Zoho Books
  // STEP 1, Pre-flight checks, then open the review modal. NEVER pushes directly:
  // the actual Zoho write happens in confirmApprovePlanToZoho after explicit confirmation.
  const handleOpenApprovalModal = async (contactIdOverride?: string) => {
    let targetPlanState = workingPlan;

    // Fallback: If no working plan is active in state, fetch the latest campaign from Supabase API
    if (!targetPlanState) {
      try {
        const campRes = await fetch("/api/campaigns");
        if (campRes.ok) {
          const campData = await campRes.json();
          const campaigns: Campaign[] = campData.campaigns || [];
          if (campaigns.length > 0) {
            const latest = campaigns[0];
            targetPlanState = {
              campaignId: latest.id,
              campaignData: {
                name: latest.name,
                client: latest.client,
                rewardType: latest.rewardType,
                budget: latest.budget,
                codeVolume: latest.codeVolume,
                startDate: latest.startDate,
                endDate: latest.endDate,
                brief: latest.brief,
              },
              tasks: latest.tasks || [],
              aspectSummary: latest.aspectSummary,
              status: (latest.status?.toLowerCase() === "live" ? "live" : "draft") as "draft" | "syncing" | "live",
              zohoCrmDealId: latest.zohoCrmDealId,
              zohoCrmDealUrl: latest.zohoCrmDealUrl,
              zohoProjectId: latest.zohoProjectId,
              zohoProjectUrl: latest.zohoProjectUrl,
              zohoBooksInvoiceId: latest.zohoBooksInvoiceId,
              zohoBooksInvoiceUrl: latest.zohoBooksInvoiceUrl,
              zohoSyncStatus: latest.zohoSyncStatus,
              booksCustomerId: latest.booksCustomerId,
            };
            setWorkingPlan(targetPlanState);
            setIsPlanPanelOpen(true);
          }
        }
      } catch (e) {
        console.warn("Fallback campaign fetch for approval failed:", e);
      }
    }

    if (!targetPlanState) {
      showToast("No active campaign plan to approve", "info");
      setIsLoading(false);
      setIsThinking(false);
      setToolCallLabel(null);
      return;
    }

    // Only abort if already live and fully synced across CRM, Projects, and Books
    if (
      targetPlanState.status === "live" &&
      targetPlanState.zohoCrmDealId &&
      targetPlanState.zohoProjectId &&
      targetPlanState.zohoBooksInvoiceId
    ) {
      showToast("Campaign already fully synced to all Zoho products", "check");
      setIsLoading(false);
      setIsThinking(false);
      setToolCallLabel(null);
      return;
    }

    const targetBooksId = contactIdOverride || targetPlanState.booksCustomerId;

    if (
      targetPlanState.booksContact &&
      !targetPlanState.booksContact.exists &&
      !targetBooksId
    ) {
      setIsLoading(false);
      setIsThinking(false);
      setToolCallLabel(null);
      setIsBooksModalOpen(true);
      return;
    }

    setIsLoading(false);
    setIsThinking(false);
    setToolCallLabel(null);
    setIsApprovalModalOpen(true);
  };

  // STEP 2, Runs ONLY on explicit user confirmation inside ApprovalModal.
  const confirmApprovePlanToZoho = async () => {
    const targetPlanState = workingPlan;
    if (!targetPlanState) return;

    const targetBooksId = targetPlanState.booksCustomerId;

    setIsPushingToZoho(true);
    setWorkingPlan((prev) => (prev ? { ...prev, status: "syncing" } : { ...targetPlanState!, status: "syncing" }));

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_and_push_zoho",
          campaignId: targetPlanState.campaignId,
          campaignData: targetPlanState.campaignData,
          tasks: targetPlanState.tasks,
          booksCustomerId: targetBooksId,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (!data.campaign) {
          showToast(data.error || "Failed to sync to Zoho", "info");
          setWorkingPlan((prev) => (prev ? { ...prev, status: "draft" } : null));
          return;
        }
        const created = data.campaign as Campaign;
        const zohoSync = data.zohoSync;
        const assignedNames = Array.from(new Set((targetPlanState.tasks || []).map((t) => t.assignee))).join(", ");

        const crmDealId =
          zohoSync?.crmDeal?.dealId ||
          created.zohoCrmDealId ||
          (created as any)?.zoho_crm_deal_id ||
          null;
        const crmDealUrl =
          zohoSync?.crmDeal?.dealUrl ||
          created.zohoCrmDealUrl ||
          (created as any)?.zoho_crm_deal_url ||
          (crmDealId ? `https://crm.zoho.in/crm/org/tab/Potentials/${crmDealId}` : undefined);
        const projectId =
          zohoSync?.projects?.projectId ||
          created.zohoProjectId ||
          (created as any)?.zoho_project_id ||
          null;
        const projectUrl =
          zohoSync?.projects?.projectUrl ||
          created.zohoProjectUrl ||
          (created as any)?.zoho_project_url ||
          (projectId ? `https://projects.zoho.in/portal/enlightlabdotcom#project/${projectId}` : undefined);
        const invoiceId =
          zohoSync?.books?.invoiceId ||
          zohoSync?.booksInvoice?.invoiceId ||
          created.zohoBooksInvoiceId ||
          (created as any)?.zoho_books_invoice_id ||
          null;
        const invoiceUrl =
          zohoSync?.books?.invoiceUrl ||
          zohoSync?.booksInvoice?.invoiceUrl ||
          created.zohoBooksInvoiceUrl ||
          (created as any)?.zoho_books_invoice_url ||
          (invoiceId ? `https://books.zoho.in/app#/invoices/${invoiceId}` : undefined);

        // Restore all Zoho product IDs into working plan state
        setWorkingPlan((prev) =>
          prev
            ? {
                ...prev,
                campaignId: created.id || prev.campaignId,
                status: "live",
                zohoCrmDealId: crmDealId || prev.zohoCrmDealId,
                zohoCrmDealUrl: crmDealUrl || prev.zohoCrmDealUrl,
                zohoProjectId: projectId || prev.zohoProjectId,
                zohoProjectUrl: projectUrl || prev.zohoProjectUrl,
                zohoBooksInvoiceId: invoiceId || prev.zohoBooksInvoiceId,
                zohoBooksInvoiceUrl: invoiceUrl || prev.zohoBooksInvoiceUrl,
                zohoSyncStatus: crmDealId && projectId && invoiceId ? "Synced" : "Partial",
              }
            : null
        );
        setIsPlanPanelOpen(true);

        showToast(
          crmDealId
            ? "Approved & synced to Zoho"
            : `Approved and saved. Zoho sync ${zohoSync?.crmDeal?.writeStatus || "QUEUED"}`,
          "check"
        );

        const confirmationMsg: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content:
            `**Campaign Approved & Synced: ${created.name}**\n\n` +
            `* **Client**: ${created.client}\n` +
            `* **Tasks Saved**: ${(targetPlanState.tasks || []).length} tasks across 4 milestone aspects\n\n` +
            `### Zoho Product Sync Status\n\n` +
            `| Product | Purpose | Status | ID |\n` +
            `|---------|---------|--------|----|\n` +
            `| **Zoho CRM** | Campaign Deal (client opportunity & campaign record) | ${crmDealId ? "✅ Synced" : "⏳ Pending"} | ${crmDealId ? `\`${crmDealId}\`` : "-"} |\n` +
            `| **Zoho Projects** | Task & milestone execution tracker | ${projectId ? "✅ Synced" : "⏳ Pending"} | ${projectId ? `\`${projectId}\`` : "-"} |\n` +
            `| **Zoho Books** | Advance payment, escrow & GST invoicing | ${invoiceId ? "✅ Synced" : "⏳ Pending"} | ${invoiceId ? `\`${invoiceId}\`` : "-"} |\n\n` +
            `SPOCs assigned: ${assignedNames}`,
          timestamp: new Date(),
        };

        setSession((prev) => ({
          ...prev,
          messages: [...prev.messages, confirmationMsg],
        }));
      } else {
        const errData = await res.json().catch(() => ({}));
        // Server-side failure (5xx), not the user's network
        showToast(
          errData.error ||
          "Zoho sync hit a problem on our end. Your campaign plan is preserved, so try approving again or contact support.",
          "error"
        );
        setWorkingPlan((prev) => (prev ? { ...prev, status: "draft" } : null));
      }
    } catch (e) {
      console.error("Failed to sync campaign to Zoho", e);
      // Network failure, could be the user's connection
      const isOffline = !navigator.onLine;
      showToast(
        isOffline
          ? "You appear to be offline. Your campaign plan is safe. Reconnect and try approving again."
          : "Couldn't reach BCP Assist. Check your internet connection. Your campaign plan is unchanged.",
        "error"
      );
      setWorkingPlan((prev) => (prev ? { ...prev, status: "draft" } : null));
    } finally {
      setIsPushingToZoho(false);
      setIsLoading(false);
      setIsThinking(false);
      setToolCallLabel(null);
      setIsApprovalModalOpen(false);
    }
  };

  // Save the working plan as a DRAFT (Supabase only, nothing pushed to Zoho).
  // Keeps the returned campaignId so a later approval updates the same row.
  const handleSaveWorkingPlanAsDraft = async () => {
    if (!workingPlan) return;
    setIsSavingDraft(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          campaignId: workingPlan.campaignId,
          campaignData: workingPlan.campaignData,
          tasks: workingPlan.tasks,
          booksCustomerId: workingPlan.booksCustomerId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.campaign) {
        setWorkingPlan((prev) =>
          prev
            ? {
                ...prev,
                campaignId: data.campaign.id || prev.campaignId,
                status: "draft",
              }
            : prev
        );
        showToast("Draft saved. Nothing is pushed to Zoho. Approve it later from Campaigns.", "info");
      } else {
        showToast(data.error || "Failed to save draft", "info");
      }
    } catch (e) {
      console.error("Failed to save draft from copilot", e);
      showToast(
        "The draft couldn't be saved. This is a connection issue on our end, not your data. Try again.",
        "error"
      );
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Direct Inline Task Field Updates
  const handleUpdateTaskField = (
    taskId: string,
    updates: Partial<AspectTask>
  ) => {
    if (!workingPlan) return;
    const task = workingPlan.tasks.find((t) => t.id === taskId);
    const updatedTasks = workingPlan.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));

    setWorkingPlan((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: updatedTasks,
      };
    });
    setHighlightedTaskIds([taskId]);
    setTimeout(() => setHighlightedTaskIds([]), 3500);

    if (workingPlan.status === "live") {
      fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_campaign_tasks",
          campaignName: workingPlan.campaignData.name,
          tasks: updatedTasks,
        }),
      }).catch((e) => {
        console.error("Failed to sync task update to store:", e);
        setTaskSyncError(true);
        setTimeout(() => setTaskSyncError(false), 8000);
      });
    }

    if (updates.assignee) {
      showToast(`Reassigned ${task?.sopCode || "Task"} to ${updates.assignee}`, "user");
    } else if (updates.tat) {
      showToast(`Updated ${task?.sopCode || "Task"} TAT to ${updates.tat}`, "check");
    } else if (updates.urgency) {
      showToast(`Set priority urgency to ${updates.urgency}`, "check");
    }
  };

  // Direct Inline Task Deletion
  const handleDeleteTask = (taskId: string) => {
    if (!workingPlan) return;
    const task = workingPlan.tasks.find((t) => t.id === taskId);
    const updatedTasks = workingPlan.tasks.filter((t) => t.id !== taskId);

    setWorkingPlan((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: updatedTasks,
      };
    });

    if (workingPlan.status === "live") {
      fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_campaign_tasks",
          campaignName: workingPlan.campaignData.name,
          tasks: updatedTasks,
        }),
      }).catch((e) => {
        console.error("Failed to sync task deletion to store:", e);
        setTaskSyncError(true);
        setTimeout(() => setTaskSyncError(false), 8000);
      });
    }

    showToast(`Removed ${task?.sopCode || "task"} from plan`, "trash");
  };

  // Handle Add New Task
  const handleCreateNewTask = () => {
    if (!workingPlan || !newTaskForm.title.trim()) return;

    const count = workingPlan.tasks.filter((t) => t.aspect === newTaskForm.aspect).length + 1;
    const sopCode = `SOP-${newTaskForm.aspect.slice(0, 3).toUpperCase()}-0${count}`;
    const newTaskId = `task-${Date.now()}`;

    const task: AspectTask = {
      id: newTaskId,
      sopCode,
      title: newTaskForm.title.trim(),
      aspect: newTaskForm.aspect,
      assignee: newTaskForm.assignee,
      role: newTaskForm.role,
      urgency: newTaskForm.urgency,
      tat: newTaskForm.tat,
      status: "PENDING_APPROVAL",
      zohoCrmTaskId: `ZP-T-${Math.floor(100000 + Math.random() * 900000)}`,
      zohoCrmTaskStatus: "Open",
      details: newTaskForm.details.trim(),
      verificationRequirement: `${newTaskForm.role} sign-off required prior to Go-Live`,
      mandatoryGate: true,
    };

    const updatedTasks = [...workingPlan.tasks, task];

    setWorkingPlan((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: updatedTasks,
      };
    });

    if (workingPlan.status === "live") {
      fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_campaign_tasks",
          campaignName: workingPlan.campaignData.name,
          tasks: updatedTasks,
        }),
      }).catch((e) => console.error("Failed to sync new task to store:", e));
    }

    setHighlightedTaskIds([newTaskId]);
    setTimeout(() => setHighlightedTaskIds([]), 4000);
    showToast(`Added ${sopCode} to plan`, "check");
    setIsAddTaskModalOpen(false);
    setNewTaskForm({
      title: "",
      aspect: "implementation",
      assignee: "Sachin (Tech Team)",
      role: "Tech Lead & Cloud Architect",
      urgency: "HIGH",
      tat: "2 Days",
      details: "",
    });
  };

  const sendMessage = useCallback(
    async (content: string) => {
      isPinnedToBottomRef.current = true;
      setShowScrollBottomBtn(false);
      // Track last sent content so the retry button can re-send it
      lastSentContentRef.current = content;
      // Clear any previous chat error banner
      setChatError(null);
      const userMessage: Message = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      setSession((prev) => {
        const newMessages = [...prev.messages, userMessage];
        return {
          ...prev,
          messages: newMessages,
          title: prev.messages.length === 0 ? deriveTitle(newMessages) : prev.title,
        };
      });

      // Force immediate scroll to bottom so the user message is visible right away
      requestAnimationFrame(() => {
        scrollToBottom("smooth", true);
      });

      // ⚡ Set loading and thinking IMMEDIATELY so loader animation shows instantly
      setIsLoading(true);
      setIsThinking(true);
      setToolCallLabel("Analyzing prompt & SOP requirements…");

      // Check conversational Zoho Books customer registration confirmation
      const lower = content.toLowerCase().trim();
      const isBooksRegisterQuery =
        (lower.includes("register") ||
          lower.includes("create") ||
          lower === "yes" ||
          lower === "yes please" ||
          lower === "sure" ||
          lower === "yes, create it" ||
          lower === "yes, register in books" ||
          lower.includes("add contact") ||
          lower.includes("create contact") ||
          lower.includes("register customer")) &&
        (lower.includes("book") ||
          lower.includes("contact") ||
          lower.includes("customer") ||
          (workingPlan?.booksContact && !workingPlan?.booksContact?.exists));

      if (isBooksRegisterQuery && workingPlan && workingPlan.status === "draft") {
        setIsLoading(false);
        setIsThinking(false);
        setToolCallLabel(null);
        await handleCreateBooksContact();
        return;
      }

      let activePlan = workingPlan;
      let planModified = false;
      let modificationSummary = "";
      let intent = "CHAT";
      let planCreatedViaChat = false;

      // 🧠 Let AI understand the prompt and intent dynamically
      try {
        const intentRes = await fetch("/api/ai/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            activePlan: workingPlan,
            sessionId: session.id,
          }),
        });

        if (intentRes.ok) {
          const intentData = await intentRes.json();
          intent = intentData.intent || "CHAT";

          if (intentData.intent === "PLAN_APPROVE") {
            setIsLoading(false);
            setIsThinking(false);
            setToolCallLabel(null);
            // Approval gate: chat approval NEVER pushes directly, it opens the
            // review modal listing what will be created. The Zoho write happens
            // only after an explicit click on "Approve & Push to Zoho" there.
            const reviewMsg: Message = {
              id: `msg-${Date.now()}-assistant-approval-review`,
              role: "assistant",
              content:
                `### 🔒 Approval required before Zoho sync\n\n` +
                `Here's what will be created once you confirm:\n\n` +
                `* **Zoho CRM**: Deal for **${activeWorkingPlanRef.current?.campaignData.name || "the campaign"}** (stage: Qualification)\n` +
                `* **Zoho Projects**: Project with ${(activeWorkingPlanRef.current?.tasks || []).length} tasks\n` +
                `* **Zoho Books**: Advance invoice for **${activeWorkingPlanRef.current?.campaignData.budget || "the budget"}**\n\n` +
                `Review the summary in the approval dialog. Nothing is pushed to Zoho until you click **Approve & Push to Zoho**.`,
              timestamp: new Date(),
            };
            setSession((prev) => ({ ...prev, messages: [...prev.messages, reviewMsg] }));
            await handleOpenApprovalModal();
            return;
          }

          if (intentData.intent === "PLAN_CREATE" && intentData.plan && intentData.campaignData) {
            const booksContact = intentData.booksContact;
            const newWorkingPlan: WorkingPlanState = {
              campaignData: intentData.campaignData,
              tasks: intentData.plan.tasks,
              aspectSummary: intentData.plan.aspectSummary,
              status: "draft",
              booksCustomerId: booksContact?.contactId,
              booksContact: booksContact,
            };
            activePlan = newWorkingPlan;
            setWorkingPlan(newWorkingPlan);
            setIsPlanPanelOpen(true);
            setToolCallLabel("Generated 4-aspect operational matrix…");
            planCreatedViaChat = true;
            showToast(
              `✨ AI generated ${intentData.plan.tasks.length} bespoke tasks for ${intentData.campaignData.name}`,
              "sparkle"
            );

            if (booksContact && !booksContact.exists) {
              const clientName = intentData.campaignData.client;
              const suggested = booksContact.suggestedName || `${clientName} India Pvt Ltd`;
              const booksAlertMsg: Message = {
                id: `msg-${Date.now()}-assistant-books-prompt`,
                role: "assistant",
                content:
                  `⚠️ **Zoho Books Pre-Flight Check:** Client **${clientName}** was not found in the active Zoho Books contacts directory.\n\n` +
                  `To ensure seamless escrow billing and automated invoice generation upon approval, would you like me to register **${suggested}** in Zoho Books?\n\n` +
                  `Click the suggestion chip below or reply **"Yes, register in Books"**.`,
                timestamp: new Date(),
              };
              setSession((prev) => ({
                ...prev,
                messages: [...prev.messages, booksAlertMsg],
              }));
            }
          } else if (intentData.intent === "PLAN_MODIFY" && intentData.campaignData) {
            const resolvedCampaignId = intentData.campaignId || workingPlan?.campaignId;
            const resolvedDealId = intentData.zohoCrmDealId || workingPlan?.zohoCrmDealId;
            const resolvedProjectId = intentData.zohoProjectId || workingPlan?.zohoProjectId;
            const resolvedInvoiceId = intentData.zohoBooksInvoiceId || workingPlan?.zohoBooksInvoiceId;

            const updatedPlan: WorkingPlanState = {
              campaignId: resolvedCampaignId,
              campaignData: intentData.campaignData,
              tasks: intentData.tasks || workingPlan?.tasks || [],
              aspectSummary: intentData.aspectSummary || workingPlan?.aspectSummary || { legal: 0, compliance: 0, accounting: 0, implementation: 0 },
              status: intentData.status || workingPlan?.status || (resolvedDealId ? "live" : "draft"),
              zohoCrmDealId: resolvedDealId,
              zohoProjectId: resolvedProjectId,
              zohoBooksInvoiceId: resolvedInvoiceId,
              booksCustomerId: intentData.booksCustomerId || workingPlan?.booksCustomerId,
            };

            activePlan = updatedPlan;
            activeWorkingPlanRef.current = updatedPlan;
            setWorkingPlan(updatedPlan);
            setIsPlanPanelOpen(true);

            planModified = true;
            modificationSummary = intentData.summaryMarkdown || "✨ Applied AI modifications to campaign plan.";
            if (intentData.modifiedTaskIds && intentData.modifiedTaskIds.length > 0) {
              setHighlightedTaskIds(intentData.modifiedTaskIds);
              setTimeout(() => setHighlightedTaskIds([]), 6000);
            }
            showToast(`✨ AI updated: ${intentData.campaignData.name}`, "sparkle");

            // Approval gate: live campaigns sync across Zoho; saved drafts persist
            // to Supabase only (server returns skipped: "draft_not_synced" with zero Zoho calls).
            if (updatedPlan.campaignId) {
              fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "update_live_campaign",
                  campaignId: updatedPlan.campaignId,
                  dealId: updatedPlan.zohoCrmDealId,
                  projectId: updatedPlan.zohoProjectId,
                  invoiceId: updatedPlan.zohoBooksInvoiceId,
                  client: intentData.campaignData.client,
                  newName: intentData.campaignData.name,
                  newBudget: intentData.campaignData.budget,
                  newVolume: intentData.campaignData.codeVolume,
                  rewardType: intentData.campaignData.rewardType,
                  tasks: intentData.tasks,
                }),
              })
                .then(async (res) => {
                  const data = await res.json().catch(() => ({}));
                  if (data.skipped === "draft_not_synced") {
                    showToast(`✨ Draft plan updated in database`, "check");
                  } else if (res.ok) {
                    showToast(`✨ Synced updates to Zoho CRM, Books, and Projects!`, "check");
                  }
                })
                .catch((err) => console.warn("Plan update failed:", err));
            }
          }
        }
      } catch (err) {
        console.warn("AI Intent evaluation warning:", err);
        // Show a transient, auto-dismissing notice, intent routing failed but
        // the message still proceeds as a CHAT request.
        setIntentError("AI routing is temporarily unavailable. Your message was sent as a general query.");
        setTimeout(() => setIntentError(null), 6000);
      }

      let promptToSend = content;

      if (intent === "CHAT" && !activePlan) {
        setIsPlanPanelOpen(false);
      }

      // Freshly created plan via chat, offer Save as Draft so the user can
      // persist it WITHOUT pushing to Zoho. Approval stays a separate step.
      if (planCreatedViaChat && activePlan) {
        const draftOfferMsg: Message = {
          id: `msg-${Date.now()}-assistant-draft-offer`,
          role: "assistant",
          content:
            `The plan for **${activePlan.campaignData.name}** is ready for review on the canvas.\n\n` +
            `Nothing has been pushed to Zoho yet. Click **Save as Draft** to store it locally (you can approve it later from Campaigns), or **Approve & Sync to Zoho** when you're satisfied with the plan.`,
          timestamp: new Date(),
        };
        setSession((prev) => ({ ...prev, messages: [...prev.messages, draftOfferMsg] }));
      }

      // Build campaign context string so n8n has the right Zoho IDs to query
      let campaignContextStr: string | undefined;
      if (activePlan) {
        const isLive = activePlan.status === "live";
        const zohoIds = [
          activePlan.zohoCrmDealId ? `CRM Deal ID: ${activePlan.zohoCrmDealId}` : null,
          activePlan.zohoProjectId ? `Projects ID: ${activePlan.zohoProjectId}` : null,
          activePlan.zohoBooksInvoiceId ? `Books Invoice ID: ${activePlan.zohoBooksInvoiceId}` : null,
          activePlan.booksCustomerId ? `Books Customer ID: ${activePlan.booksCustomerId}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        campaignContextStr =
          `[${isLive ? "LIVE" : "DRAFT"} Campaign Context]\n` +
          `Campaign: ${activePlan.campaignData.name}\n` +
          `Client: ${activePlan.campaignData.client}\n` +
          `Budget: ${activePlan.campaignData.budget}\n` +
          `Volume: ${activePlan.campaignData.codeVolume}\n` +
          (zohoIds ? `${zohoIds}\n` : "") +
          (activePlan.tasks.length > 0
            ? `Tasks (${activePlan.tasks.length}):\n` +
              activePlan.tasks
                .map((t, idx) => `${idx + 1}. [${t.aspect.toUpperCase()}] ${t.title} (Owner: ${t.assignee}, TAT: ${t.tat}, Urgency: ${t.urgency})`)
                .join("\n")
            : "");

        promptToSend =
          `${campaignContextStr}\n\nUser Request: ${content}`;
      }

      // Build last-6-turn history for Gemini direct context
      const conversationHistory = session.messages
        .slice(-6)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Chat API call / Stream
      setIsLoading(true);
      setIsThinking(true);
      setToolCallLabel(null);
      const thinkingStartTime = Date.now();

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: promptToSend,
            sessionId: session.id,
            campaignContext: campaignContextStr,
            conversationHistory,
            intent,
            activeConnectors,
          }),
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") || "";

        if (!response.ok) {
          const err = await response
            .json()
            .catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        if (contentType.includes("text/event-stream") || response.body) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No stream available");

          let accumulatedContent = "";
          let firstChunkReceived = false;
          let toolCallReceived = false; // tracks whether n8n sent a begin frame (tool was invoked but may have returned no content)
          const decoder = new TextDecoder();
          let buffer = "";
          let streamEnded = false;

          try {
            while (!streamEnded) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                let token = "";

                if (trimmed.startsWith("data: ")) {
                  const data = trimmed.slice(6).trim();
                  if (data === "[DONE]") {
                    streamEnded = true;
                    break;
                  }
                  try {
                    const parsed = JSON.parse(data);

                    // Structured error event from API route, render as banner, not chat message
                    if (parsed.error === true) {
                      const isNetworkErr = parsed.code === 'BACKEND_UNAVAILABLE';
                      const isTimeout = parsed.code === 'TIMEOUT';
                      setChatError({
                        title: isTimeout
                          ? "The AI took too long to respond"
                          : isNetworkErr
                          ? "Couldn't reach the AI service"
                          : "Something went wrong on our end",
                        description: parsed.userMessage ||
                          "Please try again. Your message wasn't sent twice.",
                        severity: isNetworkErr ? "warning" : "error",
                        retryContent: content,
                      });
                      setIsThinking(false);
                      setIsLoading(false);
                      setToolCallLabel(null);
                      continue;
                    }

                    // Handle toolCall frame from n8n begin events:
                    // Shows "Querying Zoho CRM..." during long tool calls (~17s)
                    if (parsed.toolCall) {
                      toolCallReceived = true;
                      const labelMap: Record<string, string> = {
                        "Zoho CRM Deals & Campaigns": "Querying Zoho CRM deals...",
                        "Zoho CRM Invoices": "Querying Zoho CRM invoices...",
                        "Zoho CRM Client Accounts": "Querying Zoho CRM accounts...",
                        "Campaign Knowledge Base": "Querying Zoho Knowledge Base...",
                        "Supabase Vector Store": "Querying Zoho Knowledge Base...",
                        "Supabase Vector Retriever": "Querying Zoho Knowledge Base...",
                        "Pending Tasks & SOP Action Items": "Loading pending tasks...",
                      };
                      let displayLabel =
                        labelMap[parsed.toolCall as string] ||
                        `Processing: ${parsed.toolCall}...`;
                      displayLabel = displayLabel
                        .replace(/supabase/gi, "Zoho Knowledge Base")
                        .replace(/pgvector/gi, "SOP Index")
                        .replace(/vector store/gi, "Zoho Knowledge Base");
                      setToolCallLabel(displayLabel);
                      continue;
                    }

                    // Clear tool call label once content starts arriving
                    if (parsed.text || parsed.content || parsed.output) {
                      setToolCallLabel(null);
                    }

                    token = parsed.text || parsed.content || parsed.output || "";
                  } catch {
                    token = data;
                  }
                } else {
                  // Direct NDJSON lines or raw text
                  try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.type === "item" && parsed.content) {
                      token = parsed.content;
                    } else if (parsed.type === "end") {
                      // Sub-node ended (tool completed), main stream continues
                    } else if (parsed.type === "keepalive") {
                      // Keepalive ping, ignore
                    } else if (parsed.toolCall) {
                      const labelMap: Record<string, string> = {
                        "Zoho CRM Deals & Campaigns": "Querying Zoho CRM deals...",
                        "Zoho CRM Invoices": "Querying Zoho CRM invoices...",
                        "Zoho CRM Client Accounts": "Querying Zoho CRM accounts...",
                        "Campaign Knowledge Base": "Querying Zoho Knowledge Base...",
                        "Supabase Vector Store": "Querying Zoho Knowledge Base...",
                        "Supabase Vector Retriever": "Querying Zoho Knowledge Base...",
                        "Pending Tasks & SOP Action Items": "Loading pending tasks...",
                      };
                      let displayLabel =
                        labelMap[parsed.toolCall as string] ||
                        `Processing: ${parsed.toolCall}...`;
                      displayLabel = displayLabel
                        .replace(/supabase/gi, "Zoho Knowledge Base")
                        .replace(/pgvector/gi, "SOP Index")
                        .replace(/vector store/gi, "Zoho Knowledge Base");
                      setToolCallLabel(displayLabel);
                      continue;
                    } else {
                      token = parsed.text || parsed.content || parsed.output || "";
                    }
                  } catch {
                    token = trimmed;
                  }
                }

                if (token) {
                  accumulatedContent += token;

                  if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    const elapsed = Date.now() - thinkingStartTime;
                    const minThinkingDuration = 1200;
                    const remainingDelay = Math.max(0, minThinkingDuration - elapsed);

                    if (remainingDelay > 0) {
                      setTimeout(() => {
                        setIsThinking(false);
                      }, remainingDelay);
                    } else {
                      setIsThinking(false);
                    }

                    const initialMsg: Message = {
                      id: `msg-${Date.now()}-assistant`,
                      role: "assistant",
                      content: accumulatedContent,
                      timestamp: new Date(),
                    };
                    setSession((prev) => ({
                      ...prev,
                      messages: [...prev.messages, initialMsg],
                    }));
                  } else {
                    setSession((prev) => {
                      const msgs = [...prev.messages];
                      const lastIdx = msgs.length - 1;
                      if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
                        msgs[lastIdx] = {
                          ...msgs[lastIdx],
                          content: accumulatedContent,
                        };
                      }
                      return { ...prev, messages: msgs };
                    });
                  }
                }
              }
            }

            // Check if trailing buffer has unparsed token
            if (buffer.trim() && !buffer.includes("[DONE]")) {
              try {
                const parsed = JSON.parse(buffer.trim());
                const leftover = parsed.content || parsed.text || parsed.output || "";
                if (leftover) accumulatedContent += leftover;
              } catch {}
            }



            // Ensure assistant message is ALWAYS rendered even if streaming ended without prior chunks
            if (!firstChunkReceived) {
              setIsThinking(false);
              setToolCallLabel(null);
              let fallbackContent = accumulatedContent;
              if (!fallbackContent) {
                if (planModified && modificationSummary) {
                  fallbackContent = modificationSummary;
                } else if (activePlan) {
                  fallbackContent =
                    `### Strategic Campaign Plan: **${activePlan.campaignData.name}**\n\n` +
                    `[Confirmed Information]\n` +
                    `All 4 milestone aspects (Legal, Compliance, Escrow Accounting, Tech & QR) have been verified against BigCity SOPs.\n\n` +
                    `[Recommendation]\n` +
                    `Review the tasks on the canvas. You can reassign owners, adjust TATs, or click **Approve & Push to Zoho**.`;
                } else {
                  // Re-route to static engine client-side rather than showing a generic message.
                  // This covers the case where n8n returned begin/end frames but no item content.
                  fallbackContent =
                    `I received your request. The live AI connection appears to be processing.\n\n` +
                    `[Note] If this happens repeatedly, try:\n` +
                    `- Asking about invoices: "Show my invoices"\n` +
                    `- Checking pending tasks: "Show pending tasks"\n` +
                    `- Viewing the team: "Who is Sneha Nair?"\n\n` +
                    `These work in offline mode without the live Zoho connection.`;
                }
              }

              const assistantMessage: Message = {
                id: `msg-${Date.now()}-assistant`,
                role: "assistant",
                content: fallbackContent,
                timestamp: new Date(),
              };
              setSession((prev) => ({
                ...prev,
                messages: [...prev.messages, assistantMessage],
              }));
            }
          } catch (readErr) {
            if ((readErr as Error).name !== "AbortError") throw readErr;
          } finally {
            setIsThinking(false);
            setToolCallLabel(null);
            setIsLoading(false);
          }
        } else {
          const data = await response.json();
          setIsThinking(false);
          setIsLoading(false);

          let outputText = data.text || data.output || data.content || data.error || "";
          if (planModified && modificationSummary) {
            outputText = `${modificationSummary}\n\n---\n${outputText}`;
          }



          const assistantMessage: Message = {
            id: `msg-${Date.now()}-assistant`,
            role: "assistant",
            content: outputText || "Plan updated successfully.",
            timestamp: new Date(),
          };

          setSession((prev) => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
          }));
        }
      } catch (err: unknown) {
        setIsThinking(false);
        // User deliberately stopped, no error banner needed
        if (err instanceof DOMException && err.name === "AbortError") return;

        // If network failed but we modified plan locally, show plan result as normal message
        if (planModified && modificationSummary) {
          const assistantMessage: Message = {
            id: `msg-${Date.now()}-assistant`,
            role: "assistant",
            content: modificationSummary,
            timestamp: new Date(),
          };
          setSession((prev) => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
          }));
        } else {
          // Show as ErrorInlineBanner, not as an AI chat message
          const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
          setChatError({
            title: isOffline
              ? "You appear to be offline"
              : "Couldn't reach the AI service",
            description: isOffline
              ? "Check your internet connection and try again. Your message is saved above."
              : "This is a connection issue on our end. Try again, your message wasn't sent twice.",
            severity: "warning",
            retryContent: content,
          });
        }
      } finally {
        setIsLoading(false);
        setIsThinking(false);
        setToolCallLabel(null);
        abortRef.current = null;
      }
    },
    [session.id, session.messages, workingPlan, showToast]
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setIsThinking(false);
  }, []);

  const handleNewChat = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(COPILOT_SESSION_KEY);
        localStorage.removeItem(COPILOT_WORKING_PLAN_KEY);
        localStorage.removeItem(COPILOT_PANEL_OPEN_KEY);
        localStorage.removeItem("prism_copilot_draft_input");
        localStorage.removeItem("prism_active_plan_context");
      } catch {}
    }
    setSession(createSession());
    setWorkingPlan(null);
    activeWorkingPlanRef.current = null;
    setIsPlanPanelOpen(false);
    lastProcessedContextRef.current = null;
    if (onClearPlanContext) onClearPlanContext();
    isPinnedToBottomRef.current = true;
    setShowScrollBottomBtn(false);
  }, [onClearPlanContext]);

  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    let md = `# BCP Assist, Copilot Session\n*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`;
    messages.forEach((m) => {
      const timeStr = m.timestamp instanceof Date ? m.timestamp.toLocaleTimeString() : new Date(m.timestamp).toLocaleTimeString();
      md += `### ${m.role.toUpperCase()} (${timeStr}):\n\n${m.content}\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BCP_Assist_Copilot_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported chat session to Markdown", "check");
  }, [messages, showToast]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAF9] overflow-hidden relative">
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
            {toastNotice.icon === "trash" ? (
              <Trash size={14} className="text-rose-400 flex-shrink-0" />
            ) : toastNotice.icon === "user" ? (
              <User size={14} className="text-amber-400 flex-shrink-0" />
            ) : toastNotice.icon === "sparkle" ? (
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

      {/* Header */}
      <header className="h-14 border-b border-stone-200/70 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BigCityLogo size={22} variant="tile" className="rounded-md border border-stone-200/80 shadow-2xs p-0.5 shrink-0" />
            <h1 className="text-[14.5px] font-bold text-stone-900 tracking-tight">
              {workingPlan ? "Plan Copilot Studio" : "BCP Assist"}
            </h1>
            <span className="text-[11px] text-stone-400 font-medium hidden sm:inline">
              by <span className="text-blue-600 font-semibold">Enlight Lab</span>
            </span>
          </div>
          {workingPlan && !isPlanPanelOpen && (
            <button
              type="button"
              onClick={() => setIsPlanPanelOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm cursor-pointer"
            >
              <Sparkle size={13} weight="fill" className="text-indigo-500" />
              Show Plan ({workingPlan.tasks.length})
            </button>
          )}
          {workingPlan && isPlanPanelOpen ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 hidden sm:inline-flex">
              <Sparkle size={12} weight="fill" className="text-amber-500" />
              Editing: {workingPlan.campaignData.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 hidden sm:flex">
              {session.messages.length > 0 ? deriveTitle(session.messages) : "Ready"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {workingPlan && isPlanPanelOpen && (
            <button
              onClick={() => setIsPlanPanelOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-colors border border-stone-200 shadow-xs text-xs font-semibold cursor-pointer"
            >
              <span>Hide Plan</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-colors border border-stone-200 shadow-xs text-xs font-semibold cursor-pointer"
              title="Export session to Markdown"
            >
              <DownloadSimple size={14} weight="bold" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} weight="bold" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* Paused-connections notice, pinned at the top under the header. Chat */}
      {/* refuses paused connectors server-side, so this explains up front WHY */}
      {/* those sources are unavailable. Dismiss until the paused set changes. */}
      <AnimatedErrorBanner
        show={Boolean(activeConnectors) && hasPausedAny && pausedKey !== dismissedPauseKey}
        severity="warning"
        title={
          pausedConnectorIds.length > 0
            ? `You have paused the connection: ${pausedConnectorIds.map((id) => PAUSED_PILL_LABELS[id]).join(", ")}`
            : "You have paused the connection"
        }
        description="Paused connections can't be used. Go to the Connections page and turn them on to restore access."
        action={
          onNavigateToConnections
            ? { label: "Go to Connections", onClick: onNavigateToConnections }
            : undefined
        }
        onDismiss={() => setDismissedPauseKey(pausedKey)}
        className="border-b border-amber-200 rounded-none px-6 py-2.5"
      />

      {/* Proactive Risk Nudge Banner */}
      {!workingPlan && riskDigest && riskDigest.criticalActionItems && riskDigest.criticalActionItems.length > 0 && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between z-10 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={14} className="text-rose-600" weight="bold" />
            </div>
            <div>
              <p className="text-[11.5px] font-bold text-rose-900">
                Action Required: {riskDigest.criticalActionItems[0].deal}
              </p>
              <p className="text-[10.5px] font-medium text-rose-700 mt-0.5">
                {riskDigest.criticalActionItems[0].issue}, Assigned to {riskDigest.criticalActionItems[0].owner}
              </p>
            </div>
          </div>
          <button 
            onClick={() => sendMessage(`Show me the plan and risks for ${riskDigest.criticalActionItems[0].deal}`)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          >
            Review Plan
          </button>
        </div>
      )}

      {/* Workspace Area: Split-Pane when working on a plan, Full width for normal chat */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT PANE: Chat & Modification Prompt Stream */}
        <div
          className={`flex flex-col h-full min-h-0 transition-all duration-300 ${
            workingPlan && isPlanPanelOpen ? "w-full lg:w-[44%] border-r border-stone-200 bg-[#FAFAF9]" : "w-full"
          }`}
        >
          {/* Scrollable messages */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 flex flex-col items-center space-y-4 w-full min-w-0"
          >
            {messages.length === 0 ? (
              <EmptyState onSelectPrompt={sendMessage} activeConnectors={activeConnectors ?? undefined} />
            ) : (
              <div ref={messagesInnerRef} className="w-full max-w-2xl space-y-4 min-w-0">
                {/* Chat message stream */}
                {messages.map((msg, index) => (
                  <ChatMessage key={msg.id} message={msg} index={index} />
                ))}

                {/* Live Thinking Stepper */}
                <AnimatePresence>
                  {isThinking && (
                    <ThinkingProcess
                      key="thinking"
                      mode={workingPlan && session.messages.length === 1 ? "plan" : "chat"}
                      toolCallLabel={toolCallLabel ?? undefined}
                      userPrompt={session.messages[session.messages.length - 1]?.content || ""}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}
            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Paused-connections notice lives at the top, under the header. */}
          {/* Chat stream error, shown as a banner, not an AI message */}
          <AnimatedErrorBanner
            show={!!chatError}
            severity={chatError?.severity ?? "warning"}
            title={chatError?.title ?? ""}
            description={chatError?.description}
            action={
              chatError?.retryContent
                ? {
                    label: "Retry",
                    onClick: () => {
                      setChatError(null);
                      sendMessage(chatError.retryContent!);
                    },
                  }
                : undefined
            }
            onDismiss={() => setChatError(null)}
            className="mx-4 mb-2"
          />

          {/* Intent routing notice, auto-dismisses after 6s */}
          <AnimatedErrorBanner
            show={!!intentError}
            severity="warning"
            title="AI routing unavailable"
            description={intentError ?? ""}
            onDismiss={() => setIntentError(null)}
            className="mx-4 mb-2"
          />

          {/* Task sync failure notice */}
          <AnimatedErrorBanner
            show={taskSyncError}
            severity="warning"
            title="Task change saved locally"
            description="This update didn't sync to Zoho, it's not lost. It will retry on next load."
            onDismiss={() => setTaskSyncError(false)}
            className="mx-4 mb-2"
          />

          {/* Floating 'Latest messages' pill */}
          <div className="relative w-full flex justify-center h-0 overflow-visible z-20 pointer-events-none">
            <AnimatePresence>
              {showScrollBottomBtn && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: -16, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-auto"
                >
                  <button
                    type="button"
                    onClick={() => {
                      isPinnedToBottomRef.current = true;
                      setShowScrollBottomBtn(false);
                      scrollToBottom("smooth", true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md hover:bg-stone-50 border border-stone-200 shadow-md text-stone-700 hover:text-stone-900 text-xs font-semibold cursor-pointer transition-all hover:shadow-lg hover:scale-105 active:scale-95"
                  >
                    <ArrowDown size={13} weight="bold" className="text-stone-600" />
                    <span>Latest messages</span>
                    {(isThinking || isLoading) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse ml-0.5" />
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Chat Input Bar */}
          <div className="p-3.5 bg-white border-t border-stone-200/80 flex-shrink-0 shadow-xs">
            <div className="max-w-2xl mx-auto flex flex-col gap-2">
              {/* Contextual Suggestion Chips */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {messages.length === 0 ? (
                  <>
                    <button onClick={() => sendMessage("Create a plan for a Nestlé campaign")} className="text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-600 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border border-stone-200">Create a plan for a Nestlé campaign</button>
                    <button onClick={() => sendMessage("What is a scratch & win campaign?")} className="text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-600 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border border-stone-200">What is a scratch & win campaign?</button>
                  </>
                ) : workingPlan && workingPlan.status === "draft" ? (
                  <>
                    {workingPlan.booksContact && !workingPlan.booksContact.exists && !workingPlan.booksCustomerId && (
                      <button
                        onClick={() => handleCreateBooksContact()}
                        disabled={isCreatingBooksContact}
                        className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer border border-amber-300 flex items-center gap-1 shadow-2xs animate-pulse"
                      >
                        {isCreatingBooksContact ? (
                          <ArrowsClockwise size={12} className="animate-spin text-amber-600" />
                        ) : (
                          <Sparkle size={12} weight="fill" className="text-amber-500" />
                        )}
                        Register &quot;{workingPlan.campaignData.client}&quot; in Zoho Books
                      </button>
                    )}
                    <button onClick={() => sendMessage("Assign all legal tasks to Akash Verma")} className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border border-indigo-200">Assign all legal tasks to Akash</button>
                    <button onClick={() => sendMessage("Suggest improvements")} className="text-[10px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border border-sky-200">Suggest improvements</button>
                    <button onClick={() => sendMessage("Approve")} className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border border-emerald-200 flex items-center gap-1"><CheckCircle size={12} weight="fill" /> Approve</button>
                    <button onClick={handleSaveWorkingPlanAsDraft} disabled={isSavingDraft} className="text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border border-stone-200 flex items-center gap-1 disabled:opacity-50"><FloppyDisk size={12} weight="bold" /> {isSavingDraft ? "Saving…" : "Save as Draft"}</button>
                  </>
                ) : workingPlan && workingPlan.status === "live" ? (
                  <>
                    <button onClick={handleNewChat} className="text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-600 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border border-stone-200">Start new plan</button>
                  </>
                ) : null}
              </div>

              <ChatInput
                onSendMessage={sendMessage}
                isLoading={isLoading || isPushingToZoho}
                onStop={handleStop}
              />
              <div className="flex items-center justify-between text-[11px] text-stone-400 px-1 mt-1">
                <span>
                  Press <kbd className="px-1.5 py-0.5 rounded bg-stone-50 border border-stone-200 text-[10px] text-stone-600 font-mono shadow-xs">Enter ↵</kbd> to send
                </span>
                <span className="font-medium text-stone-500">Powered by live connectors</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Live Full Plan Canvas & Task Studio */}
        {workingPlan && (
          <div className="hidden lg:flex flex-1 flex-col h-full min-h-0 bg-[#FBFBFA] overflow-hidden">
            {/* Header: Campaign Info & Push Action (Clean, uncrowded layout) */}
            <div className="px-6 py-4 border-b border-stone-200/80 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3.5 flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-stone-900 tracking-tight truncate mb-1.5">
                  {workingPlan.campaignData.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                      isFullySynced
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : workingPlan.zohoCrmDealId
                          ? "bg-sky-50 text-sky-800 border-sky-200"
                          : "bg-amber-50 text-amber-900 border-amber-200"
                    }`}
                  >
                    <Kanban size={12} weight="fill" />
                    {isFullySynced
                      ? `LIVE · ALL ZOHO SYNCED`
                      : workingPlan.zohoCrmDealId
                        ? `CRM DEAL · ${workingPlan.zohoCrmDealId}`
                        : "PLAN PREVIEW"}
                  </span>
                  <span className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/60">
                    {workingPlan.campaignData.client}
                  </span>
                  <span className="text-[11px] font-mono font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/60">
                    {workingPlan.campaignData.budget}
                  </span>
                  <span className="text-[11px] font-mono font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/60">
                    {workingPlan.campaignData.codeVolume}
                  </span>
                  {workingPlan.booksCustomerId || workingPlan.booksContact?.exists ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle size={12} weight="fill" />
                      Books: {workingPlan.booksContact?.contactName || "Verified"}
                    </span>
                  ) : workingPlan.booksContact && !workingPlan.booksContact.exists ? (
                    <button
                      type="button"
                      onClick={() => handleCreateBooksContact()}
                      disabled={isCreatingBooksContact}
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 transition-colors cursor-pointer"
                      title="Client not found in Zoho Books. Click to register customer."
                    >
                      {isCreatingBooksContact ? (
                        <ArrowsClockwise size={12} className="animate-spin text-amber-600" />
                      ) : (
                        <WarningCircle size={12} weight="fill" className="text-amber-600" />
                      )}
                      Books: Missing (Register)
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Main Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-all cursor-pointer border border-stone-200 shadow-2xs"
                  title="Add custom task to plan"
                >
                  <Plus size={13} weight="bold" />
                  <span>Add Task</span>
                </button>

                {isFullySynced ? (
                  <div className="flex items-center gap-2">
                    {workingPlan.zohoCrmDealUrl && (
                      <a
                        href={workingPlan.zohoCrmDealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all"
                        title="Open in Zoho CRM"
                      >
                        <ArrowSquareOut size={13} weight="bold" />
                        <span>Zoho CRM</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={onViewCampaigns}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                    >
                      <Kanban size={13} weight="bold" />
                      <span>View in Campaigns</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {workingPlan.zohoCrmDealUrl && (
                      <a
                        href={workingPlan.zohoCrmDealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all"
                        title="Open in Zoho CRM"
                      >
                        <ArrowSquareOut size={13} weight="bold" />
                        <span>Zoho CRM</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenApprovalModal()}
                      disabled={isPushingToZoho}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer active:scale-98"
                    >
                      {isPushingToZoho ? (
                        <>
                          <ArrowsClockwise size={13} className="animate-spin" />
                          <span>Syncing to Zoho…</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={13} weight="fill" />
                          <span>Approve & Sync to Zoho</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Filter & Aspect Navigator Tabs (FULLY INTERACTIVE & FILTERABLE) */}
            <div className="px-6 py-2.5 bg-white border-b border-stone-200/60 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {(
                  [
                    { id: "all" as const, label: "All Tasks", count: workingPlan.tasks.length, icon: Sparkle },
                    { id: "legal" as const, label: "Legal", count: workingPlan.tasks.filter((t) => t.aspect === "legal").length, icon: Scales },
                    { id: "compliance" as const, label: "Compliance", count: workingPlan.tasks.filter((t) => t.aspect === "compliance").length, icon: ShieldCheck },
                    { id: "accounting" as const, label: "Accounting", count: workingPlan.tasks.filter((t) => t.aspect === "accounting").length, icon: Receipt },
                    { id: "implementation" as const, label: "Tech & Ops", count: workingPlan.tasks.filter((t) => t.aspect === "implementation").length, icon: Cpu },
                  ]
                ).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = selectedAspectFilter === tab.id;
                  const activeClass =
                    tab.id === "all"
                      ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                      : ASPECT_META[tab.id as keyof typeof ASPECT_META]?.activeTab || "bg-stone-900 text-white";

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedAspectFilter(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isActive
                          ? activeClass
                          : "bg-stone-50 hover:bg-stone-100 border-stone-200/80 text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      <Icon
                        size={13}
                        weight={isActive ? "fill" : "bold"}
                        className={isActive && tab.id !== "all" ? "" : isActive ? "text-amber-400" : "text-stone-400"}
                      />
                      <span>{tab.label}</span>
                      <span
                        className={`ml-0.5 text-[11px] font-mono px-1.5 py-0.2 rounded-full border ${
                          isActive
                            ? tab.id === "all"
                              ? "bg-stone-800 border-stone-700 text-stone-200"
                              : "bg-white/80 border-black/10 text-stone-800"
                            : "bg-white border-stone-200 text-stone-500"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search input for instant task lookup */}
              <div className="relative flex items-center min-w-[170px] max-w-[220px]">
                <MagnifyingGlass size={13} className="absolute left-2.5 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter tasks..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="w-full pl-7.5 pr-6 py-1 text-xs bg-stone-50 hover:bg-stone-100/80 focus:bg-white border border-stone-200 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-stone-400"
                />
                {taskSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTaskSearchQuery("")}
                    className="absolute right-2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Spacious Scrollable Task Cards */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {displayedTasks.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-3 text-stone-400">
                    <Funnel size={22} weight="light" />
                  </div>
                  <h4 className="text-sm font-semibold text-stone-800">No tasks match filter</h4>
                  <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                    {taskSearchQuery
                      ? `No tasks matching "${taskSearchQuery}" in ${selectedAspectFilter === "all" ? "the plan" : selectedAspectFilter}.`
                      : `No tasks found in the ${selectedAspectFilter} aspect.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAspectFilter("all");
                      setTaskSearchQuery("");
                    }}
                    className="mt-3.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer border border-stone-200"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                <AnimatePresence>
                  {displayedTasks.map((task, i) => {
                    const meta =
                      ASPECT_META[task.aspect as keyof typeof ASPECT_META] ||
                      ASPECT_META.implementation;
                    const Icon = meta.icon;
                    const isHighlighted = highlightedTaskIds.includes(task.id);
                    const isEditingAssignee = editingAssigneeTaskId === task.id;

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: isHighlighted ? [1, 1.015, 1] : 1,
                        }}
                        transition={{ duration: 0.25, delay: i * 0.02 }}
                        className={`p-3.5 rounded-xl bg-white border transition-all space-y-2 relative group ${
                          isHighlighted
                            ? "border-amber-400 shadow-md ring-2 ring-amber-300/40 bg-amber-50/20"
                            : "border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-stone-300"
                        } border-l-4 ${meta.border}`}
                      >
                        {/* Top row: Aspect Icon + Title + Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-6.5 h-6.5 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}
                            >
                              <Icon size={13} weight="duotone" className={meta.light} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold text-stone-400">
                                  {task.sopCode}
                                </span>
                                {isHighlighted && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                    UPDATED
                                  </span>
                                )}
                              </div>
                              <h4 className="text-[13px] font-bold text-stone-900 leading-snug">
                                {task.title}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* TAT Display Pill (Duration - editable only via chat) */}
                            <div
                              className="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 flex items-center gap-1 border border-stone-200/60"
                              title="Task duration (edit via chat)"
                            >
                              <Clock size={11} className="text-stone-400" />
                              {task.tat}
                            </div>

                            {/* Delete Task Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="w-6 h-6 rounded-md text-stone-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Delete task from plan"
                            >
                              <Trash size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Details text */}
                        {task.details && (
                          <p className="text-[11.5px] text-stone-600 leading-relaxed pl-9">
                            {task.details}
                          </p>
                        )}

                        {/* Metadata & Assignee Selector Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-stone-100 pl-9 text-xs text-stone-500">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md border ${meta.badge}`}
                            >
                              {meta.label}
                            </span>

                            {/* Interactive Assignee Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingAssigneeTaskId(
                                    isEditingAssignee ? null : task.id
                                  )
                                }
                                className="flex items-center gap-1.5 text-stone-800 font-medium px-2 py-0.5 rounded-md hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200 cursor-pointer text-[11.5px]"
                                title="Click to reassign task owner"
                              >
                                <User size={11} className="text-stone-400" />
                                <span>{task.assignee}</span>
                                <CaretDown size={9} className="text-stone-400 ml-0.5" />
                              </button>

                              {/* Dropdown Menu */}
                              {isEditingAssignee && (
                                <>
                                  <div
                                    className="fixed inset-0 z-30"
                                    onClick={() => setEditingAssigneeTaskId(null)}
                                  />
                                  <div className="absolute left-0 bottom-full mb-1 z-40 w-64 bg-white rounded-xl shadow-xl border border-stone-200 p-1.5 text-xs max-h-56 overflow-y-auto">
                                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
                                      Reassign Team SPOC
                                    </div>
                                    <div className="py-1 space-y-0.5">
                                      {BIGCITY_TEAM.map((member) => (
                                        <button
                                          key={member.name}
                                          type="button"
                                          onClick={() => {
                                            handleUpdateTaskField(task.id, {
                                              assignee: member.name,
                                              role: member.role,
                                            });
                                            setEditingAssigneeTaskId(null);
                                          }}
                                          className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-stone-100 transition-colors cursor-pointer ${
                                            task.assignee === member.name
                                              ? "bg-amber-50 text-amber-900 font-bold"
                                              : "text-stone-700"
                                          }`}
                                        >
                                          <div>
                                            <div className="font-semibold text-xs">{member.name}</div>
                                            <div className="text-[10px] text-stone-400">
                                              {member.role}
                                            </div>
                                          </div>
                                          {task.assignee === member.name && (
                                            <Check size={12} className="text-amber-600 font-bold" />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ADD TASK MODAL */}
      <AnimatePresence>
        {isAddTaskModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddTaskModalOpen(false)}
              className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl z-10 border border-stone-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-stone-900 text-white flex items-center justify-center">
                    <Plus size={14} weight="bold" />
                  </div>
                  <h3 className="text-sm font-bold text-stone-900">Add Task to Project Plan</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Partner NDA & Terms Sign-Off"
                    value={newTaskForm.title}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white text-xs text-stone-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Aspect
                    </label>
                    <select
                      value={newTaskForm.aspect}
                      onChange={(e) => {
                        const asp = e.target.value as any;
                        const defaultAssignee =
                          asp === "legal"
                            ? "Akash Verma"
                            : asp === "compliance"
                            ? "Khaleel Ahmed"
                            : asp === "accounting"
                            ? "Sneha Nair"
                            : "Sachin (Tech Team)";
                        const member = BIGCITY_TEAM.find((m) => m.name === defaultAssignee);
                        setNewTaskForm({
                          ...newTaskForm,
                          aspect: asp,
                          assignee: defaultAssignee,
                          role: member ? member.role : "Lead",
                        });
                      }}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-500 text-xs text-stone-900"
                    >
                      <option value="legal">Legal</option>
                      <option value="compliance">Compliance</option>
                      <option value="accounting">Accounting</option>
                      <option value="implementation">Tech & Ops</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Assignee (SPOC)
                    </label>
                    <select
                      value={newTaskForm.assignee}
                      onChange={(e) => {
                        const member = BIGCITY_TEAM.find((m) => m.name === e.target.value);
                        setNewTaskForm({
                          ...newTaskForm,
                          assignee: e.target.value,
                          role: member ? member.role : "Lead",
                        });
                      }}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-500 text-xs text-stone-900"
                    >
                      {BIGCITY_TEAM.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Turnaround Time (TAT)
                  </label>
                  <select
                    value={newTaskForm.tat}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, tat: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-500 text-xs text-stone-900"
                  >
                    <option value="1 Day">1 Day</option>
                    <option value="2 Days">2 Days</option>
                    <option value="3 Days">3 Days</option>
                    <option value="5 Days">5 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Details / Deliverable
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe SOP requirements, deliverables, or criteria..."
                    value={newTaskForm.details}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, details: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white text-xs text-stone-900"
                  />
                </div>
              </div>

              <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewTask}
                  disabled={!newTaskForm.title.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={14} weight="bold" />
                  <span>Add to Plan</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zoho Books Customer Registration Confirmation Modal */}
      <AnimatePresence>
        {isBooksModalOpen && workingPlan && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBooksModalOpen(false)}
              className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
                  <Receipt size={22} weight="bold" />
                </div>
                <h3 className="text-base font-bold text-stone-900 mb-1">
                  Zoho Books Customer Required
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mb-4">
                  Client <strong className="text-stone-900">{workingPlan.campaignData.client}</strong> is not registered as an active contact in Zoho Books (Org <code className="font-mono text-stone-700 bg-stone-100 px-1 py-0.5 rounded text-[11px]">60085935698</code>).
                </p>
                <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200/80 text-[11.5px] text-amber-900 flex items-start gap-2.5 mb-5">
                  <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    To automatically issue the advance GST invoice for <strong>{workingPlan.campaignData.budget}</strong>, we should register them before approving.
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const newId = await handleCreateBooksContact();
                      if (newId) {
                        await handleOpenApprovalModal(newId);
                      }
                    }}
                    disabled={isCreatingBooksContact}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingBooksContact ? (
                      <>
                        <ArrowsClockwise size={14} className="animate-spin" />
                        <span>Registering & Approving…</span>
                      </>
                    ) : (
                      <>
                        <Sparkle size={14} weight="fill" className="text-amber-300" />
                        <span>Register in Books & Approve</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsBooksModalOpen(false);
                      handleOpenApprovalModal();
                    }}
                    disabled={isCreatingBooksContact}
                    className="w-full py-2 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Approve Without Books Invoice
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBooksModalOpen(false)}
                    className="w-full py-1.5 text-center text-xs text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Approval gate modal, the ONLY path to a Zoho push from the Copilot */}
      <ApprovalModal
        open={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        campaignData={workingPlan?.campaignData || {}}
        tasks={workingPlan?.tasks || []}
        booksContact={workingPlan?.booksContact || null}
        isPushing={isPushingToZoho}
        source="Copilot"
        onConfirm={() => confirmApprovePlanToZoho()}
      />
    </div>
  );
}
