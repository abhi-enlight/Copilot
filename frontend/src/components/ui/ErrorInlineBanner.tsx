"use client";

// =============================================================================
// ErrorInlineBanner, Reusable inline error / warning / info banner
//
// A single source of truth for all inline error states in Prism. Replaces
// ad-hoc styled divs scattered across CopilotView, CampaignsView, etc.
//
// Design principles:
//   • `error`   (red), blocking or destructive; things that didn't work
//   • `warning` (amber), recoverable; things that might be a problem
//   • `info`    (blue), neutral notices; things the user should know
//
// Every banner must have a `title`. A description and action are optional.
// The dismiss (×) button is shown when `onDismiss` is provided.
// =============================================================================

import { motion, AnimatePresence } from "motion/react";
import {
  WarningCircle,
  Warning,
  Info,
  ArrowsClockwise,
  X,
  type IconWeight,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

export type BannerSeverity = "error" | "warning" | "info";

export interface ErrorInlineBannerProps {
  id?: string;
  severity: BannerSeverity;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
  };
  onDismiss?: () => void;
  /** Extra className on the outer wrapper */
  className?: string;
}

const CONFIG: Record<
  BannerSeverity,
  {
    wrapper: string;
    icon: string;
    title: string;
    description: string;
    actionBtn: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Icon: ComponentType<any>;
  }
> = {
  error: {
    wrapper: "bg-rose-50 border-rose-200",
    icon: "text-rose-500",
    title: "text-rose-900",
    description: "text-rose-700",
    actionBtn:
      "bg-white border border-rose-200 text-rose-700 hover:bg-rose-100",
    Icon: WarningCircle,
  },
  warning: {
    wrapper: "bg-amber-50 border-amber-200",
    icon: "text-amber-500",
    title: "text-amber-900",
    description: "text-amber-700",
    actionBtn:
      "bg-white border border-amber-200 text-amber-700 hover:bg-amber-100",
    Icon: Warning,
  },
  info: {
    wrapper: "bg-stone-50 border-stone-200",
    icon: "text-stone-500",
    title: "text-stone-700",
    description: "text-stone-500",
    actionBtn:
      "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100",
    Icon: Info,
  },
};

export default function ErrorInlineBanner({
  id,
  severity,
  title,
  description,
  action,
  onDismiss,
  className = "",
}: ErrorInlineBannerProps) {
  const cfg = CONFIG[severity];
  const { Icon } = cfg as { Icon: ComponentType<{ size?: number; weight?: IconWeight; className?: string }> };

  return (
    <div
      id={id}
      role={severity === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cfg.wrapper} ${className}`}
    >
      {/* Icon */}
      <Icon
        size={16}
        weight="duotone"
        className={`${cfg.icon} flex-shrink-0 mt-0.5`}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-[12.5px] font-semibold leading-snug ${cfg.title}`}>
          {title}
        </p>
        {description && (
          <p className={`text-[11.5px] mt-0.5 leading-relaxed ${cfg.description}`}>
            {description}
          </p>
        )}

        {/* Inline action button */}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.isLoading}
            className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-60 ${cfg.actionBtn}`}
          >
            {action.isLoading ? (
              <ArrowsClockwise size={11} className="animate-spin" />
            ) : null}
            {action.label}
          </button>
        )}
      </div>

      {/* Dismiss */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnimatedErrorBanner, Wrapper with AnimatePresence for slide-in / fade-out
// ---------------------------------------------------------------------------
export function AnimatedErrorBanner({
  show,
  ...props
}: ErrorInlineBannerProps & { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <ErrorInlineBanner {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
