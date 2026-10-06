"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Warning,
  CheckCircle,
  Info,
  X,
  ArrowRight,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { humanizeError } from "@/lib/errors/humanize";
import { reportError } from "@/lib/errors/monitor";
import { initGlobalErrorMonitoring } from "@/lib/errors/monitor";
import type { HumanizedError } from "@/lib/errors/types";

export type ToastType = "error" | "success" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description: string;
  action?: ToastAction;
  referenceId?: string;
  duration?: number;
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, "id">) => string;
  error: (error: unknown, options?: { context?: string; action?: ToastAction }) => string;
  success: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Initialize global browser error capture once
  useEffect(() => {
    return initGlobalErrorMonitoring();
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({
      type,
      title,
      description,
      action,
      referenceId,
      duration = 5000,
    }: Omit<ToastItem, "id">) => {
      const id = `toast_${Math.random().toString(36).substring(2, 9)}`;
      const item: ToastItem = {
        id,
        type,
        title,
        description,
        action,
        referenceId,
        duration,
      };

      setToasts((prev) => [...prev.slice(-4), item]); // keep max 5 visible

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss]
  );

  const error = useCallback(
    (
      err: unknown,
      options: { context?: string; action?: ToastAction } = {}
    ): string => {
      const humanized: HumanizedError = humanizeError(err, options.context);
      reportError(err, { category: "client" });

      let action = options.action;
      if (!action && humanized.actionLabel) {
        if (humanized.actionType === "refresh" && typeof window !== "undefined") {
          action = {
            label: humanized.actionLabel,
            onClick: () => window.location.reload(),
          };
        } else if (humanized.actionType === "navigate" && humanized.actionUrl && typeof window !== "undefined") {
          action = {
            label: humanized.actionLabel,
            onClick: () => {
              window.location.href = humanized.actionUrl!;
            },
          };
        }
      }

      return show({
        type: "error",
        title: humanized.title,
        description: humanized.description,
        action,
        referenceId: humanized.referenceId,
        duration: 7000,
      });
    },
    [show]
  );

  const success = useCallback(
    (title: string, description = "") => {
      return show({
        type: "success",
        title,
        description,
        duration: 4000,
      });
    },
    [show]
  );

  const info = useCallback(
    (title: string, description = "") => {
      return show({
        type: "info",
        title,
        description,
        duration: 4500,
      });
    },
    [show]
  );

  const warning = useCallback(
    (title: string, description = "") => {
      return show({
        type: "warning",
        title,
        description,
        duration: 5500,
      });
    },
    [show]
  );

  return (
    <ToastContext.Provider value={{ show, error, success, info, warning, dismiss }}>
      {children}

      {/* Floating Toast Notification Dock (Bottom Right) */}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const isError = toast.type === "error";
            const isSuccess = toast.type === "success";
            const isWarning = toast.type === "warning";

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className={`pointer-events-auto rounded-2xl bg-white border p-4 shadow-xl shadow-stone-900/10 flex items-start gap-3 relative overflow-hidden ${
                  isError
                    ? "border-red-200/80 border-l-[4px] border-l-red-500"
                    : isSuccess
                    ? "border-emerald-200/80 border-l-[4px] border-l-emerald-500"
                    : isWarning
                    ? "border-amber-200/80 border-l-[4px] border-l-amber-500"
                    : "border-stone-200 border-l-[4px] border-l-sky-500"
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isError
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : isSuccess
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : isWarning
                      ? "bg-amber-50 text-amber-600 border border-amber-100"
                      : "bg-sky-50 text-sky-700 border border-sky-100"
                  }`}
                >
                  {isError && <Warning size={16} weight="duotone" />}
                  {isSuccess && <CheckCircle size={16} weight="duotone" />}
                  {isWarning && <Warning size={16} weight="duotone" />}
                  {!isError && !isSuccess && !isWarning && <Info size={16} weight="duotone" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-5">
                  <h4 className="text-[13px] font-semibold text-stone-900 tracking-tight leading-snug">
                    {toast.title}
                  </h4>
                  {toast.description && (
                    <p className="text-[12px] text-stone-600 mt-0.5 leading-relaxed">
                      {toast.description}
                    </p>
                  )}

                  {/* Optional Action Button */}
                  {toast.action && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          toast.action?.onClick();
                          dismiss(toast.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold transition-colors duration-150 cursor-pointer shadow-sm"
                      >
                        {toast.action.label.includes("Again") && <ArrowsClockwise size={12} />}
                        <span>{toast.action.label}</span>
                        {!toast.action.label.includes("Again") && <ArrowRight size={11} />}
                      </button>
                    </div>
                  )}

                  {/* Reference ID for diagnostic support */}
                  {toast.referenceId && (
                    <p className="text-[9.5px] font-mono text-stone-400 mt-2">
                      Reference: {toast.referenceId}
                    </p>
                  )}
                </div>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="absolute top-3 right-3 p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={13} weight="bold" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
