"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pulse,
  ChatCircle,
  PlugsConnected,
  ShieldCheck,
  Plus,
  ArrowLeft,
  MagnifyingGlass,
  CheckCircle,
  Warning,
  ArrowRight,
  ArrowsClockwise,
  Check,
  EnvelopeSimple,
  ChatsCircle,
  ChatCircleText,
  Kanban,
  Briefcase,
} from "@phosphor-icons/react";
import CockpitHeader from "@/components/copilot/CockpitHeader";
import ToolDrawer from "@/components/copilot/drawers/ToolDrawer";
import { InlineErrorBanner } from "@/components/ui/InlineErrorBanner";
import { useToast } from "@/hooks/useToast";
import { useLiveStackRadar } from "@/hooks/useLiveStackRadar";
import type { ActivityEventRow } from "@/types/database";

export default function RadarPage() {
  const router = useRouter();
  const {
    events,
    unreadCount,
    urgentCount,
    actionableCount,
    status,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useLiveStackRadar({ soundEnabled: true });

  const toast = useToast();
  const [activeFilter, setActiveFilter] = useState<"all" | "urgent" | "actionable">("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isToolDrawerOpen, setIsToolDrawerOpen] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      toast.success("Radar refreshed", "Live signal feed updated.");
    } catch (err) {
      toast.error(err, { context: "radar" });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getToolMeta = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes("outlook")) {
      return { label: "Outlook", icon: EnvelopeSimple, badge: "bg-sky-50 text-sky-800 border-sky-200" };
    }
    if (s.includes("teams")) {
      return { label: "Teams", icon: ChatsCircle, badge: "bg-indigo-50 text-indigo-800 border-indigo-200" };
    }
    if (s.includes("slack")) {
      return { label: "Slack", icon: ChatCircleText, badge: "bg-rose-50 text-rose-800 border-rose-200" };
    }
    if (s.includes("linear")) {
      return { label: "Linear", icon: Kanban, badge: "bg-violet-50 text-violet-800 border-violet-200" };
    }
    if (s.includes("zoho")) {
      return { label: "Zoho CRM", icon: Briefcase, badge: "bg-amber-50 text-amber-800 border-amber-200" };
    }
    return { label: "System", icon: Pulse, badge: "bg-stone-50 text-stone-800 border-stone-200" };
  };

  const filteredEvents = events.filter((e) => {
    if (activeFilter === "urgent" && !(e.priority === "urgent" || e.priority === "critical")) {
      return false;
    }
    if (activeFilter === "actionable" && !e.actionable) {
      return false;
    }
    if (selectedSource !== "all" && !e.source.toLowerCase().includes(selectedSource)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title?.toLowerCase().includes(q);
      const matchSummary = e.summary?.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary) return false;
    }
    return true;
  });

  const handleInvestigate = (event: ActivityEventRow) => {
    void markAsRead(event.id);
    const prompt = `Investigate this telemetry alert from ${event.source}: "${event.title}". ${event.summary || ""}`;
    sessionStorage.setItem("prism_pending_prompt", prompt);
    router.push("/cockpit");
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAFAF9] text-stone-900 font-[family-name:var(--font-geist-sans)]">
      {/* Top Header */}
      <CockpitHeader
        onOpenToolDrawer={() => setIsToolDrawerOpen(true)}
        unreadRadarCount={unreadCount}
        onToggleRadar={() => {}}
        isRadarOpen={false}
      />

      {/* Main Container with Sidebar + Feed */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Rail */}
        <nav className="w-64 h-full bg-white border-r border-black/[0.06] flex flex-col justify-between p-4 flex-shrink-0 hidden md:flex">
          <div className="space-y-4">
            <Link
              href="/cockpit"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
            >
              <Plus size={15} weight="bold" />
              <span>New Session</span>
            </Link>

            <div className="space-y-1">
              <Link
                href="/cockpit"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              >
                <ChatCircle size={16} weight="bold" className="text-stone-500" />
                <span>Operations Stream</span>
              </Link>

              <Link
                href="/radar"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-900 bg-stone-100 border-l-[3px] border-sky-500 pl-[calc(0.75rem-3px)]"
              >
                <Pulse size={16} weight="bold" className="text-sky-700" />
                <span>Live Radar Feed</span>
              </Link>

              <Link
                href="/actions"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              >
                <ShieldCheck size={16} weight="bold" className="text-stone-500" />
                <span>Action Ledger</span>
              </Link>

              <Link
                href="/integrations"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              >
                <PlugsConnected size={16} weight="bold" className="text-stone-500" />
                <span>Connect Hub</span>
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <Link
              href="/cockpit"
              className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Cockpit</span>
            </Link>
            <span className="text-[10px] font-mono text-stone-400">Prism V2</span>
          </div>
        </nav>

        {/* Center Main Radar Feed */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FAFAF9]">
          {/* Subheader Toolbar */}
          <div className="p-6 bg-white border-b border-black/[0.05] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center">
                  <Pulse size={22} weight="bold" className="text-stone-900" />
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      status === "connected"
                        ? "bg-emerald-500"
                        : status === "error"
                        ? "bg-red-500"
                        : "bg-amber-500"
                    }`}
                  >
                    {status === "connected" && (
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    )}
                  </span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-stone-900 tracking-tight">
                    Live Stack Radar Feed
                  </h1>
                  <p className="text-xs text-stone-500">
                    Real-time telemetry streams from Microsoft 365, Slack, Linear, and Zoho CRM
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Search input */}
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter events…"
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-400 w-44 md:w-56"
                />
              </div>

              <button
                type="button"
                onClick={handleManualRefresh}
                title="Refresh feed"
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <ArrowsClockwise size={15} className={isRefreshing ? "animate-spin" : ""} />
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  Mark all read ({unreadCount})
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills Bar */}
          <div className="px-6 py-3 bg-white/70 border-b border-black/[0.04] flex items-center justify-between flex-wrap gap-2 text-xs">
            {/* Priority filter */}
            <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
              {(["all", "urgent", "actionable"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    activeFilter === filter
                      ? "bg-white text-stone-900 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  <span className="capitalize">{filter}</span>
                  {filter === "all" && unreadCount > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 font-bold">
                      {unreadCount}
                    </span>
                  )}
                  {filter === "urgent" && urgentCount > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-bold">
                      {urgentCount}
                    </span>
                  )}
                  {filter === "actionable" && actionableCount > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-bold">
                      {actionableCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Source Tool Filter */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {[
                { label: "All Sources", value: "all" },
                { label: "Outlook", value: "outlook" },
                { label: "Teams", value: "teams" },
                { label: "Slack", value: "slack" },
                { label: "Linear", value: "linear" },
                { label: "Zoho CRM", value: "zoho" },
              ].map((src) => (
                <button
                  key={src.value}
                  type="button"
                  onClick={() => setSelectedSource(src.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    selectedSource === src.value
                      ? "bg-stone-900 text-white font-semibold"
                      : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          {/* Events Grid / List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 max-w-4xl mx-auto w-full prism-scroll">
            {status === "error" && filteredEvents.length === 0 ? (
              <InlineErrorBanner
                title="Telemetry Feed Paused"
                description="We're having trouble connecting to live event streams. Check your internet connection or click Reconnect."
                onRetry={handleManualRefresh}
                actionLabel="Reconnect"
                className="my-6"
              />
            ) : status === "connecting" && filteredEvents.length === 0 ? (
              <div className="space-y-3.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl bg-white border border-black/[0.07] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-20 h-5 rounded-md animate-shimmer" />
                      <div className="w-16 h-4 rounded-md animate-shimmer" />
                    </div>
                    <div className="w-3/4 h-4 rounded-md animate-shimmer" />
                    <div className="w-full h-3 rounded-md animate-shimmer" />
                  </div>
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="py-24 text-center text-stone-400 flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center">
                  <CheckCircle size={26} weight="light" className="text-stone-300" />
                </div>
                <p className="text-sm font-semibold text-stone-700">Radar feed is clear</p>
                <p className="text-xs text-stone-400 max-w-sm leading-relaxed">
                  No alerts match your current filter. Incoming messages and webhook events from your connected tools will stream here live.
                </p>
              </div>
            ) : (
              filteredEvents.map((event) => {
                const meta = getToolMeta(event.source);
                const ToolIcon = meta.icon;
                const isUrgent = event.priority === "urgent" || event.priority === "critical";

                return (
                  <div
                    key={event.id}
                    className={`p-5 rounded-2xl bg-white border transition-all duration-150 ${
                      !event.is_read
                        ? isUrgent
                          ? "border-red-200 border-l-[4px] border-l-red-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                          : "border-black/[0.08] border-l-[4px] border-l-sky-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                        : "border-black/[0.05] opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${meta.badge}`}
                        >
                          <ToolIcon size={12} weight="bold" />
                          <span>{meta.label}</span>
                        </span>
                        <span className="text-xs text-stone-400 font-mono">
                          {event.event_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isUrgent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <Warning size={10} weight="bold" />
                            URGENT
                          </span>
                        )}
                        <span className="text-xs text-stone-400 font-mono">
                          {new Date(event.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold text-stone-900 tracking-tight leading-snug">
                      {event.title}
                    </h3>
                    {event.summary && (
                      <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                        {event.summary}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                      {!event.is_read ? (
                        <button
                          type="button"
                          onClick={() => markAsRead(event.id)}
                          className="text-xs text-stone-400 hover:text-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check size={12} weight="bold" />
                          <span>Mark as read</span>
                        </button>
                      ) : (
                        <span className="text-xs text-stone-300 font-mono">Read</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleInvestigate(event)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <span>Investigate in Cockpit</span>
                        <ArrowRight size={11} weight="bold" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      <ToolDrawer
        isOpen={isToolDrawerOpen}
        onClose={() => setIsToolDrawerOpen(false)}
      />
    </div>
  );
}
