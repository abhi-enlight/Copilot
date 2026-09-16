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
import EmailDraftCard, { EmailDraftData } from "./EmailDraftCard";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function extractEmailDrafts(text: string): { drafts: EmailDraftData[]; contentWithoutDrafts: string } {
  const drafts: EmailDraftData[] = [];
  const regex = /(?:```(?:json)?\s*)?\[EMAIL_DRAFT\]([\s\S]*?)\[\/EMAIL_DRAFT\](?:\s*```)?/gi;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const rawBlock = match[1].trim();
    try {
      const parsed = JSON.parse(rawBlock);
      if (parsed && (parsed.to || parsed.subject || parsed.body)) {
        drafts.push({
          to: parsed.to || "",
          cc: parsed.cc,
          subject: parsed.subject || "",
          body: parsed.body || "",
          campaignId: parsed.campaignId,
        });
      }
    } catch {
      const toMatch = rawBlock.match(/to:\s*([^\n\r]+)/i);
      const ccMatch = rawBlock.match(/cc:\s*([^\n\r]+)/i);
      const subjectMatch = rawBlock.match(/subject:\s*([^\n\r]+)/i);
      const bodyMatch = rawBlock.match(/body:\s*([\s\S]*)/i);

      if (toMatch || subjectMatch || bodyMatch) {
        drafts.push({
          to: toMatch ? toMatch[1].trim() : "",
          cc: ccMatch ? ccMatch[1].trim() : undefined,
          subject: subjectMatch ? subjectMatch[1].trim() : "",
          body: bodyMatch ? bodyMatch[1].trim() : "",
        });
      }
    }
  }

  const contentWithoutDrafts = text.replace(regex, "").trim();
  return { drafts, contentWithoutDrafts };
}

interface ChatMessageProps {
  message: Message;
  index: number;
}

