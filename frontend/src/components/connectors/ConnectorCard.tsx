"use client";

import React from "react";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  WarningCircle,
  LockKey,
  ShieldCheck,
  PauseCircle,
} from "@phosphor-icons/react";
import type { ConnectorId, ConnectorAccess } from "@/hooks/useConnectors";

export interface ConnectorCardProps {
  id: ConnectorId;
  name: string;
  provider: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  isLoading?: boolean;
  isConnected: boolean;
  isEnabled: boolean;
  isToggling?: boolean;
  accessState: ConnectorAccess | null;
  onToggle: () => void;
  account?: string;
  connectHref?: string;
  onConnectClick?: () => void;
  onDisconnect?: () => void;
  metrics?: { label: string; value: string }[];
  requiresAdminNotice?: string;
  onAdminApprovalClick?: () => void;
}

export default function ConnectorCard({
  id,
  name,
  provider,
  description,
  icon,
  iconBg,
  isLoading = false,
  isConnected,
  isEnabled,
  isToggling = false,
  accessState,
  onToggle,
  account,
  connectHref,
  onConnectClick,
  onDisconnect,
  metrics = [],
  requiresAdminNotice,
  onAdminApprovalClick,
}: ConnectorCardProps) {
  if (isLoading) {
    return (
      <div
        id={id ? `connector-card-${id.replace(/\./g, "-")}` : undefined}
        className="rounded-2xl border border-stone-200/70 bg-white p-4.5 animate-pulse flex flex-col justify-between min-h-[240px]"
        aria-hidden
      >
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${iconBg} opacity-60`}>
                {icon}
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="h-3.5 w-36 bg-stone-200 rounded" />
                <div className="h-2.5 w-24 bg-stone-100 rounded" />
              </div>
            </div>
            <div className="h-5 w-9 rounded-full bg-stone-200 flex-shrink-0" />
          </div>
          <div className="space-y-1.5 mb-3">
            <div className="h-2.5 w-full bg-stone-100 rounded" />
            <div className="h-2.5 w-4/5 bg-stone-100 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 bg-stone-50 rounded-lg border border-stone-100" />
            <div className="h-10 bg-stone-50 rounded-lg border border-stone-100" />
          </div>
        </div>
        <div className="pt-2.5 mt-3 border-t border-stone-100">
          <div className="h-7 w-full bg-stone-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const isLocked = accessState === "locked";
  const isOperating = isConnected && isEnabled;
  const isPaused = isConnected && !isEnabled;

  return (
    <div
      id={id ? `connector-card-${id.replace(/\./g, "-")}` : undefined}
      className={`rounded-2xl border p-4.5 transition-all duration-200 flex flex-col justify-between ${
        isLocked
          ? "bg-stone-100/80 border-stone-300 opacity-95"
          : isOperating
          ? "bg-white border-stone-200/90 shadow-2xs hover:border-stone-300"
          : isPaused
          ? "bg-stone-50/70 border-stone-200/60 opacity-80"
          : "bg-white border-dashed border-stone-300 hover:border-stone-400"
      }`}
    >
      {/* Top Bar: Icon, Name & Toggle */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${iconBg}`}>
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-bold text-stone-900 leading-tight truncate">{name}</h3>
              <span className="text-[10.5px] text-stone-400 font-medium block truncate">{provider}</span>
            </div>
          </div>

          {/* Interactive Toggle Switch */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`text-[11px] font-medium ${
                isLocked
                  ? "text-rose-600 font-semibold"
                  : isOperating
                  ? "text-emerald-600 font-semibold"
                  : isPaused
                  ? "text-amber-600 font-semibold"
                  : "text-stone-400"
              }`}
            >
              {isToggling ? "Saving…" : isLocked ? "No Access" : isOperating ? "Active" : isPaused ? "Paused" : "Off"}
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              aria-disabled={isLocked}
              disabled={isLocked}
              onClick={onToggle}
              title={
                isLocked
                  ? "You don't have access to the CRM."
                  : isToggling
                  ? "Saving…"
                  : isEnabled
                  ? "Click to pause. The Copilot and automations will stop using this connection"
                  : "Click to enable for Copilot"
              }
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isLocked
                  ? "bg-stone-300 cursor-not-allowed"
                  : isToggling
                  ? "bg-stone-400 cursor-wait"
                  : isEnabled
                  ? "bg-stone-900 cursor-pointer"
                  : "bg-stone-200 cursor-pointer"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-flex items-center justify-center h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isLocked || !isEnabled ? "translate-x-0" : "translate-x-4"
                }`}
              >
                {isToggling && (
                  <ArrowsClockwise size={9} weight="bold" className="animate-spin text-stone-500" />
                )}
              </span>
              {isLocked && !isToggling && (
                <LockKey size={9} weight="fill" className="absolute inset-0 m-auto text-stone-500" aria-hidden />
              )}
              {isPaused && !isToggling && (
                <PauseCircle size={9} weight="fill" className="absolute inset-0 m-auto text-amber-500" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="text-[12px] text-stone-500 leading-relaxed mt-1 mb-3">
          {description}
        </p>

        {/* Paused explainer */}
        {isPaused && (
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-800 text-[11px] flex items-start gap-2 mb-3">
            <PauseCircle size={14} weight="fill" className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="leading-snug flex-1">
              You have paused this connection. The Copilot and automations can&apos;t use it until you turn it back on.
            </span>
          </div>
        )}

        {/* Notice for requires admin */}
        {requiresAdminNotice && (
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-800 text-[11px] flex items-start gap-2 mb-3">
            <WarningCircle size={14} weight="fill" className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="leading-snug flex-1">
              <span>{requiresAdminNotice}</span>
              {onAdminApprovalClick && (
                <button
                  type="button"
                  onClick={onAdminApprovalClick}
                  className="mt-1.5 flex items-center gap-1 font-semibold text-amber-900 hover:text-amber-950 underline cursor-pointer"
                >
                  <ShieldCheck size={12} weight="bold" />
                  <span>Need IT admin approval or fallback?</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            {metrics.map((m, mIdx) => (
              <div key={mIdx} className="bg-stone-50/90 border border-stone-100 rounded-lg p-2">
                <span className="text-[10px] text-stone-400 block">{m.label}</span>
                <span className="font-semibold text-stone-800 truncate block text-[11.5px]">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px]">
        {isConnected ? (
          <>
            <span className="text-stone-500 truncate font-mono text-[10.5px]">
              {account || "Connected & Authorized"}
            </span>
            {onDisconnect && (
              <button
                type="button"
                onClick={onDisconnect}
                className="text-rose-600 hover:text-rose-700 font-medium ml-2 cursor-pointer transition-colors"
              >
                Disconnect
              </button>
            )}
          </>
        ) : connectHref ? (
          isLocked ? (
            <button
              type="button"
              onClick={onConnectClick}
              className="w-full py-1.5 px-3 rounded-xl bg-stone-300 text-stone-600 font-semibold text-center flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              <LockKey size={12} weight="bold" />
              <span>Requires CRM Access</span>
            </button>
          ) : (
            <a
              href={connectHref}
              onClick={() => onConnectClick?.()}
              className="w-full py-1.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-center flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
            >
              <span>Connect Account</span>
              <ArrowSquareOut size={12} weight="bold" />
            </a>
          )
        ) : (
          <span className="text-stone-400">Available via Organization</span>
        )}
      </div>
    </div>
  );
}
