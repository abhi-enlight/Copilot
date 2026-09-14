"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Robot,
  Sparkle,
  Briefcase,
  EnvelopeSimple,
  MagnifyingGlass,
  CircleNotch,
  CheckCircle,
} from "@phosphor-icons/react";

interface ThinkingProcessProps {
  elapsedTime?: number;
  mode?: "plan" | "chat";
  /** Live tool-call label forwarded from n8n begin frames or route */
  toolCallLabel?: string;
  /** Optional user prompt text to infer context */
  userPrompt?: string;
}

export default function ThinkingProcess({
  elapsedTime = 0,
  mode = "chat",
  toolCallLabel,
  userPrompt = "",
}: ThinkingProcessProps) {
  const [seconds, setSeconds] = useState(elapsedTime);

  // Live seconds counter
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => +(prev + 0.1).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const { text, icon: IconComponent, iconColor } = useMemo(() => {
    const tool = (toolCallLabel || "").trim();
    const prompt = (userPrompt || "").toLowerCase();

    // 1. Explicit tool call reported from server or stream
    if (
      tool &&
      !tool.toLowerCase().includes("ai copilot agent") &&
      !tool.toLowerCase().includes("ai agent")
    ) {
      const tLower = tool.toLowerCase();

      // Zoho tools
      if (
        tLower.includes("zoho") &&
        (tLower.includes("crm") ||
          tLower.includes("deal") ||
          tLower.includes("account") ||
          tLower.includes("lead"))
      ) {
        return {
          text: "Accessing Zoho CRM…",
          icon: Briefcase,
          iconColor: "text-emerald-600",
        };
      }
      if (
        tLower.includes("zoho") &&
        (tLower.includes("book") ||
          tLower.includes("invoice") ||
          tLower.includes("bill"))
      ) {
        return {
          text: "Accessing Zoho Books…",
          icon: Briefcase,
          iconColor: "text-emerald-600",
        };
      }
      if (tLower.includes("zoho") && tLower.includes("project")) {
        return {
          text: "Accessing Zoho Projects…",
          icon: Briefcase,
          iconColor: "text-emerald-600",
        };
      }
      if (tLower.includes("zoho")) {
        return {
          text: "Accessing Zoho…",
          icon: Briefcase,
          iconColor: "text-emerald-600",
        };
      }

      // Microsoft tools
      if (tLower.includes("outlook") || tLower.includes("mail")) {
        return {
          text: "Accessing Microsoft Outlook…",
          icon: EnvelopeSimple,
          iconColor: "text-sky-600",
        };
      }
      if (tLower.includes("sharepoint") || tLower.includes("onedrive")) {
        return {
          text: "Accessing Microsoft SharePoint…",
          icon: EnvelopeSimple,
          iconColor: "text-sky-600",
        };
      }
      if (
        tLower.includes("microsoft") ||
        tLower.includes("azure") ||
        tLower.includes("m365") ||
        tLower.includes("graph")
      ) {
        return {
          text: "Accessing Microsoft 365…",
          icon: EnvelopeSimple,
          iconColor: "text-sky-600",
        };
      }

      // Knowledge Base / SOP
      if (
        tLower.includes("knowledge") ||
        tLower.includes("vector") ||
        tLower.includes("supabase") ||
        tLower.includes("sop")
      ) {
        return {
          text: "Searching Knowledge Base…",
          icon: MagnifyingGlass,
          iconColor: "text-sky-600",
        };
      }

      // Tasks
      if (tLower.includes("task")) {
        return {
          text: "Accessing tasks…",
          icon: CheckCircle,
          iconColor: "text-amber-600",
        };
      }

      // Clean arbitrary tool name
      const cleaned = tool
        .replace(/^(querying|fetching|loading|checking|searching)\s+/i, "Accessing ")
        .replace(/\.{3,}$/, "");
      return {
        text: `${cleaned}…`,
        icon: Sparkle,
        iconColor: "text-stone-500",
      };
    }

    // 2. Inferred from user prompt context
    const isZoho =
      prompt.includes("zoho") ||
      prompt.includes("crm") ||
      prompt.includes("deal") ||
      prompt.includes("lead") ||
      prompt.includes("invoice") ||
      prompt.includes("books");

    const isMicrosoft =
      prompt.includes("microsoft") ||
      prompt.includes("m365") ||
      prompt.includes("outlook") ||
      prompt.includes("mail") ||
      prompt.includes("sharepoint") ||
      prompt.includes("onedrive") ||
      prompt.includes("email");

    const isKnowledge =
      prompt.includes("sop") ||
      prompt.includes("policy") ||
      prompt.includes("handbook") ||
      prompt.includes("knowledge base");

    if (isZoho) {
      return {
        text: "Accessing Zoho…",
        icon: Briefcase,
        iconColor: "text-emerald-600",
      };
    }

    if (isMicrosoft) {
      return {
        text: "Accessing Microsoft 365…",
        icon: EnvelopeSimple,
        iconColor: "text-sky-600",
      };
    }

    if (isKnowledge) {
      return {
        text: "Searching Knowledge Base…",
        icon: MagnifyingGlass,
        iconColor: "text-sky-600",
      };
    }

    if (mode === "plan") {
      return {
        text: "Organizing campaign…",
        icon: Sparkle,
        iconColor: "text-sky-600",
      };
    }

    // 3. Default simple oneliner: Thinking…
    return {
      text: "Thinking…",
      icon: Sparkle,
      iconColor: "text-stone-400",
    };
  }, [toolCallLabel, userPrompt, mode]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 max-w-3xl w-full py-1"
    >
      {/* Assistant Avatar matching ChatMessage */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-sm">
        <Robot size={13} weight="bold" />
      </div>

      {/* Direct on background - No pill, no box, clean Claude-style oneliner */}
      <div className="flex items-center min-h-[28px]">
        <div className="inline-flex items-center gap-2 text-[13px] font-normal text-stone-500 select-none">
          <CircleNotch
            size={12}
            weight="bold"
            className="animate-spin text-sky-500"
          />
          <IconComponent size={14} weight="duotone" className={iconColor} />
          <span className="tracking-tight text-stone-600 font-medium">
            {text}
          </span>
          {seconds >= 1 && (
            <span className="text-[11px] font-mono text-stone-400 font-normal tabular-nums ml-0.5">
              · {seconds.toFixed(0)}s
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
