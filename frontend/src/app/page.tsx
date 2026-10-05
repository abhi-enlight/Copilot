import type { Metadata } from "next";
import { MarketingFooter, MarketingNav } from "@/components/marketing/LandingChrome";
import {
  ApprovalWedge,
  ArchitectureSection,
  ClosingCta,
  Hero,
  OrchestrationSection,
  SecurityGrid,
  ToolkitMarquee,
} from "@/components/marketing/LandingSections";

export const metadata: Metadata = {
  title: "Prism: Operations Copilot | Every System Briefed by 8:00 AM",
  description:
    "Stop opening nine tabs every morning. Prism reads across Microsoft 365, Zoho, Google, and Slack, delivers your executive briefing, and stages follow-ups for your review.",
};

/**
 * Public landing page.
 * Enhanced with Apple-grade tactile background designs & textures throughout the site:
 * - Fixed subtle tactile micro-grain
 * - Section-specific architectural and blueprint grids
 * - Ambient multi-spectral illumination
 * - Geometric containers (no pill shapes)
 * - Clean punctuation (no em or en dashes)
 */
export default function LandingPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[#FAFAF9] font-[family-name:var(--font-geist-sans)] text-[#1C1917] selection:bg-sky-500/20 selection:text-sky-900">
      {/* Global subtle film-grain texture across the entire website */}
      <div
        className="pointer-events-none fixed inset-0 z-30 opacity-[0.03] mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Fallback for noscript */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* Floating frosted nav */}
      <MarketingNav />

      <main className="relative flex-1">
        {/* Hero Section with Interactive Briefing Model */}
        <Hero />

        {/* 12-Toolkit Infinite Marquee with Authentic Vector Logos */}
        <ToolkitMarquee />

        {/* The Gatekeeper Approval Boundary */}
        <ApprovalWedge />

        {/* Cross-Suite Multi-System Execution Demo */}
        <OrchestrationSection />

        {/* Deterministic Architecture Deep-Dive */}
        <ArchitectureSection />

        {/* Enterprise Security Hardening */}
        <SecurityGrid />

        {/* High-Impact Dark Close CTA */}
        <ClosingCta />
      </main>

      {/* Structured Footer */}
      <MarketingFooter />
    </div>
  );
}
