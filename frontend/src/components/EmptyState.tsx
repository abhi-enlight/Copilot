"use client";

import { motion } from "motion/react";
import {
  EnvelopeSimple,
  FolderOpen,
  Briefcase,
  Kanban,
  Receipt,
  Database,
  Sparkle,
} from "@phosphor-icons/react";
import BigCityLogo from "@/components/BigCityLogo";
import EnlightLogo from "@/components/brand/EnlightLogo";
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
  // Pillar 1: Campaign Studio (AI Planning & Synthesis - Built-in)
  {
    icon: Sparkle,
    label: "Plan a Multi-Channel Campaign",
    tag: "Campaign Studio · AI Planner",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "Create a comprehensive multi-aspect campaign plan for a Nestlé festive promotion with legal, tech, finance, and ops tasks.",
  },
  // Pillar 2: Zoho Operations Suite (CRM Deals, Projects & Milestones)
  {
    connectorId: "zoho.crm",
    icon: Briefcase,
    label: "Inspect Zoho Deals & Projects",
    tag: "Zoho Suite · Operations",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "Show our active Zoho CRM deals, pending project milestones in Zoho Projects, and open Books invoices.",
  },
  // Pillar 3: Microsoft 365 (Outlook Mail & OneDrive / SharePoint)
  {
    connectorId: "microsoft.outlook",
    icon: EnvelopeSimple,
    label: "Triage Mail & OneDrive Files",
    tag: "Microsoft 365 · Mail & Files",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "Summarize my unread emails from the last 24 hours and check OneDrive for recent campaign briefs.",
  },
  // Pillar 4: Knowledge Base (pgvector SOPs & Historical Precedents)
  {
    connectorId: "internal.kb",
    icon: Database,
    label: "Search SOPs & Precedents",
    tag: "Knowledge Base · RAG",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "Search the organization knowledge base for standard operating procedures, consumer promotion precedents, and compliance rules.",
  },
  // Fallback / Alternative: Zoho Books (Accounting & Invoices)
  {
    connectorId: "zoho.books",
    icon: Receipt,
    label: "Check Invoices & Advance Balances",
    tag: "Zoho Books · Finance",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "Check our latest GST invoices, customer records, and advance escrow balances in Zoho Books.",
  },
  // Fallback / Alternative: SharePoint / OneDrive Docs
  {
    connectorId: "microsoft.sharepoint",
    icon: FolderOpen,
    label: "Explore OneDrive Documents",
    tag: "OneDrive · Files",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "List my recent files and campaign review documents in OneDrive.",
  },
  // Fallback / Alternative: Zoho Projects Tasks
  {
    connectorId: "zoho.projects",
    icon: Kanban,
    label: "Inspect Zoho Projects Tasks",
    tag: "Zoho Projects · Tasks",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "List our active projects in Zoho Projects and check milestone progress.",
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

  // Filter suggestions to only show prompts for connectors that are enabled
  const visibleSuggestions = ALL_SUGGESTIONS.filter((s) => {
    if (!s.connectorId) return true;
    return activeConnectors[s.connectorId] !== false;
  }).slice(0, 4);

  // Fallback to general suggestions if very few are enabled
  const displaySuggestions =
    visibleSuggestions.length >= 2 ? visibleSuggestions : ALL_SUGGESTIONS.slice(0, 4);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-2xl w-full mx-auto my-auto select-none">
      {/* Brand Hero: App Icon Tile */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-5 flex flex-col items-center"
      >
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl scale-125" />
          <BigCityLogo size={56} variant="tile" className="relative shadow-md rounded-2xl p-2 bg-white border border-stone-200/80" />
        </div>
      </motion.div>

      {/* Heading with Subtext */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight mb-1.5">
          BCP Assist
        </h2>
        <p className="text-xs text-stone-400 font-medium mb-2.5">
          by <span className="text-blue-600 font-semibold">Enlight Lab</span> · BigCity Promotions
        </p>
        <p className="text-[13px] text-stone-500 max-w-md mx-auto leading-relaxed">
          Ask questions across your enabled mail, documents, CRM deals, projects, and invoices, gated strictly by your real permissions.
        </p>
      </motion.div>

      {/* Action Starter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
        {displaySuggestions.map((item, i) => {
          const IconComp = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 + i * 0.05 }}
              whileHover={{ scale: 1.015, y: -2 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => handleClick(item.text)}
              className="group flex flex-col items-start p-4 rounded-2xl bg-white hover:bg-stone-50/70 border border-stone-200/90 hover:border-violet-300 hover:shadow-md transition-all text-left shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-2.5">
                <div className={`p-2 rounded-xl ${item.bg} ${item.border} border`}>
                  <IconComp size={16} weight="duotone" className={item.color} />
                </div>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200/80">
                  {item.tag}
                </span>
              </div>
              <span className="text-[13px] font-bold text-stone-900 group-hover:text-violet-700 transition-colors">
                {item.label}
              </span>
              <p className="text-[11.5px] text-stone-500 leading-relaxed mt-1 line-clamp-2">
                {item.text}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