export default function ChatMessage({ message, index }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const cleanContent = isUser
    ? message.content
    : message.content
        .replace(/^Calling tools?:[^\n\r]+(\r?\n)?/gi, "")
        .replace(/^Calling tools?:\s*[\s\S]*?(?=(?:I am|[A-Z][a-z]+))/gi, "")
        .trim();

  const { drafts, contentWithoutDrafts } = !isUser
    ? extractEmailDrafts(cleanContent)
    : { drafts: [], contentWithoutDrafts: cleanContent };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contentWithoutDrafts || cleanContent);
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.28,
          delay: index < 5 ? index * 0.04 : 0,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={`flex gap-3 max-w-3xl w-full group ${
          isUser ? "ml-auto flex-row-reverse" : ""
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
            isUser
              ? "bg-stone-800 text-white"
              : "bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-sm"
          }`}
        >
          {isUser ? (
            <User size={13} weight="bold" />
          ) : (
            <Robot size={13} weight="bold" />
          )}
        </div>

        {/* Message Body */}
        <div
          className={`flex flex-col gap-1 max-w-[88%] min-w-0 ${
            isUser ? "items-end" : "items-start"
          }`}
        >
          {/* Author & Timestamp */}
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-[11px] font-semibold text-stone-400">
              {isUser ? "You" : "Prism"}
            </span>
            <span className="text-[10px] text-stone-300 tabular-nums">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Message Card */}
          <div
            className={`relative text-[0.9rem] leading-relaxed transition-all break-words max-w-full overflow-hidden ${
              isUser
                ? "bg-stone-900 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm"
                : "text-stone-800 rounded-2xl rounded-tl-sm"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap font-normal text-stone-100 break-words">{message.content}</p>
            ) : (
              <div className="chat-content text-stone-700 break-words max-w-full overflow-hidden">
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

                      if (!cleanText && (
                        text.includes("[Confirmed Information]") ||
                        text.includes("[Historical Precedent]") ||
                        text.includes("[Risk]") ||
                        text.includes("[Recommendation]") ||
                        text.includes("[PENDING_HUMAN_SIGN_OFF]")
                      )) {
                        return null;
                      }

                      if (text.includes("[Confirmed Information]")) {
                        return (
                          <div className="my-2 p-3 rounded-xl bg-sky-50/60 border border-sky-200/70">
                            <div className="flex items-center gap-1.5 text-sky-700 font-semibold text-[10.5px] mb-1 uppercase tracking-wider">
                              <BookmarkSimple size={12} weight="bold" className="text-sky-500" />
                              <span>Confirmed Information</span>
                            </div>
                            <div className="text-[13px] text-stone-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      if (text.includes("[Historical Precedent]")) {
                        return (
                          <div className="my-2 p-3 rounded-xl bg-sky-50/60 border border-sky-200/70">
                            <div className="flex items-center gap-1.5 text-sky-700 font-semibold text-[10.5px] mb-1 uppercase tracking-wider">
                              <Sparkle size={12} weight="bold" className="text-sky-500" />
                              <span>Historical Precedent</span>
                            </div>
                            <div className="text-[13px] text-stone-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      if (text.includes("[Risk]")) {
                        return (
                          <div className="my-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
                            <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-[10.5px] mb-1 uppercase tracking-wider">
                              <WarningCircle size={12} weight="bold" className="text-amber-500" />
                              <span>Risk Alert</span>
                            </div>
                            <div className="text-[13px] text-stone-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      if (text.includes("[Recommendation]")) {
                        return (
                          <div className="my-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[10.5px] mb-1 uppercase tracking-wider">
                              <Check size={12} weight="bold" className="text-emerald-500" />
                              <span>Recommendation</span>
                            </div>
                            <div className="text-[13px] text-stone-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      if (text.includes("[PENDING_HUMAN_SIGN_OFF]")) {
                        return (
                          <div className="my-2 p-3 rounded-xl bg-rose-50/60 border border-rose-200/70">
                            <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-[10.5px] mb-1 uppercase tracking-wider">
                              <ShieldWarning size={12} weight="bold" className="text-rose-500" />
                              <span>Human Sign-Off Required</span>
                            </div>
                            <div className="text-[13px] text-stone-700 leading-relaxed font-normal">
                              {cleanText || children}
                            </div>
                          </div>
                        );
                      }

                      return <p className="mb-2 last:mb-0 leading-[1.7] text-stone-700">{children}</p>;
                    },
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 mb-2 space-y-1 text-stone-700">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 mb-2 space-y-1 text-stone-700">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-[13.5px] leading-relaxed text-stone-700">{children}</li>
                    ),
                    strong: ({ children }) => {
                      const str = parseTextContent(children);
                      if (str.includes("Sachin")) {
                        return (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11.5px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 mx-0.5">
                            {children}
                          </span>
                        );
                      }
                      if (str.includes("Khaleel")) {
                        return (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 mx-0.5">
                            {children}
                          </span>
                        );
                      }
                      if (str.includes("CS Heads") || str.includes("Client Servicing")) {
                        return (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11.5px] font-semibold bg-pink-50 text-pink-800 border border-pink-200 mx-0.5">
                            {children}
                          </span>
                        );
                      }
                      if (str.includes("Prashant")) {
                        return (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11.5px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 mx-0.5">
                            {children}
                          </span>
                        );
                      }
                      return (
                        <strong className="text-stone-900 font-semibold">
                          {children}
                        </strong>
                      );
                    },
                    em: ({ children }) => (                        <em className="text-sky-600 font-medium not-italic">{children}</em>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      if (isBlock) {
                        return (
                          <div className="my-2 rounded-xl bg-stone-950 p-3.5 border border-stone-800 overflow-x-auto text-xs font-mono text-stone-200">
                            <code className={className}>{children}</code>
                          </div>
                        );
                      }
                      return (
                        <code className="px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 font-mono text-xs border border-sky-100">
                          {children}
                        </code>
                      );
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-3 rounded-xl border border-stone-200 bg-white shadow-xs">
                        <table className="w-full text-xs text-left">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="px-3.5 py-2.5 bg-stone-50 font-semibold text-stone-800 border-b border-stone-200 text-[11.5px]">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3.5 py-2.5 border-b border-stone-100 text-stone-600">
                        {children}
                      </td>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:underline font-medium"
                      >
                        {children}
                      </a>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-base font-bold text-stone-900 mb-2 mt-3 first:mt-0">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-[14px] font-semibold text-stone-800 mb-1.5 mt-3 first:mt-0">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-[13px] font-semibold text-stone-700 mb-1 mt-2 first:mt-0">{children}</h3>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-sky-300 pl-3 my-2 text-stone-500 italic">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {contentWithoutDrafts}
                </ReactMarkdown>

                {drafts.length > 0 && (
                  <div className="mt-2 space-y-3 not-prose">
                    {drafts.map((draft, i) => (
                      <EmailDraftCard key={i} draft={draft} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 1-Click Copy Button */}
            {!isUser && cleanContent && (
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-lg text-stone-300 hover:text-stone-600 hover:bg-stone-100 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Copy response"
              >
                {copied ? (
                  <Check size={12} weight="bold" className="text-emerald-500" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </ErrorBoundary>
  );
}
