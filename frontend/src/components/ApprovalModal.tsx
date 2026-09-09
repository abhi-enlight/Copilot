"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  X,
  CheckCircle,
  ArrowsClockwise,
  Scales,
  ShieldCheck,
  Receipt,
  Cpu,
  Buildings,
  Kanban,
  WarningCircle,
  Check,
  SealCheck,
  EnvelopeSimple,
  FolderOpen,
  Database,
} from "@phosphor-icons/react";
import { type AspectTask } from "@/types/campaign";

export interface ApprovalAction {
  icon: "buildings" | "kanban" | "receipt" | "envelope" | "folder" | "database";
  title: string;
  detail: string;
}

const ICONS = {
  buildings: Buildings,
  kanban: Kanban,
  receipt: Receipt,
  envelope: EnvelopeSimple,
  folder: FolderOpen,
  database: Database,
};

const ASPECT_META = {
  legal: { icon: Scales, label: "Legal", text: "text-violet-700" },
  compliance: { icon: ShieldCheck, label: "Compliance", text: "text-amber-700" },
  accounting: { icon: Receipt, label: "Accounting", text: "text-emerald-700" },
  implementation: { icon: Cpu, label: "Tech & Ops", text: "text-blue-700" },
};

const DEFAULT_ZOHO_ACTIONS: ApprovalAction[] = [
  { icon: "buildings", title: "Zoho CRM deal", detail: "Campaign opportunity, stage Qualification" },
  { icon: "kanban", title: "Zoho Projects project", detail: "Tasks, owners, TATs and milestones" },
  { icon: "receipt", title: "Zoho Books invoice", detail: "Advance invoice for the campaign budget" },
];

interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  /** Heading, e.g. "Approve & push to Zoho" or "Approve & send" */
  heading?: string;
  campaignData: {
    name?: string;
    client?: string;
    budget?: string;
    codeVolume?: string;
    rewardType?: string;
  };
  tasks: AspectTask[];
  /** Write actions this approval will execute (defaults to the Zoho suite). */
  actions?: ApprovalAction[];
  booksContact?: {
    exists: boolean;
    contactId?: string;
    contactName?: string;
  } | null;
  isPushing?: boolean;
  onConfirm: () => void;
  source?: string;
  /** Shown inside the confirmation paragraph, e.g. "live records in Zoho" */
  outcomeText?: string;
}

/**
 * ApprovalModal, the single human-in-the-loop gate for EVERY write action
 * (Zoho CRM/Projects/Books records, Outlook mail, OneDrive/SharePoint files,
 * Dataverse records). Approvals are audit-logged server-side.
 */
