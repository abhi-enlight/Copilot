"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowsClockwise,
  Briefcase,
  ChatCircleDots,
  CheckCircle,
  EnvelopeSimple,
  SunHorizon,
} from "@phosphor-icons/react";

interface ProposalData {
  /** Small label above the details, e.g. "Reply to Dana" */
  action: string;
  to: string;
  /** Optional: channel messages don't have a subject line */
  subject?: string;
  body: string;
  tag: string;
  /** Where Prism pulled this from, in plain English */
  basis: string;
}

interface FeedItem {
  id: string;
  source: string;
  time: string;
  title: string;
  detail: string;
  badge: string;
  icon: React.ReactNode;
  proposal: ProposalData;
}

const BRIEFING_ITEMS: FeedItem[] = [
  {
    id: "item-1",
    source: "Email",
    time: "11:20 PM",
    title: "Dana confirmed the renewal",
    detail: "She agreed to two more years and asked for the paperwork.",
    badge: "Reply ready",
    icon: <EnvelopeSimple weight="duotone" size={16} className="text-sky-600" />,
    proposal: {
      action: "Reply to Dana",
      to: "dana@halcyonfreight.com",
      subject: "Here’s the paperwork for the two-year renewal",
      body: "Dana, thanks for confirming last night. The order form is attached for two years at your current rate, billed every 30 days. I’ll send the countersigned copy this week.",
      tag: "Ready to send",
      basis: "Written from Dana’s email at 11:20 PM",
    },
  },
  {
    id: "item-2",
    source: "Your deals",
    time: "3:05 AM",
    title: "The Halcyon renewal has been sitting for four days",
    detail: "It’s waiting on legal for one clause, and nobody has chased it.",
    badge: "Needs a nudge",
    icon: <Briefcase weight="duotone" size={16} className="text-amber-600" />,
    proposal: {
      action: "Nudge legal",
      to: "Priya Raman (Legal)",
      subject: "Can we clear the Halcyon renewal today?",
      body: "Priya, the Halcyon renewal has been with legal since Thursday and Dana is expecting paperwork. It’s the standard two-year agreement at the same rate. Can we get it cleared today? Happy to jump on a call if anything looks off.",
      tag: "Ready to send",
      basis: "Written from the deal record and Thursday’s handoff",
    },
  },
  {
    id: "item-3",
    source: "Team messages",
    time: "5:40 AM",
    title: "Friday’s launch is short two people",
    detail: "Two jobs on the list have nobody assigned, and the team doesn’t know yet.",
    badge: "Team blocked",
    icon: <ChatCircleDots weight="duotone" size={16} className="text-sky-600" />,
    proposal: {
      action: "Message to your team",
      to: "#launch",
      body: "Good morning. We’re two items short for Friday’s launch: the final stock check and the support handover. Both need an owner by the end of today. Can anyone pick one up?",
      tag: "Ready to send",
      basis: "Written from the launch list and this morning’s team messages",
    },
  },
];

type ItemStatus = "pending" | "approved" | "dismissed";

