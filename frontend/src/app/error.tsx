"use client";

// =============================================================================
// Root Error Boundary, error.tsx (App Router)
//
// Catches uncaught exceptions from server components, async layout data
// fetching, or any unhandled throw inside the route tree.
//
// Must be a Client Component. Receives `error` and `retry` props.
// The `retry` prop (stable since Next.js 16.3) re-renders the boundary's
// children. Never surface internal error messages to users.
// =============================================================================

import { useEffect } from "react";
import PrismLogo from "@/components/brand/PrismLogo";
import { ArrowsClockwise, Warning } from "@phosphor-icons/react";

interface ErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function GlobalError({ error, retry }: ErrorProps) {
  // Log server-side digest for cross-referencing server logs, but never
  // expose the message itself in the UI.
  useEffect(() => {
    console.error("[Prism] Unhandled error (digest:", error.digest ?? "n/a", ")");
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-24 bg-[#FAFAF9] font-sans" style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl shadow-stone-900/5 p-10 flex flex-col items-center text-center gap-6">

        {/* Logo */}
        <PrismLogo size={40} />

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <Warning size={26} weight="duotone" className="text-amber-600" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-[20px] font-bold text-stone-900 tracking-tight leading-snug">
            Something went wrong on our end
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed max-w-xs mx-auto">
            Prism ran into an unexpected problem. Your data is safe. This is a
            temporary issue with the service, not something you did.
          </p>
        </div>

        {/* Digest (for support, not a technical dump) */}
        {error.digest && (
          <div className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-mono text-stone-400">
              Reference: {error.digest}
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="w-full h-px bg-stone-100" />

        {/* Actions */}
        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={retry}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold transition-colors duration-150 cursor-pointer"
          >
            <ArrowsClockwise size={15} />
            Try again
          </button>
          <a
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-sm font-semibold transition-colors duration-150"
          >
            Go to Home
          </a>
        </div>

        <p className="text-[11px] text-stone-400">
          If this keeps happening, contact your workspace admin or refresh the page.
        </p>
      </div>
    </div>
  );
}
