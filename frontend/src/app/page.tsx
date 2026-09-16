"use client";

// =============================================================================
// 🔷 Prism, unified app shell (Phase 3)
//
// Root page of the merged product. The 8-view sidebar shell hosts both feature
// sets: Workspace (Home / Copilot / Inbox / Documents), Operations (Campaigns /
// Connections) and Administration (Users & Roles / Settings). The legacy
// Microsoft cockpit remains mounted at /cockpit until its flows migrate onto
// the connector architecture (Phase 4).
// =============================================================================

import { useState, useEffect } from "react";
import { List } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import PrismSidebar, { type NavView, NAV_LABELS } from "@/components/PrismSidebar";
import PrismLogo from "@/components/brand/PrismLogo";
import EnlightLogo from "@/components/brand/EnlightLogo";
import HomeView from "@/components/views/HomeView";
import InboxView from "@/components/views/InboxView";
import DocumentsView from "@/components/views/DocumentsView";
import CopilotView from "@/components/CopilotView";
import CampaignsView from "@/components/CampaignsView";
import ConnectionsView from "@/components/ConnectionsView";
import UsersAndRolesView from "@/components/UsersAndRolesView";
import SettingsView from "@/components/SettingsView";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/components/providers/AuthProvider";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export interface PlanContextForCopilot {
  campaignData: {
    name: string;
    client: string;
    rewardType: string;
    budget: string;
    codeVolume: string;
    startDate?: string;
    endDate?: string;
    brief: string;
    brandColor?: string;
  };
  plan: any;
}

const VALID_VIEWS: NavView[] = [
  "home",
  "copilot",
  "inbox",
  "documents",
  "campaigns",
  "connections",
  "users",
  "settings",
];

export default function PrismApp() {
  const { user } = useAuth();
  const { activeOrg } = useOrganization();
  const viewKey = user ? `prism_active_view_${user.id}` : "prism_active_view_guest";
  const planContextKey = user ? `prism_active_plan_context_${user.id}` : "prism_active_plan_context_guest";

  const [currentView, setCurrentView] = useState<NavView>("home");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activePlanForCopilot, setActivePlanForCopilot] = useState<PlanContextForCopilot | null>(null);
  const [campaignCount, setCampaignCount] = useState<number>(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    handleNavigate("copilot");
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    handleNavigate("copilot");
  };

  const handleDeleteSession = (sessionId: string) => {
    if (activeSessionId === sessionId) {
      handleNewChat();
    }
    if (typeof window !== "undefined") {
      try {
        const userSessionKey = user ? `prism_copilot_session_${user.id}` : "prism_copilot_session_guest";
        const saved = localStorage.getItem(userSessionKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.id === sessionId) {
            localStorage.removeItem(userSessionKey);
          }
        }
      } catch {}
    }
  };

  // Restore navigation view and active plan context on mount or user change
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Resolve view from URL hash or localStorage
    const hash = window.location.hash.replace("#", "") as NavView;
    let initialView: NavView | null = null;
    if (VALID_VIEWS.includes(hash)) {
      initialView = hash;
    } else {
      try {
        const savedView = localStorage.getItem(viewKey) as NavView;
        if (VALID_VIEWS.includes(savedView)) {
          initialView = savedView;
        }
      } catch {}
    }
    if (initialView && initialView !== "home") {
      // If returning to a deferred view, gently redirect to home
      if (initialView === "inbox" || initialView === "documents" || initialView === "settings") {
        initialView = "home";
        try {
          localStorage.setItem(viewKey, "home");
        } catch {}
      }
      setCurrentView(initialView);
      window.history.replaceState(null, "", `#${initialView}`);
    }

    // 2. Resolve active plan context
    try {
      const savedPlan = localStorage.getItem(planContextKey);
      if (savedPlan) {
        const parsed = JSON.parse(savedPlan);
        if (parsed && parsed.campaignData) {
          setActivePlanForCopilot(parsed);
        }
      } else {
        setActivePlanForCopilot(null);
      }
    } catch {}

    // 3. Listen to hashchange for browser back/forward buttons and in-page
    // navigation links (e.g. `/#connections` deep links from error banners).
    const handleHashChange = () => {
      const currentHash = window.location.hash.replace("#", "") as NavView;
      if (VALID_VIEWS.includes(currentHash)) {
        setCurrentView(currentHash);
        try {
          localStorage.setItem(viewKey, currentHash);
        } catch {}
      }
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [viewKey, planContextKey]);

  const handleNavigate = (view: NavView) => {
    setCurrentView(view);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(viewKey, view);
        window.history.replaceState(null, "", `#${view}`);
      } catch {}
    }
  };

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (activeOrg?.id) headers["x-active-org-id"] = activeOrg.id;

    fetch("/api/campaigns", { headers })
      .then((res) => (res.ok ? res.json() : { campaigns: [] }))
      .then((data) => {
        if (Array.isArray(data.campaigns)) {
          setCampaignCount(data.campaigns.length);
        }
      })
      .catch(() => {});
  }, [currentView, activeOrg?.id]);

  const handleModifyInCopilot = (campaignData: any, plan: any) => {
    const planContext = { campaignData, plan };
    setActivePlanForCopilot(planContext);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(planContextKey, JSON.stringify(planContext));
      } catch {}
    }
    handleNavigate("copilot");
  };

  const handleClearPlanContext = () => {
    setActivePlanForCopilot(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(planContextKey);
      } catch {}
    }
  };

  const renderView = () => {
    switch (currentView) {
      case "home":
        return <HomeView onNavigate={handleNavigate} />;
      case "copilot":
        return (
          <CopilotView
            initialPlanContext={activePlanForCopilot}
            onClearPlanContext={handleClearPlanContext}
            onViewCampaigns={() => handleNavigate("campaigns")}
            onNavigateToConnections={() => handleNavigate("connections")}
            activeSessionId={activeSessionId}
            onSessionSelect={handleSelectSession}
          />
        );
      case "inbox":
        return <InboxView />;
      case "documents":
        return <DocumentsView />;
      case "campaigns":
        return <CampaignsView onModifyInCopilot={handleModifyInCopilot} />;
      case "connections":
        return <ConnectionsView />;
      case "users":
        return <UsersAndRolesView />;
      case "settings":
        return <SettingsView />;
      default:
        return <HomeView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#FAFAF9] text-stone-900 overflow-hidden font-sans antialiased">
      {/* Persistent Prism Sidebar */}
      <PrismSidebar
        currentView={currentView}
        onViewChange={handleNavigate}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        campaignCount={campaignCount}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="lg:hidden h-12 border-b border-stone-200/60 bg-white px-4 flex items-center justify-between flex-shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
              aria-label="Open navigation"
            >
              <List size={17} weight="bold" />
            </button>
            <div className="flex items-center gap-2">
              <PrismLogo size={20} variant="tile" className="rounded-lg shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-bold text-stone-900">Prism</span>
                <span className="text-[10px] text-stone-300">·</span>
                <span className="text-[11.5px] text-stone-500 font-medium capitalize">
                  {NAV_LABELS[currentView]}
                </span>
              </div>
            </div>
          </div>
          <div className="w-8" />
        </div>

        {/* Animated View Switcher */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
