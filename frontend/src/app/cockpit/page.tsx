"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  ChatCircle,
  PlugsConnected,
  Pulse,
  SidebarSimple,
  ShieldCheck,
  FolderSimple,
} from "@phosphor-icons/react";
import CockpitHeader from "@/components/copilot/CockpitHeader";
import IntelligenceStream from "@/components/copilot/IntelligenceStream";
import HardwareInputBar from "@/components/copilot/HardwareInputBar";
import LiveStackRadar from "@/components/copilot/LiveStackRadar";
import ToolDrawer from "@/components/copilot/drawers/ToolDrawer";
import RadarDrawer from "@/components/copilot/drawers/RadarDrawer";
import SessionHistoryDrawer from "@/components/copilot/drawers/SessionHistoryDrawer";
import { useCopilotChat } from "@/hooks/useCopilotChat";
import { useLiveStackRadar } from "@/hooks/useLiveStackRadar";
import { useToolsStatus } from "@/hooks/useToolsStatus";

export default function CockpitPage() {
  // Chat agent runtime hook
  const {
    messages,
    input,
    setInput,
    isLoading,
    toolSteps,
    sessionId,
    handleSendMessage,
    stopGeneration,
    approveAction,
    rejectAction,
    startNewSession,
    loadSession,
    inputRef,
  } = useCopilotChat();

  // Telemetry radar hook
  const { unreadCount } = useLiveStackRadar();

  // Real-time dynamic tools status hook
  const { connectedCount: connectedToolsCount, totalCount: totalToolsCount } = useToolsStatus();

  // UI state
  const [isToolDrawerOpen, setIsToolDrawerOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(true);
  const [isMobileRadarOpen, setIsMobileRadarOpen] = useState(false);
  const [isSessionHistoryOpen, setIsSessionHistoryOpen] = useState(false);
  const [isNavRailCollapsed, setIsNavRailCollapsed] = useState(false);

  // Check for pending investigate prompt from /radar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = sessionStorage.getItem("prism_pending_prompt");
    if (pending) {
      sessionStorage.removeItem("prism_pending_prompt");
      setInput(pending);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [setInput, inputRef]);

  const handleToggleRadar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setIsMobileRadarOpen((prev) => !prev);
    } else {
      setIsRadarOpen((prev) => !prev);
    }
  };

  const handleInvestigatePrompt = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  return (
    <div className="relative isolate flex h-screen w-screen flex-col overflow-hidden bg-[#FAFAF9] font-sans text-stone-900">
      {/* Ambient wash — the same sky-to-sunrise gradient family as the marketing page */}
      <div className="prism-app-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]" />

      {/* Top Telemetry Header */}
      <CockpitHeader
        connectedToolsCount={connectedToolsCount}
        totalToolsCount={totalToolsCount}
        onOpenToolDrawer={() => setIsToolDrawerOpen(true)}
        unreadRadarCount={unreadCount}
        onToggleRadar={handleToggleRadar}
        isRadarOpen={isRadarOpen || isMobileRadarOpen}
      />

      {/* Main 3-Panel Cockpit Chassis */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left HUD: Navigation & Session Rail */}
        <nav
          className={`h-full bg-white border-r border-black/[0.06] transition-all duration-200 flex flex-col justify-between p-4 flex-shrink-0 ${
            isNavRailCollapsed ? "w-16" : "w-64"
          } hidden md:flex`}
        >
          {/* Top Section */}
          <div className="space-y-4">
            {/* New Session Action */}
            <button
              type="button"
              onClick={startNewSession}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                isNavRailCollapsed ? "justify-center px-0" : ""
              }`}
            >
              <Plus size={15} weight="bold" />
              {!isNavRailCollapsed && <span>New Session</span>}
            </button>

            {/* Nav Links */}
            <div className="space-y-1">
              <button
                type="button"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-900 bg-stone-100 border-l-[3px] border-sky-500 pl-[calc(0.75rem-3px)] transition cursor-pointer ${
                  isNavRailCollapsed ? "justify-center px-0 border-l-0 pl-0" : ""
                }`}
              >
                <ChatCircle size={16} weight="bold" className="text-stone-900 shrink-0" />
                {!isNavRailCollapsed && <span>Operations Stream</span>}
              </button>

              <button
                type="button"
                onClick={() => setIsSessionHistoryOpen(true)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors duration-150 cursor-pointer ${
                  isNavRailCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <FolderSimple size={16} weight="bold" className="text-stone-500 shrink-0" />
                {!isNavRailCollapsed && <span>Session History</span>}
              </button>

              <Link
                href="/actions"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors duration-150 ${
                  isNavRailCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <ShieldCheck size={16} weight="bold" className="text-stone-500 shrink-0" />
                {!isNavRailCollapsed && <span>Action Ledger</span>}
              </Link>

              <button
                type="button"
                onClick={() => setIsToolDrawerOpen(true)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors duration-150 cursor-pointer ${
                  isNavRailCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <PlugsConnected size={16} weight="bold" className="text-stone-500 shrink-0" />
                {!isNavRailCollapsed && <span>Connect Hub</span>}
              </button>

              <button
                type="button"
                onClick={handleToggleRadar}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors duration-150 cursor-pointer xl:hidden ${
                  isNavRailCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <Pulse size={16} weight="bold" className="text-stone-500 shrink-0" />
                {!isNavRailCollapsed && <span>Telemetry Radar</span>}
              </button>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsNavRailCollapsed(!isNavRailCollapsed)}
              title={isNavRailCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <SidebarSimple size={16} />
            </button>

            {!isNavRailCollapsed && (
              <span className="text-[10px] font-mono text-stone-400">Prism V2.0</span>
            )}
          </div>
        </nav>

        {/* Center Panel: Intelligence Stream & Floating Input Bar */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <IntelligenceStream
            messages={messages}
            isLoading={isLoading}
            toolSteps={toolSteps}
            connectedToolsCount={connectedToolsCount}
            totalToolsCount={totalToolsCount}
            onOpenConnectHub={() => setIsToolDrawerOpen(true)}
            onApproveAction={approveAction}
            onRejectAction={rejectAction}
            onQuickPrompt={(prompt) => {
              setInput(prompt);
              inputRef.current?.focus();
            }}
          />

          <HardwareInputBar
            input={input}
            setInput={setInput}
            onSubmit={handleSendMessage}
            onStop={stopGeneration}
            isLoading={isLoading}
            inputRef={inputRef}
          />
        </main>

        {/* Right Panel: Live Stack Radar (Desktop >= 1280px) */}
        {isRadarOpen && (
          <div className="hidden xl:block w-[340px] h-full flex-shrink-0 animate-fade-in">
            <LiveStackRadar onInvestigate={handleInvestigatePrompt} />
          </div>
        )}
      </div>

      {/* Slide-out Session History Drawer */}
      <SessionHistoryDrawer
        isOpen={isSessionHistoryOpen}
        onClose={() => setIsSessionHistoryOpen(false)}
        onSelectSession={loadSession}
        onNewSession={startNewSession}
        currentSessionId={sessionId}
      />

      {/* Slide-out Tool Connection Hub Drawer */}
      <ToolDrawer
        isOpen={isToolDrawerOpen}
        onClose={() => setIsToolDrawerOpen(false)}
      />

      {/* Slide-out Mobile Telemetry Radar Drawer (< 1280px) */}
      <RadarDrawer
        isOpen={isMobileRadarOpen}
        onClose={() => setIsMobileRadarOpen(false)}
        onInvestigate={handleInvestigatePrompt}
      />
    </div>
  );
}
