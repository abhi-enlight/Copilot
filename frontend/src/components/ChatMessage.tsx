"use client";

import { useState } from "react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Robot,
  User,
  Copy,
  Check,
  WarningCircle,
  Sparkle,
  BookmarkSimple,
  ShieldWarning,
} from "@phosphor-icons/react";
import ErrorBoundary from "./ErrorBoundary";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  index: number;
}

export default function ChatMessage({ message, index }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Failed to copy", e);
    }
  };

  const parseTextContent = (children: any): string => {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) {
      return children
        .map((c) => (typeof c === "string" ? c : typeof c === "object" && c?.props?.children ? parseTextContent(c.props.children) : ""))
        .join("");
    }
    return "";
  };

  return (
    <ErrorBoundary
      fallback={
        <div className="p-3 my-1 rounded-xl bg-white border border-stone-200 text-stone-700 text-xs">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          delay: index < 5 ? index * 0.04 : 0,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={`flex gap-3.5 max-w-3xl w-full group ${
          isUser ? "ml-auto flex-row-reverse" : ""
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
            isUser
              ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-800"
              : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30"
          }`}
        >
          {isUser ? (
            <User size={14} weight="bold" />
          ) : (
            <Robot size={15} weight="duotone" />
          )}
        </div>

        {/* Message Body */}
        <div
          className={`flex flex-col gap-1 max-w-[85%] min-w-0 ${
            isUser ? "items-end" : "items-start"
          }`}
        >
          {/* Author & Timestamp */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11.5px] font-semibold text-slate-700">
              {isUser ? "Campaign Manager" : "Prism Copilot"}
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Message Card */}
          <div
            className={`relative px-4.5 py-3.5 text-[0.92rem] leading-relaxed transition-all break-words max-w-full overflow-hidden ${
              isUser
                ? "bg-slate-900 text-white rounded-2xl rounded-tr-sm shadow-md"
                : "bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm shadow-[0_2px_12px_-2px_rgba(15,23,42,0.06)]"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap font-normal text-slate-100 break-words">{message.content}</p>
            ) : (
              <div className="chat-content text-slate-800 break-words max-w-full overflow-hidden">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => {
                      const text = parseTextContent(children);
                      const cleanText = text
                        .replace(/\[Confirmed Information\]/gi, "")
                        .replace(/\[Historical Precedent\]/gi, "")
                        .replace(/\[Risk\]/gi, "")
                        .replace(/\[Recommendation\]/gi, "")
                        .replace(/\[PENDING_HUMAN_SIGN_OFF\]/gi, "")
                        .trim();

                      // If the paragraph was just the tag alone, skip rendering duplicate empty container
                      if (!cleanText && (
                        text.includes("[Confirmed Information]") ||
                        text.includes("[Historical Precedent]") ||
                        text.includes("[Risk]") ||
                        text.includes("[Recommendation]") ||
                        text.includes("[PENDING_HUMAN_SIGN_OFF]")
                      )) {
                        return null;
                      }

                      // Confirmed Information Block
                      if (text.includes("[Confirmed Information]")) {
                        return (
                          <div className="my-2.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-indigo-900 font-semibold text-[11px] mb-1 uppercase tracking-wider">
                              <BookmarkSimple size={13} weight="bold" className="text-indigo-600" />
                              <span>Confirmed Information</span>
                            </div>
                            <div className="text-[13px] text-slate-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      // Historical Precedent Block
                      if (text.includes("[Historical Precedent]")) {
                        return (
                          <div className="my-2.5 p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-sky-900 font-semibold text-[11px] mb-1 uppercase tracking-wider">
                              <Sparkle size={13} weight="bold" className="text-sky-600" />
                              <span>Historical Precedent (Knowledge Base)</span>
                            </div>
                            <div className="text-[13px] text-slate-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      // Risk Alert Block
                      if (text.includes("[Risk]")) {
                        return (
                          <div className="my-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-[11px] mb-1 uppercase tracking-wider">
                              <WarningCircle size={13} weight="bold" className="text-amber-600" />
                              <span>Campaign Risk Alert</span>
                            </div>
                            <div className="text-[13px] text-slate-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      // Recommendation Block
                      if (text.includes("[Recommendation]")) {
                        return (
                          <div className="my-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-emerald-900 font-semibold text-[11px] mb-1 uppercase tracking-wider">
                              <Check size={13} weight="bold" className="text-emerald-600" />
                              <span>Recommendation</span>
                            </div>
                            <div className="text-[13px] text-slate-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      // Human Sign-off Policy Guard Block
                      if (text.includes("[PENDING_HUMAN_SIGN_OFF]")) {
                        return (
                          <div className="my-2.5 p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-rose-900 font-semibold text-[11px] mb-1 uppercase tracking-wider">
                              <ShieldWarning size={13} weight="bold" className="text-rose-600" />
                              <span>Compliance & Policy Gate: Human Sign-Off Required</span>
                            </div>
                            <div className="text-[13px] text-slate-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      return <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-700">{children}</p>;
                    },
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 mb-2.5 space-y-1 text-slate-700">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 mb-2.5 space-y-1 text-slate-700">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-[13.5px] leading-relaxed text-slate-700">{children}</li>
                    ),
                    strong: ({ children }) => {
                      const str = parseTextContent(children);
                      // Highlight Domain SPOCs
                      if (str.includes("Sachin")) {
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 mx-0.5">
                            {children}
                          </span>
                        );
                      }
                      if (str.includes("Khaleel")) {
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 mx-0.5">
                            {children}
                          </span>
                        );
                      }
                      if (str.includes("CS Heads") || str.includes("Client Servicing")) {
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold bg-pink-50 text-pink-800 border border-pink-200 mx-0.5">
                            {children}
                          </span>
                        );
                      }
                      if (str.includes("Prashant")) {
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 mx-0.5">
                            {children}
                          </span>
                        );
                      }
                      return (
                        <strong className="text-slate-900 font-semibold">
                          {children}
                        </strong>
                      );
                    },
                    em: ({ children }) => (
                      <em className="text-indigo-600 font-medium not-italic">{children}</em>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      if (isBlock) {
                        return (
                          <div className="my-2 rounded-xl bg-slate-900 p-3.5 border border-slate-800 overflow-x-auto text-xs font-mono text-slate-100">
                            <code className={className}>{children}</code>
                          </div>
                        );
                      }
                      return (
                        <code className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-xs border border-slate-200">
                          {children}
                        </code>
                      );
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-3 rounded-xl border border-slate-200 bg-white shadow-xs">
                        <table className="w-full text-xs text-left">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="px-3.5 py-2.5 bg-slate-50 font-semibold text-slate-900 border-b border-slate-200">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3.5 py-2.5 border-b border-slate-100 text-slate-700">
                        {children}
                      </td>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            {/* 1-Click Copy Button */}
            {!isUser && message.content && (
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100 border border-slate-200 shadow-2xs cursor-pointer"
                title="Copy response"
              >
                {copied ? (
                  <Check size={13} weight="bold" className="text-emerald-600" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </ErrorBoundary>
  );
}
