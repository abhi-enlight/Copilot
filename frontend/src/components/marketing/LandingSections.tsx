"use client";

import React, { useState } from "react";
import Link from "next/link";
import Reveal from "@/components/marketing/Reveal";
import InteractiveBriefingDemo from "@/components/marketing/InteractiveBriefingDemo";
import { ToolkitMarquee } from "@/components/marketing/ToolkitMarquee";
import {
  ArrowRight,
  CaretDown,
  Check,
} from "@phosphor-icons/react";
import {
  GmailLogo,
  OutlookLogo,
  SlackLogo,
  ZohoCrmLogo,
} from "./ToolkitLogos";

export { ToolkitMarquee };

/* ──────────────────────────────────────────────────────────────────
   Shared components. One quiet label per section, nothing louder.
   ────────────────────────────────────────────────────────────────── */

function Eyebrow({
  children,
  tone = "sky",
}: {
  children: React.ReactNode;
  tone?: "sky" | "amber";
}) {
  return (
    <p
      className={`text-[12px] font-semibold uppercase tracking-[0.18em] ${
        tone === "amber" ? "text-[#B45309]" : "text-[#0284C7]"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * Hero: Spacious, uncluttered, punchy.
 * Generous whitespace lets the briefing demo take center stage.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative pt-16 pb-24 sm:pt-24 sm:pb-36"
    >
      {/* Ambient gradient field: sky wash and morning sun that bleed downward */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -bottom-52 -z-10">
        <div className="absolute -top-40 left-1/2 h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(2,132,199,0.24)_0%,rgba(245,158,11,0.12)_48%,transparent_74%)] blur-3xl" />
        <div className="absolute -left-32 top-40 h-[440px] w-[440px] rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute -right-32 top-20 h-[440px] w-[440px] rounded-full bg-amber-200/40 blur-3xl" />
        {/* Downward bleed pool beneath the briefing desk */}
        <div className="absolute inset-x-0 bottom-0 h-[720px] bg-[radial-gradient(ellipse_at_center,rgba(2,132,199,0.20)_0%,rgba(245,158,11,0.12)_45%,transparent_72%)] blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center">
          <Reveal onMount>
            <h1
              id="hero-title"
              className="font-display mx-auto max-w-4xl text-[44px] font-extrabold leading-[1.04] tracking-[-0.04em] text-[#1C1917] sm:text-6xl lg:text-[76px]"
            >
              Stop starting your day
              <span className="mt-1 block bg-gradient-to-r from-[#0369A1] via-[#0284C7] to-[#B45309] bg-clip-text text-transparent">
                in the dark.
              </span>
            </h1>
          </Reveal>

          <Reveal onMount delay={0.06} className="mt-6">
            <p className="mx-auto max-w-xl text-[17px] leading-relaxed text-[#57534E] sm:text-[20px]">
              Overnight triage across your email, deals, and team chat.
              One morning briefing with every follow-up already written.
            </p>
          </Reveal>

          <Reveal
            onMount
            delay={0.12}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              href="/auth/signup"
              className="group flex items-center gap-2 rounded-xl bg-[#1C1917] px-7 py-3.5 text-[14.5px] font-medium text-white shadow-md transition-all hover:bg-black hover:shadow-lg active:scale-[0.98]"
            >
              <span>Get my first briefing</span>
              <ArrowRight
                size={15}
                weight="bold"
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>

            <a
              href="#how-it-works"
              className="rounded-xl border border-black/[0.1] bg-white/80 px-7 py-3.5 text-[14.5px] font-medium text-[#1C1917] shadow-xs backdrop-blur-xs transition-all hover:border-black/[0.18] hover:bg-white active:scale-[0.98]"
            >
              See how it works
            </a>
          </Reveal>

          <Reveal onMount delay={0.24} className="mt-6">
            <p className="text-[12.5px] text-[#A8A29E]">
              Two-minute setup · Zero actions without your approval
            </p>
          </Reveal>
        </div>

        {/* The briefing itself, with generous breathing room and downward bleeding aura */}
        <Reveal onMount delay={0.3} className="relative mt-20 scroll-mt-24 sm:mt-24" id="briefing">
          <div className="pointer-events-none absolute inset-x-4 -top-12 -bottom-36 -z-10 rounded-[52px] bg-[radial-gradient(ellipse_at_center,rgba(2,132,199,0.28)_0%,rgba(245,158,11,0.15)_48%,transparent_76%)] blur-3xl" />
          <InteractiveBriefingDemo />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The Shift: Crisp Before vs. After contrast.
 * Replaces dense paragraphs with immediate, scannable clarity.
 */
export function MorningDifference() {
  const withoutPrism = [
    "9 open browser tabs before coffee",
    "40 unread messages just to find what matters",
    "An hour lost before real work begins",
  ];

  const withPrism = [
    "1 briefing waiting at 8:00 AM",
    "3 decisions that actually need you",
    "Every reply and update drafted for your sign-off",
  ];

  return (
    <section
      id="difference"
      aria-labelledby="difference-title"
      className="relative scroll-mt-24 overflow-hidden py-28 sm:py-36"
    >
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal className="text-center">
          <Eyebrow>The difference</Eyebrow>
          <h2
            id="difference-title"
            className="font-display mt-4 text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#1C1917] sm:text-4xl lg:text-[46px]"
          >
            One briefing replaces the morning scramble.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-[#57534E]">
            Stop losing your first hour to triage across disconnected tools.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:gap-8">
          {/* Without Prism */}
          <Reveal delay={0.06}>
            <div className="h-full rounded-2xl border border-black/[0.07] bg-white p-7 sm:p-9 shadow-xs">
              <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#A8A29E]">
                Without Prism
              </p>
              <h3 className="font-display mt-3 text-[20px] font-bold tracking-tight text-[#1C1917]">
                Scattered across tabs
              </h3>
              <ul className="mt-6 space-y-4">
                {withoutPrism.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-[#57534E]">
                    <span className="mt-2.5 h-0.5 w-2 bg-stone-300 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* With Prism */}
          <Reveal delay={0.12}>
            <div className="relative h-full overflow-hidden rounded-2xl border border-sky-300/80 bg-gradient-to-br from-white via-[#F0F8FE] to-[#FEF9F0] p-7 sm:p-9 shadow-[0_24px_60px_-40px_rgba(2,132,199,0.35)]">
              <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#0369A1]">
                With Prism
              </p>
              <h3 className="font-display mt-3 text-[20px] font-bold tracking-tight text-[#1C1917]">
                Sorted before you wake up
              </h3>
              <ul className="mt-6 space-y-4">
                {withPrism.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-[#1E293B]">
                    <Check weight="bold" size={15} className="mt-0.5 shrink-0 text-[#0284C7]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Backwards-compatibility alias */
export const MorningProblem = MorningDifference;

/**
 * How it works: 3 tactile, visual steps showing the product in action.
 */
export function HowItWorks() {
  const steps = [
    {
      n: "01",
      badge: "Connect",
      title: "Connect your accounts",
      body: "Sign in with Outlook, Google, Slack, or Zoho in two minutes. Nothing to migrate.",
      renderVisual: () => (
        <div className="mt-6 rounded-xl border border-black/[0.06] bg-[#FAFAF9] p-4">
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-2 font-mono text-[11px] text-[#78716C]">
            <span>Active channels</span>
            <span className="font-medium text-emerald-700">2-min sync</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white px-2.5 py-2 text-[12px] font-medium text-[#1C1917] shadow-xs">
              <OutlookLogo size={18} />
              <span className="truncate">Outlook</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white px-2.5 py-2 text-[12px] font-medium text-[#1C1917] shadow-xs">
              <SlackLogo size={18} />
              <span className="truncate">Slack</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white px-2.5 py-2 text-[12px] font-medium text-[#1C1917] shadow-xs">
              <ZohoCrmLogo size={18} />
              <span className="truncate">Zoho CRM</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white px-2.5 py-2 text-[12px] font-medium text-[#1C1917] shadow-xs">
              <GmailLogo size={18} />
              <span className="truncate">Gmail</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      n: "02",
      badge: "Overnight",
      title: "Overnight synthesis",
      body: "Prism sorts incoming updates while you rest and drafts the next steps.",
      renderVisual: () => (
        <div className="mt-6 rounded-xl border border-black/[0.06] bg-[#FAFAF9] p-4">
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-2 font-mono text-[11px] text-[#78716C]">
            <span>Activity log</span>
            <span className="font-medium text-[#0284C7]">Triaged</span>
          </div>
          <div className="mt-3 space-y-2 text-[12px]">
            <div className="flex items-center justify-between rounded-lg border border-black/[0.04] bg-white px-2.5 py-2 shadow-xs">
              <span className="truncate text-[#1C1917]">Dana confirmed renewal</span>
              <span className="ml-2 shrink-0 font-mono text-[10.5px] text-[#A8A29E]">11:20 PM</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-black/[0.04] bg-white px-2.5 py-2 shadow-xs">
              <span className="truncate text-[#1C1917]">Contract flagged in legal</span>
              <span className="ml-2 shrink-0 font-mono text-[10.5px] text-[#A8A29E]">3:05 AM</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-sky-200/70 bg-sky-50/70 px-2.5 py-2 text-[#0369A1] font-medium shadow-xs">
              <span className="truncate">3 replies drafted</span>
              <span className="ml-2 shrink-0 font-mono text-[10.5px]">6:00 AM</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      n: "03",
      badge: "Approve",
      title: "Review and approve",
      body: "Open your 8:00 AM briefing and approve actions with one click.",
      renderVisual: () => (
        <div className="mt-6 rounded-xl border border-black/[0.06] bg-[#FAFAF9] p-4">
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-2 font-mono text-[11px] text-[#78716C]">
            <span>Morning briefing</span>
            <span className="font-medium text-amber-800">8:00 AM</span>
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="rounded-lg border border-black/[0.05] bg-white p-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-[#1C1917]">Renewal paperwork</p>
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-700">Ready</span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-[#78716C] truncate">To: Dana at Halcyon Freight</p>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="rounded-lg bg-[#1C1917] px-3 py-1.5 text-[11.5px] font-medium text-white shadow-xs">
                Approve in 1 tap
              </span>
              <span className="font-mono text-[10.5px] text-[#A8A29E]">0 rogue actions</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="relative scroll-mt-24 overflow-hidden border-t border-black/[0.05] py-28 sm:py-36"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2
            id="how-title"
            className="font-display mt-4 text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#1C1917] sm:text-4xl lg:text-[46px]"
          >
            Three steps. Two minutes to start.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-[#57534E]">
            No complex rollout. No new software for your team to learn.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-7 md:grid-cols-3 lg:gap-8">
          {steps.map((step, idx) => (
            <Reveal key={step.n} delay={idx * 0.08} className="h-full">
              <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-black/[0.07] bg-white p-7 sm:p-8 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_20px_48px_-28px_rgba(2,132,199,0.35)]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-bold tracking-wider text-[#0284C7] rounded-md bg-sky-50 px-2 py-0.5 border border-sky-100">
                      {step.n}
                    </span>
                    <span className="font-mono text-[11px] font-medium text-[#78716C] uppercase tracking-wider">
                      {step.badge}
                    </span>
                  </div>
                  <h3 className="font-display mt-5 text-[20px] font-bold tracking-tight text-[#1C1917]">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#57534E]">
                    {step.body}
                  </p>
                </div>

                {step.renderVisual()}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Control: Confident, uncluttered trust guarantees.
 */
export function InYourControl() {
  const guarantees = [
    "100% human-approved actions",
    "Zero actions sent autonomously",
    "Never trained on your data",
  ];

  return (
    <section
      id="safety"
      aria-labelledby="safety-title"
      className="relative scroll-mt-24 overflow-hidden border-t border-black/[0.05] py-28 sm:py-36"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-6">
            <Eyebrow tone="amber">Human control</Eyebrow>

            <h2
              id="safety-title"
              className="font-display mt-4 text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#1C1917] sm:text-4xl lg:text-[44px]"
            >
              It never sends a word without you.
            </h2>

            <p className="mt-5 text-[16px] leading-relaxed text-[#57534E]">
              Software that contacts clients on its own is a risk. Every draft and record change
              waits for your review first.
            </p>

            <div className="mt-8 space-y-3">
              {guarantees.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                    <Check weight="bold" size={12} />
                  </div>
                  <span className="text-[14.5px] font-medium text-[#1C1917]">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-6">
            <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3.5">
                <span className="font-display text-[13px] font-bold text-[#1C1917]">Waiting for you</span>
                <span className="font-mono rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  1 of 3
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <p className="font-mono text-[11.5px] text-[#78716C]">To: Dana at Halcyon Freight</p>
                <p className="font-display text-[14px] font-bold text-[#1C1917]">
                  Here is the paperwork for the two-year renewal
                </p>
                <p className="rounded-xl border border-black/[0.05] bg-[#FAFAF9] p-4 text-[13px] leading-relaxed text-[#57534E]">
                  “Dana, thanks for confirming last night. The order form is attached for two years
                  at your current rate. I will send the countersigned copy this week.”
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <span className="rounded-xl bg-[#1C1917] px-4 py-2 text-[12.5px] font-medium text-white">
                  Approve &amp; send
                </span>
                <span className="rounded-xl border border-black/[0.1] px-4 py-2 text-[12.5px] font-medium text-[#57534E]">
                  Edit first
                </span>
                <span className="ml-auto font-mono text-[11px] text-[#A8A29E]">Nothing sent yet</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/**
 * Questions: Short, punchy answers with generous spacing.
 */
export function Questions() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "Will it ever send something without asking me?",
      a: "Never. Nothing goes out until you review and approve it. You see every word first.",
    },
    {
      q: "How long does setup take?",
      a: "Under two minutes. You sign in with your work accounts. There is nothing to install and no IT project.",
    },
    {
      q: "Can I edit what it writes?",
      a: "Always. You can edit any wording before sending or dismiss items you prefer to handle yourself.",
    },
    {
      q: "How is this different from ChatGPT?",
      a: "ChatGPT waits for you to prompt it. Prism works overnight across your real tools and hands you finished work ready for review.",
    },
  ];

  return (
    <section
      id="questions"
      aria-labelledby="questions-title"
      className="relative scroll-mt-24 overflow-hidden border-t border-black/[0.05] py-28 sm:py-36"
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <Reveal className="text-center">
          <Eyebrow>Questions</Eyebrow>
          <h2
            id="questions-title"
            className="font-display mt-4 text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#1C1917] sm:text-4xl"
          >
            Straight answers.
          </h2>
        </Reveal>

        <div className="mt-14 border-y border-black/[0.07]">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;

            return (
              <div key={faq.q} className={idx > 0 ? "border-t border-black/[0.07]" : ""}>
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left transition-colors hover:text-[#0284C7]"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-[16px] font-semibold text-[#1C1917]">{faq.q}</span>
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={`shrink-0 text-[#A8A29E] transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="-mt-1 pb-6 pr-8 text-[14.5px] leading-relaxed text-[#57534E]">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Closing: One dark gradient horizon, one action, zero clutter.
 */
export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0A0F1D] px-8 py-16 text-center sm:px-16 sm:py-24 shadow-2xl">
            {/* Sapphire and sunrise aurora */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-28 left-1/2 h-[460px] w-[880px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.45)_0%,rgba(2,132,199,0.3)_38%,rgba(245,158,11,0.18)_66%,transparent_80%)] blur-3xl" />
            </div>

            <div className="relative">
              <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
                Start tonight
              </p>

              <h2
                id="closing-title"
                className="font-display mx-auto mt-5 max-w-2xl text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-5xl"
              >
                Tomorrow morning, be already caught up.
              </h2>

              <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-[#94A3B8]">
                Connect your tools in two minutes. Your first briefing will be waiting before eight.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/auth/signup"
                  className="group flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[14.5px] font-semibold text-[#0A0F1D] shadow-md transition-all hover:bg-[#F8FAFC] active:scale-[0.98]"
                >
                  <span>Get my first briefing</span>
                  <ArrowRight
                    size={15}
                    weight="bold"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
