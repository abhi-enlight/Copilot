"use client";

import { motion } from "motion/react";
import { Robot } from "@phosphor-icons/react";

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-3 max-w-3xl w-full"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-soft ring-1 ring-accent/15 flex items-center justify-center breathe">
        <Robot size={15} weight="duotone" className="text-accent" />
      </div>

      <div className="flex flex-col items-start">
        <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface border border-border shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-1.5">
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-accent/50" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-accent/50" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-accent/50" />
          </div>
        </div>
        <span className="text-[11px] text-text-tertiary px-1 mt-1">
          BCP Assist is thinking...
        </span>
      </div>
    </motion.div>
  );
}
