"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkle,
  Database,
  ShieldCheck,
  Brain,
  CheckCircle,
  CaretDown,
  CaretUp,
  CircleNotch,
  FolderOpen,
  Receipt,
  UserCheck,
} from "@phosphor-icons/react";

interface ThinkingProcessProps {
  elapsedTime?: number;
  mode?: "plan" | "chat";
  /** Live tool-call label forwarded from n8n begin frames (e.g. "Querying Zoho CRM leads...") */
  toolCallLabel?: string;
  /** Optional user prompt text to infer dynamic context */
  userPrompt?: string;
}

interface ThinkingStep {
  id: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
}

export default function ThinkingProcess({
  elapsedTime = 0,
  mode = "chat",
  toolCallLabel,
  userPrompt = "",
}: ThinkingProcessProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [seconds, setSeconds] = useState(elapsedTime);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Dynamically determine appropriate thinking steps based on query intent
  const steps: ThinkingStep[] = useMemo(() => {
    const prompt = (userPrompt || "").toLowerCase();
    const tool = (toolCallLabel || "").toLowerCase();

    const isCountQuery =
      prompt.includes("how many") ||
      prompt.includes("count") ||
      prompt.includes("number of") ||
      prompt.includes("elements") ||
      prompt.includes("total");

    const isLeadQuery =
      prompt.includes("lead") ||
      prompt.includes("customer") ||
      prompt.includes("client") ||
      prompt.includes("contact") ||
      prompt.includes("account") ||
      prompt.includes("who is") ||
      tool.includes("lead");

    const isModifyQuery =
      prompt.includes("assign") ||
      prompt.includes("change") ||
      prompt.includes("update") ||
      prompt.includes("modify") ||
      prompt.includes("reschedule") ||
      prompt.includes("sachin");

    if (isCountQuery) {
      return [
        {
          id: "crm_count",
          title: "Querying Zoho CRM Leads & Deals",
          desc: "Fetching total active leads, customer accounts, and deals",
          icon: Database,
          color: "text-amber-600",
          bg: "bg-amber-50",
          border: "border-amber-200",
        },
        {
          id: "books_count",
          title: "Querying Zoho Books Invoices & Balances",
          desc: "Retrieving billing records, draft invoices, and financial totals",
          icon: Receipt,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          border: "border-emerald-200",
        },
        {
          id: "projects_count",
          title: "Querying Zoho Projects Portals",
          desc: "Inspecting active projects and task status breakdown",
          icon: FolderOpen,
          color: "text-sky-600",
          bg: "bg-sky-50",
          border: "border-sky-200",
        },
        {
          id: "synthesis",
          title: "Aggregating System Metrics",
          desc: "Compiling real-time element summary across Zoho Suite",
          icon: Sparkle,
          color: "text-indigo-600",
          bg: "bg-indigo-50",
          border: "border-indigo-200",
        },
      ];
    }

    if (isLeadQuery) {
      return [
        {
          id: "lead_search",
          title: "Searching Zoho CRM Leads",
          desc: "Querying verified customer records and contact history",
          icon: UserCheck,
          color: "text-blue-600",
          bg: "bg-blue-50",
          border: "border-blue-200",
        },
        {
          id: "lead_verify",
          title: "Extracting Customer Context",
          desc: "Confirming company, industry designation, email, and phone",
          icon: ShieldCheck,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          border: "border-emerald-200",
        },
        {
          id: "synthesis",
          title: "Preparing Verified Lead Brief",
          desc: "Formatting lead profile for campaign anchoring",
          icon: Sparkle,
          color: "text-indigo-600",
          bg: "bg-indigo-50",
          border: "border-indigo-200",
        },
      ];
    }

    if (isModifyQuery) {
      return [
        {
          id: "parse_updates",
          title: "Analyzing Task Reassignment & Updates",
          desc: "Parsing assignee changes, urgency gates, and timeline adjustments",
          icon: Brain,
          color: "text-amber-600",
          bg: "bg-amber-50",
          border: "border-amber-200",
        },
        {
          id: "apply_updates",
          title: "Updating Operational Matrix",
          desc: "Adjusting SPOC assignments and turnaround times",
          icon: ShieldCheck,
          color: "text-sky-600",
          bg: "bg-sky-50",
          border: "border-sky-200",
        },
        {
          id: "synthesis",
          title: "Confirming Campaign Changes",
          desc: "Synchronizing updated plan for live execution",
          icon: Sparkle,
          color: "text-indigo-600",
          bg: "bg-indigo-50",
          border: "border-indigo-200",
        },
      ];
    }

    if (mode === "plan") {
      return [
        {
          id: "lead_fetch",
          title: "Resolving Client Lead in Zoho CRM",
          desc: "Matching brand parameters with verified enterprise contact",
          icon: UserCheck,
          color: "text-amber-600",
          bg: "bg-amber-50",
          border: "border-amber-200",
        },
        {
          id: "sops",
          title: "Structuring 4-Aspect Operations Architecture",
          desc: "Building Legal, Compliance, Escrow Accounting & Tech Ops tasks",
          icon: ShieldCheck,
          color: "text-sky-600",
          bg: "bg-sky-50",
          border: "border-sky-200",
        },
        {
          id: "invoicing",
          title: "Calculating Milestone Invoicing & Escrow",
          desc: "Structuring billing breakdown and payment terms in Zoho Books",
          icon: Receipt,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          border: "border-emerald-200",
        },
        {
          id: "synthesis",
          title: "Synthesizing Interactive Campaign Canvas",
          desc: "Rendering operational task matrix and live approval drawer",
          icon: Sparkle,
          color: "text-indigo-600",
          bg: "bg-indigo-50",
          border: "border-indigo-200",
        },
      ];
    }

    // Default intelligent conversational steps
    return [
      {
        id: "analysis",
        title: "Analyzing Query & Context",
        desc: "Evaluating campaign parameters and live Zoho connections",
        icon: Brain,
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
      },
      {
        id: "data_fetch",
        title: "Querying Live Zoho Knowledge",
        desc: "Checking verified records across CRM, Books, and SOP library",
        icon: Database,
        color: "text-sky-600",
        bg: "bg-sky-50",
        border: "border-sky-200",
      },
      {
        id: "synthesis",
        title: "Synthesizing AI Response",
        desc: "Formulating verified guidance and actionable recommendations",
        icon: Sparkle,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        border: "border-indigo-200",
      },
    ];
  }, [userPrompt, toolCallLabel, mode]);

  // Live timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => +(prev + 0.1).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Update active step dynamically when a live tool arrives or based on elapsed time
  useEffect(() => {
    if (toolCallLabel) {
      const label = toolCallLabel.toLowerCase();
      if (label.includes("lead") || label.includes("account")) {
        setCurrentStepIndex(0);
      } else if (label.includes("book") || label.includes("invoice") || label.includes("deal")) {
        setCurrentStepIndex(1 % steps.length);
      } else if (label.includes("project") || label.includes("task") || label.includes("sop")) {
        setCurrentStepIndex(Math.min(2, steps.length - 1));
      } else {
        setCurrentStepIndex(steps.length - 1);
      }
    } else {
      // Natural progression based on elapsed time
      const targetIdx = Math.min(Math.floor(seconds / 1.2), steps.length - 1);
      setCurrentStepIndex(targetIdx);
    }
  }, [toolCallLabel, seconds, steps.length]);

  const currentStep = steps[currentStepIndex] || steps[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-3xl w-full my-3"
    >
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] overflow-hidden">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <CircleNotch size={17} weight="bold" className="animate-spin text-indigo-600" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold tracking-tight text-slate-900">
                {toolCallLabel
                  ? toolCallLabel
                  : mode === "plan"
                  ? "Architecting Operational Campaign Matrix"
                  : "Processing Query"}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 tabular-nums font-medium">
                {seconds.toFixed(1)}s
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-slate-500 hidden sm:inline font-medium">
              Stage {Math.min(currentStepIndex + 1, steps.length)} of {steps.length}
            </span>
            <button
              type="button"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
            >
              {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
            </button>
          </div>
        </div>

        {/* Live Active Step Badge (When collapsed) */}
        {!isExpanded && currentStep && (
          <div className="px-4 py-2 bg-indigo-50/50 flex items-center gap-2 text-[12px] text-indigo-900 font-medium">
            <currentStep.icon size={14} className={currentStep.color} />
            <span>{currentStep.title}</span>
          </div>
        )}

        {/* Collapsible Stepper Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              key="thinking-stepper-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="p-4 space-y-2"
            >
              {steps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;
                const IconComponent = step.icon;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className={`flex items-start gap-3 p-2.5 rounded-xl transition-all duration-200 border ${
                      isCurrent
                        ? `${step.bg} ${step.border} shadow-2xs`
                        : isPassed
                        ? "bg-slate-50/50 border-slate-100 opacity-80"
                        : "opacity-40 border-transparent bg-transparent"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${
                        isCurrent
                          ? `${step.bg} ${step.color}`
                          : isPassed
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                      ) : isCurrent ? (
                        <CircleNotch size={16} weight="bold" className="animate-spin text-indigo-600" />
                      ) : (
                        <IconComponent size={15} weight="duotone" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[12.5px] font-medium leading-tight ${
                            isCurrent
                              ? "text-slate-900 font-semibold"
                              : isPassed
                              ? "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {step.title}
                        </span>
                        {isPassed && (
                          <span className="text-[10.5px] text-emerald-600 font-mono font-medium">Done</span>
                        )}
                        {isCurrent && (
                          <span className="text-[10.5px] text-indigo-600 animate-pulse font-mono font-medium">
                            Processing...
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-slate-500 truncate mt-0.5">
                        {isCurrent && toolCallLabel ? toolCallLabel : step.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
