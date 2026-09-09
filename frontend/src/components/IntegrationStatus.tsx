"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Database,
  Brain,
  CheckCircle,
  Lightning,
  CaretDown,
  CaretUp,
  Receipt,
  Kanban,
} from "@phosphor-icons/react";

export interface IntegrationItem {
  id: string;
  name: string;
  shortName: string;
  category: string;
  status: "active" | "connected" | "synced";
  metric: string;
  detail: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  isReadWrite?: boolean;
}

export const INTEGRATIONS_LIST: IntegrationItem[] = [
  {
    id: "zoho-projects",
    name: "Zoho Projects",
    shortName: "Zoho Projects",
    category: "Project & Task Management",
    status: "connected",
    metric: "Read & Write",
    detail: "Live Read & Write Active • Auto-creates Projects, Milestones & Aspect Tasks on approval",
    icon: Kanban,
    color: "text-emerald-700",
    bg: "bg-emerald-50/80",
    border: "border-emerald-200",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    isReadWrite: true,
  },
  {
    id: "zoho-crm",
    name: "Zoho CRM Suite",
    shortName: "Zoho CRM",
    category: "Enterprise Cloud CRM",
    status: "connected",
    metric: "Read & Write",
    detail: "Live Read & Write • Sync Deals, Client Accounts, Commercial Terms & Post-Campaign Closeout",
    icon: Database,
    color: "text-emerald-700",
    bg: "bg-emerald-50/80",
    border: "border-emerald-200",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    isReadWrite: true,
  },
  {
    id: "zoho-books",
    name: "Zoho Books",
    shortName: "Zoho Books",
    category: "Accounting & Escrow",
    status: "connected",
    metric: "Read & Write",
    detail: "Live Read & Write • 100% Advance Payment Verification, GST Invoicing, TDS 194B & Escrow Ledger",
    icon: Receipt,
    color: "text-emerald-700",
    bg: "bg-emerald-50/80",
    border: "border-emerald-200",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    isReadWrite: true,
  },
  {
    id: "zoho-knowledge",
    name: "Zoho Knowledge Base",
    shortName: "Zoho SOPs",
    category: "Campaign Precedents & SOPs",
    status: "synced",
    metric: "34 SOPs",
    detail: "BigCity Assured Reward Precedents & Legal SOPs • Synced via Zoho CRM Suite",
    icon: Brain,
    color: "text-emerald-700",
    bg: "bg-emerald-50/80",
    border: "border-emerald-200",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
  },
];

export default function IntegrationStatus() {
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="border-b border-slate-100 bg-slate-50/40 p-3">
      {/* Section Header with Toggle */}
      <button
        type="button"
        onClick={() => setIsSectionOpen(!isSectionOpen)}
        className="w-full flex items-center justify-between px-1 py-1 text-left cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold text-slate-700 tracking-tight uppercase">
            Connected Services
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-2xs">
            {INTEGRATIONS_LIST.length}/{INTEGRATIONS_LIST.length} Live
          </span>
          <span className="text-slate-400 group-hover:text-slate-700 transition-colors">
            {isSectionOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
          </span>
        </div>
      </button>

      {/* Collapsible List */}
      <AnimatePresence>
        {isSectionOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5 mt-2 overflow-hidden"
          >
            {INTEGRATIONS_LIST.map((item) => {
              const isSelected = selectedId === item.id;
              const IconComp = item.icon;

              return (
                <div key={item.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedId(isSelected ? null : item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-150 text-left border ${
                      isSelected
                        ? `${item.bg} ${item.border} shadow-xs ring-1 ring-slate-300`
                        : "bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center ${item.bg} ${item.border} border`}
                      >
                        <IconComp size={12} weight="duotone" className={item.color} />
                      </div>
                      <div className="truncate">
                        <span className="text-[11.5px] font-semibold text-slate-800 block leading-tight truncate">
                          {item.shortName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 pl-1.5">
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {item.metric}
                      </span>
                    </div>
                  </button>

                  {/* Detail Drawer */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 p-2.5 rounded-xl bg-slate-900 text-white text-[10.5px] leading-relaxed shadow-md border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-slate-400 font-mono text-[9px]">
                            <span>{item.name.toUpperCase()}</span>
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle size={10} weight="fill" /> CONNECTED
                            </span>
                          </div>
                          <p className="text-slate-200 font-medium text-[11px] leading-snug">{item.detail}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
