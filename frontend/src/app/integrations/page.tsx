"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PlugsConnected,
  ChatCircle,
  Pulse,
  ShieldCheck,
  Plus,
  ArrowLeft,
  ArrowSquareOut,
  Trash,
  SpinnerGap,
  EnvelopeSimple,
  ChatsCircle,
  ChatCircleText,
  Kanban,
  Briefcase,
  GithubLogo,
  CalendarCheck,
  Notebook,
  Buildings,
  Folders,
  Receipt,
} from "@phosphor-icons/react";
import CockpitHeader from "@/components/copilot/CockpitHeader";
import { openPrismConnectPopup } from "@/lib/integrations/popup";
import { notifyToolsUpdated } from "@/hooks/useToolsStatus";
import { useToast } from "@/hooks/useToast";
import type { SupportedToolSlug, ToolConnectionStatus } from "@/types/integrations";

interface ToolDefinition {
  slug: SupportedToolSlug;
  name: string;
  category: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  badgeClass: string;
  color: string;
  scopes: string[];
}

const TOOLS: ToolDefinition[] = [
  {
    slug: "outlook",
    name: "Microsoft Outlook",
    category: "Communication & Scheduling",
    description: "Search corporate emails, review customer threads, and draft high-context replies directly from Prism.",
    icon: EnvelopeSimple,
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
    color: "#0284C7",
    scopes: ["Mail.Read", "Mail.Send", "Calendars.Read"],
  },
  {
    slug: "microsoft_teams",
    name: "Microsoft Teams",
    category: "Real-Time Collaboration",
    description: "Send channel broadcasts, search discussions, and dispatch urgent alerts across project channels.",
    icon: ChatsCircle,
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    color: "#4F46E5",
    scopes: ["ChannelMessage.Read.All", "ChatMessage.Send"],
  },
  {
    slug: "slack",
    name: "Slack",
    category: "Workplace Messaging",
    description: "Query company threads, monitor operational channels, and post approved proposals.",
    icon: ChatCircleText,
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    color: "#E11D48",
    scopes: ["channels:history", "chat:write", "users:read"],
  },
  {
    slug: "linear",
    name: "Linear",
    category: "Project & Issue Tracking",
    description: "List sprint backlogs, inspect active bugs, and create new engineering tasks with client context.",
    icon: Kanban,
    badgeClass: "bg-violet-50 text-violet-800 border-violet-200",
    color: "#7C3AED",
    scopes: ["read", "write", "issues:create"],
  },
  {
    slug: "zoho",
    name: "Zoho CRM",
    category: "Enterprise Revenue Pipeline",
    description: "Inspect pipeline deals, track stages, and update client records with human sign-off gates.",
    icon: Briefcase,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    color: "#D97706",
    scopes: ["ZohoCRM.modules.ALL", "ZohoCRM.users.READ"],
  },
  {
    slug: "github",
    name: "GitHub",
    category: "Code & Engineering",
    description: "Inspect repositories, review pull requests, triage issues, and stage code reviews.",
    icon: GithubLogo,
    badgeClass: "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
    color: "#24292F",
    scopes: ["repo", "read:org", "pull_requests:read"],
  },
  {
    slug: "gmail",
    name: "Google Gmail",
    category: "Communication",
    description: "Search corporate threads, review correspondence, and draft replies with Google Workspace.",
    icon: EnvelopeSimple,
    badgeClass: "bg-red-50 text-red-800 border-red-200",
    color: "#EA4335",
    scopes: ["gmail.readonly", "gmail.send", "gmail.compose"],
  },
  {
    slug: "googlecalendar",
    name: "Google Calendar",
    category: "Scheduling",
    description: "Manage calendar events, check team availability, and organize meetings.",
    icon: CalendarCheck,
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    color: "#4285F4",
    scopes: ["calendar.readonly", "calendar.events"],
  },
  {
    slug: "notion",
    name: "Notion",
    category: "Knowledge & Docs",
    description: "Search workspace pages, read team documentation, and draft notes.",
    icon: Notebook,
    badgeClass: "bg-stone-50 text-stone-900 border-stone-200",
    color: "#000000",
    scopes: ["pages:read", "pages:write", "blocks:read"],
  },
  {
    slug: "dynamics365",
    name: "Microsoft Dynamics 365",
    category: "CRM & Pipeline",
    description: "Inspect customer accounts, pipeline opportunities, contacts, and sales engagement.",
    icon: Buildings,
    badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
    color: "#002050",
    scopes: ["user_impersonation", "offline_access"],
  },
  {
    slug: "share_point",
    name: "Microsoft SharePoint",
    category: "Intranet & Documents",
    description: "Search corporate team sites, document libraries, policies, and intranet pages.",
    icon: Folders,
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
    color: "#0364B8",
    scopes: ["Sites.Read.All", "Files.ReadWrite.All"],
  },
  {
    slug: "zoho_books",
    name: "Zoho Books",
    category: "Finance & Accounting",
    description: "Track unpaid invoices, review bills, manage expenses, and reconcile accounts.",
    icon: Receipt,
    badgeClass: "bg-orange-50 text-orange-800 border-orange-200",
    color: "#E54332",
    scopes: ["ZohoBooks.invoices.ALL", "ZohoBooks.bills.ALL", "ZohoBooks.contacts.ALL"],
  },
];

