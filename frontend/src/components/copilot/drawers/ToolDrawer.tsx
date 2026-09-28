"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@phosphor-icons/react";
import { openPrismConnectPopup } from "@/lib/integrations/popup";
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
  icon: typeof EnvelopeSimple;
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
];

export default function ToolDrawer({ isOpen, onClose, onStatusChange }: ToolDrawerProps) {
  const [toolsStatus, setToolsStatus] = useState<Record<string, ToolConnectionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [connectingTool, setConnectingTool] = useState<string | null>(null);
  const [disconnectingTool, setDisconnectingTool] = useState<string | null>(null);
  const [confirmDisconnectSlug, setConfirmDisconnectSlug] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        if (data.tools && Array.isArray(data.tools)) {
          const map: Record<string, ToolConnectionStatus> = {};
          data.tools.forEach((t: ToolConnectionStatus) => {
            map[t.slug] = t;
          });
          setToolsStatus(map);
          onStatusChange?.(data.tools);
        }
      }
    } catch (err) {
      console.warn("[ToolDrawer] Failed to fetch status:", err);
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      fetch("/api/integrations/status")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!ignore && data?.tools && Array.isArray(data.tools)) {
            const map: Record<string, ToolConnectionStatus> = {};
            data.tools.forEach((t: ToolConnectionStatus) => {
              map[t.slug] = t;
            });
            setToolsStatus(map);
            onStatusChange?.(data.tools);
          }
        })
        .catch((err) => {
          console.warn("[ToolDrawer] Failed to fetch status:", err);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }
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
        showToast(`Successfully connected to ${TOOLS.find((t) => t.slug === slug)?.name}!`);
        await fetchStatus();
      },
      onError: (err) => {
        setConnectingTool(null);
        showToast(err.message || "Connection was cancelled.");
      },
    });
  };

  const handleDisconnect = async (slug: SupportedToolSlug) => {
    setDisconnectingTool(slug);
    setConfirmDisconnectSlug(null);
    try {
      const res = await fetch(`/api/integrations/disconnect?app=${encodeURIComponent(slug)}`, {
        method: "POST",
      });
      if (res.ok) {
        showToast(`Disconnected ${slug}.`);
        await fetchStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Failed to disconnect.");
      }
    } catch {
      showToast("Network error during disconnect.");
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
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs cursor-pointer"
          />

          {/* Drawer Body */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative w-full max-w-md bg-white border-l border-slate-200/80 shadow-2xl h-full flex flex-col z-10 font-sans"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <PlugsConnected size={20} weight="bold" className="text-slate-900" />
                  <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                    Prism Connect Hub
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {connectedCount} of {TOOLS.length} enterprise tools active
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Notification Toast */}
            {toastMessage && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-slate-900 text-white text-xs flex items-center justify-between shadow-lg">
                <span>{toastMessage}</span>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Tools List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loading && Object.keys(toolsStatus).length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <SpinnerGap size={24} className="animate-spin text-slate-600" />
                  <span className="text-xs">Loading tool statuses…</span>
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
                      className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center border"
                            style={{
                              backgroundColor: `${tool.color}10`,
                              borderColor: `${tool.color}30`,
                              color: tool.color,
                            }}
                          >
                            <ToolIcon size={20} weight="bold" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">{tool.name}</h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {tool.category}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            Not Connected
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {tool.description}
                      </p>

                      {/* Action Bar */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-mono">
                          ID: {tool.slug}
                        </span>

                        {!isConnected ? (
                          <button
                            type="button"
                            disabled={isConnecting || Boolean(connectingTool)}
                            onClick={() => handleConnect(tool.slug)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition cursor-pointer active:scale-98"
                          >
                            {isConnecting ? (
                              <>
                                <SpinnerGap size={13} className="animate-spin" />
                                <span>Authorizing…</span>
                              </>
                            ) : (
                              <>
                                <span>Connect</span>
                                <ArrowSquareOut size={13} weight="bold" />
                              </>
                            )}
                          </button>
                        ) : isConfirming ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDisconnectSlug(null)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isDisconnecting}
                              onClick={() => handleDisconnect(tool.slug)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                            >
                              {isDisconnecting ? "Disconnecting…" : "Confirm"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDisconnectSlug(tool.slug)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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

            {/* Footer */}
            <div className="p-4 border-t border-slate-200/80 bg-slate-50/60 text-center text-[11px] text-slate-400">
              🔒 256-bit encrypted credentials secured by Prism Sovereign Vault
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
