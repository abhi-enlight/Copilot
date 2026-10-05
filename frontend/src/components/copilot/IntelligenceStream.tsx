"use client";

import { useRef, useEffect, useState, useCallback, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDown,
  Copy,
  Check,
  EnvelopeSimple,
  ChatsCircle,
  Kanban,
  Briefcase,
  PlugsConnected,
  Warning,
  ArrowsClockwise,
  ArrowRight,
  type Icon,
} from "@phosphor-icons/react";
import ActionCard from "@/components/copilot/cards/ActionCard";
import PrismLogo from "@/components/brand/PrismLogo";
import { TOTAL_COCKPIT_TOOLS } from "@/lib/constants";
import type { Message } from "@/types";
import type { ActionProposal } from "@/types/database";

const emptySubscribe = () => () => {};

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface IntelligenceStreamProps {
  messages: Message[];
  isLoading: boolean;
  toolSteps?: import("@/types").ToolStep[];
  connectedToolsCount?: number;
  totalToolsCount?: number;
  onOpenConnectHub?: () => void;
  onApproveAction: (actionId: string, updatedPayload?: Record<string, unknown>) => Promise<{ success: boolean; error?: string; result?: unknown } | void>;
  onRejectAction: (actionId: string, reason?: string) => Promise<{ success: boolean; error?: string } | void>;
  onQuickPrompt?: (prompt: string) => void;
}

interface EmailItem {
  sender: string;
  subject: string;
  received?: string;
  summary?: string;
  urgency?: string;
}

interface DealItem {
  dealName: string;
  amount?: string;
  stage?: string;
  closeDate?: string;
  summary?: string;
}

interface ParsedStructuredData {
  type: "email" | "deal";
  intro: string;
  emails?: EmailItem[];
  deals?: DealItem[];
  outro: string;
}

function parseStructuredContent(text: string): ParsedStructuredData | null {
  if (!text) return null;

  // 1. Check for email patterns: "From: ... Summary: ..."
  if (text.includes("From:") && (text.includes("Summary:") || text.includes("Urgency") || text.includes("Received:"))) {
    const parts = text.split(/(?=From:\s*)/i);
    if (parts.length >= 2) {
      const intro = parts[0].trim();
      const emails: EmailItem[] = [];
      let outro = "";

      for (let i = 1; i < parts.length; i++) {
        let chunk = parts[i].trim();
        // In the last item, check if there's a trailing question/outro
        if (i === parts.length - 1) {
          const lines = chunk.split("\n");
          const outroIndex = lines.findIndex((l) =>
            l.toLowerCase().includes("want me to") ||
            l.toLowerCase().includes("should i") ||
            l.toLowerCase().includes("would you like") ||
            (l.trim().endsWith("?") && !l.toLowerCase().includes("summary") && !l.toLowerCase().includes("urgency"))
          );
          if (outroIndex !== -1) {
            outro = lines.slice(outroIndex).join("\n").trim();
            chunk = lines.slice(0, outroIndex).join("\n").trim();
          }
        }

        const fromMatch = chunk.match(/From:\s*([^\n—–-]+)(?:[—–-]\s*([^\n]+))?/i);
        const receivedMatch = chunk.match(/Received:\s*([^\n]+)/i);
        const summaryMatch = chunk.match(/Summary:\s*([^\n]+(?:\n(?!(?:Action|Urgency|From|Received):)[^\n]+)*)/i);
        const urgencyMatch = chunk.match(/(?:Action\s*\/\s*Urgency|Urgency|Action):\s*([^\n]+(?:\n(?!(?:From|Received|Summary):)[^\n]+)*)/i);

        if (fromMatch) {
          emails.push({
            sender: fromMatch[1]?.trim() || "Unknown Sender",
            subject: fromMatch[2]?.trim() || "Message Notification",
            received: receivedMatch ? receivedMatch[1].trim() : undefined,
            summary: summaryMatch ? summaryMatch[1].trim() : undefined,
            urgency: urgencyMatch ? urgencyMatch[1].trim() : undefined,
          });
        }
      }

      if (emails.length > 0) {
        return { type: "email", intro, emails, outro };
      }
    }
  }

  // 2. Check for CRM deal patterns: "Deal: ... Amount: ... Stage: ..."
  if (text.includes("Deal:") && (text.includes("Amount:") || text.includes("Stage:"))) {
    const parts = text.split(/(?=Deal:\s*)/i);
    if (parts.length >= 2) {
      const intro = parts[0].trim();
      const deals: DealItem[] = [];
      let outro = "";

      for (let i = 1; i < parts.length; i++) {
        let chunk = parts[i].trim();
        if (i === parts.length - 1) {
          const lines = chunk.split("\n");
          const outroIndex = lines.findIndex((l) =>
            l.toLowerCase().includes("want me to") || l.toLowerCase().includes("should i") || l.trim().endsWith("?")
          );
          if (outroIndex !== -1) {
            outro = lines.slice(outroIndex).join("\n").trim();
            chunk = lines.slice(0, outroIndex).join("\n").trim();
          }
        }

        const dealMatch = chunk.match(/Deal:\s*([^\n—–-]+)(?:[—–-]\s*([^\n]+))?/i);
        const amountMatch = chunk.match(/Amount:\s*([^\n]+)/i);
        const stageMatch = chunk.match(/Stage:\s*([^\n]+)/i);
        const closeMatch = chunk.match(/(?:Close Date|Close):\s*([^\n]+)/i);
        const summaryMatch = chunk.match(/Summary:\s*([^\n]+)/i);

        if (dealMatch) {
          deals.push({
            dealName: dealMatch[1]?.trim() || "Untitled Deal",
            amount: amountMatch ? amountMatch[1].trim() : undefined,
            stage: stageMatch ? stageMatch[1].trim() : undefined,
            closeDate: closeMatch ? closeMatch[1].trim() : undefined,
            summary: summaryMatch ? summaryMatch[1].trim() : undefined,
          });
        }
      }

      if (deals.length > 0) {
        return { type: "deal", intro, deals, outro };
      }
    }
  }

  return null;
}

