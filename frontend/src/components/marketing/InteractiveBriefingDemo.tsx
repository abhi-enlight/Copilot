"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  ShieldCheck,
  Check,
  X,
  EnvelopeSimple,
  Briefcase,
  GitBranch,
  Warning,
  Sparkle,
  CheckCircle,
} from "@phosphor-icons/react";

interface ProposalData {
  actionType: string;
  targetSystem: string;
  recipient: string;
  subject: string;
  body: string;
  risk: string;
  hash: string;
}

interface FeedItem {
  id: string;
  source: string;
  icon: React.ReactNode;
  time: string;
  title: string;
  detail: string;
  category: "deal" | "email" | "sprint";
  badge: string;
  proposal: ProposalData;
}

const BRIEFING_ITEMS: FeedItem[] = [
  {
    id: "item-1",
    source: "Zoho CRM",
    icon: <Briefcase weight="duotone" className="text-amber-600" size={18} />,
    time: "06:40",
    title: "Halcyon Freight deal moved to legal review",
    detail: "Deal value $240,000 ARR. Legal flagged an indemnity clause on the SLA renewal. Prepared revision summary for executive review.",
    category: "deal",
    badge: "Contract Flag",
    proposal: {
      actionType: "ZOHO_UPDATE_DEAL",
      targetSystem: "Zoho CRM / Update Deal",
      recipient: "Legal and Deal Desk Queue",
      subject: "Halcyon Freight Contract: Attach SLA Rider",
      body: "Update deal stage to 'Legal Review' ($240,000 ARR) and attach revised indemnity addendum for COO review.",
      risk: "Medium Risk",
      hash: "8a4f91e2b5c7d0e34f1a9b2c8e7d4a1b",
    },
  },
  {
    id: "item-2",
    source: "Microsoft Outlook",
    icon: <EnvelopeSimple weight="duotone" className="text-sky-600" size={18} />,
    time: "07:05",
    title: "Dana Okafor confirmed renewal terms",
    detail: "VP confirmed 24-month term with net-30 invoicing. Prism drafted the confirmation email and staged it for your review.",
    category: "email",
    badge: "Approval Staged",
    proposal: {
      actionType: "OUTLOOK_SEND_EMAIL",
      targetSystem: "Microsoft Outlook / Send Email",
      recipient: "dana.okafor@halcyonfreight.com",
      subject: "Confirmation: 24-month term and net-30 schedule",
      body: "Dana, confirming our agreed terms: 24-month commitment at standard tier with net-30 payment schedule, effective December 1. Finalizing order form now.",
      risk: "Requires Sign-Off",
      hash: "9f2c41d7a0b8e5c36f4a1d9e7b0c2a5f",
    },
  },
  {
    id: "item-3",
    source: "Linear",
    icon: <GitBranch weight="duotone" className="text-purple-600" size={18} />,
    time: "07:50",
    title: "Platform migration sprint tickets blocked past Friday",
    detail: "Sprint cycle #41 has 2 unassigned blockers impacting deployment dates. Reassignment proposal queued.",
    category: "sprint",
    badge: "Sprint Blocker",
    proposal: {
      actionType: "LINEAR_REASSIGN_ISSUE",
      targetSystem: "Linear / Reassign Issue",
      recipient: "DevOps Sprint Cycle #41",
      subject: "OPS-284: Reassign Database Blocker",
      body: "Reassign unowned ticket OPS-284 to DevOps Lead and escalate priority to Urgent to protect Friday deployment window.",
      risk: "Low Risk",
      hash: "3c7e82b1d9a0f5e42a1b6c8d7e0f9a2b",
    },
  },
];

