"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Pulse,
  EnvelopeSimple,
  ChatsCircle,
  ChatCircleText,
  Kanban,
  Briefcase,
  Warning,
  CheckCircle,
  ArrowRight,
  ArrowsClockwise,
  Check,
} from "@phosphor-icons/react";
import { useLiveStackRadar } from "@/hooks/useLiveStackRadar";

interface LiveStackRadarProps {
  onInvestigate?: (prompt: string) => void;
  className?: string;
}

export default function LiveStackRadar({ onInvestigate, className = "" }: LiveStackRadarProps) {
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

  const [activeFilter, setActiveFilter] = useState<"all" | "urgent" | "actionable">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredEvents = events.filter((e) => {
    if (activeFilter === "urgent") return e.priority === "urgent" || e.priority === "critical";
    if (activeFilter === "actionable") return e.actionable;
    return true;
  });

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
    return { label: "System", icon: Pulse, badge: "bg-slate-50 text-slate-800 border-slate-200" };
  };

  const formatRelativeTime = (timestamp: string) => {
    const diff = Math.floor((now - new Date(timestamp).getTime()) / 1000);
    if (diff < 10) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <aside className={`w-full h-full flex flex-col bg-slate-50/60 border-l border-slate-200/80 font-sans ${className}`}>
      {/* Top Header */}
      <div className="p-4 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Pulse size={18} weight="bold" className="text-slate-900" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                status === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Live Stack Radar
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              {status === "connected" ? "Realtime Telemetry Active" : "Reconnecting…"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh telemetry"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowsClockwise size={14} className={isRefreshing ? "animate-spin" : ""} />
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
            >
              Mark read
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 border-b border-slate-200/60 bg-white/50 flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            activeFilter === "all"
              ? "bg-slate-900 text-white font-semibold shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>All</span>
          {unreadCount > 0 && (
            <span className={`text-[10px] px-1 rounded-full ${activeFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("urgent")}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            activeFilter === "urgent"
              ? "bg-slate-900 text-white font-semibold shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Urgent</span>
          {urgentCount > 0 && (
            <span className={`text-[10px] px-1 rounded-full ${activeFilter === "urgent" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"}`}>
              {urgentCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("actionable")}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            activeFilter === "actionable"
              ? "bg-slate-900 text-white font-semibold shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Actionable</span>
          {actionableCount > 0 && (
            <span className={`text-[10px] px-1 rounded-full ${activeFilter === "actionable" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-800"}`}>
              {actionableCount}
            </span>
          )}
        </button>
      </div>

      {/* Events Stream List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <CheckCircle size={28} weight="light" className="text-slate-300" />
            <p className="text-xs font-medium text-slate-500">Radar feed clear</p>
            <p className="text-[11px] text-slate-400 max-w-[200px]">
              New alerts from Outlook, Teams, Slack, and Linear will appear here in real-time.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredEvents.map((event) => {
              const meta = getToolMeta(event.source);
              const ToolIcon = meta.icon;
              const isUrgent = event.priority === "urgent" || event.priority === "critical";

              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`p-3.5 rounded-2xl bg-white border transition-all ${
                    !event.is_read
                      ? "border-slate-300 shadow-xs"
                      : "border-slate-200/70 opacity-80"
                  }`}
                >
                  {/* Event Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${meta.badge}`}>
                      <ToolIcon size={12} weight="bold" />
                      <span>{meta.label}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isUrgent && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          <Warning size={10} weight="bold" />
                          URGENT
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatRelativeTime(event.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <h4 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                    {event.title}
                  </h4>
                  {event.summary && (
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {event.summary}
                    </p>
                  )}

                  {/* Action Bar */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    {!event.is_read ? (
                      <button
                        type="button"
                        onClick={() => markAsRead(event.id)}
                        className="text-[10.5px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Check size={12} />
                        <span>Mark read</span>
                      </button>
                    ) : (
                      <span className="text-[10.5px] text-slate-300 font-mono">Read</span>
                    )}

                    {onInvestigate && (
                      <button
                        type="button"
                        onClick={() =>
                          onInvestigate(
                            `Review incoming alert from ${meta.label}: "${event.title}". Provide an operational summary and recommend next actions.`
                          )
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-900 hover:text-blue-600 transition cursor-pointer ml-auto"
                      >
                        <span>Investigate</span>
                        <ArrowRight size={11} weight="bold" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
}
