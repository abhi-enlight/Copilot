"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  X,
  Warning,
  Clock,
  ShieldCheck,
  EnvelopeSimple,
  ChatsCircle,
  ChatCircleText,
  Kanban,
  Briefcase,
  ArrowRight,
  SpinnerGap,
} from "@phosphor-icons/react";
import type { ActionProposal } from "@/types/database";

interface ActionCardProps {
  proposal: ActionProposal;
  onApprove: (actionId: string) => Promise<{ success: boolean; error?: string; result?: unknown } | void>;
  onReject: (actionId: string, reason?: string) => Promise<{ success: boolean; error?: string } | void>;
}

export default function ActionCard({ proposal, onApprove, onReject }: ActionCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [rejectionMode, setRejectionMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check 24-hour expiration
  const [isExpired] = useState(() => {
    return proposal.created_at
      ? Date.now() - new Date(proposal.created_at).getTime() > 24 * 60 * 60 * 1000
      : false;
  });

  const handleApprove = async () => {
    if (isExecuting || proposal.status !== "pending" || isExpired) return;
    setIsExecuting(true);
    setErrorMessage(null);
    try {
      const res = await onApprove(proposal.id);
      if (res && !res.success) {
        setErrorMessage(res.error || "Approval failed");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setErrorMessage(null);
    try {
      await onReject(proposal.id, rejectionReason.trim() || undefined);
      setRejectionMode(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setIsExecuting(false);
    }
  };

  // Tool badge styling & icon
  const getToolBadge = (slug: string) => {
    const s = slug.toLowerCase();
    if (s.includes("outlook")) {
      return {
        label: "Microsoft Outlook",
        icon: EnvelopeSimple,
        badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
      };
    }
    if (s.includes("teams")) {
      return {
        label: "Microsoft Teams",
        icon: ChatsCircle,
        badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
      };
    }
    if (s.includes("slack")) {
      return {
        label: "Slack",
        icon: ChatCircleText,
        badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
      };
    }
    if (s.includes("linear")) {
      return {
        label: "Linear",
        icon: Kanban,
        badgeClass: "bg-violet-50 text-violet-800 border-violet-200",
      };
    }
    if (s.includes("zoho")) {
      return {
        label: "Zoho CRM",
        icon: Briefcase,
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      };
    }
    return {
      label: "Prism Connector",
      icon: ShieldCheck,
      badgeClass: "bg-slate-50 text-slate-800 border-slate-200",
    };
  };

  const toolMeta = getToolBadge(proposal.tool_slug);
  const ToolIcon = toolMeta.icon;

  const payload = proposal.payload || {};
  const recipient = (payload.to || payload.recipient || payload.email || "") as string;
  const subject = (payload.subject || payload.title || "") as string;
  const content = (payload.content || payload.body || payload.message || payload.description || "") as string;
  const amount = (payload.amount || payload.deal_amount || payload.value || "") as string | number;

  return (
    <div className="w-full my-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-slate-300">
      {/* Top Header Bar */}
      <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${toolMeta.badgeClass}`}>
            <ToolIcon size={14} weight="bold" />
            <span>{toolMeta.label}</span>
          </span>
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            {proposal.action_type}
          </span>
        </div>

        {/* Risk Level Badge */}
        <div className="flex items-center gap-2">
          {proposal.risk_level === "high" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
              <Warning size={12} weight="bold" />
              High Risk
            </span>
          )}
          {proposal.risk_level === "medium" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Warning size={12} weight="bold" />
              Medium Risk
            </span>
          )}
          {proposal.risk_level === "low" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck size={12} weight="bold" />
              Low Risk
            </span>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-900 tracking-tight">
            {proposal.title}
          </h4>
          {proposal.description && (
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {proposal.description}
            </p>
          )}
        </div>

        {/* Clean Structured Parameter Inspection */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-2 text-xs">
          {recipient && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Recipient:</span>
              <span className="font-semibold text-slate-900 font-mono">{recipient}</span>
            </div>
          )}
          {subject && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Subject / Title:</span>
              <span className="font-semibold text-slate-900">{subject}</span>
            </div>
          )}
          {amount && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Value / Amount:</span>
              <span className="font-semibold text-emerald-700 font-mono">
                {typeof amount === "number" ? `$${amount.toLocaleString()}` : amount}
              </span>
            </div>
          )}
          {content && (
            <div className="pt-1.5 border-t border-slate-200/50">
              <span className="text-slate-500 font-medium block mb-1">Payload Content:</span>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200/70 text-slate-800 font-sans text-xs whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {content}
              </div>
            </div>
          )}
        </div>

        {/* Expiration or Error Warnings */}
        {isExpired && proposal.status === "pending" && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <Clock size={15} weight="bold" />
            <span>Action proposal expired (24-hour limit). Ask Prism to generate a new proposal.</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <Warning size={15} weight="bold" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Controls Island */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
          {/* Status Display when not Pending */}
          {proposal.status === "approved" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <SpinnerGap size={14} className="animate-spin" />
              Approved — Executing via Prism…
            </span>
          )}

          {proposal.status === "executed" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <Check size={14} weight="bold" />
              Executed & Delivered via Prism
            </span>
          )}

          {proposal.status === "rejected" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <X size={14} weight="bold" />
              Proposal Rejected
            </span>
          )}

          {proposal.status === "failed" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
              <Warning size={14} weight="bold" />
              Execution Failed
            </span>
          )}

          {/* Pending Controls */}
          {proposal.status === "pending" && !isExpired && (
            <>
              {!rejectionMode ? (
                <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
                  <button
                    type="button"
                    disabled={isExecuting}
                    onClick={() => setRejectionMode(true)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    disabled={isExecuting}
                    onClick={handleApprove}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer active:scale-98"
                  >
                    {isExecuting ? (
                      <>
                        <SpinnerGap size={14} className="animate-spin" />
                        <span>Securing Approval…</span>
                      </>
                    ) : (
                      <>
                        <span>Approve & Deliver via Prism</span>
                        <ArrowRight size={13} weight="bold" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Rejection 2-Step Confirmation */
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full flex flex-col gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Optional reason for rejection (e.g. need different terms)..."
                      className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectionMode(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isExecuting}
                        onClick={handleRejectConfirm}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-50"
                      >
                        {isExecuting ? "Rejecting…" : "Confirm Rejection"}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
