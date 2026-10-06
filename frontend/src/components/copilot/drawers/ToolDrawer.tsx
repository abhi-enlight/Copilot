"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  EnvelopeSimple,
  ChatsCircle,
  ChatCircleText,
  Kanban,
  Briefcase,
  ArrowSquareOut,
  SpinnerGap,
  PlugsConnected,
  Trash,
  GithubLogo,
  CalendarCheck,
  Notebook,
  Buildings,
  Folders,
  Receipt,
} from "@phosphor-icons/react";
import { openPrismConnectPopup } from "@/lib/integrations/popup";
import { notifyToolsUpdated } from "@/hooks/useToolsStatus";
import { useToast } from "@/hooks/useToast";
import type { SupportedToolSlug, ToolConnectionStatus } from "@/types/integrations";

interface ToolDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (tools: ToolConnectionStatus[]) => void;
}

interface ToolDefinition {
  slug: SupportedToolSlug;
  name: string;
  category: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  badgeClass: string;
  color: string;
}

const TOOLS: ToolDefinition[] = [
  {
    slug: "outlook",
    name: "Microsoft Outlook",
    category: "Communication & Scheduling",
    description: "Search emails, review customer correspondence, and draft replies directly from Prism.",
    icon: EnvelopeSimple,
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
    color: "#0284C7",
  },
  {
    slug: "microsoft_teams",
    name: "Microsoft Teams",
    category: "Real-Time Collaboration",
    description: "Send channel broadcasts, search discussions, and dispatch urgent alerts to team channels.",
    icon: ChatsCircle,
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    color: "#4F46E5",
  },
  {
    slug: "slack",
    name: "Slack",
    category: "Workplace Messaging",
    description: "Query company threads, monitor operational channels, and post approved proposals.",
    icon: ChatCircleText,
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    color: "#E11D48",
  },
  {
    slug: "linear",
    name: "Linear",
    category: "Project & Issue Tracking",
    description: "List sprint backlogs, inspect active bugs, and create new engineering tasks.",
    icon: Kanban,
    badgeClass: "bg-violet-50 text-violet-800 border-violet-200",
    color: "#7C3AED",
  },
  {
    slug: "zoho",
    name: "Zoho CRM",
    category: "Enterprise Revenue Pipeline",
    description: "Inspect pipeline deals, track deal stages, and update client records with sign-off gates.",
    icon: Briefcase,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    color: "#D97706",
  },
  {
    slug: "github",
    name: "GitHub",
    category: "Code & Engineering",
    description: "Inspect repositories, review pull requests, triage issues, and stage code reviews.",
    icon: GithubLogo,
    badgeClass: "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
    color: "#24292F",
  },
  {
    slug: "gmail",
    name: "Google Gmail",
    category: "Communication",
    description: "Search corporate threads, review correspondence, and draft replies with Google Workspace.",
    icon: EnvelopeSimple,
    badgeClass: "bg-red-50 text-red-800 border-red-200",
    color: "#EA4335",
  },
  {
    slug: "googlecalendar",
    name: "Google Calendar",
    category: "Scheduling",
    description: "Manage calendar events, check team availability, and organize meetings.",
    icon: CalendarCheck,
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    color: "#4285F4",
  },
  {
    slug: "notion",
    name: "Notion",
    category: "Knowledge & Docs",
    description: "Search workspace pages, read team documentation, and draft notes.",
    icon: Notebook,
    badgeClass: "bg-stone-50 text-stone-900 border-stone-200",
    color: "#000000",
  },
  {
    slug: "dynamics365",
    name: "Microsoft Dynamics 365",
    category: "CRM & Pipeline",
    description: "Inspect customer accounts, pipeline opportunities, contacts, and sales engagement.",
    icon: Buildings,
    badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
    color: "#002050",
  },
  {
    slug: "share_point",
    name: "Microsoft SharePoint",
    category: "Intranet & Documents",
    description: "Search corporate team sites, document libraries, policies, and intranet pages.",
    icon: Folders,
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
    color: "#0364B8",
  },
  {
    slug: "zoho_books",
    name: "Zoho Books",
    category: "Finance & Accounting",
    description: "Track unpaid invoices, review bills, manage expenses, and reconcile accounts.",
    icon: Receipt,
    badgeClass: "bg-orange-50 text-orange-800 border-orange-200",
    color: "#E54332",
  },
];