export default function IntegrationsPage() {
  const toast = useToast();
  const [toolsStatus, setToolsStatus] = useState<Record<string, ToolConnectionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [connectingTool, setConnectingTool] = useState<string | null>(null);
  const [disconnectingTool, setDisconnectingTool] = useState<string | null>(null);
  const [confirmDisconnectSlug, setConfirmDisconnectSlug] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.tools && Array.isArray(data.tools)) {
          const map: Record<string, ToolConnectionStatus> = {};
          data.tools.forEach((t: ToolConnectionStatus) => {
            map[t.slug] = t;
          });
          setToolsStatus(map);
        }
      }
    } catch (err) {
      console.warn("[IntegrationsPage] Failed to fetch status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/integrations/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.tools && Array.isArray(data.tools)) {
          const map: Record<string, ToolConnectionStatus> = {};
          data.tools.forEach((t: ToolConnectionStatus) => {
            map[t.slug] = t;
          });
          setToolsStatus(map);
        }
      })
      .catch((err) => {
        console.warn("[IntegrationsPage] Failed to fetch status:", err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    const handleToolsUpdated = () => {
      fetch("/api/integrations/status", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!ignore && data?.tools && Array.isArray(data.tools)) {
            const map: Record<string, ToolConnectionStatus> = {};
            data.tools.forEach((t: ToolConnectionStatus) => {
              map[t.slug] = t;
            });
            setToolsStatus(map);
          }
        })
        .catch(() => {});
    };

    const handleSignOut = () => {
      setToolsStatus({});
    };

    window.addEventListener("prism:tools-updated", handleToolsUpdated);
    window.addEventListener("prism:auth-signout", handleSignOut);

    return () => {
      ignore = true;
      window.removeEventListener("prism:tools-updated", handleToolsUpdated);
      window.removeEventListener("prism:auth-signout", handleSignOut);
    };
  }, []);

  const handleConnect = (slug: SupportedToolSlug) => {
    if (connectingTool) return;
    setConnectingTool(slug);

    openPrismConnectPopup(slug, {
      onProgress: (msg) => {
        console.log(`[IntegrationsPage] Progress for ${slug}:`, msg);
      },
      onSuccess: async () => {
        setConnectingTool(null);
        const toolName = TOOLS.find((t) => t.slug === slug)?.name || slug;
        toast.success("Connected", `Successfully connected to ${toolName}!`);
        notifyToolsUpdated();
        await fetchStatus();
      },
      onError: (err) => {
        setConnectingTool(null);
        toast.error(err, { context: "integration" });
      },
    });
  };

  const handleDisconnect = async (slug: SupportedToolSlug) => {
    setDisconnectingTool(slug);
    setConfirmDisconnectSlug(null);
    try {
      const res = await fetch(`/api/integrations/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: slug }),
      });
      if (res.ok) {
        toast.success("Disconnected", `Successfully disconnected ${slug}.`);
        notifyToolsUpdated();
        await fetchStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to disconnect.", { context: "integration" });
      }
    } catch {
      toast.error("Network error during disconnect.", { context: "integration" });
    } finally {
      setDisconnectingTool(null);
    }
  };

  const connectedCount = Object.values(toolsStatus).filter((t) => t.isConnected).length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAFAF9] text-stone-900 font-[family-name:var(--font-geist-sans)]">
      {/* Top Header */}
      <CockpitHeader
        connectedToolsCount={connectedCount}
        totalToolsCount={TOOLS.length}
        onOpenToolDrawer={() => {
          const el = document.getElementById("tools-grid");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        onToggleRadar={() => {}}
        isRadarOpen={false}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Rail */}
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
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              >
                <Pulse size={16} weight="bold" className="text-stone-500" />
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
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-900 bg-stone-100 border-l-[3px] border-indigo-500 pl-[calc(0.75rem-3px)]"
              >
                <PlugsConnected size={16} weight="bold" className="text-indigo-600" />
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
            <span className="text-[10px] font-mono text-stone-400">Prism Hub</span>
          </div>
        </nav>

        {/* Center Main Hub */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FAFAF9]">
          {/* Subheader */}
          <div className="p-6 bg-white border-b border-black/[0.05] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <PlugsConnected size={22} weight="bold" className="text-stone-900" />
                <div>
                  <h1 className="text-lg font-bold text-stone-900 tracking-tight">
                    Prism Connector Hub
                  </h1>
                  <p className="text-xs text-stone-500">
                    Connect and orchestrate your enterprise operational stack with per-user isolated credentials
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {connectedCount} of {TOOLS.length} Tools Connected
              </span>
            </div>
          </div>

          {/* Tools Grid */}
          <div id="tools-grid" className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full prism-scroll">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading && Object.keys(toolsStatus).length === 0 ? (
                <>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="p-6 rounded-2xl bg-white border border-black/[0.07] flex flex-col justify-between h-48 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl animate-shimmer flex-shrink-0" />
                          <div className="space-y-1.5">
                            <div className="w-32 h-4 rounded-md animate-shimmer" />
                            <div className="w-24 h-3 rounded-md animate-shimmer" />
                          </div>
                        </div>
                        <div className="w-16 h-5 rounded-full animate-shimmer" />
                      </div>
                      <div className="space-y-1">
                        <div className="w-full h-3 rounded-md animate-shimmer" />
                        <div className="w-3/4 h-3 rounded-md animate-shimmer" />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                        <div className="w-24 h-3 rounded-md animate-shimmer" />
                        <div className="w-20 h-7 rounded-xl animate-shimmer" />
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                TOOLS.map((tool) => {
                  const status = toolsStatus[tool.slug];
                  const isConnected = status?.isConnected ?? false;
                  const isConnecting = connectingTool === tool.slug;
                  const isDisconnecting = disconnectingTool === tool.slug;
                  const isConfirming = confirmDisconnectSlug === tool.slug;
                  const ToolIcon = tool.icon;

                  return (
                    <div
                      key={tool.slug}
                      className="p-6 rounded-2xl bg-white border border-black/[0.07] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Tool Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center border"
                              style={{
                                backgroundColor: `${tool.color}12`,
                                borderColor: `${tool.color}25`,
                                color: tool.color,
                              }}
                            >
                              <ToolIcon size={22} weight="bold" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-stone-900 tracking-tight leading-tight">
                                {tool.name}
                              </h3>
                              <p className="text-[11px] text-stone-400 mt-0.5 font-medium">
                                {tool.category}
                              </p>
                            </div>
                          </div>

                          {isConnected ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-50 text-stone-500 border border-stone-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                              Not Connected
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-stone-600 leading-relaxed mb-4">
                          {tool.description}
                        </p>

                        {/* Scopes pill tags */}
                        <div className="mb-5">
                          <span className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
                            Authorizations
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tool.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="px-2 py-0.5 rounded-md bg-stone-50 border border-stone-200 text-[10.5px] font-mono text-stone-600"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-stone-500 truncate max-w-[220px]" title={status?.connectedAccountName || undefined}>
                          {isConnected && status?.connectedAccountName
                            ? `Connected as ${status.connectedAccountName}`
                            : isConnected && status?.lastSyncAt
                            ? `Last sync: ${new Date(status.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : `Slug: ${tool.slug}`}
                        </span>

                        {!isConnected ? (
                          <button
                            type="button"
                            disabled={isConnecting || Boolean(connectingTool)}
                            onClick={() => handleConnect(tool.slug)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40"
                          >
                            {isConnecting ? (
                              <>
                                <SpinnerGap size={13} className="animate-spin" />
                                <span>Authorizing…</span>
                              </>
                            ) : (
                              <>
                                <span>Connect with Prism</span>
                                <ArrowSquareOut size={13} weight="bold" />
                              </>
                            )}
                          </button>
                        ) : isConfirming ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDisconnectSlug(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isDisconnecting}
                              onClick={() => handleDisconnect(tool.slug)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              {isDisconnecting ? "Removing…" : "Confirm"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDisconnectSlug(tool.slug)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash size={13} />
                            <span>Disconnect</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Security Guarantee Box */}
            <div className="mt-8 p-5 rounded-2xl bg-white border border-black/[0.06] text-center text-xs text-stone-500 space-y-1">
              <p className="font-semibold text-stone-800">
                🔒 Prism Sovereign Security Guarantee
              </p>
              <p className="text-[11.5px] text-stone-400 max-w-md mx-auto leading-relaxed">
                OAuth access tokens and refresh tokens are AES-256-GCM encrypted in the Sovereign Vault and isolated per user. No tool data is ever shared across organizations.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
