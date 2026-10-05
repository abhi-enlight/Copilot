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
  GitPullRequest,
  Calendar,
  FileText,
  FolderSimple,
  CurrencyDollar,
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
    if (s.includes("zoho_books") || s.includes("books")) {
      return { label: "Zoho Books", icon: CurrencyDollar, badge: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    }
    if (s.includes("zoho")) {
      return { label: "Zoho CRM", icon: Briefcase, badge: "bg-amber-50 text-amber-800 border-amber-200" };
    }
    if (s.includes("github")) {
      return { label: "GitHub", icon: GitPullRequest, badge: "bg-neutral-100 text-neutral-800 border-neutral-300" };
    }
    if (s.includes("gmail")) {
      return { label: "Gmail", icon: EnvelopeSimple, badge: "bg-red-50 text-red-800 border-red-200" };
    }
    if (s.includes("googlecalendar") || s.includes("calendar")) {
      return { label: "Google Calendar", icon: Calendar, badge: "bg-blue-50 text-blue-800 border-blue-200" };
    }
    if (s.includes("notion")) {
      return { label: "Notion", icon: FileText, badge: "bg-stone-100 text-stone-800 border-stone-300" };
    }
    if (s.includes("share_point") || s.includes("sharepoint")) {
      return { label: "SharePoint", icon: FolderSimple, badge: "bg-teal-50 text-teal-800 border-teal-200" };
    }
    if (s.includes("dynamics")) {
      return { label: "Dynamics 365", icon: Briefcase, badge: "bg-blue-50 text-blue-800 border-blue-200" };
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

  const getDisplayTitle = (event: typeof events[number]) => {
    let title = event.title || "";
    // If title was generic like "[Outlook] New Message", extract from raw_payload
    if (!title || title.toLowerCase() === "[outlook] new message" || title.toLowerCase() === "new message") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = event.raw_payload as Record<string, any> | undefined;
      const msg = raw?.outlook_message || raw?.message || raw?.data || raw;
      const sender =
        msg?.from?.emailAddress?.name ||
        msg?.sender?.email_address?.name ||
        msg?.sender?.emailAddress?.name ||
        msg?.from_address?.email_address?.name ||
        "";
      const subject = msg?.subject || "";
      if (sender && subject) title = `${sender}: ${subject}`;
      else if (subject) title = subject;
      else if (sender) title = `Message from ${sender}`;
    }

    // Strip leading redundant tool tag e.g. "[Outlook] " since the badge already shows the tool
    return title.replace(/^\[(Outlook|Slack|Teams|Linear|Zoho CRM|Zoho Books|GitHub|Gmail|Google Calendar|Notion|Dynamics 365|SharePoint)[^\]]*\]\s*/i, "");
  };

  const getDisplaySummary = (event: typeof events[number]) => {
    if (event.summary && event.summary.trim()) {
      return event.summary
        .replace(/\r\n/g, "\n")
        .split(/\n_{5,}|\nFrom:\s*\S+@/i)[0]
        .trim();
    }

    // Fallback extract preview from raw_payload if summary was empty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = event.raw_payload as Record<string, any> | undefined;
    if (raw) {
      const msg = raw?.outlook_message || raw?.message || raw?.data || raw;
      const preview =
        msg?.bodyPreview ||
        msg?.body_preview ||
        msg?.preview ||
        msg?.snippet ||
        msg?.text ||
        msg?.content ||
        "";
      if (typeof preview === "string" && preview.trim()) {
        return preview
          .replace(/\r\n/g, "\n")
          .split(/\n_{5,}|\nFrom:\s*\S+@/i)[0]
          .trim();
      }
    }
    return "";
  };

  return (
    <aside className={`w-full h-full flex flex-col bg-[#FAFAF9] border-l border-black/[0.06] font-[family-name:var(--font-geist-sans)] ${className}`}>
      {/* Header */}
      <div className="p-4 bg-white/80 backdrop-blur-xl border-b border-black/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <Pulse size={17} weight="bold" className="text-stone-800" />
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
            <h3 className="text-[13px] font-semibold text-stone-900 tracking-tight">Live Radar</h3>
            <p className="text-[10.5px] text-stone-400 font-mono leading-none mt-0.5">
              {status === "connected"
                ? "Realtime active"
                : status === "error"
                ? "Connection paused"
                : "Connecting…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleManualRefresh}
            aria-label="Refresh telemetry radar"
            title="Refresh radar"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <ArrowsClockwise size={14} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          {unreadCount > 0 && (
            <button onClick={() => markAllAsRead()} className="text-[11px] font-medium text-stone-400 hover:text-stone-800 px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter row — iOS-style segmented control */}
      <div className="p-3 border-b border-black/[0.05] bg-white/60">
        <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
          {(["all", "urgent", "actionable"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11.5px] font-medium transition-all duration-200 cursor-pointer ${
                activeFilter === filter
                  ? "bg-white text-stone-900 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <span className="capitalize">{filter}</span>
              {filter === "all" && unreadCount > 0 && (
                <span className={`text-[10px] px-1 rounded-full font-bold ${
                  activeFilter === "all" ? "bg-stone-100 text-stone-600" : "bg-stone-200 text-stone-600"
                }`}>{unreadCount}</span>
              )}
              {filter === "urgent" && urgentCount > 0 && (
                <span className="text-[10px] px-1 rounded-full font-bold bg-red-100 text-red-700">{urgentCount}</span>
              )}
              {filter === "actionable" && actionableCount > 0 && (
                <span className="text-[10px] px-1 rounded-full font-bold bg-indigo-100 text-indigo-700">{actionableCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 prism-scroll">
        {status === "error" && filteredEvents.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center px-4 bg-amber-50/50 rounded-2xl border border-amber-200/60 m-1">
            <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center">
              <Warning size={18} weight="duotone" />
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-stone-900">Radar Disconnected</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-[200px] leading-relaxed">
                We&apos;re having trouble receiving live signals right now.
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-[11px] font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <ArrowsClockwise size={12} />
              <span>Reconnect</span>
            </button>
          </div>
        ) : status === "connecting" && filteredEvents.length === 0 ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-white border border-black/[0.05] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-14 h-4 rounded-md animate-shimmer" />
                  <div className="w-10 h-3 rounded-md animate-shimmer" />
                </div>
                <div className="w-3/4 h-3.5 rounded-md animate-shimmer" />
                <div className="w-full h-3 rounded-md animate-shimmer" />
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
              <CheckCircle size={22} weight="light" className="text-stone-400" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-stone-600">Feed clear</p>
              <p className="text-[11px] text-stone-400 mt-0.5 max-w-[180px] leading-relaxed">New alerts from Outlook, Teams, Slack, and Linear appear here in real-time.</p>
            </div>
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
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className={`p-3.5 rounded-2xl bg-white transition-all duration-200 border-l-[3px] ${
                    !event.is_read
                      ? isUrgent
                        ? "border-l-red-500 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : "border-l-indigo-400 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "border-l-transparent opacity-50"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${meta.badge}`}>
                      <ToolIcon size={11} weight="bold" />
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isUrgent && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                          <Warning size={9} weight="bold" />
                          URGENT
                        </span>
                      )}
                      <span className="text-[10px] text-stone-400 font-mono">{formatRelativeTime(event.created_at)}</span>
                    </div>
                  </div>

                  {/* Content */}
                  {(() => {
                    const displayTitle = getDisplayTitle(event);
                    const displaySummary = getDisplaySummary(event);

                    return (
                      <>
                        <h4 className="text-[12.5px] font-semibold text-stone-900 leading-snug line-clamp-2 tracking-[-0.01em]">
                          {displayTitle}
                        </h4>
                        {displaySummary && (
                          <p className="text-[11.5px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                            {displaySummary}
                          </p>
                        )}

                        {/* Action row */}
                        <div className="mt-2.5 flex items-center justify-between">
                          {!event.is_read ? (
                            <button
                              onClick={() => markAsRead(event.id)}
                              className="text-[10.5px] text-stone-400 hover:text-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Check size={11} weight="bold" />
                              Mark read
                            </button>
                          ) : (
                            <span className="text-[10.5px] text-stone-300 font-mono">Read</span>
                          )}

                          {onInvestigate && (
                            <button
                              onClick={() => {
                                markAsRead(event.id);
                                // Send the event id, not the event text. The server
                                // re-fetches the event (scoped to this user) and wraps
                                // its contents as untrusted data, so externally supplied
                                // text can never be injected into the model's prompt
                                // through the browser.
                                onInvestigate(
                                  `Investigate telemetry event from ${meta.label}. [prism:telemetry:${event.id}]`
                                );
                              }}
                              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                            >
                              Ask Prism
                              <ArrowRight size={10} weight="bold" />
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
}
