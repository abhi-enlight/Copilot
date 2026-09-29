"use client";

import React from "react";
import { Warning, ArrowsClockwise } from "@phosphor-icons/react";
import { humanizeError } from "@/lib/errors/humanize";
import type { HumanizedError } from "@/lib/errors/types";

interface InlineErrorBannerProps {
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  actionLabel?: string;
  context?: string;
  className?: string;
}

export function InlineErrorBanner({
  error,
  title,
  description,
  onRetry,
  actionLabel,
  context,
  className = "",
}: InlineErrorBannerProps) {
  const humanized: HumanizedError = humanizeError(error, context);

  const displayTitle = title || humanized.title;
  const displayDescription = description || humanized.description;
  const displayActionLabel = actionLabel || humanized.actionLabel || "Try Again";

  return (
    <div
      role="alert"
      className={`p-6 rounded-2xl bg-white border border-amber-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-700">
          <Warning size={20} weight="duotone" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-stone-900 tracking-tight leading-snug">
            {displayTitle}
          </h4>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed max-w-lg">
            {displayDescription}
          </p>
          {humanized.referenceId && (
            <p className="text-[10px] font-mono text-stone-400 mt-1.5">
              Reference: {humanized.referenceId}
            </p>
          )}
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] cursor-pointer flex-shrink-0"
        >
          <ArrowsClockwise size={13} />
          <span>{displayActionLabel}</span>
        </button>
      )}
    </div>
  );
}
