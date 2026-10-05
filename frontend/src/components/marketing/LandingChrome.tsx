"use client";

import React, { useState } from "react";
import Link from "next/link";
import PrismLogo from "@/components/brand/PrismLogo";
import { List, X } from "@phosphor-icons/react";

const NAV_LINKS = [
  { label: "Morning Briefing", href: "#briefing" },
  { label: "Safety Gatekeeper", href: "#approvals" },
  { label: "Cross-Suite Workflows", href: "#orchestration" },
  { label: "Integrations", href: "#toolkits" },
  { label: "Security", href: "#security" },
];

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/[0.05] bg-[#FAFAF9]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
        {/* Brand identity */}
        <Link href="/" className="flex items-center gap-2.5">
          <PrismLogo size={28} variant="tile" />
          <span className="text-[15px] font-bold tracking-tight text-[#1C1917]">
            Prism
          </span>
        </Link>

        {/* Minimal clean center nav */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 lg:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-[#78716C] transition-colors hover:text-[#1C1917] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-hidden rounded-xs"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Clean action buttons */}
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="hidden text-[13px] font-medium text-[#78716C] transition-colors hover:text-[#1C1917] sm:block focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-hidden rounded-xs"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-lg bg-[#1C1917] px-3.5 py-1.5 text-[13px] font-medium text-white transition-all hover:bg-black active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-hidden"
          >
            Get Started
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center text-[#1C1917] lg:hidden cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-hidden rounded-xs"
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-black/[0.06] bg-[#FAFAF9] px-6 py-6 lg:hidden">
          <div className="flex flex-col space-y-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[15px] font-medium text-[#1C1917]"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 border-t border-black/[0.06] flex flex-col gap-2.5">
              <Link
                href="/auth/login"
                className="w-full text-center rounded-lg border border-black/[0.08] py-2 text-[14px] font-medium text-[#1C1917]"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="w-full text-center rounded-lg bg-[#1C1917] py-2 text-[14px] font-medium text-white"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-[#F5F5F4]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand info */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <PrismLogo size={26} variant="tile" />
              <span className="text-[15px] font-bold tracking-tight text-[#1C1917]">Prism</span>
            </div>
            <p className="mt-3.5 max-w-sm text-[13px] leading-relaxed text-[#78716C]">
              The proactive operations copilot. Synthesizes Microsoft 365, Zoho, Google,
              and developer suites into one morning briefing, staging all actions for your sign-off.
            </p>
            <div className="mt-5 text-[12px] text-[#A8A29E]">
              Engineered by Enlight Lab. Built for operations leaders where mistakes have real costs.
            </div>
          </div>

          {/* Product Links */}
          <div className="md:col-span-3 md:col-start-7">
            <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">
              Product
            </h4>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-[#57534E] hover:text-[#1C1917] transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/cockpit" className="text-[#0369a1] font-medium hover:underline">
                  Live Executive Cockpit
                </Link>
              </li>
            </ul>
          </div>

          {/* Security & Access */}
          <div className="md:col-span-3">
            <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">
              Security and Governance
            </h4>
            <ul className="mt-4 space-y-2.5 text-[13px] text-[#57534E]">
              <li>Fail-Closed Action Classifier</li>
              <li>Row-Level Tenant Isolation</li>
              <li>Append-Only Cryptographic Ledger</li>
              <li>24-Hour Proposal Auto-Expiry</li>
              <li>Deterministic Refusal Policy</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-black/[0.06] pt-8 text-[12px] text-[#A8A29E] sm:flex-row">
          <p>© 2026 Enlight Lab. All rights reserved. Prism is an operations copilot.</p>
          <div className="flex items-center gap-6">
            <span>Microsoft 365</span>
            <span>Zoho CRM</span>
            <span>Google Workspace</span>
            <span>Linear and GitHub</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
