"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, LockKey, ArrowsClockwise, EnvelopeSimple, FolderOpen } from "@phosphor-icons/react";

interface NoAccessModalProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "Dynamics 365 CRM" or "Zoho CRM" */
  connectorName?: string;
  /** Verdict reason from the entitlements engine (shown as supporting detail). */
  reason?: string;
  onRecheck?: () => void;
  isRechecking?: boolean;
  onFallback?: () => void;
}

/**
 * NoAccessModal, shown when a user clicks a locked CRM connection toggle.
 * The required copy is exactly: "You don't have access to the CRM."
 */
export default function NoAccessModal({
  open,
  onClose,
  connectorName,
  reason,
  onRecheck,
  isRechecking = false,
  onFallback,
}: NoAccessModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-950/45"
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label="No CRM access"
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
                  <LockKey size={20} weight="duotone" className="text-rose-600" />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              <h3 className="text-[15px] font-bold text-stone-900 mt-4 tracking-[-0.01em]">
                You don&apos;t have access to the CRM.
              </h3>
              {connectorName && (
                <p className="text-[12.5px] text-stone-500 mt-1.5 leading-relaxed">
                  The <span className="font-semibold text-stone-700">{connectorName}</span> connection requires a
                  CRM license and security role{connectorName.includes("Zoho") ? " on your connected Zoho account" : " in your organization's Microsoft Entra ID"}.
                </p>
              )}
              {reason && (
                <p className="text-[11px] text-stone-400 mt-2 px-3 py-2 rounded-xl bg-stone-50 border border-stone-100 leading-relaxed">
                  {reason}
                </p>
              )}
              <p className="text-[11.5px] text-stone-500 mt-3 leading-relaxed">
                If you believe you should have access, ask your administrator to grant you the CRM role, then use
                <span className="font-semibold text-stone-700"> Re-check access</span> below to unlock it without
                signing in again.
              </p>

              {connectorName?.includes("Dynamics") && (
                <div className="mt-3 p-3 rounded-2xl bg-sky-50/80 border border-sky-200/80 text-sky-950 space-y-1.5">
                  <div className="text-[12px] font-bold flex items-center gap-1.5">
                    <EnvelopeSimple size={14} weight="bold" className="text-sky-600" />
                    <FolderOpen size={14} weight="bold" className="text-blue-600" />
                    <span>Outlook & SharePoint are still available</span>
                  </div>
                  <p className="text-[11px] text-sky-800 leading-relaxed">
                    You can connect Outlook Mail and SharePoint / OneDrive files right now without IT admin approval or CRM licenses.
                  </p>
                  <div className="pt-0.5">
                    <a
                      href="/api/integrations/microsoft/connect?preset=readonly&returnTo=/"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-900 underline"
                    >
                      Connect Outlook & SharePoint (No Admin Needed) →
                    </a>
                  </div>
                </div>
              )}

              {onFallback && (
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11.5px]">
                  <span className="text-stone-500">Need admin approval or fallback?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onFallback();
                    }}
                    className="font-semibold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                  >
                    View Fallbacks
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-[12.5px] font-semibold text-stone-600 hover:bg-stone-100 active:scale-[0.98] transition-all cursor-pointer"
              >
                Close
              </button>
              {onRecheck && (
                <button
                  type="button"
                  onClick={onRecheck}
                  disabled={isRechecking}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white text-[12.5px] font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ArrowsClockwise size={14} weight="bold" className={isRechecking ? "animate-spin" : ""} />
                  <span>{isRechecking ? "Checking…" : "Re-check access"}</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
