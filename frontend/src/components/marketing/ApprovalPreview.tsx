"use client";

import { useState } from "react";
import ActionCard from "@/components/copilot/cards/ActionCard";
import type { ActionProposal } from "@/types/database";
import { ArrowClockwise } from "@phosphor-icons/react";

/**
 * A real Prism ActionCard rendered interactively so visitors can test
 * the fail-closed approval gatekeeper directly on the landing page.
 */
const INITIAL_PROPOSAL: ActionProposal = {
  id: "00000000-0000-4000-8000-000000000001",
  tool_slug: "outlook",
  action_type: "OUTLOOK_SEND_EMAIL",
  title: "Send Email via Outlook",
  description: "To: dana.okafor@halcyonfreight.com • Subject: \"Confirmation: 24-month term and net-30 schedule\"",
  payload: {
    to: "dana.okafor@halcyonfreight.com",
    subject: "Confirmation: 24-month term and net-30 schedule",
    body: "Dana, confirming our agreed terms: 24-month commitment at standard tier with net-30 payment schedule, effective December 1. Finalizing order form now.",
  },
  status: "pending",
  risk_level: "medium",
  signature_hash: "9f2c41d7a0b8e5c36f4a1d9e7b0c2a5f8d3e6b1c4a7f0d2e5b8c1a4f7d0e3b6c",
  created_at: "2026-10-05T08:12:00.000Z",
};

export default function ApprovalPreview() {
  const [proposal, setProposal] = useState<ActionProposal>(INITIAL_PROPOSAL);

  const handleApprove = async () => {
    await new Promise((r) => setTimeout(r, 350));
    setProposal((prev) => ({
      ...prev,
      status: "approved",
      executed_at: new Date().toISOString(),
      execution_result: { message: "Dispatched via Outlook API. SHA-256 verified on immutable ledger." },
    }));
    return { success: true };
  };

  const handleReject = async () => {
    await new Promise((r) => setTimeout(r, 200));
    setProposal((prev) => ({
      ...prev,
      status: "rejected",
    }));
    return { success: true };
  };

  return (
    <div className="relative">
      <ActionCard
        proposal={proposal}
        onApprove={handleApprove}
        onReject={handleReject}
        cardBg="bg-[#F5F5F4] border border-black/[0.08]"
      />

      {proposal.status !== "pending" && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => setProposal(INITIAL_PROPOSAL)}
            className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-[#0369a1] hover:text-[#075985] transition-colors cursor-pointer"
          >
            <ArrowClockwise size={13} />
            <span>Reset Demo Card</span>
          </button>
        </div>
      )}
    </div>
  );
}