export default function InteractiveBriefingDemo() {
  const [activeTab, setActiveTab] = useState<"all" | "approvals">("all");
  const [selectedId, setSelectedId] = useState<string>("item-2");
  const [itemStatuses, setItemStatuses] = useState<Record<string, "pending" | "approved" | "rejected">>({
    "item-1": "pending",
    "item-2": "pending",
    "item-3": "pending",
  });
  const [executing, setExecuting] = useState(false);

  const selectedItem = BRIEFING_ITEMS.find((it) => it.id === selectedId) || BRIEFING_ITEMS[1];
  const currentStatus = itemStatuses[selectedItem.id] || "pending";

  const pendingCount = BRIEFING_ITEMS.filter((it) => itemStatuses[it.id] === "pending").length;

  const visibleItems =
    activeTab === "approvals"
      ? BRIEFING_ITEMS.filter((it) => itemStatuses[it.id] === "pending")
      : BRIEFING_ITEMS;

  const handleApprove = () => {
    setExecuting(true);
    setTimeout(() => {
      setExecuting(false);
      setItemStatuses((prev) => ({ ...prev, [selectedItem.id]: "approved" }));
    }, 500);
  };

  const handleReject = () => {
    setItemStatuses((prev) => ({ ...prev, [selectedItem.id]: "rejected" }));
  };

  const handleResetAll = () => {
    setItemStatuses({
      "item-1": "pending",
      "item-2": "pending",
      "item-3": "pending",
    });
    setSelectedId("item-2");
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Outer container: Machined secondary chassis */}
      <div className="relative rounded-2xl border border-black/[0.08] bg-[#F5F5F4] p-2.5 sm:p-3 shadow-lg">
        {/* Inner core display */}
        <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-[#FAFAF9]">
          {/* Executive Cockpit Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] bg-[#F5F5F4] px-5 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1C1917] text-white">
                <Sparkle weight="fill" size={14} className="text-sky-300" />
              </div>
              <div>
                <span className="text-[13px] font-semibold text-[#1C1917]">Executive Morning Briefing</span>
                <p className="font-mono text-[11px] text-[#78716C]">TUESDAY 08:12 AM / 12 SYSTEMS SYNTHESIZED</p>
              </div>
            </div>

            {/* Filter and Reset Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-[#EFECE8] p-0.5">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`rounded-md px-3 py-1 text-[12px] font-medium transition-all cursor-pointer ${
                    activeTab === "all"
                      ? "bg-[#1C1917] text-white"
                      : "text-[#78716C] hover:text-[#1C1917]"
                  }`}
                >
                  All Signals ({BRIEFING_ITEMS.length})
                </button>
                <button
                  onClick={() => setActiveTab("approvals")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium transition-all cursor-pointer ${
                    activeTab === "approvals"
                      ? "bg-[#1C1917] text-white"
                      : "text-[#78716C] hover:text-[#1C1917]"
                  }`}
                >
                  <span>Pending Sign-Off</span>
                  <span className="font-mono text-[11px] font-bold">
                    {pendingCount}
                  </span>
                </button>
              </div>

              {pendingCount < BRIEFING_ITEMS.length && (
                <button
                  onClick={handleResetAll}
                  className="rounded-lg border border-black/[0.08] bg-[#F5F5F4] px-2.5 py-1 text-[11px] font-mono text-[#78716C] hover:text-[#1C1917] hover:bg-[#EFECE8] transition-colors cursor-pointer"
                  title="Reset simulation"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Interactive Workspace Grid */}
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-12">
            {/* Left Column: Assembled Signal Stream */}
            <div className="space-y-3 lg:col-span-7">
              <div className="flex items-center justify-between pb-1">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">
                  Proactive Morning Signals
                </span>
                <span className="text-[11px] text-[#78716C]">Select any event to inspect proposal</span>
              </div>

              {visibleItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-8 text-center">
                  <CheckCircle weight="fill" size={28} className="mx-auto text-emerald-600" />
                  <h4 className="mt-2 text-[14px] font-semibold text-emerald-950">Inbox Zero: All Proposals Resolved</h4>
                  <p className="mt-1 text-[12.5px] text-emerald-800">
                    Every state-modifying action was signed off or declined. Zero pending mutations.
                  </p>
                  <button
                    onClick={handleResetAll}
                    className="mt-4 rounded-lg bg-emerald-700 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                  >
                    Replay All Proposals
                  </button>
                </div>
              ) : (
                visibleItems.map((item) => {
                  const isSelected = selectedItem.id === item.id;
                  const status = itemStatuses[item.id];

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-sky-500/60 bg-sky-50/50 shadow-xs"
                          : "border-black/[0.08] bg-[#F5F5F4] hover:border-black/[0.14] hover:bg-[#EFECE8]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.06] bg-white">
                            {item.icon}
                          </div>
                          <div>
                            <span className="text-[12px] font-semibold text-[#1C1917]">{item.source}</span>
                            <span className="ml-2 font-mono text-[11px] text-[#A8A29E]">{item.time}</span>
                          </div>
                        </div>

                        {status === "approved" ? (
                          <span className="flex items-center gap-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-emerald-600">
                            <CheckCircle weight="fill" size={13} />
                            Executed
                          </span>
                        ) : status === "rejected" ? (
                          <span className="flex items-center gap-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-stone-500">
                            <X weight="bold" size={12} />
                            Declined
                          </span>
                        ) : (
                          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[#78716C]">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2.5 text-[14px] font-semibold tracking-tight text-[#1C1917]">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#57534E]">
                        {item.detail}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Physical Staged Approval Card */}
            <div className="lg:col-span-5">
              <div className="flex items-center justify-between pb-1">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">
                  Deterministic Gatekeeper
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#0284c7]">
                  FAIL-CLOSED RUNTIME
                </span>
              </div>

              {/* The Staged Action Proposal Card */}
              <motion.div
                key={selectedItem.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="relative mt-3 overflow-hidden rounded-xl border border-black/[0.08] bg-[#F5F5F4] p-5 shadow-xs"
              >
                {/* Header ribbon */}
                <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1C1917] text-white">
                      <EnvelopeSimple size={13} weight="bold" />
                    </div>
                    <span className="text-[12.5px] font-semibold text-[#1C1917]">Staged Action Proposal</span>
                  </div>
                  <span className="font-mono text-[11px] font-medium text-amber-800">
                    {selectedItem.proposal.risk}
                  </span>
                </div>

                {/* Staged Content */}
                <div className="mt-3.5 space-y-3">
                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#A8A29E]">Target System</span>
                    <p className="text-[12.5px] font-semibold text-[#1C1917]">{selectedItem.proposal.targetSystem}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#A8A29E]">Recipient / Target</span>
                    <p className="font-mono text-[12px] text-[#44403C]">{selectedItem.proposal.recipient}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#A8A29E]">Action Context</span>
                    <p className="text-[12.5px] font-medium text-[#1C1917]">{selectedItem.proposal.subject}</p>
                  </div>

                  <div className="rounded-lg border border-black/[0.06] bg-[#EFECE8] p-3 text-[12px] leading-relaxed text-[#44403C]">
                    &ldquo;{selectedItem.proposal.body}&rdquo;
                  </div>

                  {/* Verification Ledger Hash */}
                  <div className="flex items-center justify-between font-mono text-[10px] text-[#78716C]">
                    <span>SHA-256</span>
                    <span className="truncate max-w-[170px]">{selectedItem.proposal.hash}</span>
                  </div>
                </div>

                {/* Interactive Action Controls */}
                <div className="mt-4 pt-3.5 border-t border-black/[0.06]">
                  {currentStatus === "pending" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApprove}
                        disabled={executing}
                        className="flex-1 rounded-lg bg-[#0369a1] py-2.5 px-4 text-[13px] font-medium text-white transition-all hover:bg-[#075985] active:scale-[0.98] cursor-pointer disabled:opacity-60"
                      >
                        {executing ? "Signing and Executing..." : "Approve and Execute"}
                      </button>
                      <button
                        onClick={handleReject}
                        className="flex items-center justify-center rounded-lg border border-black/[0.1] bg-[#F5F5F4] px-3 py-2.5 text-[13px] font-medium text-[#57534E] transition-all hover:bg-[#EFECE8] active:scale-[0.98] cursor-pointer"
                        title="Decline Proposal"
                      >
                        <X weight="bold" size={15} />
                      </button>
                    </div>
                  )}

                  {currentStatus === "approved" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2 text-emerald-900">
                        <CheckCircle weight="fill" size={17} className="text-emerald-600 flex-shrink-0" />
                        <span className="text-[12.5px] font-semibold">Executed and Recorded to Ledger</span>
                      </div>
                      <button
                        onClick={() => setItemStatuses((prev) => ({ ...prev, [selectedItem.id]: "pending" }))}
                        className="text-[11px] font-medium text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                      >
                        Undo
                      </button>
                    </motion.div>
                  )}

                  {currentStatus === "rejected" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-100 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2 text-stone-800">
                        <X weight="bold" size={16} className="text-stone-500 flex-shrink-0" />
                        <span className="text-[12.5px] font-semibold">Declined: Proposal dropped safely</span>
                      </div>
                      <button
                        onClick={() => setItemStatuses((prev) => ({ ...prev, [selectedItem.id]: "pending" }))}
                        className="text-[11px] font-medium text-stone-600 underline hover:text-stone-900 cursor-pointer"
                      >
                        Undo
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Bottom Dock Control */}
          <div className="flex items-center justify-between border-t border-black/[0.05] bg-[#F5F5F4]/70 px-6 py-2.5 text-[11px] text-[#78716C] font-mono">
            <span>Zero unapproved changes / Proposals expire after 24 hours</span>
            <span className="text-[#A8A29E]">SYSTEM STATUS: HEALTHY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