export default function ToolDrawer({ isOpen, onClose, onStatusChange }: ToolDrawerProps) {
  const toast = useToast();
  const [toolsStatus, setToolsStatus] = useState<Record<string, ToolConnectionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [connectingTool, setConnectingTool] = useState<string | null>(null);
  const [disconnectingTool, setDisconnectingTool] = useState<string | null>(null);
  const [confirmDisconnectSlug, setConfirmDisconnectSlug] = useState<string | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status?refresh=true", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.tools && Array.isArray(data.tools)) {
          const map: Record<string, ToolConnectionStatus> = {};
          data.tools.forEach((t: ToolConnectionStatus) => {
            map[t.slug] = t;
          });
          setToolsStatus(map);
          lastFetchTimeRef.current = Date.now();
          notifyToolsUpdated(data.tools);
          onStatusChange?.(data.tools);
        }
      }
    } catch (err) {
      console.warn("[ToolDrawer] Failed to fetch status:", err);
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  // Synchronize whenever tools update globally across tabs or popups
  useEffect(() => {
    const handleGlobalUpdate = () => {
      fetch("/api/integrations/status", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.tools && Array.isArray(data.tools)) {
            const map: Record<string, ToolConnectionStatus> = {};
            data.tools.forEach((t: ToolConnectionStatus) => {
              map[t.slug] = t;
            });
            setToolsStatus(map);
            lastFetchTimeRef.current = Date.now();
            onStatusChange?.(data.tools);
          }
        })
        .catch(() => {});
    };

    const handleSignOut = () => {
      setToolsStatus({});
      lastFetchTimeRef.current = 0;
    };

    window.addEventListener("prism:tools-updated", handleGlobalUpdate);
    window.addEventListener("prism:auth-signout", handleSignOut);
    return () => {
      window.removeEventListener("prism:tools-updated", handleGlobalUpdate);
      window.removeEventListener("prism:auth-signout", handleSignOut);
    };
  }, [onStatusChange]);

  useEffect(() => {
    if (!isOpen) return;
    const now = Date.now();
    // Cache for 15 seconds to avoid redundant round-trips on rapid drawer toggling
    if (now - lastFetchTimeRef.current < 15000 && lastFetchTimeRef.current > 0) {
      return;
    }

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
          lastFetchTimeRef.current = Date.now();
          onStatusChange?.(data.tools);
        }
      })
      .catch((err) => {
        console.warn("[ToolDrawer] Failed to fetch status:", err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isOpen, onStatusChange]);

  const handleConnect = (slug: SupportedToolSlug) => {
    if (connectingTool) return;
    setConnectingTool(slug);

    openPrismConnectPopup(slug, {
      onProgress: (msg) => {
        console.log(`[ToolDrawer] Progress for ${slug}:`, msg);
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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] cursor-pointer"
          />

          {/* Drawer Body */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Connect Hub"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative w-full max-w-[420px] bg-white border-l border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.06)] h-full flex flex-col z-10 font-[family-name:var(--font-geist-sans)]"
          >
            {/* Header */}
            <div className="p-6 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <PlugsConnected size={18} weight="bold" className="text-stone-800" />
                  <h3 className="text-[15px] font-semibold text-stone-900 tracking-tight">Connect Hub</h3>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">{connectedCount} of {TOOLS.length} tools active</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Connect Hub"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Tools list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 prism-scroll">
              {loading && Object.keys(toolsStatus).length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-white border border-black/[0.07] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl animate-shimmer" />
                          <div className="space-y-1.5">
                            <div className="w-28 h-4 rounded-md animate-shimmer" />
                            <div className="w-20 h-3 rounded-md animate-shimmer" />
                          </div>
                        </div>
                        <div className="w-16 h-5 rounded-full animate-shimmer" />
                      </div>
                      <div className="w-full h-3 rounded-md animate-shimmer" />
                      <div className="w-20 h-7 rounded-xl animate-shimmer ml-auto" />
                    </div>
                  ))}
                </div>
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
                      className="p-5 rounded-2xl bg-white border border-black/[0.07] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] hover:border-black/[0.1] transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center border"
                            style={{ backgroundColor: `${tool.color}12`, borderColor: `${tool.color}25`, color: tool.color }}
                          >
                            <ToolIcon size={20} weight="bold" />
                          </div>
                          <div>
                            <h4 className="text-[14px] font-semibold text-stone-900 tracking-tight leading-tight">{tool.name}</h4>
                            <p className="text-[11px] text-stone-400 mt-0.5">{tool.category}</p>
                          </div>
                        </div>

                        {/* Status badge */}
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-50 text-stone-500 border border-stone-200 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                            Inactive
                          </span>
                        )}
                      </div>

                      <p className="text-[12.5px] text-stone-600 leading-relaxed mb-4">{tool.description}</p>

                      {/* Connected account identity banner */}
                      {isConnected && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-50 border border-black/[0.05] text-xs text-stone-700 mb-3.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-stone-400 font-medium shrink-0">Connected as:</span>
                          <span className="font-semibold text-stone-900 truncate font-mono text-[11.5px]" title={status?.connectedAccountName || "Active Account"}>
                            {status?.connectedAccountName || "Active Account"}
                          </span>
                        </div>
                      )}

                      {/* Action button */}
                      {!isConnected ? (
                        <button
                          disabled={isConnecting || Boolean(connectingTool)}
                          onClick={() => handleConnect(tool.slug)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all disabled:opacity-40 cursor-pointer active:scale-[0.98]"
                        >
                          {isConnecting ? (
                            <><SpinnerGap size={13} className="animate-spin" /><span>Connecting…</span></>
                          ) : (
                            <><span>Connect with Prism</span><ArrowSquareOut size={13} weight="bold" /></>
                          )}
                        </button>
                      ) : isConfirming ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setConfirmDisconnectSlug(null)} className="flex-1 py-2.5 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-50 border border-stone-200 cursor-pointer">Cancel</button>
                          <button disabled={isDisconnecting} onClick={() => handleDisconnect(tool.slug)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50">
                            {isDisconnecting ? "Removing…" : "Confirm Remove"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDisconnectSlug(tool.slug)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all cursor-pointer"
                        >
                          <Trash size={12} />
                          Disconnect
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-black/[0.06] bg-stone-50/80">
              <p className="text-center text-[10.5px] text-stone-400">
                🔒 Credentials secured by Prism Sovereign Vault
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
