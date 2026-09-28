"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  ChatCircle,
  PlugsConnected,
  Pulse,
  SidebarSimple,
} from "@phosphor-icons/react";
import CockpitHeader from "@/components/copilot/CockpitHeader";
import IntelligenceStream from "@/components/copilot/IntelligenceStream";
import HardwareInputBar from "@/components/copilot/HardwareInputBar";
import LiveStackRadar from "@/components/copilot/LiveStackRadar";
import ToolDrawer from "@/components/copilot/drawers/ToolDrawer";
import RadarDrawer from "@/components/copilot/drawers/RadarDrawer";
import { useCopilotChat } from "@/hooks/useCopilotChat";
import { useLiveStackRadar } from "@/hooks/useLiveStackRadar";
import type { ToolConnectionStatus } from "@/types/integrations";

export default function CockpitPage() {
  // Chat agent runtime hook
  const {
    messages,
    input,
    setInput,
    isLoading,
    toolSteps,
    handleSendMessage,
    approveAction,
    rejectAction,
    inputRef,
  } = useCopilotChat();

  // Telemetry radar hook
  const { unreadCount } = useLiveStackRadar();

  // UI state
  const [isToolDrawerOpen, setIsToolDrawerOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(true);
  const [isMobileRadarOpen, setIsMobileRadarOpen] = useState(false);
  const [isNavRailCollapsed, setIsNavRailCollapsed] = useState(false);
  const [connectedToolsCount, setConnectedToolsCount] = useState(0);

  // Fetch initial tool count
  useEffect(() => {
    let ignore = false;
    fetch("/api/integrations/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.tools && Array.isArray(data.tools)) {
          const count = data.tools.filter((t: ToolConnectionStatus) => t.isConnected).length;
          setConnectedToolsCount(count);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  const handleStatusChange = (tools: ToolConnectionStatus[]) => {
    const count = tools.filter((t) => t.isConnected).length;
    setConnectedToolsCount(count);
  };

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAFAF9] text-slate-900 font-sans select-none">
      {/* Top Telemetry Header */}
      <CockpitHeader
        connectedToolsCount={connectedToolsCount}
        onOpenToolDrawer={() => setIsToolDrawerOpen(true)}
        unreadRadarCount={unreadCount}
        onToggleRadar={handleToggleRadar}
        isRadarOpen={isRadarOpen || isMobileRadarOpen}
      />

      {/* Main 3-Panel Cockpit Chassis */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left HUD: Navigation & Session Rail */}
        <nav
          className={`h-full bg-white border-r border-slate-200/80 transition-all duration-200 flex flex-col justify-between p-3 flex-shrink-0 ${
            isNavRailCollapsed ? "w-16" : "w-56"
          } hidden md:flex`}
        >
          {/* Top Section */}
          <div className="space-y-4">
            {/* New Session Action */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer active:scale-98 ${
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
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-900 bg-slate-100 transition cursor-pointer ${
                  isNavRailCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <ChatCircle size={16} weight="bold" className="text-slate-900" />
                {!isNavRailCollapsed && <span>Operations Stream</span>}
              </button>

              <button
                type="button"
                onClick={() => setIsToolDrawerOpen(true)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer ${
                  isNavRailCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <PlugsConnected size={16} weight="bold" className="text-slate-500" />
                {!isNavRailCollapsed && <span>Connect Hub</span>}
              </button>

              <button
                type="button"
                onClick={handleToggleRadar}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer xl:hidden ${
                  isNavRailCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <Pulse size={16} weight="bold" className="text-slate-500" />
                {!isNavRailCollapsed && <span>Telemetry Radar</span>}
              </button>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsNavRailCollapsed(!isNavRailCollapsed)}
              title={isNavRailCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <SidebarSimple size={16} />
            </button>

            {!isNavRailCollapsed && (
              <span className="text-[10px] font-mono text-slate-400">Prism V2.0</span>
            )}
          </div>
        </nav>

        {/* Center Panel: Intelligence Stream & Floating Input Bar */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAF9] overflow-hidden relative">
          <IntelligenceStream
            messages={messages}
            isLoading={isLoading}
            toolSteps={toolSteps}
            connectedToolsCount={connectedToolsCount}
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
            isLoading={isLoading}
            inputRef={inputRef}
          />
        </main>

        {/* Right Panel: Live Stack Radar (Desktop >= 1280px) */}
        {isRadarOpen && (
          <div className="hidden xl:block w-80 h-full flex-shrink-0 animate-fade-in">
            <LiveStackRadar onInvestigate={handleInvestigatePrompt} />
          </div>
        )}
      </div>

      {/* Slide-out Tool Connection Hub Drawer */}
      <ToolDrawer
        isOpen={isToolDrawerOpen}
        onClose={() => setIsToolDrawerOpen(false)}
        onStatusChange={handleStatusChange}
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
