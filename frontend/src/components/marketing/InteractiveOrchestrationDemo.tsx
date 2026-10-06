"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  ArrowClockwise,
  CheckCircle,
  EnvelopeSimple,
  Briefcase,
  ChatCircleDots,
  ShieldCheck,
  Pause,
} from "@phosphor-icons/react";

interface WorkflowStep {
  id: string;
  tool: string;
  action: string;
  outcome: string;
  icon: React.ReactNode;
  tag: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "step-1",
    tool: "Microsoft Outlook",
    action: "Read client email thread",
    outcome: "Identified that VP Dana Okafor agreed to 24-month term with net-30 schedule.",
    icon: <EnvelopeSimple weight="duotone" className="text-sky-600" size={20} />,
    tag: "Context Retrieved",
  },
  {
    id: "step-2",
    tool: "Zoho CRM",
    action: "Pull contract & deal details",
    outcome: "Verified Halcyon Freight deal ($240,000 ARR) and attached legal rider addendum.",
    icon: <Briefcase weight="duotone" className="text-amber-600" size={20} />,
    tag: "Record Matched",
  },
  {
    id: "step-3",
    tool: "Your Approval Desk",
    action: "Stage draft for your sign-off",
    outcome: "Presented ready-to-send email and CRM stage update for your 1-click approval.",
    icon: <ShieldCheck weight="duotone" className="text-emerald-600" size={20} />,
    tag: "Human Review",
  },
  {
    id: "step-4",
    tool: "Slack & Systems",
    action: "Execute and alert team",
    outcome: "Sent email via Outlook, updated Zoho CRM stage to Closed-Won, and posted confirmation to #sales-ops.",
    icon: <ChatCircleDots weight="duotone" className="text-sky-600" size={20} />,
    tag: "Workflow Finished",
  },
];

export default function InteractiveOrchestrationDemo() {
  const [currentStep, setCurrentStep] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= WORKFLOW_STEPS.length - 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 2400);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Outer double-bezel wrapper */}
      <div className="rounded-3xl border border-black/[0.08] bg-[#F5F5F4] p-3 shadow-xl">
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          {/* Top Instruction Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] bg-[#FAFAF9] px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 rounded-xs bg-emerald-500" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
                  Example Executive Request
                </p>
                <p className="text-[14px] font-semibold text-[#1C1917]">
                  &ldquo;Confirm the renewal terms with Dana, update the deal in Zoho, and notify the team on Slack.&rdquo;
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-1.5 rounded-lg bg-[#1C1917] px-4 py-2 text-[12px] font-medium text-white transition-all hover:bg-black active:scale-[0.98] cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause size={13} weight="fill" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={13} weight="fill" />
                    <span>Watch Run</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep(0);
                }}
                className="rounded-full border border-black/[0.08] bg-white p-2 text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
                title="Restart"
              >
                <ArrowClockwise size={14} />
              </button>
            </div>
          </div>

          {/* Stepper Grid */}
          <div className="grid gap-4 p-6 md:grid-cols-4">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isActive = currentStep === idx;
              const isPast = currentStep > idx;

              return (
                <div
                  key={step.id}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep(idx);
                  }}
                  className={`group relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "border-sky-500 bg-sky-50/40 shadow-sm ring-1 ring-sky-500/20"
                      : isPast
                      ? "border-emerald-200 bg-emerald-50/20"
                      : "border-black/[0.06] bg-[#FAFAF9] hover:border-black/[0.12]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-[11px] font-bold text-[#1C1917]">
                      {idx + 1}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isPast
                          ? "text-emerald-700"
                          : isActive
                          ? "text-sky-700"
                          : "text-[#A8A29E]"
                      }`}
                    >
                      {step.tag}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-black/[0.06] shadow-2xs">
                      {step.icon}
                    </div>
                    <span className="text-[12px] font-semibold text-[#1C1917] truncate">
                      {step.tool}
                    </span>
                  </div>

                  <h4 className="mt-2 text-[13px] font-bold text-[#1C1917]">
                    {step.action}
                  </h4>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#57534E]">
                    {step.outcome}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Step Detail Callout */}
          <div className="border-t border-black/[0.06] bg-[#FAFAF9] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle weight="fill" size={20} className="text-sky-600" />
              <p className="text-[13px] text-[#475569]">
                <strong className="text-[#0F172A]">Result:</strong> Handled in 45 seconds instead of 25 minutes of manual copy-pasting between three different apps.
              </p>
            </div>
            <span className="text-[12px] font-medium text-emerald-700 bg-emerald-100/60 px-3 py-1 rounded-full">
              Zero Manual Data Entry
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
