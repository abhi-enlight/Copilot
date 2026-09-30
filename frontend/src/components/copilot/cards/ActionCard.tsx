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
  GithubLogo,
  CalendarCheck,
  Notebook,
  PencilSimple,
} from "@phosphor-icons/react";
import type { ActionProposal } from "@/types/database";
import { humanizeError } from "@/lib/errors/humanize";

function formatField(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    return val.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return "[Object]";
    }
  }
  return String(val);
}

function formatCardOutcome(result: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = result as any;
  if (!res) return "Action completed successfully.";

  const channels =
    res?.data?.results?.[0]?.response?.data?.channels ||
    res?.results?.[0]?.response?.data?.channels ||
    res?.channels;

  if (Array.isArray(channels) && channels.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return `Channels: ${channels.map((c: any) => `#${c.name}`).join(", ")}`;
  }

  const totalSucceeded = res?.data?.total_succeeded ?? res?.total_succeeded;
  if (typeof totalSucceeded === "number") {
    return `Updated ${totalSucceeded} email message${totalSucceeded === 1 ? "" : "s"} successfully.`;
  }

  const msg =
    res?.data?.results?.[0]?.response?.data?.message ||
    res?.data?.message ||
    res?.message;

  if (typeof msg === "string" && msg.trim()) {
    return msg;
  }

  return "Verified execution delivered to connected service.";
}

interface ActionCardProps {
  proposal: ActionProposal;
  onApprove: (actionId: string, updatedPayload?: Record<string, unknown>) => Promise<{ success: boolean; error?: string; result?: unknown } | void>;
  onReject: (actionId: string, reason?: string) => Promise<{ success: boolean; error?: string } | void>;
}

