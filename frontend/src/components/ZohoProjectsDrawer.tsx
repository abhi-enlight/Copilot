"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Kanban,
  CheckCircle,
  Clock,
  ArrowsClockwise,
  ArrowSquareOut,
  Scales,
  ShieldCheck,
  Receipt,
  Cpu,
  User,
  Code,
  Tag,
  Check,
  Circle,
  CaretRight,
  Dot,
} from "@phosphor-icons/react";
import { type Campaign, type AspectTask } from "@/types/campaign";

interface ZohoProjectsDrawerProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: (updatedCampaign: Campaign) => void;
}

const ASPECT_META = {
  legal: {
    icon: Scales,
    label: "Legal",
    accent: "bg-violet-500",
    light: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-l-violet-400",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
  compliance: {
    icon: ShieldCheck,
    label: "Compliance",
    accent: "bg-amber-500",
    light: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  accounting: {
    icon: Receipt,
    label: "Accounting",
    accent: "bg-emerald-500",
    light: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-l-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  implementation: {
    icon: Cpu,
    label: "Tech",
    accent: "bg-sky-500",
    light: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-l-sky-400",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
  },
};

type TabId = "tasks" | "milestones" | "api_logs";

export default function ZohoProjectsDrawer({
  campaign,
  isOpen,
  onClose,
  onTaskUpdated,
}: ZohoProjectsDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("tasks");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [drawerAspectFilter, setDrawerAspectFilter] = useState<"all" | "legal" | "compliance" | "accounting" | "implementation">("all");
  const [drawerSearch, setDrawerSearch] = useState("");

  if (!isOpen) return null;

  const handleToggleTaskStatus = async (task: AspectTask) => {
    setUpdatingTaskId(task.id);
    const newStatus = task.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_zoho_task",
          campaignId: campaign.id,
          taskId: task.id,
          newStatus,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncNotice(`Synced "${task.sopCode}" → ${newStatus === "COMPLETED" ? "Closed" : "In Progress"}`);
        setTimeout(() => setSyncNotice(null), 3500);
        if (onTaskUpdated && data.campaign) onTaskUpdated(data.campaign);
      }
    } catch (e) {
      console.error("Failed to update task", e);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await fetch(`/api/campaigns?action=read_zoho_tasks&id=${campaign.id}`);
      setSyncNotice("Synced with Zoho · Tasks up to date");
      setTimeout(() => setSyncNotice(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const totalCompleted = campaign.tasks.filter((t) => t.status === "COMPLETED").length;
  const completionPct = campaign.tasks.length > 0
    ? Math.round((totalCompleted / campaign.tasks.length) * 100)
    : 0;

  const tabs: { id: TabId; label: string; icon: typeof Kanban }[] = [
    { id: "tasks", label: `Tasks (${campaign.tasks.length})`, icon: Kanban },
    { id: "milestones", label: "Milestones", icon: Tag },
    { id: "api_logs", label: "API Logs", icon: Code },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/30 backdrop-blur-[2px]"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 border-l border-stone-200"
        >
          {/* ── HEADER ── */}
          <div className="px-5 pt-5 pb-4 border-b border-stone-100 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Zoho ID + status row */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    <Kanban size={12} weight="fill" />
                    {campaign.zohoProjectId || "ZP-881290"}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>

                {/* Campaign title */}
                <h2 className="text-[15px] font-bold text-stone-900 leading-snug line-clamp-2">
                  {campaign.name}
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {campaign.client} · {campaign.budget}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                  title="Sync from Zoho"
                >
                  <ArrowsClockwise
                    size={15}
                    weight="bold"
                    className={isSyncing ? "animate-spin text-amber-600" : ""}
                  />
                </button>
                <a
                  href={campaign.zohoProjectUrl || "https://projects.zoho.in"}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                  title="Open Zoho Portal"
                >
                  <ArrowSquareOut size={15} weight="bold" />
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={15} weight="bold" />
                </button>
              </div>
            </div>

            {/* Task completion counter */}
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-stone-500">
                {totalCompleted} of {campaign.tasks.length} tasks completed
              </span>
            </div>
          </div>

          {/* ── SYNC TOAST ── */}
          <AnimatePresence>
            {syncNotice && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-stone-900 text-white text-[11px] font-medium px-4 py-2 flex items-center justify-between flex-shrink-0"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={13} weight="fill" className="text-emerald-400" />
                  <span>{syncNotice}</span>
                </div>
                <button onClick={() => setSyncNotice(null)} className="text-white/60 hover:text-white cursor-pointer">
                  <X size={12} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── TABS ── */}
          <div className="flex border-b border-stone-100 px-5 flex-shrink-0 bg-white">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 py-2.5 px-2 mr-2 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "border-stone-900 text-stone-900"
                      : "border-transparent text-stone-400 hover:text-stone-600"
                  }`}
                >
                  <Icon size={13} weight={isActive ? "bold" : "regular"} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── CONTENT ── */}
          <div className="flex-1 overflow-y-auto">
            {/* TASKS TAB */}
            {activeTab === "tasks" && (
              <div>
                {/* Filter & Search Bar */}
                <div className="px-5 py-2.5 border-b border-stone-100 bg-stone-50/70 space-y-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(
                      [
                        { key: "all" as const, label: "All", count: campaign.tasks.length },
                        { key: "legal" as const, label: "Legal", count: campaign.tasks.filter((t) => t.aspect === "legal").length },
                        { key: "compliance" as const, label: "Compliance", count: campaign.tasks.filter((t) => t.aspect === "compliance").length },
                        { key: "accounting" as const, label: "Accounting", count: campaign.tasks.filter((t) => t.aspect === "accounting").length },
                        { key: "implementation" as const, label: "Tech", count: campaign.tasks.filter((t) => t.aspect === "implementation").length },
                      ]
                    ).map((f) => {
                      const isSel = drawerAspectFilter === f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setDrawerAspectFilter(f.key)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                            isSel
                              ? "bg-stone-900 text-white border-stone-900 shadow-2xs"
                              : "bg-white text-stone-600 hover:text-stone-900 border-stone-200"
                          }`}
                        >
                          <span>{f.label}</span>
                          <span
                            className={`text-[9.5px] font-mono px-1 rounded-full ${
                              isSel ? "bg-stone-700 text-stone-200" : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            {f.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Filter tasks by name or owner..."
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      className="w-full text-xs px-2.5 py-1 bg-white border border-stone-200 rounded-lg outline-none focus:border-amber-500 placeholder:text-stone-400"
                    />
                    {drawerSearch && (
                      <button
                        type="button"
                        onClick={() => setDrawerSearch("")}
                        className="text-[11px] text-stone-400 hover:text-stone-600 cursor-pointer whitespace-nowrap"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-stone-100">
                  {campaign.tasks
                    .filter((task) => {
                      const matchAsp =
                        drawerAspectFilter === "all" || task.aspect === drawerAspectFilter;
                      const q = drawerSearch.toLowerCase().trim();
                      const matchQ =
                        !q ||
                        task.title.toLowerCase().includes(q) ||
                        task.assignee.toLowerCase().includes(q) ||
                        task.sopCode.toLowerCase().includes(q);
                      return matchAsp && matchQ;
                    })
                    .map((task, idx) => {
                    const meta = ASPECT_META[task.aspect as keyof typeof ASPECT_META] || ASPECT_META.implementation;
                    const Icon = meta.icon;
                    const isDone = task.status === "COMPLETED";
                    const isBusy = updatingTaskId === task.id;
                    const isExpanded = expandedTaskId === task.id;

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {/* Main row */}
                        <div
                          className={`flex items-center gap-3 px-5 py-3 cursor-pointer group transition-colors hover:bg-stone-50 border-l-2 ${
                            isDone ? "border-l-transparent opacity-60" : meta.border
                          }`}
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTaskStatus(task);
                            }}
                            disabled={isBusy}
                            className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                              isDone
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "border-stone-300 hover:border-stone-500 bg-white"
                            }`}
                          >
                            {isBusy ? (
                              <ArrowsClockwise size={10} className="animate-spin text-stone-400" />
                            ) : isDone ? (
                              <Check size={10} weight="bold" />
                            ) : null}
                          </button>

                          {/* Aspect icon */}
                          <Icon
                            size={13}
                            weight="duotone"
                            className={`flex-shrink-0 ${isDone ? "text-stone-400" : meta.light}`}
                          />

                          {/* Title + meta */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[12px] font-semibold truncate ${
                                  isDone ? "text-stone-400 line-through" : "text-stone-900"
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-semibold ${meta.light}`}>{meta.label}</span>
                              <Dot size={8} className="text-stone-300" />
                              <span className="text-[10px] text-stone-400 truncate">{task.assignee}</span>
                            </div>
                          </div>

                          {/* TAT + expand caret */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-mono text-stone-400 hidden sm:block">{task.tat}</span>
                            <CaretRight
                              size={12}
                              className={`text-stone-300 transition-transform duration-200 ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden"
                            >
                              <div className={`mx-5 mb-3 p-3 rounded-xl border text-[11px] leading-relaxed space-y-2 ${meta.bg} border-${meta.accent.replace("bg-", "")}/20`}>
                                <p className="text-stone-700">{task.details}</p>
                                <div className="pt-2 border-t border-stone-200/60 flex items-center gap-4 text-stone-500">
                                  <span className="flex items-center gap-1">
                                    <User size={11} />
                                    <strong className="text-stone-700">{task.assignee}</strong>
                                    {task.role ? ` (${task.role})` : ""}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} />
                                    TAT: <strong>{task.tat}</strong>
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MILESTONES TAB */}
            {activeTab === "milestones" && (
              <div className="p-5 space-y-3">
                <p className="text-[11px] text-stone-400 mb-4">
                  4 milestone tasklists mapped to BigCity SOP gates
                </p>

                {[
                  {
                    name: "Legal Clearances & Partner Consents",
                    aspect: "legal" as const,
                    count: 3,
                    done: campaign.aspectSummary?.legal?.done || 0,
                  },
                  {
                    name: "Compliance, DLT & 72h Staging UAT",
                    aspect: "compliance" as const,
                    count: 3,
                    done: campaign.aspectSummary?.compliance?.done || 0,
                  },
                  {
                    name: "100% Advance Payment & Finance Escrow",
                    aspect: "accounting" as const,
                    count: 3,
                    done: campaign.aspectSummary?.accounting?.done || 1,
                  },
                  {
                    name: "Code Gen, Microsite DNS & Gateway Failover",
                    aspect: "implementation" as const,
                    count: 4,
                    done: campaign.aspectSummary?.implementation?.done || 0,
                  },
                ].map((m, idx) => {
                  const meta = ASPECT_META[m.aspect];
                  const Icon = meta.icon;
                  const pct = Math.round((m.done / m.count) * 100);

                  return (
                    <motion.div
                      key={m.aspect}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.06 }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-white hover:border-stone-300 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <Icon size={14} weight="duotone" className={meta.light} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="text-[12px] font-semibold text-stone-900 block truncate">
                          {m.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${meta.accent}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.1 }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-stone-500 flex-shrink-0">
                            {m.done}/{m.count}
                          </span>
                        </div>
                      </div>

                      {m.done === m.count ? (
                        <CheckCircle size={16} weight="fill" className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle size={16} weight="regular" className="text-stone-300 flex-shrink-0" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* API LOGS TAB */}
            {activeTab === "api_logs" && (
              <div className="p-5 space-y-3">
                {/* GET request */}
                <div className="rounded-xl overflow-hidden border border-stone-800 bg-[#0d1117]">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-900 px-1.5 py-px rounded">GET</span>
                      <span className="text-[10px] font-mono text-stone-400 truncate">
                        /restapi/portal/bigcity/projects/{campaign.zohoProjectId || "881290"}/tasks
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 flex-shrink-0">200 · 32ms</span>
                  </div>
                  <pre className="text-[10.5px] text-emerald-300 font-mono p-4 overflow-x-auto leading-relaxed">
{JSON.stringify({
  project: {
    id: campaign.zohoProjectId || "ZP-881290",
    name: campaign.name,
    client: campaign.client,
    status: "active",
    task_count: campaign.tasks.length,
    completion_pct: completionPct,
    portal_id: "81293",
  },
  milestones: [
    { id: "MLS-01", name: "Legal Clearances", status: "Active" },
    { id: "MLS-02", name: "Compliance & DLT", status: "Active" },
    { id: "MLS-03", name: "Accounting & Escrow", status: "Active" },
    { id: "MLS-04", name: "Tech & Implementation", status: "Active" },
  ],
}, null, 2)}
                  </pre>
                </div>

                {/* POST request */}
                <div className="rounded-xl overflow-hidden border border-stone-800 bg-[#0d1117]">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 border border-amber-900 px-1.5 py-px rounded">POST</span>
                      <span className="text-[10px] font-mono text-stone-400 truncate">
                        /restapi/portal/bigcity/projects/{campaign.zohoProjectId || "881290"}/tasks
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-400 flex-shrink-0">201 CREATED</span>
                  </div>
                  <pre className="text-[10.5px] text-amber-300 font-mono p-4 overflow-x-auto leading-relaxed">
{JSON.stringify({
  action: "TASK_CREATED_BATCH",   source: "Prism AI Agent",
  aspects_pushed: ["legal", "compliance", "accounting", "implementation"],
  tasks_injected: campaign.tasks.length,
  timestamp: new Date().toISOString(),
}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
