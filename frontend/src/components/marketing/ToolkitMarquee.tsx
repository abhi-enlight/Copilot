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
  JiraLogo,
  MondayLogo,
  ClickUpLogo,
  ZohoProjectsLogo,
} from "./ToolkitLogos";

export interface ToolkitItem {
  name: string;
  logo: React.ReactNode;
}

const TOOLKIT_ITEMS: ToolkitItem[] = [
  { name: "Outlook", logo: <OutlookLogo size={28} /> },
  { name: "Teams", logo: <TeamsLogo size={28} /> },
  { name: "SharePoint", logo: <SharePointLogo size={28} /> },
  { name: "Dynamics 365", logo: <DynamicsLogo size={28} /> },
  { name: "Zoho CRM", logo: <ZohoCrmLogo size={28} /> },
  { name: "Zoho Projects", logo: <ZohoProjectsLogo size={28} /> },
  { name: "Zoho Books", logo: <ZohoBooksLogo size={28} /> },
  { name: "Gmail", logo: <GmailLogo size={28} /> },
  { name: "Google Calendar", logo: <GoogleCalendarLogo size={28} /> },
  { name: "Slack", logo: <SlackLogo size={28} /> },
  { name: "Linear", logo: <LinearLogo size={28} /> },
  { name: "Jira", logo: <JiraLogo size={28} /> },
  { name: "Monday.com", logo: <MondayLogo size={28} /> },
  { name: "ClickUp", logo: <ClickUpLogo size={28} /> },
  { name: "GitHub", logo: <GitHubLogo size={28} /> },
  { name: "Notion", logo: <NotionLogo size={28} /> },
];

/**
 * One quiet line of proof that Prism fits the stack they already have.
 * Two copies of the list + a -50% loop keeps the scroll smooth.
 */
export function ToolkitMarquee() {
  const marqueeItems = [...TOOLKIT_ITEMS, ...TOOLKIT_ITEMS];

  return (
    <section
      id="tools"
      aria-labelledby="tools-title"
      className="relative scroll-mt-24 overflow-hidden py-12 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <h2 id="tools-title" className="text-center text-[14px] text-[#78716C]">
            Works with the tools you already use. Nothing new to install.
          </h2>
        </Reveal>
      </div>

      {/* Edges fade with a mask so they work over any background */}
      <div
        className="relative mt-9 w-full overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        {/* Track: spacing lives on the items so two copies loop perfectly */}
        <div className="flex w-max animate-infinite-scroll items-center py-2">
          {marqueeItems.map((item, idx) => (
            <div
              key={`${item.name}-${idx}`}
              className="mr-8 flex items-center gap-2.5 opacity-75 transition-opacity duration-200 hover:opacity-100 sm:mr-12"
            >
              <span className="flex h-7 w-7 items-center justify-center">{item.logo}</span>
              <span className="whitespace-nowrap text-[13px] font-medium text-[#57534E]">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
