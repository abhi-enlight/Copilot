"use client";

import Link from "next/link";
import Reveal from "@/components/marketing/Reveal";
import ApprovalPreview from "@/components/marketing/ApprovalPreview";
import InteractiveBriefingDemo from "@/components/marketing/InteractiveBriefingDemo";
import InteractiveArchitecture from "@/components/marketing/InteractiveArchitecture";
import InteractiveOrchestrationDemo from "@/components/marketing/InteractiveOrchestrationDemo";
import { ToolkitMarquee } from "@/components/marketing/ToolkitMarquee";
import {
  ArrowRight,
  ShieldCheck,
  Check,
  Database,
  LockKey,
  FileText,
  ShieldWarning,
  Clock,
  Fingerprint,
} from "@phosphor-icons/react";

export { ToolkitMarquee };

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pt-20 pb-16 sm:pt-28 sm:pb-24">
      {/* High-end Apple ambient lighting behind hero: Organic soft lighting, zero ruler grids */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Celestial diffuse radial glow */}
        <div
          className="absolute inset-0 opacity-[0.7]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 60% at 50% -10%, rgba(2, 132, 199, 0.10), rgba(56, 189, 248, 0.04) 45%, transparent 75%),
              radial-gradient(circle at 50% 40%, rgba(245, 245, 244, 0.8) 0%, transparent 80%)
            `,
          }}
        />
        {/* Tactile micro-noise texture */}
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-multiply"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center">
          {/* Typographic Eyebrow Badge */}
          <Reveal onMount>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#F5F5F4]/90 px-3.5 py-1.5 shadow-2xs backdrop-blur-xs transition-colors hover:border-black/[0.14]">
              <span className="font-mono text-[11px] font-medium tracking-wide uppercase text-[#1C1917]">
                Proactive Operations Copilot
              </span>
              <span className="text-black/20">•</span>
              <span className="text-[12px] font-normal text-[#78716C]">
                Briefed at 8:00 AM
              </span>
            </div>
          </Reveal>

          {/* Hero Heading: Editorial two-tone hierarchy with scaled-down payoff */}
          <Reveal onMount delay={0.06} className="mt-6">
            <h1
              id="hero-title"
              className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-[#1C1917] sm:text-5xl md:text-6xl lg:text-[68px]"
            >
              Stop checking nine tabs every morning.
              <span className="block mt-3.5 text-xl font-medium tracking-[-0.02em] text-[#78716C] sm:text-2xl md:text-3xl lg:text-[34px] lg:leading-[1.25]">
                Every deal, thread, and blocker briefed before 8:00 AM.
              </span>
            </h1>
          </Reveal>

          {/* Subheading */}
          <Reveal onMount delay={0.12} className="mt-6">
            <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-[#78716C] sm:text-[18px]">
              Prism reads across Microsoft 365, Zoho, Google, and Slack while you sleep. It surfaces what actually
              needs your attention, drafts every follow-up, and executes only when you approve.
            </p>
          </Reveal>

          {/* Button cluster (clean Apple buttons with secondary surface tone) */}
          <Reveal onMount delay={0.18} className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="group flex items-center gap-2 rounded-lg bg-[#1C1917] px-6 py-3.5 text-[14px] font-medium text-white shadow-sm transition-all hover:bg-black active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <span>Get Your Morning Briefing</span>
              <ArrowRight size={15} weight="bold" className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <a
              href="#approvals"
              className="rounded-lg border border-black/[0.08] bg-[#F5F5F4] px-6 py-3.5 text-[14px] font-medium text-[#1C1917] transition-all hover:bg-[#EFECE8] hover:border-black/[0.14] active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              See How Approvals Work
            </a>
          </Reveal>

          {/* Proof badges (Secondary color cards, zero ruler tick dividers) */}
          <Reveal onMount delay={0.24} className="mt-8 flex flex-wrap items-center justify-center gap-3 font-mono text-[11px] text-[#57534E]">
            <div className="flex items-center gap-2 rounded-md border border-black/[0.06] bg-[#F5F5F4] px-3.5 py-1.5 shadow-2xs">
              <Check weight="bold" size={13} className="text-emerald-600" />
              <span>Reclaims 42 minutes every morning</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-black/[0.06] bg-[#F5F5F4] px-3.5 py-1.5 shadow-2xs">
              <Check weight="bold" size={13} className="text-emerald-600" />
              <span>Fail-closed action gatekeeper</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-black/[0.06] bg-[#F5F5F4] px-3.5 py-1.5 shadow-2xs">
              <Check weight="bold" size={13} className="text-emerald-600" />
              <span>Connects in 2 minutes without migrations</span>
            </div>
          </Reveal>
        </div>

        {/* Live Interactive Hero Canvas */}
        <Reveal onMount delay={0.3} className="mt-14 sm:mt-18" id="briefing">
          <InteractiveBriefingDemo />
        </Reveal>
      </div>
    </section>
  );
}

export function ApprovalWedge() {
  return (
    <section id="approvals" aria-labelledby="approvals-title" className="relative overflow-hidden py-24 sm:py-32">
      {/* Background design texture: Soft warm diffuse aura, zero ruler lattice lines */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 70% 50% at 20% 50%, rgba(245, 158, 11, 0.06), transparent 70%)
            `,
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
          <Reveal className="lg:col-span-6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Fail-Closed Safety Boundary
            </p>

            <h2
              id="approvals-title"
              className="mt-3 text-3xl font-bold leading-tight tracking-[-0.03em] text-[#1C1917] sm:text-4xl lg:text-5xl"
            >
              Nothing changes without your sign-off. Ever.
            </h2>

            <p className="mt-5 text-[16px] leading-relaxed text-[#57534E]">
              Unchecked autonomous bots writing to production databases are an unacceptable operational liability.
              Prism enforces a strict architectural boundary: read queries stream freely into your morning briefing,
              while any state-changing write halts until you review and sign off.
            </p>

            <div className="mt-8 space-y-3.5">
              {[
                {
                  icon: <Fingerprint size={18} weight="duotone" className="text-sky-600 flex-shrink-0" />,
                  title: "Staged proposals, zero silent edits",
                  desc: "Every outbound email, CRM update, or Linear assignment creates an explicit proposal card. If an LLM hallucinates, nothing touches your production systems.",
                },
                {
                  icon: <LockKey size={18} weight="duotone" className="text-amber-600 flex-shrink-0" />,
                  title: "Tamper-proof SHA-256 signatures",
                  desc: "Proposals carry a cryptographic hash calculated before review. If background logic or prompt injection alters the payload, the proposal invalidates immediately.",
                },
                {
                  icon: <Clock size={18} weight="duotone" className="text-indigo-600 flex-shrink-0" />,
                  title: "Automatic 24-hour expiration",
                  desc: "Unreviewed proposals expire permanently after 24 hours. Stale recommendations never linger in your queue or execute on outdated company context.",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3.5 rounded-xl border border-black/[0.08] bg-[#F5F5F4] p-4 transition-all duration-200 hover:border-black/[0.14] hover:bg-[#EFECE8] hover:shadow-2xs">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.06] bg-white flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-semibold text-[#1C1917]">{item.title}</h4>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#78716C]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-6">
            <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-2.5 shadow-lg">
              <div className="rounded-xl border border-black/[0.08] bg-[#F5F5F4] p-5 sm:p-7">
                <div className="mb-4 flex items-center justify-between border-b border-black/[0.06] pb-3">
                  <span className="font-mono text-[11px] font-semibold uppercase text-[#78716C]">
                    In-Cockpit Approval Card
                  </span>
                  <span className="font-mono text-[11px] font-medium text-emerald-600">FAIL-CLOSED RUNTIME</span>
                </div>
                <ApprovalPreview />
                <p className="mt-4 text-center font-mono text-[11px] text-[#A8A29E]">
                  INTERACTIVE SPECIFICATION: ZERO UNAPPROVED MUTATIONS
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function OrchestrationSection() {
  return (
    <section id="orchestration" aria-labelledby="orchestration-title" className="relative overflow-hidden border-t border-black/[0.05] bg-[#FAFAF9] py-24 sm:py-32">
      {/* Background design texture: Soft ambient conduit glow, zero ruler grid lines */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 75% 55% at 50% 45%, rgba(2, 132, 199, 0.08), transparent 70%)
            `,
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0284c7]">
            Cross-Suite Orchestration
          </p>
          <h2
            id="orchestration-title"
            className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#1C1917] sm:text-4xl lg:text-5xl"
          >
            One instruction. Handled across every tool.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-[#57534E]">
            When you need to update a deal, notify a client, and alert engineering, you do not need three logins.
            Prism resolves the entire sequence in seconds, keeping you in one clean interface.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <InteractiveOrchestrationDemo />
        </Reveal>
      </div>
    </section>
  );
}

export function ArchitectureSection() {
  return (
    <section id="architecture" aria-labelledby="arch-title" className="relative overflow-hidden py-24 sm:py-32">
      {/* Background design texture: Ethereal blueprint aura, zero ruler dot grids */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 60% at 50% 45%, rgba(14, 165, 233, 0.08), transparent 70%)
            `,
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0284c7]">
            Deterministic System Architecture
          </p>
          <h2
            id="arch-title"
            className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#1C1917] sm:text-4xl lg:text-5xl"
          >
            Built for operations where mistakes cost real money.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-[#57534E]">
            We treat large language models as untrusted inference engines. Enterprise safety cannot rely on
            prompt suggestions: it must be enforced by compiled software logic, typed schemas, and cryptographic receipts.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <InteractiveArchitecture />
        </Reveal>
      </div>
    </section>
  );
}

export function SecurityGrid() {
  return (
    <section id="security" aria-labelledby="security-title" className="relative overflow-hidden border-t border-black/[0.05] bg-[#F5F5F4]/60 py-24 sm:py-32">
      {/* Background design texture: Soft diffuse aura, zero ruler hatch lines */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 75% 60% at 50% 40%, rgba(2, 132, 199, 0.06), transparent 70%)
            `,
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0284c7]">
            Enterprise Governance
          </p>
          <h2 id="security-title" className="mt-2 text-3xl font-bold tracking-tight text-[#1C1917] sm:text-4xl">
            Strict boundaries written in code, not prompts.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-[#57534E]">
            We never ask an AI to behave itself. We enforce multi-tenant isolation, deterministic refusal policies,
            and encrypted credential vaults at the infrastructure level.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <Database size={20} weight="duotone" className="text-sky-600" />,
              tag: "SUPABASE RLS",
              title: "Row-Level Isolation",
              body: "Supabase row-level security guarantees multi-tenant partition. Tool tokens and briefing histories cannot leak across organizations.",
            },
            {
              icon: <ShieldWarning size={20} weight="duotone" className="text-amber-600" />,
              tag: "HARD AST POLICY",
              title: "Deterministic Refusal",
              body: "Destructive deletes, credential export, wire transfers, and mass email sends are blocked by code policy before model invocation.",
            },
            {
              icon: <LockKey size={20} weight="duotone" className="text-indigo-600" />,
              tag: "AES-256-GCM",
              title: "Hardware-Encrypted Vaults",
              body: "Composio OAuth credentials live in encrypted vaults with automated rotation cycles and instant single-click revocation.",
            },
            {
              icon: <FileText size={20} weight="duotone" className="text-emerald-600" />,
              tag: "SHA-256 CHAIN",
              title: "Append-Only Audit Ledger",
              body: "Every generated briefing, staged proposal, human signature, and API payload is recorded into an unalterable audit table for compliance reviews.",
            },
          ].map((card, idx) => (
            <Reveal key={card.title} delay={idx * 0.05}>
              <div className="group h-full rounded-xl border border-black/[0.08] bg-[#F5F5F4] p-6 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-black/[0.14] hover:bg-[#EFECE8] hover:shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.06] bg-white transition-colors group-hover:border-black/[0.12]">
                    {card.icon}
                  </div>
                  <span className="font-mono text-[10px] font-semibold text-[#78716C]">{card.tag}</span>
                </div>
                <h4 className="mt-4 text-[15px] font-bold text-[#1C1917]">{card.title}</h4>
                <p className="mt-2 text-[13px] leading-relaxed text-[#57534E]">{card.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="relative overflow-hidden py-24 sm:py-32">
      {/* Background design texture: Ambient light dispersion, zero ruler grids */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 60%, rgba(2, 132, 199, 0.09), transparent 70%)
            `,
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-[#1C1917] px-8 py-16 text-center text-white shadow-2xl sm:px-16 sm:py-24">
            {/* Inner nebula glow */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-80 w-[450px] rounded-2xl bg-gradient-to-b from-sky-400/20 via-blue-600/10 to-transparent blur-3xl" />

            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-sky-400">
              Reclaim 42 Minutes Tomorrow
            </p>

            <h2
              id="closing-title"
              className="mx-auto mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-[#FAFAF9] sm:text-5xl"
            >
              Start tomorrow with complete operational clarity.
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-[#A8A29E]">
              Connect Microsoft 365 or Zoho in under two minutes. Prism delivers your first executive
              briefing before 8:00 AM tomorrow.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/auth/signup"
                className="group flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-[14px] font-medium text-[#1C1917] shadow-md transition-all hover:bg-[#FAFAF9] active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <span>Get Your Morning Briefing</span>
                <ArrowRight size={15} weight="bold" className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/auth/login"
                className="rounded-lg border border-white/20 bg-transparent px-6 py-3 text-[14px] font-medium text-white transition-all hover:bg-white/10 active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Sign In to Cockpit
              </Link>
            </div>

            <p className="mt-6 font-mono text-[11px] text-[#A8A29E]">
              Connects in 120 seconds. No credit card required. Zero data migration.
            </p>

            {/* Compliance Guarantee Strip */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 border-t border-white/10 pt-6 font-mono text-[10.5px] text-[#78716C]">
              <span>SOC 2 TYPE II ROADMAP</span>
              <span className="hidden sm:inline text-white/20">•</span>
              <span>GDPR COMPLIANT</span>
              <span className="hidden sm:inline text-white/20">•</span>
              <span>AES-256 ENCRYPTION</span>
              <span className="hidden sm:inline text-white/20">•</span>
              <span>FAIL-CLOSED ARCHITECTURE</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
