"use client";

import React from "react";
import Reveal from "@/components/marketing/Reveal";
import {
  OutlookLogo,
  TeamsLogo,
  SharePointLogo,
  DynamicsLogo,
  ZohoCrmLogo,
  ZohoBooksLogo,
  GmailLogo,
  GoogleCalendarLogo,
  SlackLogo,
  LinearLogo,
  GitHubLogo,
  NotionLogo,
} from "./ToolkitLogos";

export interface ToolkitItem {
  name: string;
  logo: React.ReactNode;
}

const TOOLKIT_ITEMS: ToolkitItem[] = [
  {
    name: "Microsoft Outlook",
    logo: <OutlookLogo size={56} />,
  },
  {
    name: "Microsoft Teams",
    logo: <TeamsLogo size={56} />,
  },
  {
    name: "Microsoft SharePoint",
    logo: <SharePointLogo size={56} />,
  },
  {
    name: "Dynamics 365 CRM",
    logo: <DynamicsLogo size={56} />,
  },
  {
    name: "Zoho CRM",
    logo: <ZohoCrmLogo size={56} />,
  },
  {
    name: "Zoho Books",
    logo: <ZohoBooksLogo size={56} />,
  },
  {
    name: "Gmail",
    logo: <GmailLogo size={56} />,
  },
  {
    name: "Google Calendar",
    logo: <GoogleCalendarLogo size={56} />,
  },
  {
    name: "Slack",
    logo: <SlackLogo size={56} />,
  },
  {
    name: "Linear",
    logo: <LinearLogo size={56} />,
  },
  {
    name: "GitHub",
    logo: <GitHubLogo size={56} />,
  },
  {
    name: "Notion",
    logo: <NotionLogo size={56} />,
  },
];

export function ToolkitMarquee() {
  // Triple array for an ultra-seamless infinite scroll
  const marqueeItems = [...TOOLKIT_ITEMS, ...TOOLKIT_ITEMS, ...TOOLKIT_ITEMS];

  return (
    <section
      id="toolkits"
      aria-labelledby="toolkits-title"
      className="relative overflow-hidden border-y border-black/[0.05] bg-[#F7F6F4]/40 py-20 sm:py-24"
    >
      {/* Background design texture & illumination: Soft ambient aura, zero ruler grid lines */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 90% 70% at 50% 50%, rgba(2, 132, 199, 0.07), transparent 75%)
            `,
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-black/[0.06] pb-8">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0284c7]">
              Zero-Migration Integration Mesh
            </p>
            <h2 id="toolkits-title" className="mt-2 text-2xl font-bold tracking-tight text-[#1C1917] sm:text-3xl lg:text-4xl">
              12 toolkits. Zero multi-tenant cross-contamination.
            </h2>
            <p className="mt-2 text-[14px] text-[#57534E] max-w-xl">
              Connect the tools your team already relies on in two minutes. Scoped per-user OAuth tokens ensure your data never touches another tenant.
            </p>
          </div>
          <div className="font-mono text-[11px] text-[#78716C] md:text-right shrink-0">
            <p className="font-semibold text-[#1C1917]">HARDWARE-ENCRYPTED VAULTS</p>
            <p className="mt-0.5">PER-USER OAUTH ISOLATION</p>
          </div>
        </Reveal>
      </div>

      {/* Infinite Horizontal Marquee Container */}
      <div className="relative mt-12 w-full overflow-hidden">
        {/* Soft edge gradient masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#F7F6F4] via-[#F7F6F4]/60 to-transparent sm:w-40" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#F7F6F4] via-[#F7F6F4]/60 to-transparent sm:w-40" />

        {/* Marquee Track with huge icons and clean labels below */}
        <div className="flex w-max animate-infinite-scroll items-center gap-14 py-4 sm:gap-20 hover:[animation-play-state:paused]">
          {marqueeItems.map((item, idx) => (
            <div
              key={`${item.name}-${idx}`}
              className="group flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-200 hover:-translate-y-1 cursor-default"
            >
              <div className="flex h-16 w-16 items-center justify-center drop-shadow-xs transition-transform duration-200 group-hover:scale-105">
                {item.logo}
              </div>
              <span className="text-[13px] font-semibold tracking-tight text-[#44403C] transition-colors group-hover:text-[#1C1917]">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
