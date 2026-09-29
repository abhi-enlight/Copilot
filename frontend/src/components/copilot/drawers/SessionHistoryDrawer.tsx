"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Plus,
  ChatCircle,
  Trash,
  Clock,
  SpinnerGap,
  FolderSimple,
} from "@phosphor-icons/react";
import type { ChatSessionRow } from "@/types/database";
import { useToast } from "@/hooks/useToast";

interface SessionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  currentSessionId: string | null;
}

export default function SessionHistoryDrawer({
  isOpen,
  onClose,
  onSelectSession,
  onNewSession,
  currentSessionId,
}: SessionHistoryDrawerProps) {
  const toast = useToast();
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const isLoading = !hasLoaded;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      fetch("/api/chat/sessions")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!ignore && data?.sessions) {
            setSessions(data.sessions);
          }
        })
        .catch((err) => {
          console.warn("[SessionHistoryDrawer] fetch error:", err);
        })
        .finally(() => {
          if (!ignore) setHasLoaded(true);
        });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirmDeleteId !== sessionId) {
      setConfirmDeleteId(sessionId);
      setTimeout(() => setConfirmDeleteId((prev) => (prev === sessionId ? null : prev)), 3000);
      return;
    }

    setConfirmDeleteId(null);
    setDeletingId(sessionId);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        toast.success("Session deleted", "The conversation has been removed.");
        if (currentSessionId === sessionId) {
          onNewSession();
        }
      } else {
        toast.error("Could not delete this session. Please try again.");
      }
    } catch (err) {
      console.warn("[SessionHistoryDrawer] delete error:", err);
      toast.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatSessionDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Session History"
          className="fixed inset-0 z-50 flex justify-start"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] cursor-pointer"
          />

          {/* Drawer Body (Left Slide) */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative w-full max-w-sm bg-white border-r border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.06)] h-full flex flex-col z-10 font-[family-name:var(--font-geist-sans)]"
          >
            {/* Header */}
            <div className="p-5 border-b border-black/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FolderSimple size={18} weight="bold" className="text-stone-800" />
                <h3 className="text-[14px] font-semibold text-stone-900 tracking-tight">
                  Session History
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close session history"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* New Session Action */}
            <div className="p-3 border-b border-black/[0.05]">
              <button
                type="button"
                onClick={() => {
                  onNewSession();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-150 active:scale-[0.98] cursor-pointer"
              >
                <Plus size={14} weight="bold" />
                <span>Start New Session</span>
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 prism-scroll">
              {isLoading && sessions.length === 0 ? (
                <div className="space-y-2 p-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-4 h-4 rounded-full animate-shimmer flex-shrink-0" />
                        <div className="w-3/4 h-3.5 rounded-md animate-shimmer" />
                      </div>
                      <div className="w-12 h-3 rounded-md animate-shimmer flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-16 text-center text-stone-400 px-4">
                  <Clock size={24} weight="light" className="mx-auto mb-2 text-stone-300" />
                  <p className="text-xs font-medium text-stone-600">No archived sessions</p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Your conversations across Outlook, Teams, and CRM are saved here automatically.
                  </p>
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = currentSessionId === s.id;
                  const isDeleting = deletingId === s.id;

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        onSelectSession(s.id);
                        onClose();
                      }}
                      className={`group w-full text-left p-3 rounded-xl transition-all duration-150 cursor-pointer flex items-start justify-between gap-2 border ${
                        isActive
                          ? "bg-stone-100 border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                          : "bg-white border-transparent hover:bg-stone-50 hover:border-black/[0.04]"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <ChatCircle
                          size={15}
                          weight={isActive ? "fill" : "regular"}
                          className={`mt-0.5 flex-shrink-0 ${
                            isActive ? "text-indigo-600" : "text-stone-400 group-hover:text-stone-600"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[12.5px] font-medium text-stone-900 truncate leading-snug">
                            {s.title || "Untitled Briefing"}
                          </h4>
                          <span className="text-[10.5px] text-stone-400 font-mono">
                            {formatSessionDate(s.updated_at || s.created_at)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        title="Delete session"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer flex-shrink-0"
                      >
                        {isDeleting ? (
                          <SpinnerGap size={13} className="animate-spin" />
                        ) : (
                          <Trash size={13} />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-black/[0.05] bg-stone-50/80 text-center text-[10.5px] text-stone-400">
              Encrypted session history stored in PostgreSQL
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