export default function InteractiveBriefingDemo() {
  const [selectedId, setSelectedId] = useState<string>("item-1");
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({
    "item-1": "pending",
    "item-2": "pending",
    "item-3": "pending",
  });
  const [sending, setSending] = useState(false);

  const selected = BRIEFING_ITEMS.find((item) => item.id === selectedId) ?? BRIEFING_ITEMS[0];
  const selectedStatus = statuses[selected.id] ?? "pending";
  const waiting = BRIEFING_ITEMS.filter((item) => statuses[item.id] === "pending").length;

  const handleSelect = (id: string) => {
    setSending(false);
    setSelectedId(id);
  };

  const handleApprove = () => {
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setStatuses((prev) => ({ ...prev, [selected.id]: "approved" }));
    }, 400);
  };

  const handleDismiss = () => {
    setStatuses((prev) => ({ ...prev, [selected.id]: "dismissed" }));
  };

  const handleUndo = () => {
    setStatuses((prev) => ({ ...prev, [selected.id]: "pending" }));
  };

  const handleReset = () => {
    setStatuses({ "item-1": "pending", "item-2": "pending", "item-3": "pending" });
    setSelectedId("item-1");
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Soft gradient halo behind the panel, bleeding downward */}
      <div className="pointer-events-none absolute inset-x-4 top-4 -bottom-16 -z-10 rounded-[44px] bg-gradient-to-br from-sky-300/45 via-sky-100/35 to-amber-200/40 blur-3xl" />

      <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_36px_90px_-60px_rgba(15,23,42,0.55)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white">
              <SunHorizon weight="fill" size={16} />
            </span>
            <div>
              <p className="font-display text-[13.5px] font-bold text-[#1C1917]">Your morning briefing</p>
              <p className="font-mono text-[11.5px] text-[#A8A29E]">Tuesday, 7:58 AM</p>
            </div>
          </div>

          <span className="font-mono text-[12px] text-[#78716C]">
            {waiting === 0 ? "Nothing waiting on you" : `${waiting} waiting on you`}
          </span>
        </div>

        {waiting === 0 ? (
          /* Everything handled, the good part of the morning */
          <div className="px-6 py-20 text-center">
            <h3 className="font-display text-[19px] font-bold tracking-tight text-[#1C1917]">
              Morning handled.
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-[#57534E]">
              Everything that came in overnight has been dealt with. Nothing is waiting on you.
            </p>
            <button
              onClick={handleReset}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-black/[0.1] bg-white px-5 py-2.5 text-[13px] font-medium text-[#1C1917] transition-colors hover:bg-[#FAFAF9]"
            >
              <ArrowsClockwise size={14} />
              Run it again
            </button>
          </div>
        ) : (
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-12">
            {/* Overnight updates */}
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between pb-3">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#A8A29E]">
                  What came in overnight
                </span>
                <span className="text-[11.5px] text-[#A8A29E]">Click to see the follow-up</span>
              </div>

              <div className="space-y-2.5">
                {BRIEFING_ITEMS.map((item) => {
                  const status = statuses[item.id];
                  const isSelected = selected.id === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-sky-300 bg-sky-50/50"
                          : "border-black/[0.07] bg-white hover:border-black/[0.14]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.06] bg-[#FAFAF9]">
                            {item.icon}
                          </span>
                          <span className="font-mono text-[11.5px] text-[#78716C]">
                            {item.source} · {item.time}
                          </span>
                        </div>

                        {status === "approved" ? (
                          <span className="flex items-center gap-1 text-[11.5px] font-medium text-emerald-700">
                            <CheckCircle weight="fill" size={13} />
                            Sent
                          </span>
                        ) : status === "dismissed" ? (
                          <span className="text-[11.5px] font-medium text-[#A8A29E]">
                            Dismissed
                          </span>
                        ) : (
                          <span className="font-mono rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <h3 className="font-display mt-3 text-[14.5px] font-bold tracking-tight text-[#1C1917]">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#57534E]">
                        {item.detail}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What Prism wrote */}
            <div className="lg:col-span-5">
              <div className="flex items-center justify-between pb-3">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#A8A29E]">
                  What Prism wrote
                </span>
              </div>

              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="rounded-2xl border border-black/[0.07] bg-[#FAFAF9] p-5"
              >
                <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] pb-3">
                  <span className="font-display text-[13px] font-bold text-[#1C1917]">
                    {selected.proposal.action}
                  </span>
                  <span className="font-mono rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-[#0369A1] ring-1 ring-black/[0.05]">
                    {selected.proposal.tag}
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#A8A29E]">To</p>
                    <p className="mt-0.5 text-[13px] font-medium text-[#1C1917]">
                      {selected.proposal.to}
                    </p>
                  </div>

                  {selected.proposal.subject && (
                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#A8A29E]">
                        Subject
                      </p>
                      <p className="font-display mt-0.5 text-[13.5px] font-bold text-[#1C1917]">
                        {selected.proposal.subject}
                      </p>
                    </div>
                  )}

                  <p className="rounded-xl border border-black/[0.05] bg-white p-4 text-[13px] leading-relaxed text-[#44403C]">
                    {selected.proposal.body}
                  </p>

                  <p className="text-[11.5px] text-[#A8A29E]">{selected.proposal.basis}</p>
                </div>

                <div className="mt-5 border-t border-black/[0.06] pt-4">
                  {selectedStatus === "pending" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={sending}
                        className="flex-1 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#0369A1] py-2.5 text-[13px] font-medium text-white shadow-xs transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                      >
                        {sending ? "Sending…" : "Approve & send"}
                      </button>
                      <button
                        onClick={handleDismiss}
                        className="rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#78716C] transition-colors hover:text-[#1C1917]"
                      >
                        Not this one
                      </button>
                    </div>
                  )}

                  {selectedStatus === "approved" && (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-emerald-900">
                        <CheckCircle weight="fill" size={16} className="shrink-0 text-emerald-600" />
                        Sent. Your records were updated.
                      </span>
                      <button
                        onClick={handleUndo}
                        className="text-[12px] font-medium text-emerald-800 underline hover:text-emerald-950"
                      >
                        Undo
                      </button>
                    </div>
                  )}

                  {selectedStatus === "dismissed" && (
                    <div className="flex items-center justify-between rounded-xl border border-black/[0.07] bg-white px-3.5 py-2.5">
                      <span className="text-[13px] font-medium text-[#57534E]">
                        Dismissed. Nothing went out.
                      </span>
                      <button
                        onClick={handleUndo}
                        className="text-[12px] font-medium text-[#78716C] underline hover:text-[#1C1917]"
                      >
                        Undo
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              <p className="mt-3 text-center text-[11.5px] text-[#A8A29E]">
                Nothing sends until you approve it.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
