"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ChatCircle,
  Pulse,
  PlugsConnected,
  Plus,
  ArrowLeft,
  Check,
  X,
  Warning,
  SpinnerGap,
  CaretDown,
  CaretUp,
  ArrowsClockwise,
  Copy,
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
import type { AgentAuditLogRow } from "@/types/database";

export default function ActionsPage() {
  const toast = useToast();
  const [actions, setActions] = useState<AgentAuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<unknown | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeTool, setActiveTool] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isToolDrawerOpen, setIsToolDrawerOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchActions = useCallback(async () => {
    try {
      const url = new URL("/api/agent/actions", window.location.origin);
      if (activeFilter !== "all") url.searchParams.set("status", activeFilter);
      if (activeTool !== "all") url.searchParams.set("tool", activeTool);
      url.searchParams.set("limit", "50");

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
        setTotalCount(data.totalCount || 0);
        setFetchError(null);
      } else {
        throw new Error(`Failed to load actions (HTTP ${res.status})`);
      }
    } catch (err) {
      console.warn("[ActionsPage] fetch error:", err);
      setFetchError(err);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, activeTool]);

  useEffect(() => {
    let ignore = false;
    const url = new URL("/api/agent/actions", window.location.origin);
    if (activeFilter !== "all") url.searchParams.set("status", activeFilter);
    if (activeTool !== "all") url.searchParams.set("tool", activeTool);
    url.searchParams.set("limit", "50");

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load actions (HTTP ${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setActions(data.actions || []);
          setTotalCount(data.totalCount || 0);
          setFetchError(null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.warn("[ActionsPage] fetch error:", err);
          setFetchError(err);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeFilter, activeTool]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchActions();
      toast.success("Ledger refreshed", "Latest audit logs loaded.");
    } catch (err) {
      toast.error(err, { context: "action" });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleCopy = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {}
  };

  const getToolMeta = (slug: string) => {
    const s = slug.toLowerCase();
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
    const cleanLabel = slug
      .replace(/^composio_/i, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: cleanLabel || "Prism Action", icon: ShieldCheck, badge: "bg-stone-50 text-stone-800 border-stone-200" };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "executed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Check size={11} weight="bold" />
            Executed
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <SpinnerGap size={11} className="animate-spin" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            <X size={11} weight="bold" />
            Declined
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <Warning size={11} weight="bold" />
            Failed
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <SpinnerGap size={11} className="animate-spin text-amber-600" />
            Pending Sign-Off
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAFAF9] text-stone-900 font-[family-name:var(--font-geist-sans)] select-none">
      {/* Top Header */}
      <CockpitHeader
        onOpenToolDrawer={() => setIsToolDrawerOpen(true)}
        onToggleRadar={() => {}}
        isRadarOpen={false}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Rail */}
        <nav className="w-64 h-full bg-white border-r border-black/[0.06] flex flex-col justify-between p-4 flex-shrink-0 hidden md:flex">
          <div className="space-y-4">
            <Link
              href="/"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
            >
              <Plus size={15} weight="bold" />
              <span>New Session</span>
            </Link>

            <div className="space-y-1">
              <Link
                href="/"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              >
                <ChatCircle size={16} weight="bold" className="text-stone-500" />
                <span>Operations Stream</span>
              </Link>

              <Link
                href="/radar"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              >
                <Pulse size={16} weight="bold" className="text-stone-500" />
                <span>Live Radar Feed</span>
              </Link>

              <Link
                href="/actions"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-900 bg-stone-100 border-l-[3px] border-indigo-500 pl-[calc(0.75rem-3px)]"
              >
                <ShieldCheck size={16} weight="bold" className="text-indigo-600" />
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
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Cockpit</span>
            </Link>
            <span className="text-[10px] font-mono text-stone-400">Prism Audit</span>
          </div>
        </nav>

        {/* Center Main Ledger */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FAFAF9]">
          {/* Subheader Toolbar */}
          <div className="p-6 bg-white border-b border-black/[0.05] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={22} weight="bold" className="text-stone-900" />
                <div>
                  <h1 className="text-lg font-bold text-stone-900 tracking-tight">
                    Human-in-the-Loop Action Ledger
                  </h1>
                  <p className="text-xs text-stone-500">
                    Cryptographically signed, tamper-proof record of every AI execution proposal and sign-off
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                aria-label="Refresh audit ledger"
                title="Refresh audit ledger"
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <ArrowsClockwise size={15} className={isRefreshing ? "animate-spin" : ""} />
              </button>
              <span className="text-xs font-mono text-stone-400">
                {totalCount} total events
              </span>
            </div>
          </div>

          {/* Filter Pills Bar */}
          <div className="px-6 py-3 bg-white/70 border-b border-black/[0.04] flex items-center justify-between flex-wrap gap-2 text-xs overflow-x-auto scrollbar-none">
            {/* Status Segmented Control */}
            <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1 overflow-x-auto scrollbar-none flex-nowrap">
              {[
                { label: "All", value: "all" },
                { label: "Executed", value: "executed" },
                { label: "Pending", value: "pending" },
                { label: "Declined", value: "rejected" },
                { label: "Failed", value: "failed" },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setActiveFilter(f.value)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === f.value
                      ? "bg-white text-stone-900 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Tool Filter */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-nowrap">
              {[
                { label: "All Tools", value: "all" },
                { label: "Outlook", value: "outlook" },
                { label: "Teams", value: "microsoft_teams" },
                { label: "Slack", value: "slack" },
                { label: "Linear", value: "linear" },
                { label: "Zoho CRM", value: "zoho" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setActiveTool(t.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeTool === t.value
                      ? "bg-stone-900 text-white font-semibold"
                      : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ledger Content List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3.5 max-w-4xl mx-auto w-full prism-scroll">
            {fetchError && actions.length === 0 ? (
              <InlineErrorBanner
                error={fetchError}
                context="action"
                onRetry={fetchActions}
                className="my-6"
              />
            ) : isLoading && actions.length === 0 ? (
              <div className="space-y-3.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl bg-white border border-black/[0.07] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl animate-shimmer flex-shrink-0" />
                      <div className="space-y-1.5 min-w-0">
                        <div className="w-44 h-4 rounded-md animate-shimmer" />
                        <div className="w-64 h-3 rounded-md animate-shimmer" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-20 h-6 rounded-full animate-shimmer" />
                      <div className="w-16 h-3 rounded-md animate-shimmer hidden sm:block" />
                    </div>
                  </div>
                ))}
              </div>
            ) : actions.length === 0 ? (
              <div className="py-24 text-center text-stone-400 flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center">
                  <ShieldCheck size={26} weight="light" className="text-stone-300" />
                </div>
                <p className="text-sm font-semibold text-stone-700">No audit logs found</p>
                <p className="text-xs text-stone-400 max-w-sm leading-relaxed">
                  When Prism proposes and executes state-changing actions (sending emails, modifying CRM deals, posting team updates), an immutable cryptographic audit record is saved here.
                </p>
              </div>
            ) : (
              actions.map((action) => {
                const meta = getToolMeta(action.tool_slug);
                const ToolIcon = meta.icon;
                const isExpanded = expandedId === action.id;

                return (
                  <div
                    key={action.id}
                    className="rounded-2xl bg-white border border-black/[0.07] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-150"
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : action.id)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-stone-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700 flex-shrink-0 border border-stone-200/60">
                          <ToolIcon size={18} weight="bold" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-stone-900 tracking-tight leading-snug">
                              {action.action_type}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded text-[10.5px] font-semibold border ${meta.badge}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-400 font-mono mt-0.5 truncate">
                            Actor: {action.actor_email || "System"} · ID: {action.id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {getStatusBadge(action.status)}
                        <span className="text-xs text-stone-400 font-mono hidden sm:inline">
                          {new Date(action.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="text-stone-400">
                          {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Inspection Details */}
                    {isExpanded && (
                      <div className="p-5 pt-0 border-t border-stone-100 bg-stone-50/50 space-y-3 text-xs">
                        {/* Signature hash verification */}
                        {action.signature_hash && (
                          <div className="pt-3 flex items-center justify-between bg-white rounded-xl p-3 border border-stone-200/80">
                            <div className="flex items-center gap-2 min-w-0">
                              <ShieldCheck size={14} weight="bold" className="text-emerald-600 flex-shrink-0" />
                              <span className="text-stone-500 font-medium">HMAC-SHA256 Signature:</span>
                              <span className="font-mono text-stone-700 truncate">
                                {action.signature_hash}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(action.signature_hash!)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-stone-900 cursor-pointer ml-2 flex-shrink-0"
                            >
                              {copiedHash === action.signature_hash ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                              <span>{copiedHash === action.signature_hash ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        )}

                        {/* Request payload */}
                        <div>
                          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                            Request Payload
                          </span>
                          <pre className="p-3 rounded-xl bg-stone-900 text-stone-100 text-[11px] font-mono overflow-x-auto">
                            {JSON.stringify(action.request_payload, null, 2)}
                          </pre>
                        </div>

                        {/* Execution result (if completed) */}
                        {action.execution_result && (
                          <div>
                            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                              Execution Result
                            </span>
                            <pre className="p-3 rounded-xl bg-stone-900 text-stone-100 text-[11px] font-mono overflow-x-auto">
                              {JSON.stringify(action.execution_result, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
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
