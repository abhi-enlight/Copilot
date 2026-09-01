'use client';

import React from 'react';
import { Loader2, ArrowUpRight } from 'lucide-react';

type HardwareInputBarProps = {
  input: string;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function HardwareInputBar({
  input,
  isLoading,
  inputRef,
  setInput,
  onSubmit
}: HardwareInputBarProps) {
  return (
    <div className="p-4 bg-white/80 border-t border-slate-200/70 backdrop-blur-2xl">
      <form onSubmit={onSubmit} className="relative flex items-center max-w-4xl mx-auto">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about SharePoint files, Dynamics CRM deals, or Outlook emails..."
          className="w-full bg-white border border-slate-200/90 rounded-2xl pl-5 pr-14 py-3.5 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
          disabled={isLoading}
        />

        {/* Nested Trailing Action Button */}
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="absolute right-2 p-1.5 bg-[#0f172a] hover:bg-slate-800 text-white rounded-xl transition-all disabled:opacity-30 flex items-center justify-center shadow-md shadow-slate-900/10 group active:scale-[0.95]"
        >
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
          </div>
        </button>
      </form>
    </div>
  );
}
