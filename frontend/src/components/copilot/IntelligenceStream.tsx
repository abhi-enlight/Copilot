"use client";

import { useRef, useEffect, useState, useCallback } from "react";
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
} from "@phosphor-icons/react";
import ActionCard from "@/components/copilot/cards/ActionCard";
import PrismLogo from "@/components/brand/PrismLogo";
import { TOTAL_COCKPIT_TOOLS } from "@/lib/constants";
import type { Message } from "@/types";
import type { ActionProposal } from "@/types/database";

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

// Tool meta mapping removed — agent now shows a single "Thinking…" pill
// instead of per-tool badges, keeping backend internals invisible to users.

export default function IntelligenceStream({
  messages,
  isLoading,
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
              Good morning. Prism is ready.
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
          messages.map((message, index) => {
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start group"}`}
              >
                {isUser ? (
                  /* User Message Bubble */
                  <div className="max-w-[80%] sm:max-w-xl rounded-2xl rounded-tr-sm bg-stone-900 text-white px-4 py-3 text-sm leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ) : (
                  /* Assistant Message — plain text on page background, no card */
                  <div className="w-full max-w-3xl flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-lg bg-white border border-black/[0.07] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex-shrink-0 flex items-center justify-center mt-0.5">
                      <PrismLogo size={16} variant="tile" />
                    </div>

                    <div className="flex-1 min-w-0">
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
                        /* Plain text renders directly on page background */
                        <div className="text-sm text-stone-800 leading-relaxed">
                          <div className="prose prose-sm max-w-none text-stone-800
                            prose-headings:font-semibold prose-headings:text-stone-900 prose-headings:tracking-tight
                            prose-p:leading-relaxed prose-p:text-stone-700
                            prose-strong:text-stone-900 prose-strong:font-semibold
                            prose-pre:bg-stone-900 prose-pre:text-stone-100 prose-pre:rounded-xl prose-pre:text-xs
                            prose-code:bg-stone-100 prose-code:text-stone-800 prose-code:rounded prose-code:px-1 prose-code:text-[0.8em]
                            prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
                            prose-ul:text-stone-700 prose-ol:text-stone-700
                          ">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                            {isLoading && index === messages.length - 1 && (
                              <span className="inline-block w-1.5 h-3.5 bg-stone-500 ml-1 rounded-sm animate-pulse align-middle" />
                            )}
                          </div>
                        </div>
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

                      {/* Copy + timestamp — only show on hover when content exists */}
                      {message.content && (
                        <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <span className="font-mono">{message.sourceBadges?.[0] || "Prism"}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(message.id, message.content)}
                            aria-label="Copy response text"
                            className="inline-flex items-center gap-1 hover:text-stone-800 transition-colors cursor-pointer"
                          >
                            {copiedId === message.id ? (
                              <><Check size={12} weight="bold" className="text-emerald-500" /><span className="text-emerald-600">Copied</span></>
                            ) : (
                              <><Copy size={12} /><span>Copy</span></>
                            )}
                          </button>
                        </div>
                      )}
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

      {/* Floating Smart Scroll-to-Bottom Pill */}
      {showScrollPill && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-stone-800 transition-all cursor-pointer"
        >
          <ArrowDown size={12} weight="bold" />
          New response below
        </button>
      )}
    </div>
  );
}
