"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowRight,
  PlugsConnected,
  EnvelopeSimple,
  FolderOpen,
  Receipt,
  Megaphone,
  Robot,
} from "@phosphor-icons/react";
import type { NavView } from "@/components/PrismSidebar";
import EnlightLogo from "@/components/brand/EnlightLogo";
import { useAuth } from "@/components/providers/AuthProvider";
import { useConnectors } from "@/hooks/useConnectors";
import { useOrganization } from "@/hooks/useOrganization";
import { getPendingPromptKey } from "@/lib/copilot-storage";

interface HomeViewProps {
  onNavigate: (view: NavView) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QUICK_PROMPTS: { icon: ComponentType<any>; title: string; prompt: string; goTo: NavView }[] = [
  {
    icon: EnvelopeSimple,
    title: "What are my recent mails?",
    prompt: "What are my recent mails? Summarize urgent messages and unread threads from the last 24 hours.",
    goTo: "copilot",
  },
  {
    icon: FolderOpen,
    title: "What files are in SharePoint?",
    prompt: "Search my SharePoint data and list recent documents, briefs, and spreadsheets.",
    goTo: "copilot",
  },
  {
    icon: Receipt,
    title: "What are my recent invoices?",
    prompt: "What are our recent invoices in Zoho Books? Check open balances and payment statuses.",
    goTo: "copilot",
  },
  {
    icon: Megaphone,
    title: "What are my active campaigns?",
    prompt: "Show all my active campaigns, their task completion status, and pending approvals.",
    goTo: "campaigns",
  },
];

export default function HomeView({ onNavigate }: HomeViewProps) {
  const { user } = useAuth();
  const { activeConnectors, isSyncing: connectorsSyncing, pausedConnectorIds } = useConnectors();
  const { activeOrg } = useOrganization();
  const [campaignCount, setCampaignCount] = useState<number | null>(null);
  const [campaignsError, setCampaignsError] = useState<boolean>(false);

  const pausedCount = pausedConnectorIds.length;
  const enabledCount =
    activeConnectors === null
      ? 0
      : Object.values(activeConnectors).filter(Boolean).length - pausedCount;

  useEffect(() => {
    let cancelled = false;
    const headers: Record<string, string> = {};
    if (activeOrg?.id) headers["x-active-org-id"] = activeOrg.id;

    fetch("/api/campaigns", { headers })
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
  }, [activeOrg?.id]);

  return (
    <div className="prism-aurora flex-1 overflow-y-auto prism-scroll">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-10 lg:py-14 space-y-8">
        {/* Hero */}
        <div className="space-y-3">
          <h1 className="text-[28px] lg:text-[34px] font-bold tracking-tight text-slate-900 leading-[1.15]">
            One interface for every system
            <span className="block prism-gradient-text">you work in.</span>
          </h1>
          <p className="text-sm lg:text-[15px] text-slate-500 max-w-xl leading-relaxed">
            Prism connects your mail, documents, CRM deals, projects, and invoices into a single
            copilot conversation, gated by the real permissions of each platform.
          </p>
        </div>

        {/* Quick prompts */}
        <div className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Try asking
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_PROMPTS.map((q, idx) => {
              const Icon = q.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    // Auto-run: stage the prompt under a user-scoped pending key;
                    // CopilotView consumes it on mount and sends it immediately.
                    if (q.goTo === "copilot" && typeof window !== "undefined") {
                      try {
                        localStorage.setItem(getPendingPromptKey(user?.id), q.prompt);
                      } catch {}
                    }
                    onNavigate(q.goTo);
                  }}
                  className="prism-focus group text-left p-4 rounded-2xl bg-white/85 hover:bg-white border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-md active:translate-y-0 active:scale-[0.99] transition-all duration-150 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl prism-gradient-soft border border-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                    <Icon size={17} weight="duotone" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-slate-900">{q.title}</div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                      {q.prompt}
                    </div>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Workspace band — the Copilot (core action) is a full-width
            horizontal gradient strip; the two status cards sit side by side
            below it. No stretched voids. */}
        <div className="space-y-3">
          {/* Copilot feature band */}
          <button
            type="button"
            onClick={() => onNavigate("copilot")}
            className="prism-gradient prism-focus group relative overflow-hidden text-left w-full p-5 lg:p-6 rounded-2xl text-white shadow-lg shadow-blue-900/25 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] transition-all duration-150 flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Robot size={20} weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold">Ask the Copilot</div>
              <div className="text-[12px] text-sky-100 mt-0.5 leading-snug">
                Query mail, files, CRM, projects, and invoices in one conversation.
              </div>
            </div>
            <ArrowRight
              size={18}
              className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0"
            />
          </button>

          {/* Status cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            {/* Campaigns card */}
            <button
              type="button"
              onClick={() => onNavigate("campaigns")}
              className="prism-focus group text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-150 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                  <Megaphone size={17} weight="duotone" />
                </div>
                {campaignsError ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                    Unavailable
                  </span>
                ) : campaignCount === null ? (
                  <span className="inline-block h-3.5 w-12 rounded-full bg-slate-200 animate-pulse" />
                ) : (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {campaignCount} active
                  </span>
                )}
              </div>
              <div className="mt-3 text-[13.5px] font-bold text-slate-900">Campaigns</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                Plan initiatives with approval gates before any write.
              </div>
            </button>

            {/* Connections card */}
            <button
              type="button"
              onClick={() => onNavigate("connections")}
              className="prism-focus group text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-sky-300 hover:bg-sky-50/30 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-150 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                  <PlugsConnected size={17} weight="duotone" />
                </div>
                {connectorsSyncing || !activeConnectors ? (
                  <span className="inline-block h-3.5 w-14 rounded-full bg-slate-200 animate-pulse" />
                ) : pausedCount > 0 ? (
                  <span
                    suppressHydrationWarning
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {pausedCount} paused
                  </span>
                ) : (
                  <span
                    suppressHydrationWarning
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {enabledCount}/{Object.keys(activeConnectors ?? {}).length || 7} Active
                  </span>
                )}
              </div>
              <div className="mt-3 text-[13.5px] font-bold text-slate-900">Connections</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                Outlook, SharePoint, Dynamics 365, and Zoho, permission-aware.
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer (brand lockup & attribution) */}
      <footer className="max-w-5xl mx-auto w-full px-6 lg:px-8">
        <div className="py-6 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <EnlightLogo size="sm" showWordmark={true} wordmark="PRISM" href="/" />

          <p className="text-xs text-slate-500 text-center sm:text-left order-last sm:order-none">
            Unified productivity copilot for modern operations.
          </p>
        </div>
      </footer>
    </div>
  );
}
