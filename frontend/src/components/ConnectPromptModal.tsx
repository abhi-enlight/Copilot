"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, PlugsConnected, ArrowRight } from "@phosphor-icons/react";

interface ConnectPromptModalProps {
  open: boolean;
  onClose: () => void;
  connectorName?: string;
  connectHref?: string;
}

/**
 * ConnectPromptModal is shown when a user clicks a connector toggle or action,
 * but their account is not connected yet (accessState: "not_connected").
 * Gives a clear, friendly prompt explaining they must authorize/connect first.
 */
export default function ConnectPromptModal({
  open,
  onClose,
  connectorName = "service",
  connectHref,
}: ConnectPromptModalProps) {
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
            role="dialog"
            aria-modal="true"
            aria-label={`Connect ${connectorName}`}
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center flex-shrink-0">
                  <PlugsConnected size={20} weight="duotone" className="text-sky-600" />
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
                Connect your {connectorName} account
              </h3>
              
              <p className="text-[12.5px] text-stone-500 mt-2 leading-relaxed">
                To use <span className="font-semibold text-stone-700">{connectorName}</span>, you need to sign in and grant permission for Prism to sync with your workspace.
              </p>

              <div className="mt-6 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50 transition cursor-pointer"
                >
                  Cancel
                </button>

                {connectHref ? (
                  <a
                    href={connectHref}
                    className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <span>Connect Now</span>
                    <ArrowRight size={13} weight="bold" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Got it</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
