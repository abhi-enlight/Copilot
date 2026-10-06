import type { Metadata } from "next";
import { MarketingFooter, MarketingNav } from "@/components/marketing/LandingChrome";
import {
  ClosingCta,
  Hero,
  HowItWorks,
  InYourControl,
  MorningDifference,
  Questions,
  ToolkitMarquee,
} from "@/components/marketing/LandingSections";

export const metadata: Metadata = {
  title: "Prism | Your morning briefing, ready before 8 AM",
  description:
    "Prism reads your email, your deals, and your team's messages overnight, then hands you one short briefing with every follow-up already written. Nothing sends without your approval.",
};

export default function LandingPage() {
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col bg-[#FAFAF9] font-sans text-[#1C1917] selection:bg-sky-500/20 selection:text-sky-950">
      {/* Page-level ambient wash: deep sky at top, bleeding down past hero, marquee, and into the difference section */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[2200px] overflow-hidden">
        {/* Soft atmospheric gradient cascading from sapphire sky to morning sun to warm ivory */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#C5E4F9_0%,#DCF0FD_18%,rgba(224,242,254,0.75)_36%,rgba(240,249,255,0.6)_54%,rgba(254,243,199,0.35)_72%,rgba(250,250,249,0.85)_88%,#FAFAF9_100%)]" />
        {/* Deep sky radiance on the left flank */}
        <div className="absolute -left-36 top-52 h-[850px] w-[850px] rounded-full bg-sky-300/40 blur-3xl" />
        {/* Sunrise radiance on the right flank */}
        <div className="absolute -right-36 top-36 h-[800px] w-[800px] rounded-full bg-amber-200/45 blur-3xl" />
        {/* Central downward bleed plume centered under the hero and briefing desk */}
        <div className="absolute left-1/2 top-[650px] h-[1050px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(2,132,199,0.18)_0%,rgba(245,158,11,0.11)_45%,transparent_72%)] blur-3xl" />
      </div>

      {/* Subtle organic micro-noise texture */}
      <div
        className="pointer-events-none fixed inset-0 z-40 opacity-[0.025] mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Fallback for noscript */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* Floating glass pill navigation */}
      <MarketingNav />

      <main className="relative flex-1">
        {/* 1. Hero: the thesis & interactive briefing preview */}
        <Hero />

        {/* 2. Connected tools proof strip */}
        <ToolkitMarquee />

        {/* 3. The Shift: Before vs. After contrast */}
        <MorningDifference />

        {/* 4. Three plain steps to start */}
        <HowItWorks />

        {/* 5. Human control and trust guarantees */}
        <InYourControl />

        {/* 6. Straight answers */}
        <Questions />

        {/* 7. Closing call to action */}
        <ClosingCta />
      </main>

      <MarketingFooter />
    </div>
  );
}
