// =============================================================================
// Custom 404, Not Found
//
// Rendered by Next.js App Router for any unmatched URL in the app.
// Server Component, no "use client" needed.
// Must match the Prism visual language without depending on the main layout
// (which carries sidebar state, connectors, etc.).
// =============================================================================

import Link from "next/link";
import type { Metadata } from "next";
import BigCityLogo from "@/components/BigCityLogo";

export const metadata: Metadata = {
  title: "Page not found · BCP Assist",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#FAFAF9] font-sans" style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
          {/* Card */}
          <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl shadow-stone-900/5 p-10 flex flex-col items-center text-center gap-6">

            {/* Logo */}
            <BigCityLogo size={44} variant="tile" className="rounded-2xl p-1.5" />

            {/* Error code */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-[11px] font-mono font-semibold text-stone-500">
              404 · Page not found
            </div>

            {/* Headline */}
            <div className="space-y-2">
              <h1 className="text-[22px] font-bold text-stone-900 tracking-tight leading-snug">
                This page doesn&rsquo;t exist
              </h1>
              <p className="text-sm text-stone-500 leading-relaxed max-w-xs mx-auto">
                The link might be wrong, or this page may have moved.
                Either way, that&rsquo;s on the URL, not on you.
              </p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-stone-100" />

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Link
                href="/"
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold transition-colors duration-150"
              >
                Go to Home
              </Link>
              <Link
                href="/#connections"
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-sm font-semibold transition-colors duration-150"
              >
                Connections
              </Link>
            </div>

            {/* Footer note */}
            <p className="text-[11px] text-stone-400">
              If you were following a link from inside BCP Assist, please let your admin know.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
