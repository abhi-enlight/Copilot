"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SpinnerGap,
  Lightning,
  ArrowDown,
  Copy,
  Check,
  EnvelopeSimple,
  ChatsCircle,
  Kanban,
  Briefcase,
} from "@phosphor-icons/react";
import ActionCard from "@/components/copilot/cards/ActionCard";
import PrismLogo from "@/components/brand/PrismLogo";
import type { Message } from "@/types";
import type { ActionProposal } from "@/types/database";

interface IntelligenceStreamProps {
  messages: Message[];
  isLoading: boolean;
  toolSteps?: import("@/types").ToolStep[];
  onApproveAction: (actionId: string) => Promise<{ success: boolean; error?: string; result?: unknown } | void>;
  onRejectAction: (actionId: string, reason?: string) => Promise<{ success: boolean; error?: string } | void>;
  onQuickPrompt?: (prompt: string) => void;
}

export default function IntelligenceStream({
  messages,
  isLoading,
  toolSteps,
  onApproveAction,
  onRejectAction,
  onQuickPrompt,
}: IntelligenceStreamProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    <div className="flex-1 flex flex-col min-h-0 relative bg-[#FAFAF9] font-sans">
      {/* Scrollable Conversation Stream */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 stream-mask-light"
      >
        {messages.length === 1 && messages[0].id === "welcome" ? (
          /* Empty / Welcome State */
          <div className="max-w-2xl mx-auto py-12 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-center mb-4">
              <PrismLogo size={32} variant="tile" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Good morning. Prism is ready.
            </h2>
            <p className="text-sm text-slate-500 mt-1.5 max-w-md leading-relaxed">
              Your autonomous executive employee connected to Outlook, Teams, Slack, Linear, and Zoho CRM.
            </p>

            {/* Quick Starters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-8 text-left">
              {quickStarters.map((starter) => {
                const Icon = starter.icon;
                return (
                  <button
                    key={starter.title}
                    type="button"
                    onClick={() => onQuickPrompt?.(starter.prompt)}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-slate-900 group-hover:text-white flex items-center justify-center text-slate-600 transition-colors mb-2.5">
                      <Icon size={16} weight="bold" />
                    </div>
                    <h4 className="text-xs font-semibold text-slate-900">{starter.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {starter.prompt}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                {isUser ? (
                  /* User Message Pill */
                  <div className="max-w-[85%] sm:max-w-xl rounded-2xl rounded-tr-xs bg-slate-900 text-white px-4 py-3 text-sm leading-relaxed shadow-xs">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ) : (
                  /* Assistant Message Card */
                  <div className="w-full max-w-3xl flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 shadow-2xs flex-shrink-0 flex items-center justify-center mt-1">
                      <PrismLogo size={16} variant="tile" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="rounded-2xl rounded-tl-xs bg-white border border-slate-200/80 shadow-xs p-5 text-sm text-slate-900 leading-relaxed">
                        {/* Markdown Formatted Text */}
                        <div className="prose prose-sm max-w-none text-slate-800 prose-headings:font-semibold prose-headings:text-slate-900 prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>

                        {/* Inline Human-in-the-Loop Action Proposals */}
                        {message.action_proposals && message.action_proposals.length > 0 && (
                          <div className="mt-4 space-y-3 pt-3 border-t border-slate-100">
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

                        {/* Bottom Utility Bar (Copy + Timestamp) */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono">
                            {message.sourceBadges?.[0] || "Prism Assistant"}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyText(message.id, message.content)}
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                          >
                            {copiedId === message.id ? (
                              <>
                                <Check size={12} weight="bold" className="text-emerald-600" />
                                <span className="text-emerald-600 font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Multi-Tool Orchestration Step Tracker */}
        {toolSteps && toolSteps.length > 0 && (
          <div className="flex flex-col gap-1.5 max-w-3xl pl-10 mb-2">
            {toolSteps.map((step, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs text-slate-700 w-fit"
              >
                {step.status === "executing" && <SpinnerGap size={14} className="animate-spin text-amber-500" />}
                {step.status === "complete" && <Check size={14} className="text-emerald-500" />}
                {step.status === "failed" && <Lightning size={14} className="text-rose-500" />}
                
                <span className="opacity-80">
                  {step.status === "executing" ? "Executing tool:" : step.status === "complete" ? "Finished tool:" : "Failed tool:"}
                </span>
                <span className="font-mono font-semibold text-slate-900">{step.tool}</span>
                
                {step.status === "complete" && step.completedAt && (
                  <span className="text-[10px] text-slate-400 ml-2">
                    {((step.completedAt - step.startedAt) / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Loading Spinner Indicator */}
        {isLoading && (!toolSteps || toolSteps.length === 0) && (
          <div className="flex items-center gap-2 max-w-3xl pl-10 text-xs text-slate-400">
            <SpinnerGap size={15} className="animate-spin text-slate-600" />
            <span>Prism is synthesizing response…</span>
          </div>
        )}

        {/* Bottom Anchor for Auto-Scroll */}
        <div ref={bottomAnchorRef} className="h-2" />
      </div>

      {/* Floating Smart Scroll-to-Bottom Pill */}
      {showScrollPill && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-lg hover:bg-slate-800 transition cursor-pointer animate-fade-in"
        >
          <ArrowDown size={13} weight="bold" />
          <span>New response below</span>
        </button>
      )}
    </div>
  );
}
