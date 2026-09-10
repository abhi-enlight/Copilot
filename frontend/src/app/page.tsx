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
import BigCityLogo from "@/components/BigCityLogo";
import EnlightLogo from "@/components/brand/EnlightLogo";
import HomeView from "@/components/views/HomeView";
import InboxView from "@/components/views/InboxView";
import DocumentsView from "@/components/views/DocumentsView";
import CopilotView from "@/components/CopilotView";
import CampaignsView from "@/components/CampaignsView";
import ConnectionsView from "@/components/ConnectionsView";
import UsersAndRolesView from "@/components/UsersAndRolesView";
import SettingsView from "@/components/SettingsView";

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
    startDate: string;
    endDate: string;
    brief: string;
  };
  plan: {
    tasks: any[];
    aspectSummary: any;
  };
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
  const [currentView, setCurrentView] = useState<NavView>("home");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activePlanForCopilot, setActivePlanForCopilot] = useState<PlanContextForCopilot | null>(null);
  const [campaignCount, setCampaignCount] = useState<number>(0);

  // Restore navigation view and active plan context on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Resolve view from URL hash or localStorage
    const hash = window.location.hash.replace("#", "") as NavView;
    let initialView: NavView | null = null;
    if (VALID_VIEWS.includes(hash)) {
      initialView = hash;
    } else {
      try {
        const savedView = localStorage.getItem("prism_active_view") as NavView;
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
          localStorage.setItem("prism_active_view", "home");
        } catch {}
      }
      setCurrentView(initialView);
      window.history.replaceState(null, "", `#${initialView}`);
    }

    // 2. Resolve active plan context
    try {
      const savedPlan = localStorage.getItem("prism_active_plan_context");
      if (savedPlan) {
        const parsed = JSON.parse(savedPlan);
        if (parsed && parsed.campaignData) {
          setActivePlanForCopilot(parsed);
        }
      }
    } catch {}

    // 3. Listen to hashchange for browser back/forward buttons
    const handleHashChange = () => {
      const currentHash = window.location.hash.replace("#", "") as NavView;
      if (VALID_VIEWS.includes(currentHash)) {
        setCurrentView(currentHash);
        try {
          localStorage.setItem("prism_active_view", currentHash);
        } catch {}
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleNavigate = (view: NavView) => {
    setCurrentView(view);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("prism_active_view", view);
        window.history.replaceState(null, "", `#${view}`);
      } catch {}
    }
  };

  useEffect(() => {
    fetch("/api/campaigns")
      .then((res) => (res.ok ? res.json() : { campaigns: [] }))
      .then((data) => {
        if (Array.isArray(data.campaigns)) {
          setCampaignCount(data.campaigns.length);
        }
      })
      .catch(() => {});
  }, [currentView]);

  const handleModifyInCopilot = (campaignData: any, plan: any) => {
    const planContext = { campaignData, plan };
    setActivePlanForCopilot(planContext);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("prism_active_plan_context", JSON.stringify(planContext));
      } catch {}
    }
    handleNavigate("copilot");
  };

  const handleClearPlanContext = () => {
    setActivePlanForCopilot(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("prism_active_plan_context");
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="lg:hidden h-14 border-b border-stone-200/70 bg-white/90 backdrop-blur-md px-4 flex items-center justify-between flex-shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 cursor-pointer"
              aria-label="Open navigation"
            >
              <List size={20} weight="bold" />
            </button>
            <div className="flex items-center gap-2">
              <BigCityLogo size={22} variant="tile" className="rounded-lg p-0.5 bg-white border border-stone-200/60 shadow-2xs" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-900">BCP Assist</span>
                <span className="text-[10.5px] text-stone-400 font-medium">
                  by <span className="text-blue-600 font-semibold">Enlight Lab</span>
                </span>
              </div>
              <span className="text-stone-300 font-normal">/</span>
              <span className="text-xs text-stone-500 font-medium capitalize">
                {NAV_LABELS[currentView]}
              </span>
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
