"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { PaperPlaneTilt, StopCircle, Microphone } from "@phosphor-icons/react";

interface ChatInputProps {
  onSendMessage?: (message: string) => void;
  onSend?: (message: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

const DRAFT_STORAGE_KEY = "prism_copilot_draft_input";

export default function ChatInput({
  onSendMessage,
  onSend,
  onStop,
  isLoading,
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore draft from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) setInput(saved);
    } catch {}
  }, []);

  // Sync draft to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (input.trim()) {
        localStorage.setItem(DRAFT_STORAGE_KEY, input);
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {}
  }, [input]);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 160;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
    }
    if (onSendMessage) onSendMessage(trimmed);
    else if (onSend) onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Web Speech API
  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    if (!isListening) {
      setIsListening(true);
      recognition.start();
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    } else {
      recognition.stop();
      setIsListening(false);
    }
  };

  return (
    <div className="relative flex items-end gap-2 bg-white border border-slate-300/90 rounded-2xl p-2.5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.08)] transition-all duration-200 focus-within:border-indigo-500 focus-within:ring-3 focus-within:ring-indigo-500/15">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask BCP Assist about briefs, deals, documents, or SOP precedents..."
        rows={1}
        disabled={disabled}
        className="flex-1 bg-transparent text-[13.5px] text-slate-900 placeholder:text-slate-400 resize-none outline-none leading-relaxed max-h-40 px-2 py-1.5 disabled:opacity-40 font-normal"
      />

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Voice Input Button */}
        <button
          type="button"
          onClick={toggleVoice}
          className={`p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ${
            isListening ? "text-rose-600 bg-rose-50 animate-pulse" : ""
          }`}
          title="Voice input"
        >
          <Microphone size={16} weight={isListening ? "fill" : "regular"} />
        </button>

        {/* Send / Stop Button */}
        {isLoading ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
            title="Stop generation"
          >
            <StopCircle size={16} weight="fill" />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Send message"
          >
            <PaperPlaneTilt size={14} weight="bold" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
