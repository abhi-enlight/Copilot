"use client";

import React, { useState } from "react";
import Link from "next/link";
import PrismLogo from "@/components/brand/PrismLogo";
import { List, X, ArrowRight } from "@phosphor-icons/react";

const NAV_LINKS = [
  { label: "The difference", href: "#difference" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Safety", href: "#safety" },
  { label: "Questions", href: "#questions" },
];

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 px-4 pt-3 sm:pt-4">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl border border-black/[0.07] bg-white/80 px-4 shadow-[0_10px_36px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:px-6">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="transition-transform duration-300 group-hover:scale-105">
            <PrismLogo size={28} variant="tile" />
          </div>
          <span className="font-display text-[15.5px] font-bold tracking-tight text-[#1C1917]">Prism</span>
        </Link>

        {/* Center nav */}
        <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-xs text-[13px] font-medium text-[#78716C] transition-colors hover:text-[#1C1917]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="hidden rounded-xs text-[13px] font-medium text-[#78716C] transition-colors hover:text-[#1C1917] sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="group flex items-center gap-1.5 rounded-xl bg-[#1C1917] px-4 py-2 text-[13px] font-medium text-white shadow-xs transition-all hover:bg-black hover:shadow-md active:scale-[0.98]"
          >
            <span>Start free</span>
            <ArrowRight
              size={13}
              weight="bold"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>

          {/* Mobile menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-xs text-[#1C1917] md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="mx-auto mt-2 max-w-6xl rounded-2xl border border-black/[0.08] bg-white/95 p-5 shadow-xl backdrop-blur-2xl md:hidden">
          <div className="flex flex-col space-y-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[14px] font-medium text-[#1C1917] transition-colors hover:text-sky-600"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2.5 border-t border-black/[0.06] pt-3">
              <Link
                href="/auth/login"
                className="w-full rounded-xl border border-black/[0.08] py-2.5 text-center text-[14px] font-medium text-[#1C1917]"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="w-full rounded-xl bg-[#1C1917] py-2.5 text-center text-[14px] font-medium text-white"
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-[#0A0F1D] pt-16 pb-10 text-white">
      {/* Ambient glow + watermark, continuing the closing panel */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[440px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.35)_0%,rgba(2,132,199,0.28)_36%,rgba(245,158,11,0.16)_62%,transparent_78%)] blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-16 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 select-none whitespace-nowrap text-center text-[18vw] font-bold leading-none tracking-tight text-white/[0.02]">
          PRISM
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 pb-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <div className="flex items-center gap-2.5">
              <PrismLogo size={28} variant="tile" />
              <span className="font-display text-[16px] font-bold tracking-tight text-white">Prism</span>
            </div>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[#94A3B8]">
              Prism reads across your work overnight and hands you one short briefing, with every
              follow-up already written. You approve; it sends.
            </p>
          </div>

          <div className="md:col-span-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
              Product
            </h4>
            <ul className="mt-4 space-y-3 text-[14px]">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-[#CBD5E1] transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
              Get started
            </h4>
            <ul className="mt-4 space-y-3 text-[14px]">
              <li>
                <Link
                  href="/auth/signup"
                  className="font-medium text-sky-400 transition-colors hover:text-sky-300"
                >
                  Start free
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/login"
                  className="text-[#CBD5E1] transition-colors hover:text-white"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/cockpit"
                  className="text-[#CBD5E1] transition-colors hover:text-white"
                >
                  Live demo
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.08] pt-6 text-[12.5px] text-[#64748B]">
          © 2026 Enlight Lab. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
