"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  EnvelopeSimple,
  PaperPlaneTilt,
  FloppyDisk,
  PencilSimple,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  ArrowSquareOut,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";

export interface EmailDraftData {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  body: string;
  campaignId?: string;
}

interface EmailDraftCardProps {
  draft: EmailDraftData;
  onSent?: (result: { to: string; subject: string }) => void;
  onSavedDraft?: (draftId: string) => void;
}

export default function EmailDraftCard({
  draft,
  onSent,
  onSavedDraft,
}: EmailDraftCardProps) {
  const initialTo = Array.isArray(draft.to) ? draft.to.join(", ") : draft.to || "";
  const initialCc = Array.isArray(draft.cc) ? draft.cc.join(", ") : draft.cc || "";

  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [subject, setSubject] = useState(draft.subject || "");
  const [body, setBody] = useState(draft.body || "");

  const [isEditing, setIsEditing] = useState(false);
  const [showCc, setShowCc] = useState(Boolean(initialCc));
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [status, setStatus] = useState<"idle" | "sent" | "draft_saved" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState<string | null>(null);
  const [webLink, setWebLink] = useState<string | null>(null);
  const [requiresReconnect, setRequiresReconnect] = useState(false);
  const [reconnectUrl, setReconnectUrl] = useState<string | null>(null);

  const handleSend = async () => {
    if (!to.trim()) {
      setStatus("error");
      setStatusMessage("Please specify at least one recipient email address ('To').");
      return;
    }

    setIsSending(true);
    setStatus("idle");
    setStatusMessage(null);
    setRequiresReconnect(false);

    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.split(",").map((s) => s.trim()).filter(Boolean),
          cc: cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          subject,
          body,
          campaignId: draft.campaignId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setStatusMessage(data.error || "Failed to dispatch email via Microsoft Outlook.");
        if (data.requiresReconnect) {
          setRequiresReconnect(true);
          setReconnectUrl(
            data.reconnectUrl ||
              "/api/integrations/microsoft/connect?preset=mail&mode=write&prompt=consent&returnTo=/"
          );
        }
        return;
      }

      setStatus("sent");
      setSenderEmail(data.sender || null);
      setStatusMessage(data.message || "Email delivered successfully.");
      setIsEditing(false);
      onSent?.({ to, subject });
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while sending.";
      setStatusMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    setStatus("idle");
    setStatusMessage(null);
    setRequiresReconnect(false);

    try {
      const res = await fetch("/api/mail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to ? to.split(",").map((s) => s.trim()).filter(Boolean) : [],
          cc: cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          subject,
          body,
          campaignId: draft.campaignId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setStatusMessage(data.error || "Failed to save draft in Microsoft Outlook.");
        if (data.requiresReconnect) {
          setRequiresReconnect(true);
          setReconnectUrl(
            data.reconnectUrl ||
              "/api/integrations/microsoft/connect?preset=mail&mode=write&prompt=consent&returnTo=/"
          );
        }
        return;
      }

      setStatus("draft_saved");
      setSenderEmail(data.sender || null);
      setWebLink(data.webLink || null);
      setStatusMessage("Draft successfully created in your Outlook Drafts folder.");
      setIsEditing(false);
      if (data.draftId) {
        onSavedDraft?.(data.draftId);
      }
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while saving draft.";
      setStatusMessage(msg);
    } finally {
      setIsSavingDraft(false);
    }
  };

  return (
    <div className="my-3 rounded-2xl border border-sky-200/90 bg-gradient-to-b from-sky-50/50 to-white p-4 shadow-sm text-stone-800 transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-sky-100 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
            <EnvelopeSimple size={16} weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-900 tracking-tight">
                Email Action Draft
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                Microsoft Outlook
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Human-in-the-loop review • Direct Outlook dispatch
            </p>
          </div>
        </div>

        {status === "idle" && (
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg shadow-2xs transition-colors"
          >
            <PencilSimple size={13} weight="bold" />
            <span>{isEditing ? "Done Editing" : "Edit Draft"}</span>
          </button>
        )}
      </div>

      {/* Success Banner: Sent */}
      {status === "sent" && (
        <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5 text-xs">
          <CheckCircle size={16} weight="bold" className="text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold">{statusMessage || "Email sent successfully!"}</p>
            <p className="text-[11px] text-emerald-700">
              Dispatched from {senderEmail ? <span className="font-medium">{senderEmail}</span> : "your Outlook mailbox"}. Logged to security audit logs.
            </p>
          </div>
        </div>
      )}

      {/* Success Banner: Draft Saved */}
      {status === "draft_saved" && (
        <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start justify-between gap-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle size={16} weight="bold" className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="font-semibold">{statusMessage}</p>
              <p className="text-[11px] text-blue-700">
                You can view and finalize this message in your Outlook application.
              </p>
            </div>
          </div>
          {webLink && (
            <a
              href={webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline flex-shrink-0"
            >
              <span>Open in Outlook</span>
              <ArrowSquareOut size={12} weight="bold" />
            </a>
          )}
        </div>
      )}

      {/* Error Banner */}
      {status === "error" && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5 text-xs">
          <WarningCircle size={16} weight="bold" className="text-rose-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="font-semibold leading-snug">{statusMessage || "Action failed."}</p>
            {requiresReconnect && (
              <div className="pt-0.5 flex flex-wrap items-center gap-2">
                <a
                  href={
                    reconnectUrl ||
                    "/api/integrations/microsoft/connect?preset=mail&mode=write&prompt=consent&returnTo=/"
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all"
                >
                  <ShieldCheck size={13} weight="bold" />
                  <span>Authorize Outlook to Send Emails</span>
                  <ArrowSquareOut size={12} weight="bold" />
                </a>
                <a
                  href="/#connections"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:text-rose-900 underline"
                >
                  <span>Connections tab</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Fields & Content */}
      <div className="space-y-2.5 text-xs">
        {/* Recipients (To & CC) */}
        <div className="bg-white/80 rounded-xl border border-stone-200/80 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-12 text-stone-400 font-semibold uppercase tracking-wider text-[10px]">
              To:
            </span>
            {isEditing ? (
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com (comma-separated)"
                className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white text-stone-900"
              />
            ) : (
              <span className="font-medium text-stone-900 flex-1 truncate select-all">
                {to || <span className="text-stone-400 italic">No recipient specified</span>}
              </span>
            )}
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="text-[10.5px] text-stone-400 hover:text-stone-700 font-medium"
              >
                + CC
              </button>
            )}
          </div>

          {showCc && (
            <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
              <span className="w-12 text-stone-400 font-semibold uppercase tracking-wider text-[10px]">
                CC:
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="optional-cc@example.com"
                  className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white text-stone-900"
                />
              ) : (
                <span className="font-medium text-stone-800 flex-1 truncate select-all">
                  {cc || <span className="text-stone-400 italic">None</span>}
                </span>
              )}
            </div>
          )}

          {/* Subject Line */}
          <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
            <span className="w-12 text-stone-400 font-semibold uppercase tracking-wider text-[10px]">
              Subject:
            </span>
            {isEditing ? (
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email Subject"
                className="flex-1 px-2 py-1 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white text-stone-900 font-medium"
              />
            ) : (
              <span className="font-semibold text-stone-900 flex-1">
                {subject || <span className="text-stone-400 italic">No Subject</span>}
              </span>
            )}
          </div>
        </div>

        {/* Message Body */}
        <div className="bg-white/80 rounded-xl border border-stone-200/80 p-3">
          <div className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider mb-1.5 flex items-center justify-between">
            <span>Body Content</span>
            <span className="text-[10px] text-stone-400 lowercase">{body.length} characters</span>
          </div>

          {isEditing ? (
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body..."
              className="w-full p-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white font-mono text-stone-800 leading-relaxed"
            />
          ) : (
            <div className="text-[12.5px] leading-relaxed text-stone-700 whitespace-pre-wrap max-h-60 overflow-y-auto pr-1">
              {body || <span className="text-stone-400 italic">Empty body</span>}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      {(status === "idle" || status === "error") && (
        <div className="mt-3 pt-3 border-t border-sky-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
            <ShieldCheck size={14} weight="bold" className="text-emerald-500" />
            <span>Sends via your corporate Microsoft 365 token</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSavingDraft || isSending}
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 rounded-xl transition-all"
            >
              {isSavingDraft ? (
                <ArrowsClockwise size={13} weight="bold" className="animate-spin" />
              ) : (
                <FloppyDisk size={13} weight="bold" />
              )}
              <span>Save to Drafts</span>
            </button>

            <button
              type="button"
              disabled={isSending || isSavingDraft}
              onClick={handleSend}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
            >
              {isSending ? (
                <ArrowsClockwise size={13} weight="bold" className="animate-spin" />
              ) : (
                <PaperPlaneTilt size={13} weight="bold" />
              )}
              <span>{status === "error" ? "Retry Send" : "Approve & Send"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
