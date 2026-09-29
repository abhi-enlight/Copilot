"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Pulse } from "@phosphor-icons/react";
import LiveStackRadar from "@/components/copilot/LiveStackRadar";

interface RadarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onInvestigate?: (prompt: string) => void;
}

export default function RadarDrawer({ isOpen, onClose, onInvestigate }: RadarDrawerProps) {
  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleInvestigateWrapped = (prompt: string) => {
    onClose();
    onInvestigate?.(prompt);
  };

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
            aria-label="Live Stack Radar"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative w-full max-w-sm bg-[#FAFAF9] border-l border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.06)] h-full flex flex-col z-10 font-[family-name:var(--font-geist-sans)]"
          >
            {/* Top Close Header */}
            <div className="px-5 py-3.5 bg-white border-b border-black/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pulse size={18} weight="bold" className="text-stone-800" />
                <span className="text-[13px] font-semibold text-stone-900 tracking-tight">
                  Live Stack Radar
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Live Stack Radar"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Radar Content */}
            <div className="flex-1 overflow-hidden">
              <LiveStackRadar onInvestigate={handleInvestigateWrapped} className="border-l-0" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
