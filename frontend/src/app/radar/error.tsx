"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Pulse, ArrowsClockwise, ArrowLeft } from "@phosphor-icons/react";
import { humanizeError } from "@/lib/errors/humanize";
import { reportError } from "@/lib/errors/monitor";

export default function RadarError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const handleRetry = retry || reset || (() => window.location.reload());

  useEffect(() => {
    reportError(error, { category: "client", severity: "error", context: { route: "/radar" } });
  }, [error]);

  const humanized = humanizeError(error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FAFAF9]">
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl shadow-stone-900/5 p-8 flex flex-col items-center text-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
          <Pulse size={24} weight="duotone" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Telemetry Radar Feed Interrupted
          </h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            {humanized.description}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full pt-2">
          <button
            type="button"
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors duration-150 cursor-pointer shadow-sm"
          >
            <ArrowsClockwise size={14} />
            Reconnect radar
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors duration-150"
          >
            <ArrowLeft size={13} />
            Cockpit
          </Link>
        </div>

        <p className="text-[10px] font-mono text-stone-400">
          Reference: {error.digest || humanized.referenceId}
        </p>
      </div>
    </div>
  );
}
