'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Bot, User, Loader2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, Tenant } from '@/types';
import { SourceBadge } from '@/components/ui/SourceBadge';

type IntelligenceStreamProps = {
  messages: Message[];
  isLoading: boolean;
  activeTenant: Tenant;
  copiedId: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onCopy: (id: string, text: string) => void;
};

export function IntelligenceStream({
  messages,
  isLoading,
  activeTenant,
  copiedId,
  messagesEndRef,
  onCopy
}: IntelligenceStreamProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Stream Header */}
      <header className="px-6 py-3.5 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-800">
            Intelligence Stream
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500">
          <span>
            Tenant: <span className="font-semibold text-slate-900">{activeTenant.slug}</span>
          </span>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex justify-start ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex space-x-3.5 max-w-[90%] sm:max-w-[85%] ${
                  msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1 shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-[#0f172a] text-white border border-slate-700'
                      : 'bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 text-indigo-300 border border-slate-700/40 shadow-xs'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-slate-200" />
                  ) : (
                    <Bot className="w-4 h-4 text-indigo-300" />
                  )}
                </div>

                {/* Message Bubble Chassis */}
                <div
                  className={`relative p-5 rounded-2xl transition-all shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-xs shadow-md'
                      : 'bg-white border border-slate-200/90 text-slate-900 rounded-tl-xs hover:border-slate-300'
                  }`}
                >
                  {/* Markdown Content */}
                  <div
                    className={`prose prose-sm max-w-none break-words text-[13.5px] leading-relaxed ${
                      msg.role === 'user' ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        table: ({ ...props }) => (
                          <div className="overflow-x-auto my-3 rounded-xl border border-slate-200">
                            <table
                              className="min-w-full text-xs text-left divide-y divide-slate-200"
                              {...props}
                            />
                          </div>
                        ),
                        thead: ({ ...props }) => (
                          <thead className="bg-slate-50 font-semibold text-slate-900" {...props} />
                        ),
                        th: ({ ...props }) => <th className="px-3 py-2 text-slate-900 font-semibold" {...props} />,
                        td: ({ ...props }) => <td className="px-3 py-2 text-slate-700 border-t border-slate-100" {...props} />,
                        p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                        strong: ({ ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                        code: ({ className, ...props }: React.ComponentPropsWithoutRef<'code'>) => {
                          const match = /language-(\w+)/.exec(className || '');
                          return !match ? (
                            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-mono border border-slate-200" {...props} />
                          ) : (
                            <code className={className} {...props} />
                          );
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {/* Message Meta Citation Footer */}
                  <div className="mt-3.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-3">
                      <span>{msg.timestamp || 'Just now'}</span>
                      {msg.sourceBadges && msg.sourceBadges.length > 0 && (
                        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                          {msg.sourceBadges.map((badge, bIdx) => (
                            <SourceBadge key={bIdx} label={badge} />
                          ))}
                        </div>
                      )}
                    </div>

                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => onCopy(msg.id, msg.content)}
                        className="hover:text-slate-700 text-slate-400 text-xs flex items-center transition-colors font-mono"
                        title="Copy message content"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 mr-1 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 mr-1 text-slate-400" />
                        )}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Synthesizing Pulse */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start space-x-3.5 max-w-[85%]"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-center justify-center mt-1 shadow-xs border border-indigo-500/30">
              <Bot className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-indigo-200/80 rounded-tl-xs flex items-center space-x-3 text-xs text-indigo-900 shadow-xs">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="font-mono font-medium">
                Synthesizing SharePoint, Dynamics 365 & Outlook...
              </span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
