"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Pulse } from "@phosphor-icons/react";
import LiveStackRadar from "@/components/copilot/LiveStackRadar";

interface RadarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onInvestigate?: (prompt: string) => void;
}

export default function RadarDrawer({ isOpen, onClose, onInvestigate }: RadarDrawerProps) {
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
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs cursor-pointer"
          />

          {/* Drawer Body */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative w-full max-w-sm bg-white border-l border-slate-200/80 shadow-2xl h-full flex flex-col z-10 font-sans"
          >
            {/* Top Close Header */}
            <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pulse size={18} weight="bold" className="text-slate-900" />
                <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Live Stack Radar
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} weight="bold" />
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
