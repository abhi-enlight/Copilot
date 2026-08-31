'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  Send, Bot, User, Loader2, Sparkles, ShieldCheck, Mail, 
  Briefcase, FileText, ArrowUpRight, CheckCircle2, ChevronRight,
  Copy, Check, Terminal, Zap, Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sourceBadges?: string[];
  timestamp?: string;
};

export default function OperationsCockpitPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Operations Copilot is active and connected to your enterprise endpoints:\n\n- **Microsoft SharePoint**: Microsoft Graph `/sites` root drive.\n- **Dynamics 365 CRM**: Dataverse Web API v9.2 (`org98ee0c24.crm8.dynamics.com`).\n- **Outlook & Calendar**: Mailbox `dj@enlightlab.com`.\n\nEnter a query below to retrieve data across these services.',
      sourceBadges: ['SharePoint', 'Dynamics 365', 'Outlook'],
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Global ⌘K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  // Helper to remove any emojis from text
  const cleanEmoji = (text: string) => {
    return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}\u{2B05}-\u{2B07}\u{2934}-\u{2935}\u{2190}-\u{21FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, '').trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://indigo-pelican-266513.hostingersite.com/webhook/b1c82c64-895a-4c9a-bad9-1b415aefa8dd/chat';
      
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: userText, sessionId: 'session-cockpit-1' })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      let aiResponse = data.output || data.response || data.message || data.text || (typeof data === 'string' ? data : JSON.stringify(data));
      aiResponse = cleanEmoji(aiResponse);
      
      const badges: string[] = [];
      if (/sharepoint|contract|msa|pdf|sop/i.test(aiResponse)) badges.push('SharePoint');
      if (/dynamics|crm|deal|opportunity|pipeline/i.test(aiResponse)) badges.push('Dynamics 365');
      if (/outlook|email|calendar|meeting/i.test(aiResponse)) badges.push('Outlook');

      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: aiResponse,
        sourceBadges: badges.length > 0 ? badges : ['Unified Copilot'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (error) {
      console.error('Error calling n8n:', error);
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: 'Error communicating with n8n workflow. Please check webhook configuration.',
          sourceBadges: ['System'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }, 900);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 font-sans flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8">
      
      {/* Background Soft Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[10%] w-[500px] h-[500px] rounded-full bg-indigo-200/30 blur-[140px]" />
        <div className="absolute bottom-[-5%] right-[10%] w-[500px] h-[500px] rounded-full bg-sky-200/30 blur-[140px]" />
      </div>

      {/* Main Hardware Cockpit Container (Double-Bezel) */}
      <div className="w-full max-w-7xl h-[92vh] flex flex-col md:flex-row bg-slate-900/[0.03] ring-1 ring-slate-900/5 p-2 rounded-[2rem] shadow-2xl shadow-slate-900/5 relative z-10 overflow-hidden">
        
        {/* ============================================================ */}
        {/* LEFT PANE: LIVE ENTERPRISE HUD & TELEMETRY */}
        {/* ============================================================ */}
        <aside className="w-full md:w-80 lg:w-96 flex flex-col bg-white/70 backdrop-blur-xl border-r border-slate-200/70 rounded-2xl p-5 justify-between">
          
          <div className="space-y-6">
            
            {/* Logo & Header */}
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/10">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">Operations Cockpit</h2>
              </div>
            </div>

            {/* Telemetry Sources Grid - Real Endpoints */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Connected Sources</span>
                <span className="text-[11px] font-mono text-slate-400">3 / 3 Active</span>
              </div>

              {/* 1. SharePoint */}
              <div className="p-3 bg-white/80 border border-slate-200/60 rounded-xl shadow-xs hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-slate-800">SharePoint Library</span>
                  </div>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                  <span>Graph Endpoint</span>
                  <span className="text-slate-700 font-semibold">/sites/root/drive</span>
                </div>
              </div>

              {/* 2. Dynamics 365 CRM */}
              <div className="p-3 bg-white/80 border border-slate-200/60 rounded-xl shadow-xs hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-slate-800">Dynamics 365 CRM</span>
                  </div>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                  <span>Dataverse Org</span>
                  <span className="text-slate-900 font-semibold">org98ee0c24</span>
                </div>
              </div>

              {/* 3. Outlook & Calendar */}
              <div className="p-3 bg-white/80 border border-slate-200/60 rounded-xl shadow-xs hover:border-indigo-300 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-semibold text-slate-800">Outlook & Calendar</span>
                  </div>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                  <span>Mailbox User</span>
                  <span className="text-slate-700 font-semibold">dj@enlightlab.com</span>
                </div>
              </div>
            </div>

            {/* Quick Prompts Drawer */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</span>
              <div className="flex flex-col space-y-1.5">
                <button 
                  onClick={() => handleQuickAction("Search SharePoint root drive for active contract and SOP files")}
                  className="text-left text-xs p-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50/80 hover:text-indigo-900 text-slate-600 transition-all border border-slate-200/50 flex items-center justify-between group"
                >
                  <span className="flex items-center"><Zap className="w-3.5 h-3.5 text-indigo-600 mr-1.5" /> Search SharePoint Documents</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button 
                  onClick={() => handleQuickAction("Fetch recent Outlook emails received for dj@enlightlab.com")}
                  className="text-left text-xs p-2.5 rounded-lg bg-slate-50 hover:bg-sky-50/80 hover:text-sky-900 text-slate-600 transition-all border border-slate-200/50 flex items-center justify-between group"
                >
                  <span className="flex items-center"><Inbox className="w-3.5 h-3.5 text-sky-600 mr-1.5" /> Fetch Outlook Inbox</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

          </div>



        </aside>

        {/* ============================================================ */}
        {/* RIGHT PANE: INTERACTIVE CHAT STREAM & HARDWARE INPUT */}
        {/* ============================================================ */}
        <main className="flex-1 flex flex-col bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden relative">
          
          {/* Stream Header */}
          <header className="px-6 py-4 border-b border-slate-100 bg-white/50 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Intelligence Stream</h3>
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">⌘K Focus</span>
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[85%] space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                    
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1 shadow-xs ${
                      msg.role === 'user' 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-gradient-to-tr from-indigo-600 to-blue-600 text-white'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Message Bubble Card */}
                    <div className="space-y-1.5">
                      <div className={`p-4 rounded-2xl text-[14.5px] leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-xs'
                          : 'bg-slate-50/90 text-slate-800 border border-slate-200/70 rounded-tl-xs'
                      }`}>
                        
                        {/* Source Badges */}
                        {msg.sourceBadges && msg.sourceBadges.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2.5 pb-2 border-b border-slate-200/50">
                            {msg.sourceBadges.map((badge, idx) => (
                              <span key={idx} className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200/60 shadow-2xs flex items-center">
                                <span className="w-1 h-1 rounded-full bg-indigo-500 mr-1" />
                                {badge}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Markdown Rendered Content */}
                        <div className="prose prose-slate prose-sm max-w-none text-slate-800">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-[13.5px]">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2 text-[13.5px]">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-2 text-[13.5px]">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                              h1: ({ children }) => <h1 className="text-lg font-bold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold text-slate-900 mt-3.5 mb-1.5">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1.5">{children}</h3>,
                              h4: ({ children }) => <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mt-2.5 mb-1">{children}</h4>,
                              hr: () => <hr className="my-3.5 border-slate-200" />,
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-3 border-indigo-500 pl-3 py-1.5 my-2.5 bg-indigo-50/50 rounded-r-lg text-slate-700 text-xs italic">
                                  {children}
                                </blockquote>
                              ),
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-3.5 rounded-xl border border-slate-200/90 shadow-2xs bg-white">
                                  <table className="min-w-full divide-y divide-slate-200/80 text-left border-collapse">
                                    {children}
                                  </table>
                                </div>
                              ),
                              thead: ({ children }) => (
                                <thead className="bg-slate-100/90 text-slate-800 text-[11px] font-bold uppercase tracking-wider">
                                  {children}
                                </thead>
                              ),
                              tbody: ({ children }) => (
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {children}
                                </tbody>
                              ),
                              tr: ({ children }) => (
                                <tr className="hover:bg-slate-50/80 transition-colors">
                                  {children}
                                </tr>
                              ),
                              th: ({ children }) => (
                                <th className="px-3.5 py-2.5 font-semibold text-slate-800 align-middle">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="px-3.5 py-2.5 text-slate-700 text-[12.5px] leading-relaxed align-top">
                                  {children}
                                </td>
                              ),
                              code: ({ children }) => (
                                <code className="px-1.5 py-0.5 rounded bg-slate-200/70 text-indigo-700 font-mono text-[12px]">
                                  {children}
                                </code>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>

                      {/* Message Footer Meta */}
                      <div className="flex items-center space-x-2 px-1 text-[11px] text-slate-400">
                        <span>{msg.timestamp}</span>
                        {msg.role === 'assistant' && (
                          <button 
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="hover:text-slate-600 flex items-center transition-colors"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-600 mr-0.5" />
                            ) : (
                              <Copy className="w-3 h-3 mr-0.5" />
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

            {/* Deliberation Loading Pulse */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start space-x-3 max-w-[85%]"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center mt-1 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 rounded-tl-xs flex items-center space-x-3 text-xs text-slate-600">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span>Synthesizing SharePoint, Dynamics 365 & Outlook...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Hardware Input Bar */}
          <div className="p-4 bg-white/70 border-t border-slate-100">
            <form onSubmit={handleSubmit} className="relative flex items-center max-w-4xl mx-auto">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about SharePoint files, Dynamics CRM deals, or Outlook emails... (⌘K)"
                className="w-full bg-slate-50/90 border border-slate-200/90 rounded-2xl pl-5 pr-14 py-4 text-[14.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                disabled={isLoading}
              />
              
              {/* Button-in-Button Trailing Action */}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-40 flex items-center justify-center shadow-md shadow-indigo-600/10 group active:scale-[0.96]"
              >
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
              </button>
            </form>
          </div>

        </main>
      </div>

    </div>
  );
}
