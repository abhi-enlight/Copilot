"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
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
  Lightning,
} from "@phosphor-icons/react";
import { useLiveStackRadar } from "@/hooks/useLiveStackRadar";
import type { ActivityEventRow } from "@/types/database";

export interface ParsedEventDetails {
  senderName: string | null;
  senderEmail: string | null;
  headline: string;
  summary: string;
}

/**
 * Normalizes and separates sender metadata, clean subject headlines,
 * and body snippets from diverse provider payloads.
 */
export function parseEventDetails(event: ActivityEventRow): ParsedEventDetails {
  const raw = (event.raw_payload || {}) as Record<string, unknown>;

  // 1. Extract sender
  let rawSender = "";
  if (typeof raw.sender === "string") {
    rawSender = raw.sender;
  } else if (typeof raw.from === "string") {
    rawSender = raw.from;
  } else if (raw.sender && typeof raw.sender === "object") {
    const s = raw.sender as Record<string, string>;
    rawSender = s.name ? `${s.name} <${s.address || ""}>` : s.address || "";
  } else if (raw.from && typeof raw.from === "object") {
    const f = raw.from as Record<string, unknown>;
    const emailObj = (f.emailAddress || f.email_address) as Record<string, string> | undefined;
    if (emailObj?.name || emailObj?.address) {
      rawSender = emailObj.name ? `${emailObj.name} <${emailObj.address || ""}>` : emailObj.address || "";
    }
  }

  // 2. Extract headline from raw payload
  let headline = "";
  if (typeof raw.subject === "string" && raw.subject.trim()) {
    headline = raw.subject.trim();
  } else if (typeof raw.title === "string" && raw.title.trim()) {
    headline = raw.title.trim();
  }

  // 3. Fallback: Parse from event.title
  let titleStr = (event.title || "").trim();
  // Strip tool prefixes e.g. "[Gmail]", "[Outlook]", "[Slack #channel]"
  titleStr = titleStr.replace(/^\[[^\]]+\]\s*/, "").trim();

  let senderName: string | null = null;
  let senderEmail: string | null = null;

  if (rawSender) {
    const match = rawSender.match(/^([^<]+?)(?:\s*<([^>]+)>)?$/);
    if (match) {
      senderName = match[1].trim() || null;
      senderEmail = match[2]?.trim() || null;
    } else {
      senderName = rawSender.trim();
    }
  }

  // If headline wasn't found directly, parse from titleStr
  if (!headline) {
    const colonIdx = titleStr.indexOf(":");
    if (colonIdx > 0 && colonIdx < 80) {
      const possibleSender = titleStr.slice(0, colonIdx).trim();
      const possibleSubject = titleStr.slice(colonIdx + 1).trim();

      if (!senderName) {
        const match = possibleSender.match(/^([^<]+?)(?:\s*<([^>]+)>)?$/);
        if (match) {
          senderName = match[1].trim() || null;
          senderEmail = match[2]?.trim() || null;
        } else {
          senderName = possibleSender;
        }
      }
      headline = possibleSubject || titleStr;
    } else {
      headline = titleStr;
    }
  }

  // If headline still retains "Sender: " or "Sender <email>: ", strip it
  if (headline.includes(":")) {
    const parts = headline.split(":");
    if (parts.length >= 2) {
      const firstPart = parts[0].trim();
      if (firstPart.includes("@") || (senderName && firstPart.toLowerCase().includes(senderName.toLowerCase()))) {
        headline = parts.slice(1).join(":").trim();
      }
    }
  }

  if (!headline) {
    headline = "New Activity";
  }

  // 4. Extract summary
  let summary = (event.summary || "").trim();
  if (!summary && raw) {
    const rawPreview = raw.preview || raw.bodyPreview || raw.snippet || raw.message_text;
    if (typeof rawPreview === "string") {
      summary = rawPreview;
    } else if (rawPreview && typeof rawPreview === "object") {
      const p = rawPreview as Record<string, unknown>;
      if (typeof p.body === "string") {
        summary = p.body;
      }
    }
  }

  // Clean reply dividers and whitespace
  summary = summary
    .replace(/\r\n/g, "\n")
    .split(/\n_{5,}|\nFrom:\s*\S+@/i)[0]
    .trim();

  return {
    senderName,
    senderEmail,
    headline,
    summary,
  };
}

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
    if (s.includes("gmail")) {
      return { label: "Gmail", icon: EnvelopeSimple, tag: "text-red-700 bg-red-50 border-red-200/70" };
    }
    if (s.includes("outlook")) {
      return { label: "Outlook", icon: EnvelopeSimple, tag: "text-sky-700 bg-sky-50 border-sky-200/70" };
    }
    if (s.includes("teams")) {
      return { label: "Teams", icon: ChatsCircle, tag: "text-indigo-700 bg-indigo-50 border-indigo-200/70" };
    }
    if (s.includes("slack")) {
      return { label: "Slack", icon: ChatCircleText, tag: "text-emerald-700 bg-emerald-50 border-emerald-200/70" };
    }
    if (s.includes("linear")) {
      return { label: "Linear", icon: Kanban, tag: "text-violet-700 bg-violet-50 border-violet-200/70" };
    }
    if (s.includes("github")) {
      return { label: "GitHub", icon: GitPullRequest, tag: "text-stone-700 bg-stone-100 border-stone-200/80" };
    }
    if (s.includes("zoho_books") || s.includes("books")) {
      return { label: "Zoho Books", icon: CurrencyDollar, tag: "text-emerald-700 bg-emerald-50 border-emerald-200/70" };
    }
    if (s.includes("zoho")) {
      return { label: "Zoho CRM", icon: Briefcase, tag: "text-amber-700 bg-amber-50 border-amber-200/70" };
    }
    if (s.includes("calendar")) {
      return { label: "Calendar", icon: Calendar, tag: "text-blue-700 bg-blue-50 border-blue-200/70" };
    }
    if (s.includes("notion")) {
      return { label: "Notion", icon: FileText, tag: "text-stone-700 bg-stone-100 border-stone-200/80" };
    }
    if (s.includes("share_point") || s.includes("sharepoint")) {
      return { label: "SharePoint", icon: FolderSimple, tag: "text-teal-700 bg-teal-50 border-teal-200/70" };
    }
    return { label: "System", icon: Lightning, tag: "text-stone-600 bg-stone-100 border-stone-200/70" };
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const diff = Math.floor((now - date.getTime()) / 1000);

    if (diff < 45) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <aside className={`flex h-full w-full flex-col border-l border-stone-200/80 bg-stone-50/60 font-[family-name:var(--font-geist-sans)] ${className}`}>
      {/* Header */}
      <div className="p-3.5 bg-white border-b border-stone-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-[2px] transition-colors shrink-0 ${
              status === "connected"
                ? "bg-emerald-500"
                : status === "error"
                ? "bg-red-500"
                : "bg-amber-500"
            }`}
          />
          <div>
            <h3 className="text-[11.5px] font-semibold text-stone-900 tracking-wider uppercase font-mono leading-none">
              Live Radar
            </h3>
            <p className="text-[10px] text-stone-400 font-mono mt-1 leading-none">
              {status === "connected"
                ? "Stream active"
                : status === "error"
                ? "Offline"
                : "Connecting"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleManualRefresh}
            aria-label="Refresh telemetry radar"
            title="Refresh radar"
            className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <ArrowsClockwise size={13} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="text-[10.5px] font-medium text-stone-500 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap font-mono"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter Row — Linear-style segmented bar */}
      <div className="p-2.5 border-b border-stone-200/80 bg-white">
        <div className="grid grid-cols-3 gap-1 bg-stone-100/90 p-0.5 rounded-md border border-stone-200/60 text-[11px] font-mono">
          {(["all", "urgent", "actionable"] as const).map((filter) => {
            const count =
              filter === "all"
                ? unreadCount
                : filter === "urgent"
                ? urgentCount
                : actionableCount;
            const isActive = activeFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-[4px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-stone-950 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04]"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <span className="capitalize">{filter}</span>
                {count > 0 && (
                  <span
                    className={`text-[9.5px] px-1 py-0.2 rounded-[2px] font-mono font-semibold ${
                      isActive
                        ? filter === "urgent"
                          ? "bg-red-100 text-red-700"
                          : "bg-stone-100 text-stone-700"
                        : filter === "urgent"
                        ? "bg-red-50 text-red-600"
                        : "bg-stone-200/80 text-stone-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 prism-scroll">
        {status === "error" && filteredEvents.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center px-4 bg-white rounded-md border border-red-200/60 m-1">
            <div className="w-8 h-8 rounded bg-red-50 text-red-700 flex items-center justify-center">
              <Warning size={16} weight="bold" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-stone-900 font-mono">Connection Interrupted</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-[200px] leading-relaxed">
                Unable to receive live telemetry signals right now.
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-900 text-white text-[11px] font-medium hover:bg-stone-800 transition-colors cursor-pointer font-mono"
            >
              <ArrowsClockwise size={11} />
              <span>Retry</span>
            </button>
          </div>
        ) : status === "connecting" && filteredEvents.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3 rounded-md bg-white border border-stone-200/70 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-14 h-3.5 rounded bg-stone-100 animate-pulse" />
                  <div className="w-10 h-3 rounded bg-stone-100 animate-pulse" />
                </div>
                <div className="w-4/5 h-3.5 rounded bg-stone-100 animate-pulse" />
                <div className="w-full h-3 rounded bg-stone-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-center px-4">
            <div className="w-8 h-8 rounded bg-stone-100 text-stone-400 flex items-center justify-center">
              <CheckCircle size={18} weight="bold" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-stone-700 font-mono uppercase tracking-wide">Stream Clear</p>
              <p className="text-[11px] text-stone-400 mt-0.5 max-w-[200px] leading-relaxed">
                Incoming alerts from your connected stack will appear here in real time.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredEvents.map((event) => {
              const meta = getToolMeta(event.source);
              const ToolIcon = meta.icon;
              const isUrgent = event.priority === "urgent" || event.priority === "critical";
              const details = parseEventDetails(event);

              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className={`group relative p-3 rounded-md transition-all duration-150 border ${
                    !event.is_read
                      ? isUrgent
                        ? "bg-white border-red-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                        : "bg-white border-stone-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                      : "bg-stone-50/50 border-stone-200/60 opacity-60 hover:opacity-95"
                  }`}
                >
                  {/* Straight vertical unread indicator bar */}
                  {!event.is_read && (
                    <div
                      className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-[1px] ${
                        isUrgent ? "bg-red-500" : "bg-stone-900"
                      }`}
                    />
                  )}

                  <div className="pl-1.5">
                    {/* Top Meta Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono font-semibold border ${meta.tag}`}
                        >
                          <ToolIcon size={11} weight="bold" />
                          <span>{meta.label}</span>
                        </span>

                        {details.senderName && (
                          <span
                            className="text-[11.5px] font-medium text-stone-700 truncate"
                            title={
                              details.senderEmail
                                ? `${details.senderName} <${details.senderEmail}>`
                                : details.senderName
                            }
                          >
                            {details.senderName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isUrgent && (
                          <span className="text-[9px] font-mono uppercase font-bold text-red-700 bg-red-50 border border-red-200 px-1 py-0.2 rounded-[2px]">
                            Urgent
                          </span>
                        )}
                        <span className="text-[10px] text-stone-400 font-mono whitespace-nowrap">
                          {formatRelativeTime(event.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Headline / Clean Subject */}
                    <h4 className="text-[12.5px] font-semibold text-stone-950 leading-snug tracking-[-0.01em] line-clamp-2 mt-1.5">
                      {details.headline}
                    </h4>

                    {/* Snippet / Summary */}
                    {details.summary && (
                      <p className="text-[11.5px] text-stone-500 line-clamp-2 leading-relaxed mt-1">
                        {details.summary}
                      </p>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between">
                      {!event.is_read ? (
                        <button
                          type="button"
                          onClick={() => markAsRead(event.id)}
                          className="text-[10.5px] text-stone-400 hover:text-stone-800 flex items-center gap-1 transition-colors cursor-pointer font-mono"
                        >
                          <Check size={11} weight="bold" />
                          <span>Mark read</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-stone-300 font-mono flex items-center gap-1">
                          <Check size={10} weight="bold" />
                          <span>Read</span>
                        </span>
                      )}

                      {onInvestigate && (
                        <button
                          type="button"
                          onClick={() => {
                            markAsRead(event.id);
                            onInvestigate(
                              `Investigate telemetry event from ${meta.label}: ${details.headline}. [prism:telemetry:${event.id}]`
                            );
                          }}
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200/80 px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer font-mono"
                        >
                          <span>Investigate</span>
                          <ArrowRight size={10} weight="bold" />
                        </button>
                      )}
                    </div>
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
