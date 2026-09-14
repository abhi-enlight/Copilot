"use client";

import { motion } from "motion/react";
import {
  EnvelopeSimple,
  FolderOpen,
  Receipt,
  Megaphone,
  Briefcase,
  Kanban,
  Database,
  ArrowRight,
} from "@phosphor-icons/react";
import PrismLogo from "@/components/brand/PrismLogo";
import type { ConnectorId } from "@/hooks/useConnectors";

interface EmptyStateProps {
  onSelectPrompt?: (suggestion: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
  activeConnectors?: Record<string, boolean>;
}

interface SuggestionItem {
  connectorId?: ConnectorId;
  icon: any;
  label: string;
  tag: string;
  color: string;
  bg: string;
  border: string;
  text: string;
}

const ALL_SUGGESTIONS: SuggestionItem[] = [
  {
    connectorId: "microsoft.outlook",
    icon: EnvelopeSimple,
    label: "What are my recent mails?",
    tag: "Outlook",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200/70",
    text: "What are my recent mails? Summarize urgent messages and unread threads from the last 24 hours.",
  },
  {
    connectorId: "microsoft.sharepoint",
    icon: FolderOpen,
    label: "What files are in SharePoint?",
    tag: "SharePoint",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200/70",
    text: "Search my SharePoint data and list recent documents, briefs, and spreadsheets.",
  },
  {
    connectorId: "zoho.books",
    icon: Receipt,
    label: "What are my recent invoices?",
    tag: "Zoho Books",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200/70",
    text: "What are our recent invoices in Zoho Books? Check open balances and payment statuses.",
  },
  {
    icon: Megaphone,
    label: "What are my active campaigns?",
    tag: "Campaigns",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200/70",
    text: "Show all my active campaigns, their task completion status, and pending approvals.",
  },
  {
    connectorId: "zoho.crm",
    icon: Briefcase,
    label: "What are our open CRM deals?",
    tag: "Zoho CRM",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200/70",
    text: "Show our active Zoho CRM deals, pipeline stages, and high-value customer accounts.",
  },
  {
    connectorId: "zoho.projects",
    icon: Kanban,
    label: "What tasks are due in Projects?",
    tag: "Zoho Projects",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200/70",
    text: "List our active projects and pending tasks across teams in Zoho Projects.",
  },
  {
    connectorId: "internal.kb",
    icon: Database,
    label: "Search knowledge base SOPs",
    tag: "Knowledge Base",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200/70",
    text: "Search our organization knowledge base for standard operating procedures and compliance rules.",
  },
];

export default function EmptyState({
  onSelectPrompt,
  onSuggestionClick,
  activeConnectors = {},
}: EmptyStateProps) {
  const handleClick = (text: string) => {
    if (onSelectPrompt) onSelectPrompt(text);
    else if (onSuggestionClick) onSuggestionClick(text);
  };

  const visibleSuggestions = ALL_SUGGESTIONS.filter((s) => {
    if (!s.connectorId) return true;
    return activeConnectors[s.connectorId] !== false;
  }).slice(0, 4);

  const displaySuggestions =
    visibleSuggestions.length >= 2 ? visibleSuggestions : ALL_SUGGESTIONS.slice(0, 4);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-xl w-full mx-auto my-auto select-none">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 flex flex-col items-center"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-violet-500/10 blur-2xl scale-150" />
          <PrismLogo size={52} className="relative shadow-sm rounded-2xl" />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.07 }}
        className="text-center mb-8"
      >
        <h2 className="text-[22px] font-bold text-stone-900 tracking-tight mb-1">
          How can I help you today?
        </h2>
        <p className="text-[12.5px] text-stone-400 max-w-sm mx-auto leading-relaxed">
          Ask questions across your mail, documents, CRM, projects, and invoices.
        </p>
      </motion.div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
        {displaySuggestions.map((item, i) => {
          const IconComp = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}
              whileHover={{ y: -1, scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => handleClick(item.text)}
              className="group flex items-start gap-3 p-3.5 rounded-xl bg-white hover:bg-stone-50/80 border border-stone-200/80 hover:border-violet-200 hover:shadow-sm transition-all text-left cursor-pointer"
            >
              <div className={`p-1.5 rounded-lg ${item.bg} ${item.border} border flex-shrink-0 mt-0.5`}>
                <IconComp size={14} weight="duotone" className={item.color} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-semibold text-stone-800 group-hover:text-violet-700 transition-colors leading-snug block">
                  {item.label}
                </span>
                <span className="text-[11px] text-stone-400 mt-0.5 block">{item.tag}</span>
              </div>
              <ArrowRight
                size={13}
                className="text-stone-300 group-hover:text-violet-400 flex-shrink-0 mt-1 transition-colors"
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