export default function ApprovalModal({
  open,
  onClose,
  heading = "Approve & push to Zoho",
  campaignData,
  tasks,
  actions = DEFAULT_ZOHO_ACTIONS,
  booksContact,
  isPushing = false,
  onConfirm,
  source,
  outcomeText = "This creates live records in Zoho CRM, Projects and Books and marks the plan",
}: ApprovalModalProps) {
  const totalTasks = tasks.length;
  const aspectCounts = (["legal", "compliance", "accounting", "implementation"] as const).map((aspect) => ({
    aspect,
    count: tasks.filter((t) => t.aspect === aspect).length,
    meta: ASPECT_META[aspect],
  }));
  const mandatoryGates = tasks.filter((t) => t.mandatoryGate).length;
  const booksVerified = booksContact?.exists ?? false;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !isPushing && onClose()}
            className="absolute inset-0 bg-stone-950/45"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={heading}
            initial={{ scale: 0.97, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92dvh]"
          >
            {/* Header: the approval, stated once, plainly */}
            <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3 flex-shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center flex-shrink-0">
                  <SealCheck size={18} weight="fill" className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-stone-900 tracking-[-0.01em]">{heading}</h3>
                  <p className="text-[12px] text-stone-500 mt-0.5 leading-snug">
                    {campaignData.client} · {campaignData.rewardType || "Campaign"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isPushing && onClose()}
                disabled={isPushing}
                aria-label="Cancel approval"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 space-y-5">
              {/* The plan on record */}
              <div className="rounded-xl bg-stone-50 border border-stone-200/80 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-stone-400 block">Campaign</span>
                    <h4 className="text-[13.5px] font-bold text-stone-900 leading-snug mt-0.5 line-clamp-2">
                      {campaignData.name}
                    </h4>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] font-semibold text-stone-400 block">Budget</span>
                    <span className="text-[13.5px] font-bold text-stone-900 font-mono tracking-[-0.01em]">
                      {campaignData.budget || "Not set"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-200/70">
                  <span className="text-[11px] text-stone-500">
                    {totalTasks} tasks
                    {mandatoryGates > 0 ? ` · ${mandatoryGates} mandatory gates` : ""}
                  </span>
                  <span className="flex-1" />
                  {aspectCounts.map(({ aspect, count, meta }) => {
                    const Icon = meta.icon;
                    return (
                      <span
                        key={aspect}
                        title={`${meta.label}: ${count} task${count === 1 ? "" : "s"}`}
                        className={`inline-flex items-center gap-1 ${meta.text}`}
                      >
                        <Icon size={12} weight="duotone" />
                        <span className="text-[11px] font-bold font-mono">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* What approval creates, as a plain list */}
              <div>
                <h5 className="text-[12px] font-bold text-stone-900 mb-2">What approval creates</h5>
                <ul className="space-y-0">
                  {actions.map(({ icon, title, detail }, i) => {
                    const Icon = ICONS[icon] || Buildings;
                    return (
                      <li
                        key={title}
                        className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-stone-100" : ""}`}
                      >
                        <Icon size={15} weight="duotone" className="text-stone-500 flex-shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <span className="text-[12.5px] font-semibold text-stone-900 block leading-tight">{title}</span>
                          <span className="text-[11px] text-stone-500 block leading-snug mt-0.5">
                            {title.includes("Books")
                              ? `Advance invoice for ${campaignData.budget || "the campaign budget"}`
                              : detail}
                          </span>
                        </div>
                        <Check size={13} weight="bold" className="text-stone-400 flex-shrink-0" aria-hidden />
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Books contact status: only shown when it matters */}
              {booksContact && !booksVerified && (
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200/80">
                  <WarningCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
                  <p className="text-[11.5px] text-amber-900 leading-relaxed">
                    {campaignData.client} has no customer record in Zoho Books yet. The advance invoice is created
                    once they are registered.
                  </p>
                </div>
              )}
              {booksContact?.exists && (
                <p className="flex items-center gap-1.5 text-[11.5px] text-emerald-700">
                  <CheckCircle size={13} weight="fill" aria-hidden />
                  <span>
                    Books customer verified
                    {booksContact.contactName ? `: ${booksContact.contactName}` : ""}
                  </span>
                </p>
              )}

              {/* The commitment, in plain words */}
              <p className="text-[11.5px] text-stone-500 leading-relaxed">
                {source ? `${source}. ` : ""}
                {outcomeText} <strong className="text-stone-700 font-semibold">Approved</strong>. Your sign-off is
                recorded in the audit log.
              </p>
            </div>

            {/* Footer: one decision */}
            <div className="px-6 py-4 border-t border-stone-100 bg-white flex items-center justify-between gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => !isPushing && onClose()}
                disabled={isPushing}
                className="px-4 py-2.5 rounded-xl text-[12.5px] font-semibold text-stone-600 hover:bg-stone-100 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPushing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[12.5px] font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                {isPushing ? (
                  <>
                    <ArrowsClockwise size={14} className="animate-spin" aria-hidden />
                    <span>Syncing to Zoho</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={15} weight="fill" aria-hidden />
                    <span>Approve &amp; push</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
