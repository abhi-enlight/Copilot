"use client";

import React, { useState } from "react";
import {
  Play,
  ArrowClockwise,
  CheckCircle,
} from "@phosphor-icons/react";

interface Step {
  num: string;
  source: string;
  action: string;
  status: "pending" | "running" | "completed";
  detail: string;
  type: "read" | "reason" | "write";
  latency: string;
  telemetry: {
    request: string;
    response: string;
  };
}

const STEPS: Step[] = [
  {
    num: "01",
    source: "Zoho CRM",
    action: "GET /deals/halcyon-freight",
    status: "completed",
    detail: "Pulled contract record. Verified renewal deal value at $240,000 ARR with legal indemnity note.",
    type: "read",
    latency: "18ms",
    telemetry: {
      request: "GET /api/v3/deals/halcyon-freight?fields=amount,stage,clauses",
      response: '{\n  "deal_id": "HF-8941",\n  "value": 240000,\n  "stage": "renewal_negotiation",\n  "sla_indemnity_rider": true\n}',
    },
  },
  {
    num: "02",
    source: "Microsoft Outlook",
    action: "GET /messages?threadId=halcyon-renewal",
    status: "completed",
    detail: "Scanned thread history with VP Dana Okafor. Extracted agreed 24-month terms and net-30 schedule.",
    type: "read",
    latency: "24ms",
    telemetry: {
      request: "GET /graph/v1.0/mail/threads/halcyon-renewal?select=sender,bodyPreview",
      response: '{\n  "counterparty": "dana.okafor@halcyonfreight.com",\n  "confirmed_term_months": 24,\n  "payment_terms": "net-30",\n  "effective_date": "2026-12-01"\n}',
    },
  },
  {
    num: "03",
    source: "Safety Classifier",
    action: "INTERCEPT /actions/send_email",
    status: "completed",
    detail: "Detected external write attempt. Blocked direct send and minted signed proposal #9f2c.",
    type: "reason",
    latency: "6ms",
    telemetry: {
      request: 'EVALUATE_INTENT(tool="OUTLOOK_SEND_EMAIL", destination="external")',
      response: '{\n  "classification": "EXTERNAL_STATE_MUTATION",\n  "action": "EXECUTION_HALTED",\n  "proposal_minted": "PR-9F2C",\n  "sha256": "9f2c41d7a0b8e5c36f4a..."\n}',
    },
  },
  {
    num: "04",
    source: "Human Gatekeeper",
    action: "AWAIT /signature/single_click",
    status: "completed",
    detail: "Staged on Executive Morning Briefing. Awaiting your single-click approval.",
    type: "write",
    latency: "Awaiting Sign-Off",
    telemetry: {
      request: 'STAGE_PROPOSAL(queue="morning_briefing", expiry="24h")',
      response: '{\n  "status": "AWAITING_OPERATOR_SIGNATURE",\n  "fail_closed": true,\n  "auto_expiry_remaining": "23h 58m"\n}',
    },
  },
];

export default function InteractiveOrchestrationDemo() {
  const [activeStep, setActiveStep] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentStepData = STEPS[activeStep];

  const runSimulation = () => {
    setIsPlaying(true);
    setActiveStep(0);
    setTimeout(() => setActiveStep(1), 700);
    setTimeout(() => setActiveStep(2), 1400);
    setTimeout(() => {
      setActiveStep(3);
      setIsPlaying(false);
    }, 2100);
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-2 sm:p-2.5 shadow-lg">
        <div className="rounded-xl border border-black/[0.06] bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] pb-5">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0284c7]">
                Cross-Suite Autonomy with Human Oversight
              </p>
              <h3 className="mt-1 text-xl font-bold tracking-tight text-[#1C1917] sm:text-2xl">
                How Prism resolves a 45-minute workflow in 6 seconds
              </h3>
            </div>
            <button
              onClick={runSimulation}
              disabled={isPlaying}
              className="flex items-center gap-2 rounded-lg border border-black/[0.09] bg-[#FAFAF9] px-4 py-2 text-[12.5px] font-medium text-[#1C1917] transition-all hover:bg-white active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isPlaying ? (
                <>
                  <ArrowClockwise className="animate-spin text-[#0284c7]" size={14} />
                  <span>Chaining requests...</span>
                </>
              ) : (
                <>
                  <Play weight="fill" size={12} className="text-[#0284c7]" />
                  <span>Replay Workflow</span>
                </>
              )}
            </button>
          </div>

          {/* Stepper Grid with Connected Progress Bar */}
          <div className="mt-8">
            {/* Horizontal Timeline Connector */}
            <div className="mb-4 h-1 w-full overflow-hidden rounded-xs bg-stone-100">
              <div
                className="h-full bg-sky-500 transition-all duration-500 ease-out"
                style={{ width: `${((activeStep + 1) / STEPS.length) * 100}%` }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {STEPS.map((step, idx) => {
                const isPassed = idx <= activeStep;
                const isCurrent = idx === activeStep;

                return (
                  <div
                    key={step.num}
                    onClick={() => setActiveStep(idx)}
                    className={`group relative flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-200 cursor-pointer ${
                      isCurrent
                        ? "border-sky-500/70 bg-sky-50/20 shadow-xs"
                        : isPassed
                        ? "border-black/[0.08] bg-white hover:border-black/[0.14]"
                        : "border-black/[0.04] bg-[#FAFAF9]/60 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[12px] font-bold text-[#A8A29E]">{step.num}</span>
                        <span className="font-mono text-[10.5px] font-medium uppercase text-[#78716C]">
                          {step.type}
                        </span>
                      </div>

                      <h4 className="mt-3 text-[13.5px] font-semibold text-[#1C1917]">{step.source}</h4>
                      <p className="mt-0.5 font-mono text-[11px] text-[#78716C]">{step.action}</p>
                      <p className="mt-2 text-[12px] leading-relaxed text-[#57534E]">{step.detail}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between font-mono text-[10.5px]">
                      <span className="text-[#78716C]">{step.latency}</span>
                      {isPassed && <CheckCircle weight="fill" size={14} className="text-emerald-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Step Live Telemetry Inspector */}
          <div className="mt-6 rounded-xl border border-black/[0.06] bg-[#FAFAF9] p-4.5">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0284c7]">
                  Step {currentStepData.num} Telemetry
                </span>
                <span className="font-mono text-[11px] text-[#78716C]">/ {currentStepData.source}</span>
              </div>
              <span className="font-mono text-[11px] text-emerald-600">STATE: VERIFIED</span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-black/[0.06] bg-white p-3 font-mono text-[11.5px]">
                <span className="text-[10px] uppercase text-[#A8A29E]">Dispatched Instruction</span>
                <p className="mt-1 font-semibold text-[#1C1917] break-all">{currentStepData.telemetry.request}</p>
              </div>
              <div className="rounded-lg border border-black/[0.06] bg-white p-3 font-mono text-[11.5px]">
                <span className="text-[10px] uppercase text-[#A8A29E]">Structured Payload Response</span>
                <pre className="mt-1 overflow-x-auto text-[#44403C] leading-snug">{currentStepData.telemetry.response}</pre>
              </div>
            </div>
          </div>

          {/* Execution Insight */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#FAFAF9] p-4 text-[12.5px] text-[#57534E]">
            <span>Outcome: Zero tab switches. The operations leader reviews one unified briefing.</span>
            <span className="font-mono text-[11.5px] font-semibold text-[#0369a1]">
              Average time saved: 42 minutes every morning
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