function extractSuggestedActions(text: string): { label: string; prompt: string; icon: Icon }[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const actions: { label: string; prompt: string; icon: Icon }[] = [];

  if (lower.includes("mark these as read") || lower.includes("mark as read")) {
    actions.push({
      label: "Mark as Read",
      prompt: "Yes, mark these emails as read in Outlook.",
      icon: Check,
    });
  }
  if (lower.includes("draft a reply") || lower.includes("draft replies") || lower.includes("draft reply")) {
    actions.push({
      label: "Draft Reply",
      prompt: "Draft a reply to the most urgent email.",
      icon: ArrowRight,
    });
  }
  if (lower.includes("slack summary") || lower.includes("sent as a slack") || lower.includes("send to slack")) {
    actions.push({
      label: "Post to Slack",
      prompt: "Post a concise summary of this update to the general Slack channel.",
      icon: ChatsCircle,
    });
  }

  return actions;
}

export default function IntelligenceStream({
  messages,
  isLoading,
  toolSteps = [],
  connectedToolsCount = 0,
  totalToolsCount = TOTAL_COCKPIT_TOOLS,
  onOpenConnectHub,
  onApproveAction,
  onRejectAction,
  onQuickPrompt,
}: IntelligenceStreamProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Time-aware greeting read from the client clock without a hydration mismatch:
  // the server snapshot stays neutral until the store is read in the browser.
  const greeting = useSyncExternalStore(
    emptySubscribe,
    () => greetingForHour(new Date().getHours()),
    () => "Welcome back"
  );

  // Derived state: show pill when scrolled up with messages
  const showScrollPill = !isPinnedToBottom && messages.length > 0;

  // Check if scroll container is near the bottom
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsPinnedToBottom(distanceToBottom < 80);
  };

  const scrollToBottom = useCallback((smooth = true) => {
    bottomAnchorRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
    setIsPinnedToBottom(true);
  }, []);

  // Auto-scroll when messages update, but ONLY if pinned
  useEffect(() => {
    if (isPinnedToBottom) {
      bottomAnchorRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, isLoading, isPinnedToBottom]);

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn("Failed to copy:", err);
    }
  };

  const quickStarters = [
    {
      title: "Check Unread Emails",
      prompt: "Summarize my last 3 unread emails in Outlook and identify urgent follow-ups.",
      icon: EnvelopeSimple,
    },
    {
      title: "Draft Channel Update",
      prompt: "Draft an operational status announcement for the Microsoft Teams project channel.",
      icon: ChatsCircle,
    },
    {
      title: "Inspect CRM Deals",
      prompt: "Review high-value pipeline deals in Zoho CRM closing this month.",
      icon: Briefcase,
    },
    {
      title: "Sprint Backlog Review",
      prompt: "List active blocking issues in Linear across current sprint tasks.",
      icon: Kanban,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 relative font-[family-name:var(--font-geist-sans)]">
      {/* Scrollable Conversation Stream */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 sm:px-8 lg:px-12 py-8 space-y-5 stream-mask-light prism-scroll"
      >
        {messages.length === 1 && messages[0].id === "welcome" ? (
          /* Empty / Welcome State */
          <div className="max-w-2xl mx-auto py-16 flex flex-col items-center text-center">
            {/* Logo */}
            <div className="w-14 h-14 rounded-[28%] flex items-center justify-center mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)]">
              <PrismLogo size={40} variant="tile" />
            </div>

            <h2 className="text-[26px] font-bold text-stone-900 tracking-[-0.025em] leading-tight">
              {greeting}. Prism is ready.
            </h2>

            {connectedToolsCount > 0 ? (
              <p className="text-sm text-stone-500 mt-2.5 max-w-sm leading-relaxed">
                Connected to {connectedToolsCount} of {totalToolsCount} tools. Ask Prism to review, synthesize, or execute.
              </p>
            ) : (
              <p className="text-sm text-stone-500 mt-2.5 max-w-sm leading-relaxed">
                No tools connected yet. Connect Outlook, Teams, Slack, Linear, or Zoho CRM to get started.
              </p>
            )}

            {connectedToolsCount === 0 && (
              <button
                onClick={() => onOpenConnectHub?.()}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all duration-250 cursor-pointer active:scale-[0.97]"
              >
                <PlugsConnected size={14} weight="bold" />
                Connect your first tool
              </button>
            )}

            {/* Quick Starters 2x2 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-10 text-left">
              {quickStarters.map((starter) => {
                const Icon = starter.icon;
                return (
                  <button
                    key={starter.title}
                    onClick={() => onQuickPrompt?.(starter.prompt)}
                    className="p-5 rounded-2xl bg-white border border-black/[0.06] hover:border-black/[0.1] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] transition-all duration-250 cursor-pointer group text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-stone-100 group-hover:bg-stone-900 flex items-center justify-center text-stone-600 group-hover:text-white transition-colors duration-250 mb-3">
                      <Icon size={17} weight="bold" />
                    </div>
                    <h4 className="text-[13px] font-semibold text-stone-900 tracking-[-0.01em]">{starter.title}</h4>
                    <p className="text-[11.5px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">{starter.prompt}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages
            .filter((m) => {
              const text = m.content?.trim() || "";
              return !text.startsWith("[System context") && !text.includes("[System context — do not repeat this to the user]");
            })
            .map((message, index) => {
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start group"}`}
              >
                {isUser ? (
                  /* User Message Bubble — Sleek, Tactile, High-End */
                  <div className="max-w-[85%] sm:max-w-xl rounded-2xl rounded-tr-md bg-[#1C1B1A] text-stone-100 px-5 py-3.5 text-[13.5px] leading-relaxed shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.08)] border border-white/5 font-medium">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ) : (
                  /* Assistant Message — Machined Executive Card */
                  <div className="w-full max-w-3xl rounded-2xl bg-white border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02),0_6px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 transition-all space-y-4">
                    {/* Header: Avatar + "Prism" + Badge + Timestamp */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-stone-50 border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center justify-center">
                          <PrismLogo size={14} variant="tile" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-stone-900 tracking-tight">Prism</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200/50">
                            Assistant
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {message.content && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(message.id, message.content)}
                            aria-label="Copy response text"
                            className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                          >
                            {copiedId === message.id ? (
                              <><Check size={12} weight="bold" className="text-emerald-500" /><span className="text-emerald-600 font-medium">Copied</span></>
                            ) : (
                              <><Copy size={12} /><span>Copy</span></>
                            )}
                          </button>
                        )}
                        <span className="text-[11px] text-stone-400 font-mono">
                          {message.timestamp || "Just now"}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3">
                      {/* Active thinking indicator inside assistant bubble while loading and no content yet */}
                      {!message.content && (!message.action_proposals || message.action_proposals.length === 0) && isLoading && (
                        <div className="py-1 space-y-3">
                          {/* Multi-phase status pill */}
                          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200/80 text-xs text-stone-700">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span className="font-medium">Thinking…</span>
                          </div>

                          {/* Soft Shimmer Skeleton placeholder */}
                          <div className="space-y-2 pt-1 max-w-md">
                            <div className="h-3.5 w-3/4 rounded-md animate-shimmer" />
                            <div className="h-3.5 w-1/2 rounded-md animate-shimmer" />
                          </div>
                        </div>
                      )}

                      {/* Defensive fallback if done but empty */}
                      {!message.content && (!message.action_proposals || message.action_proposals.length === 0) && !isLoading && (
                        <div className="text-xs text-stone-500 italic py-1">
                          Action completed.
                        </div>
                      )}

                      {/* Non-Technical Error Card if message is an error/alert */}
                      {message.content && message.content.startsWith("⚠️ **") ? (
                        <div className="my-2 p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Warning size={16} weight="duotone" />
                            </div>
                            <div className="space-y-1 min-w-0 flex-1">
                              <h4 className="text-[13.5px] font-semibold text-stone-900 tracking-tight leading-snug">
                                {message.content.split("\n\n")[0]?.replace("⚠️ **", "").replace("**", "") || "Assistant Paused"}
                              </h4>
                              <p className="text-xs text-stone-600 leading-relaxed">
                                {message.content.split("\n\n")[1] || message.content.replace(/^⚠️ \*\*[^*]+\*\*\s*/, "")}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1 pl-11">
                            {onQuickPrompt && (
                              <button
                                type="button"
                                onClick={() => {
                                  const prevUserMsg = [...messages.slice(0, index)].reverse().find((m) => m.role === "user");
                                  if (prevUserMsg) onQuickPrompt(prevUserMsg.content);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-sm"
                              >
                                <ArrowsClockwise size={12} />
                                <span>Try Again</span>
                              </button>
                            )}
                            {onOpenConnectHub && (
                              <button
                                type="button"
                                onClick={onOpenConnectHub}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                <span>Check Connect Hub</span>
                                <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ) : message.content ? (
                        (() => {
                          const structured = parseStructuredContent(message.content);

                          if (structured && structured.type === "email" && structured.emails) {
                            return (
                              <div className="space-y-3">
                                {structured.intro && (
                                  <p className="text-[13px] text-stone-700 leading-relaxed font-medium">
                                    {structured.intro}
                                  </p>
                                )}

                                {/* Stack of Executive Email Cards */}
                                <div className="space-y-2.5 my-2">
                                  {structured.emails.map((item, idx) => {
                                    const urgencyLower = (item.urgency || "").toLowerCase();
                                    const isUrgent = urgencyLower.includes("urgent") || urgencyLower.includes("action needed");
                                    const isReview = urgencyLower.includes("worth noting") || urgencyLower.includes("review") || urgencyLower.includes("low");

                                    return (
                                      <div
                                        key={idx}
                                        className="rounded-xl bg-[#FBFBFA] border border-black/[0.07] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-black/[0.12] transition-all space-y-2.5"
                                      >
                                        {/* Top row: Sender + Date */}
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-5 h-5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 flex items-center justify-center shrink-0">
                                              <EnvelopeSimple size={11} weight="bold" />
                                            </div>
                                            <span className="text-xs font-semibold text-stone-900 truncate">
                                              {item.sender}
                                            </span>
                                          </div>
                                          {item.received && (
                                            <span className="text-[11px] font-mono text-stone-400 shrink-0 bg-white px-2 py-0.5 rounded border border-stone-200/60">
                                              {item.received}
                                            </span>
                                          )}
                                        </div>

                                        {/* Subject */}
                                        <h4 className="text-[13.5px] font-semibold text-stone-900 tracking-[-0.01em] leading-snug">
                                          {item.subject}
                                        </h4>

                                        {/* Summary */}
                                        {item.summary && (
                                          <p className="text-xs text-stone-600 leading-relaxed">
                                            {item.summary}
                                          </p>
                                        )}

                                        {/* Card Footer: Urgency Pill + Quick Action */}
                                        <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] text-xs">
                                          <div>
                                            {isUrgent ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                Action Needed
                                              </span>
                                            ) : isReview ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                Review
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-stone-100 text-stone-600 border border-stone-200/80">
                                                Informational
                                              </span>
                                            )}
                                          </div>

                                          {onQuickPrompt && (
                                            <button
                                              type="button"
                                              onClick={() => onQuickPrompt(`Draft a reply to "${item.subject}" from ${item.sender}`)}
                                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                                            >
                                              <span>Draft Reply</span>
                                              <ArrowRight size={10} weight="bold" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {structured.outro && (
                                  <p className="text-[13px] text-stone-800 font-medium pt-1">
                                    {structured.outro}
                                  </p>
                                )}
                              </div>
                            );
                          }

                          if (structured && structured.type === "deal" && structured.deals) {
                            return (
                              <div className="space-y-3">
                                {structured.intro && (
                                  <p className="text-[13px] text-stone-700 leading-relaxed font-medium">
                                    {structured.intro}
                                  </p>
                                )}

                                {/* Stack of Executive CRM Deal Cards */}
                                <div className="space-y-2.5 my-2">
                                  {structured.deals.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="rounded-xl bg-[#FBFBFA] border border-black/[0.07] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-black/[0.12] transition-all space-y-2"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shrink-0">
                                            <Briefcase size={11} weight="bold" />
                                          </div>
                                          <h4 className="text-[13.5px] font-semibold text-stone-900 truncate">
                                            {item.dealName}
                                          </h4>
                                        </div>
                                        {item.amount && (
                                          <span className="text-xs font-semibold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                                            {item.amount}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3 text-[11.5px] text-stone-500">
                                        {item.stage && <span>Stage: <strong className="text-stone-700">{item.stage}</strong></span>}
                                        {item.closeDate && <span>Close: <strong className="text-stone-700">{item.closeDate}</strong></span>}
                                      </div>

                                      {item.summary && (
                                        <p className="text-xs text-stone-600 leading-relaxed">
                                          {item.summary}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {structured.outro && (
                                  <p className="text-[13px] text-stone-800 font-medium pt-1">
                                    {structured.outro}
                                  </p>
                                )}
                              </div>
                            );
                          }

                          // Default rich markdown rendering with enhanced typography
                          return (
                            <div className="text-sm text-stone-800 leading-relaxed">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({ children }) => <h1 className="text-base font-bold text-stone-900 mt-4 mb-2">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-sm font-bold text-stone-900 mt-3 mb-1.5">{children}</h2>,
                                  h3: ({ children }) => (
                                    <div className="mt-3.5 mb-1.5 pt-2.5 border-t border-stone-100 first:mt-0 first:pt-0 first:border-0">
                                      <h3 className="text-[13.5px] font-semibold text-stone-900 tracking-tight flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                                        <span>{children}</span>
                                      </h3>
                                    </div>
                                  ),
                                  ul: ({ children }) => <ul className="my-2 space-y-1.5 pl-1">{children}</ul>,
                                  li: ({ children }) => (
                                    <li className="text-xs sm:text-[13px] text-stone-700 flex items-start gap-2 leading-relaxed">
                                      <span className="text-stone-400 mt-1 select-none">•</span>
                                      <span className="flex-1">{children}</span>
                                    </li>
                                  ),
                                  p: ({ children }) => <p className="my-1.5 leading-relaxed text-stone-700 text-xs sm:text-[13px]">{children}</p>,
                                  strong: ({ children }) => <strong className="font-semibold text-stone-950">{children}</strong>,
                                  blockquote: ({ children }) => (
                                    <blockquote className="my-3 border-l-2 border-indigo-500 bg-stone-50 rounded-r-xl px-4 py-2.5 text-xs text-stone-700">
                                      {children}
                                    </blockquote>
                                  ),
                                  code: ({ children, className }) => {
                                    const isBlock = className?.includes("language-");
                                    if (isBlock) {
                                      return <code className="block p-3 rounded-xl bg-stone-900 text-stone-100 text-xs font-mono overflow-x-auto my-2">{children}</code>;
                                    }
                                    return <code className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-800 text-[11px] font-mono">{children}</code>;
                                  },
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                              {isLoading && index === messages.length - 1 && (
                                <span className="inline-block w-1.5 h-3.5 bg-stone-500 ml-1 rounded-sm animate-pulse align-middle" />
                              )}
                            </div>
                          );
                        })()
                      ) : null}

                      {/* Action proposals get a card container */}
                      {message.action_proposals && message.action_proposals.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {message.action_proposals.map((proposal: ActionProposal) => (
                            <ActionCard
                              key={proposal.id}
                              proposal={proposal}
                              onApprove={onApproveAction}
                              onReject={onRejectAction}
                            />
                          ))}
                        </div>
                      )}

                      {/* Clickable Suggested Action Pills extracted from questions */}
                      {(() => {
                        const suggestedActions = extractSuggestedActions(message.content);
                        if (suggestedActions.length === 0) return null;

                        return (
                          <div className="pt-3 border-t border-black/[0.04] flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Suggested:</span>
                            {suggestedActions.map((action, i) => {
                              const ActionIcon = action.icon;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => onQuickPrompt?.(action.prompt)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer active:scale-95"
                                >
                                  <ActionIcon size={12} weight="bold" />
                                  <span>{action.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Bottom Anchor for Auto-Scroll */}
        <div ref={bottomAnchorRef} className="h-2" />
      </div>

      {/* Live orchestration timeline: exactly what Prism is doing, step by step */}
      {toolSteps.length > 0 && (
        <div className="px-5 sm:px-8 lg:px-12 pb-2 font-[family-name:var(--font-geist-sans)]">
          <ol className="mx-auto flex max-w-3xl flex-col gap-1.5 rounded-xl border border-black/[0.06] bg-white/90 px-4 py-3">
            {toolSteps.map((step, index) => (
              <li
                key={`${step.tool}-${step.startedAt}-${index}`}
                className="flex items-center gap-2.5 text-[12.5px] text-stone-600"
              >
                {step.status === "executing" ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 animate-thinking-glow" />
                ) : step.status === "failed" ? (
                  <Warning size={13} weight="bold" className="shrink-0 text-amber-500" />
                ) : (
                  <Check size={13} weight="bold" className="shrink-0 text-emerald-500" />
                )}
                <span className="truncate">{step.tool}</span>
                <span className="ml-auto shrink-0 text-[11px] text-stone-400">
                  {step.status === "executing" ? "working…" : step.status === "failed" ? "failed" : "done"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Floating Smart Scroll-to-Bottom Pill */}
      {showScrollPill && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-5 right-6 z-20 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-900/90 hover:bg-stone-900 text-white text-xs font-medium shadow-md border border-white/10 backdrop-blur-md transition-all duration-150 cursor-pointer active:scale-95"
          title="Scroll to latest message"
        >
          {isLoading ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Generating…</span>
            </>
          ) : (
            <span>Latest message</span>
          )}
          <ArrowDown size={11} weight="bold" />
        </button>
      )}
    </div>
  );
}
