"use client";

import { motion } from "motion/react";
import PrismLogo from "@/components/brand/PrismLogo";

export default function LoadingSplash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAFAF9]">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-sky-500/10 blur-xl animate-pulse" />
          <PrismLogo size={52} variant="tile" className="relative shadow-md" />
        </div>
        
        <div className="space-y-1">
          <h2 className="text-base font-bold text-stone-900 tracking-tight">Prism Workspace</h2>
          <p className="text-xs text-stone-400 font-medium">Loading your enterprise copilot...</p>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </motion.div>
    </div>
  );
}
