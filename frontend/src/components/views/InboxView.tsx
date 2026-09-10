"use client";

import { EnvelopeSimple, Sparkle, FunnelSimple, PenNib } from "@phosphor-icons/react";
import BigCityLogo from "@/components/BigCityLogo";

/**
 * Inbox, Outlook-centric triage view (Phase 6 feature surface).
 * Phase 3 ships the shell + design; this view will mount the Outlook connector
 * (Phase 4) and the email-intelligence features (F2/F3) later.
 */
export default function InboxView() {
  const capabilities = [
    { icon: FunnelSimple, title: "Priority triage", text: "Urgent mail and VIP senders surfaced first, with sentiment and action hints." },
    { icon: Sparkle, title: "Thread summaries", text: "Long 20-message chains distilled into a 3-bullet decision summary." },
    { icon: PenNib, title: "Reply drafts", text: "Tone-matched drafts that pull live data like deal stage and invoice balance before you send." },
  ];

  return (
    <div className="flex-1 overflow-y-auto prism-scroll prism-shell-bg">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-14 flex flex-col items-center text-center">
        <BigCityLogo size={54} variant="tile" className="mb-5 p-2 rounded-2xl" />
        <h1 className="text-[22px] font-bold tracking-tight text-stone-900">Inbox</h1>
        <p className="text-sm text-stone-500 max-w-md mt-2 leading-relaxed">
          Your Outlook mailbox becomes a copilot surface: triage, summarize, and draft replies
          without leaving BCP Assist.
        </p>

        <div className="mt-8 w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          {capabilities.map((c, idx) => {
            const Icon = c.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs"
              >
                <div className="w-8 h-8 rounded-lg prism-gradient-soft border border-violet-100 text-violet-700 flex items-center justify-center mb-2.5">
                  <Icon size={15} weight="duotone" />
                </div>
                <div className="text-[12.5px] font-bold text-stone-900">{c.title}</div>
                <div className="text-[11px] text-stone-500 mt-1 leading-snug">{c.text}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 text-[11.5px] font-semibold text-stone-600 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          Coming Soon
        </div>

        <div className="mt-4 flex items-center gap-2 text-stone-400">
          <EnvelopeSimple size={14} />
          <span className="text-[11px]">Connect your Outlook mailbox in Connections</span>
        </div>
      </div>
    </div>
  );
}
