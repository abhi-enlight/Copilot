"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { PaperPlaneTilt, StopCircle, Microphone } from "@phosphor-icons/react";

import { useAuth } from "@/components/providers/AuthProvider";
import { getDraftKey } from "@/lib/copilot-storage";

interface ChatInputProps {
  onSendMessage?: (message: string) => void;
  onSend?: (message: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function ChatInput({
  onSendMessage,
  onSend,
  onStop,
  isLoading,
  disabled = false,
}: ChatInputProps) {
  const { user } = useAuth();
  const draftKey = getDraftKey(user?.id);

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Value last restored from localStorage. The sync effect skips writes while
  // input still equals it, so the restore pass can't be clobbered by the
  // initial "" render before setInput applies.
  const lastRestoredRef = useRef<string | null>(null);

  // Restore draft from localStorage when user/key changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      lastRestoredRef.current = saved || "";
      setInput(saved || "");
    } catch {}
  }, [draftKey]);

  // Sync draft to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (input === lastRestoredRef.current) return;
    try {
      if (input.trim()) {
        localStorage.setItem(draftKey, input);
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {}
  }, [input, draftKey]);

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
        localStorage.removeItem(draftKey);
      } catch {}
    }
    lastRestoredRef.current = "";
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

  const hasContent = input.trim().length > 0;

  return (
    <div
      className={`relative flex items-end gap-2 bg-white rounded-2xl p-2 transition-all duration-200 ${
        isFocused
          ? "shadow-[0_0_0_2px_rgba(124,58,237,0.18),0_4px_24px_-4px_rgba(124,58,237,0.12)]  ring-0 border border-violet-300/80"
          : "shadow-[0_2px_16px_-2px_rgba(15,23,42,0.07),0_0_0_1px_rgba(15,23,42,0.07)] border border-transparent"
      }`}
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Ask anything about your briefs, deals, mail, or SOPs…"
        rows={1}
        disabled={disabled}
        className="flex-1 bg-transparent text-[13.5px] text-stone-900 placeholder:text-stone-400 resize-none outline-none leading-relaxed max-h-40 px-2 py-1.5 disabled:opacity-40 font-normal"
      />

      <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
        {/* Voice Input Button */}
        <button
          type="button"
          onClick={toggleVoice}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            isListening
              ? "text-rose-600 bg-rose-50 animate-pulse"
              : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
          }`}
          title="Voice input"
        >
          <Microphone size={15} weight={isListening ? "fill" : "regular"} />
        </button>

        {/* Send / Stop Button */}
        {isLoading ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 border border-stone-200 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-xs cursor-pointer"
            title="Stop generation"
          >
            <StopCircle size={15} weight="fill" />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: hasContent ? 1.06 : 1 }}
            whileTap={{ scale: hasContent ? 0.94 : 1 }}
            onClick={handleSubmit}
            disabled={!hasContent || disabled}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              hasContent
                ? "bg-gradient-to-br from-violet-600 to-violet-700 text-white shadow-[0_2px_8px_-1px_rgba(124,58,237,0.4)] hover:shadow-[0_4px_12px_-2px_rgba(124,58,237,0.5)]"
                : "bg-stone-100 text-stone-300 cursor-not-allowed"
            }`}
            title="Send message"
          >
            <PaperPlaneTilt size={14} weight="bold" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
