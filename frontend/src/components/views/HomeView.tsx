"use client";

import { useEffect, useState, type ComponentType } from "react";import {
  Sparkle,
  ArrowRight,
  PlugsConnected,
  EnvelopeSimple,
  CalendarBlank,
  FolderOpen,
  Robot,
  Megaphone,
  CheckCircle,
  PauseCircle,
} from "@phosphor-icons/react";
import type { NavView } from "@/components/PrismSidebar";
import { useConnectors, PAUSED_PILL_LABELS, type ConnectorId } from "@/hooks/useConnectors";

interface HomeViewProps {
  onNavigate: (view: NavView) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QUICK_PROMPTS: { icon: ComponentType<any>; title: string; prompt: string; goTo: NavView }[] = [
  {
    icon: EnvelopeSimple,
    title: "Triage my inbox",
    prompt: "What needs my attention from the last 24 hours of email?",
    goTo: "copilot",
  },
  {
    icon: Megaphone,
    title: "Campaign pulse",
    prompt: "Summarize open campaigns, risks, and what's launching this week.",
    goTo: "campaigns",
  },
  {
    icon: CalendarBlank,
    title: "Today's briefing",
    prompt: "Give me a morning briefing of meetings, urgent mail, and open tasks.",
    goTo: "copilot",
  },
  {
    icon: FolderOpen,
    title: "Find a document",
    prompt: "Find recent contracts or SOPs across my drives and knowledge base.",
    goTo: "copilot",
  },
];

export default function HomeView({ onNavigate }: HomeViewProps) {
  const { activeConnectors, isSyncing: connectorsSyncing, pausedConnectorIds } = useConnectors();
  const [campaignCount, setCampaignCount] = useState<number | null>(null);
  const [campaignsError, setCampaignsError] = useState<boolean>(false);

  const pausedCount = pausedConnectorIds.length;
  const enabledCount =
    activeConnectors === null
      ? 0
      : Object.values(activeConnectors).filter(Boolean).length - pausedCount;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaigns")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("campaigns fetch failed"))))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.campaigns)) setCampaignCount(data.campaigns.length);
        else setCampaignsError(true);
      })
      .catch(() => {
        if (!cancelled) setCampaignsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="prism-aurora flex-1 overflow-y-auto prism-scroll">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 space-y-7">
        {/* Hero */}
        <div className="space-y-3">
          <h1 className="text-[26px] lg:text-[30px] font-bold tracking-tight text-stone-900 leading-tight">
            One interface for every system
            <span className="block prism-gradient-text">you work in.</span>
          </h1>
          <p className="text-sm text-stone-500 max-w-xl leading-relaxed">
            Prism connects your mail, documents, CRM deals, projects, and invoices into a single
            copilot conversation, gated by the real permissions of each platform.
          </p>
        </div>

        {/* Quick prompts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_PROMPTS.map((q, idx) => {
            const Icon = q.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigate(q.goTo)}
                className="prism-focus group text-left p-4 rounded-2xl bg-white/85 hover:bg-white border border-stone-200/90 hover:border-violet-200 shadow-2xs hover:shadow-md transition-all duration-150 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-xl prism-gradient-soft border border-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
                  <Icon size={17} weight="duotone" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-stone-900">{q.title}</div>
                  <div className="text-[11.5px] text-stone-500 mt-0.5 leading-snug line-clamp-2">
                    {q.prompt}
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  className="text-stone-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1"
                />
              </button>
            );
          })}
        </div>

        {/* Status cards row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          {/* Copilot card */}
          <button
            type="button"
            onClick={() => onNavigate("copilot")}
            className="prism-gradient text-left p-4 rounded-2xl text-white shadow-lg shadow-violet-600/20 hover:shadow-xl hover:shadow-violet-600/25 transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                <Robot size={16} weight="fill" />
              </div>
              <ArrowRight size={15} className="opacity-70" />
            </div>
            <div className="mt-3 text-[13px] font-bold">Ask the Copilot</div>
            <div className="text-[11px] text-white/85 mt-0.5 leading-snug">
              Query mail, files, CRM, projects, and invoices in one conversation.
            </div>
          </button>

          {/* Campaigns card */}
          <button
            type="button"
            onClick={() => onNavigate("campaigns")}
            className="text-left p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:border-stone-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                <Megaphone size={16} weight="duotone" />
              </div>
              {campaignsError ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                  Unavailable
                </span>
              ) : campaignCount === null ? (
                <span className="inline-block h-3.5 w-12 rounded-full bg-stone-200 animate-pulse" />
              ) : (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  {campaignCount} active
                </span>
              )}
            </div>
            <div className="mt-3 text-[13px] font-bold text-stone-900">Campaigns</div>
            <div className="text-[11px] text-stone-500 mt-0.5 leading-snug">
              Plan initiatives across legal, compliance, accounting, and operations, with
              approval gates before any write.
            </div>
          </button>

          {/* Connectors card + per-connector pause pills */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onNavigate("connections")}
              className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:border-violet-300 hover:bg-violet-50/20 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center">
                  <PlugsConnected size={16} weight="duotone" />
                </div>
                {connectorsSyncing || !activeConnectors ? (
                  <span className="inline-block h-3.5 w-14 rounded-full bg-stone-200 animate-pulse" />
                ) : pausedCount > 0 ? (
                  <span
                    suppressHydrationWarning
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {pausedCount} paused
                  </span>
                ) : (
                  <span
                    suppressHydrationWarning
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {enabledCount}/7 Active
                  </span>
                )}
              </div>
              <div className="mt-3 text-[13px] font-bold text-stone-900">Connections</div>
              <div className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                Outlook, OneDrive, SharePoint, Dynamics 365, or Zoho, independent, toggleable,
                permission-aware.
              </div>
            </button>

            {/* Pause pills, one per paused connector, click to jump to Connections */}
            {connectorsSyncing || !activeConnectors ? null : pausedCount > 0 ? (
              <div className="flex flex-wrap gap-1.5" suppressHydrationWarning>
                {pausedConnectorIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavigate("connections")}
                    title={`${PAUSED_PILL_LABELS[id as ConnectorId]} is paused, click to manage connections`}
                    className="prism-focus inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-[10px] font-semibold text-amber-700 transition-colors cursor-pointer"
                  >
                    <PauseCircle size={11} weight="fill" />
                    {PAUSED_PILL_LABELS[id as ConnectorId] || id}
                    <span className="text-amber-500 font-normal">paused</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Feature preview banner */}
        <div className="rounded-2xl border border-stone-200 bg-white/70 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl prism-gradient-soft border border-cyan-100 text-cyan-700 flex items-center justify-center flex-shrink-0">
            <Sparkle size={17} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-stone-900">
              Coming next, cross-source superpowers
            </div>
            <div className="text-[11.5px] text-stone-500 mt-1 leading-relaxed space-y-0.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} weight="fill" className="text-violet-400 flex-shrink-0" />
                Daily briefing uniting calendar, urgent mail, deals, invoices, and tasks
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} weight="fill" className="text-cyan-400 flex-shrink-0" />
                Deal radar: an email auto-attaches the matching CRM record, project, and invoices
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} weight="fill" className="text-violet-400 flex-shrink-0" />
                One search across mail, files, CRM, tasks, and the knowledge base
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