export default function ActionCard({ proposal, onApprove, onReject }: ActionCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [rejectionMode, setRejectionMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const payload = proposal.payload || {};
  const recipient = formatField(payload.to || payload.recipient || payload.email || "");
  const subject = formatField(payload.subject || payload.title || "");
  const content = formatField(payload.content || payload.body || payload.message || payload.description || "");
  const amount = (payload.amount || payload.deal_amount || payload.value || "") as string | number;

  const [isEditing, setIsEditing] = useState(false);
  const [editedRecipient, setEditedRecipient] = useState(recipient);
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedContent, setEditedContent] = useState(content);
  const [editedAmount, setEditedAmount] = useState(String(amount || ""));

  // Check 24-hour expiration
  const [isExpired] = useState(() => {
    return proposal.created_at
      ? Date.now() - new Date(proposal.created_at).getTime() > 24 * 60 * 60 * 1000
      : false;
  });

  const handleApprove = async (withEdits = false) => {
    if (isExecuting || proposal.status !== "pending" || isExpired) return;
    setIsExecuting(true);
    setErrorMessage(null);
    try {
      let updatedPayload: Record<string, unknown> | undefined;
      if (withEdits) {
        updatedPayload = {};
        if (editedRecipient !== recipient) {
          updatedPayload.to = editedRecipient;
          updatedPayload.recipient = editedRecipient;
        }
        if (editedSubject !== subject) {
          updatedPayload.subject = editedSubject;
          updatedPayload.title = editedSubject;
        }
        if (editedContent !== content) {
          updatedPayload.content = editedContent;
          updatedPayload.body = editedContent;
          updatedPayload.message = editedContent;
        }
        if (editedAmount !== String(amount || "")) {
          const num = parseFloat(editedAmount);
          updatedPayload.amount = isNaN(num) ? editedAmount : num;
          updatedPayload.deal_amount = isNaN(num) ? editedAmount : num;
        }
      }
      const res = await onApprove(proposal.id, updatedPayload);
      if (res && !res.success) {
        const humanized = humanizeError(res.error || "Approval failed", "action");
        setErrorMessage(humanized.description);
      }
    } catch (err: unknown) {
      const humanized = humanizeError(err, "action");
      setErrorMessage(humanized.description);
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
      const humanized = humanizeError(err, "action");
      setErrorMessage(humanized.description);
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
    if (s.includes("github")) {
      return {
        label: "GitHub",
        icon: GithubLogo,
        badgeClass: "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
      };
    }
    if (s.includes("gmail")) {
      return {
        label: "Google Gmail",
        icon: EnvelopeSimple,
        badgeClass: "bg-red-50 text-red-800 border-red-200",
      };
    }
    if (s.includes("calendar")) {
      return {
        label: "Google Calendar",
        icon: CalendarCheck,
        badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
      };
    }
    if (s.includes("notion")) {
      return {
        label: "Notion",
        icon: Notebook,
        badgeClass: "bg-stone-50 text-stone-900 border-stone-200",
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

  return (
    <div
      className={`w-full my-4 rounded-2xl bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] transition-all duration-300 ${
        proposal.status !== "pending" ? "opacity-60" : ""
      } border-l-[3px] ${
        proposal.risk_level === "high"
          ? "border-l-red-500"
          : proposal.risk_level === "medium"
          ? "border-l-amber-500"
          : "border-l-emerald-500"
      }`}
    >
      {/* Top Header Row — Risk badge + Tool badge */}
      <div className="px-5 pt-5 pb-0 flex items-center justify-between gap-2">
        {/* Risk badge */}
        {proposal.risk_level === "high" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
            <Warning size={12} weight="fill" />
            High Risk
          </span>
        )}
        {proposal.risk_level === "medium" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Warning size={12} weight="bold" />
            Medium Risk
          </span>
        )}
        {proposal.risk_level === "low" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck size={12} weight="bold" />
            Low Risk
          </span>
        )}

        {/* Tool source badge */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${toolMeta.badgeClass}`}>
          <ToolIcon size={12} weight="bold" />
          {toolMeta.label}
        </span>
      </div>

      {/* Title + Description */}
      <div className="px-5 pt-3">
        <h4 className="text-[15px] font-semibold text-stone-900 tracking-[-0.015em] leading-snug">
          {(proposal.title || "")
            .replace(/composio/gi, "Prism")
            .replace(/_tool/gi, "")
            .replace(/multi execute/gi, "Multi-Operation")}
        </h4>
        {proposal.description && !proposal.description.startsWith("Request payload:") && (
          <p className="text-sm text-stone-600 mt-1 leading-relaxed">{proposal.description}</p>
        )}
      </div>

      {/* Preview Pane — editable in edit mode or read-only */}
      {(recipient || subject || content || amount || isEditing) && (
        <div className="px-5 pt-3">
          <div className="rounded-xl bg-stone-50 border border-black/[0.06] p-4 space-y-2.5 text-xs">
            {isEditing ? (
              <div className="space-y-3">
                {(recipient || proposal.tool_slug.includes("mail") || proposal.tool_slug.includes("slack") || proposal.tool_slug.includes("teams")) && (
                  <div>
                    <label className="block text-stone-500 font-medium mb-1 text-[11px]">To / Recipient</label>
                    <input
                      type="text"
                      value={editedRecipient}
                      onChange={(e) => setEditedRecipient(e.target.value)}
                      placeholder="e.g. name@company.com or #channel"
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400"
                    />
                  </div>
                )}
                {(subject || proposal.tool_slug.includes("mail") || proposal.tool_slug.includes("linear")) && (
                  <div>
                    <label className="block text-stone-500 font-medium mb-1 text-[11px]">Subject / Title</label>
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      placeholder="Subject line..."
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400"
                    />
                  </div>
                )}
                {amount && (
                  <div>
                    <label className="block text-stone-500 font-medium mb-1 text-[11px]">Amount</label>
                    <input
                      type="text"
                      value={editedAmount}
                      onChange={(e) => setEditedAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400 font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-stone-500 font-medium mb-1 text-[11px]">Message / Content</label>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={4}
                    placeholder="Enter message body..."
                    className="w-full text-xs p-3 rounded-lg bg-white border border-stone-200 text-stone-900 focus:outline-none focus:border-stone-400 leading-relaxed font-sans"
                  />
                </div>
              </div>
            ) : (
              <>
                {recipient && (
                  <div className="flex items-start gap-2">
                    <span className="text-stone-400 font-medium w-20 flex-shrink-0">To</span>
                    <span className="font-medium text-stone-800 font-mono">{editedRecipient || recipient}</span>
                  </div>
                )}
                {subject && (
                  <div className="flex items-start gap-2">
                    <span className="text-stone-400 font-medium w-20 flex-shrink-0">Subject</span>
                    <span className="font-semibold text-stone-900">{editedSubject || subject}</span>
                  </div>
                )}
                {amount && (
                  <div className="flex items-start gap-2">
                    <span className="text-stone-400 font-medium w-20 flex-shrink-0">Amount</span>
                    <span className="font-semibold text-emerald-700 font-mono">
                      {typeof amount === "number" ? `$${amount.toLocaleString()}` : editedAmount || amount}
                    </span>
                  </div>
                )}
                {content && (
                  <div className="pt-2 border-t border-stone-100">
                    <div
                      className="text-stone-700 leading-relaxed max-h-24 overflow-hidden"
                      style={{
                        maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                      }}
                    >
                      {editedContent || content}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Expiration or Error Warnings */}
      {isExpired && proposal.status === "pending" && (
        <div className="px-5 pt-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <Clock size={13} weight="bold" />
            Action proposal expired (24-hour limit). Ask Prism to generate a new proposal.
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="px-5 pt-3">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-stone-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <Warning size={14} weight="duotone" />
              <span>Notice</span>
            </div>
            <p className="text-[11.5px] text-stone-600 leading-relaxed">
              {errorMessage}
            </p>
          </div>
        </div>
      )}

      {/* Status display when not pending */}
      {proposal.status !== "pending" && (
        <div className="px-5 pb-5 pt-3">
          {proposal.status === "approved" && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <SpinnerGap size={13} className="animate-spin" />
              Approved — Executing via Prism…
            </div>
          )}

          {proposal.status === "executed" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <Check size={13} weight="bold" />
                Executed &amp; Delivered via Prism
              </div>
              {proposal.execution_result && (
                <div className="p-3 rounded-xl bg-stone-50 border border-black/[0.05] text-xs text-stone-700 space-y-1">
                  <span className="font-semibold text-stone-800 block text-[11px] uppercase tracking-wider">Outcome</span>
                  <div className="text-[12px] leading-relaxed">
                    {formatCardOutcome(proposal.execution_result)}
                  </div>
                </div>
              )}
            </div>
          )}
          {proposal.status === "rejected" && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 text-xs font-semibold">
              <X size={13} weight="bold" />
              Proposal Declined
            </div>
          )}
          {proposal.status === "failed" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Warning size={13} weight="duotone" />
                Action Could Not Be Completed
              </div>
              <p className="text-[11.5px] text-stone-500 px-1 leading-relaxed">
                The connected service was unable to fulfill this request. You can check your tool connection in Connect Hub and try again.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pending controls */}
      {proposal.status === "pending" && !isExpired && (
        <AnimatePresence mode="wait">
          {rejectionMode ? (
            <motion.div
              key="rejection-mode"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pb-5 pt-3 space-y-2"
            >
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for declining (optional)…"
                className="w-full text-xs px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-400 transition-colors"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setRejectionMode(false)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={isExecuting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {isExecuting ? "Declining…" : "Confirm Decline"}
                </button>
              </div>
            </motion.div>
          ) : isEditing ? (
            <motion.div
              key="edit-mode-controls"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-5 pb-5 pt-3 flex items-center justify-end gap-2"
            >
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditedRecipient(recipient);
                  setEditedSubject(subject);
                  setEditedContent(content);
                  setEditedAmount(String(amount || ""));
                }}
                disabled={isExecuting}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApprove(true)}
                disabled={isExecuting}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
              >
                {isExecuting ? (
                  <><SpinnerGap size={13} className="animate-spin" /><span>Executing…</span></>
                ) : (
                  <><span>Approve with Edits</span><ArrowRight size={12} weight="bold" /></>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="approve-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-5 pb-5 pt-3 flex items-center gap-2"
            >
              <button
                onClick={() => setRejectionMode(true)}
                disabled={isExecuting}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                disabled={isExecuting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <PencilSimple size={13} weight="bold" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => handleApprove(false)}
                disabled={isExecuting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
              >
                {isExecuting ? (
                  <><SpinnerGap size={13} className="animate-spin" /><span>Executing…</span></>
                ) : (
                  <><span>Approve &amp; Send</span><ArrowRight size={12} weight="bold" /></>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
