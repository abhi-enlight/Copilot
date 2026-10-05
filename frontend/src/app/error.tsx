"use client";

import { useEffect } from "react";
import Link from "next/link";
import PrismLogo from "@/components/brand/PrismLogo";
import { ArrowsClockwise, Warning } from "@phosphor-icons/react";
import { humanizeError } from "@/lib/errors/humanize";
import { reportError } from "@/lib/errors/monitor";

interface ErrorProps {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}

export default function GlobalError({ error, reset, retry }: ErrorProps) {
  const handleRetry = retry || reset || (() => window.location.reload());

  useEffect(() => {
    reportError(error, { category: "client", severity: "error" });
  }, [error]);

  const humanized = humanizeError(error);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-24 bg-[#FAFAF9] font-sans antialiased text-stone-900"
      style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl shadow-stone-900/5 p-10 flex flex-col items-center text-center gap-6">
        {/* Logo */}
        <PrismLogo size={44} variant="tile" />

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <Warning size={26} weight="duotone" />
        </div>

        {/* Non-Technical Message */}
        <div className="space-y-2">
          <h1 className="text-[20px] font-bold text-stone-900 tracking-tight leading-snug">
            {humanized.title}
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed max-w-xs mx-auto">
            {humanized.description}
          </p>
        </div>

        {/* Support Reference ID (clean reference, not technical dump) */}
        <div className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200">
          <p className="text-[10.5px] font-mono text-stone-400">
            Reference: {error.digest || humanized.referenceId}
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-stone-100" />

        {/* Actions */}
        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold transition-colors duration-150 cursor-pointer shadow-sm"
          >
            <ArrowsClockwise size={15} />
            Try again
          </button>
          <Link
            href="/cockpit"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-sm font-semibold transition-colors duration-150"
          >
            Back to Cockpit
          </Link>
        </div>

        <p className="text-[11px] text-stone-400">
          Your data is safe. If this keeps happening, refreshing the page usually resolves it.
        </p>
      </div>
    </div>
  );
}
