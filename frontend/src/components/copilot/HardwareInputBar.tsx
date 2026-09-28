"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Square,
  Microphone,
  MicrophoneSlash,
  EnvelopeSimple,
  ChatsCircle,
  ChatCircleText,
  Kanban,
  Briefcase,
} from "@phosphor-icons/react";

interface HardwareInputBarProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (textToSend?: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

const TOOL_CHIPS = [
  { label: "@Outlook", slug: "outlook", icon: EnvelopeSimple, color: "text-sky-600 bg-sky-50 border-sky-200" },
  { label: "@Teams", slug: "teams", icon: ChatsCircle, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { label: "@Slack", slug: "slack", icon: ChatCircleText, color: "text-rose-600 bg-rose-50 border-rose-200" },
  { label: "@Linear", slug: "linear", icon: Kanban, color: "text-violet-600 bg-violet-50 border-violet-200" },
  { label: "@Zoho", slug: "zoho", icon: Briefcase, color: "text-amber-600 bg-amber-50 border-amber-200" },
];

export default function HardwareInputBar({
  input,
  setInput,
  onSubmit,
  isLoading,
  onStop,
  inputRef: externalInputRef,
}: HardwareInputBarProps) {
  const [isListening, setIsListening] = useState(false);
  const internalInputRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = (externalInputRef || internalInputRef) as React.RefObject<HTMLTextAreaElement>;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 160);
    el.style.height = `${Math.max(44, nextHeight)}px`;
  }, [input, textareaRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleChipClick = (chipLabel: string) => {
    const current = input.trim();
    if (current.includes(chipLabel)) return;
    const next = current ? `${chipLabel} ${current}` : `${chipLabel} `;
    setInput(next);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Web Speech API Voice Toggle
  const toggleVoice = () => {
    if (typeof window === "undefined") return;

    type SpeechEvent = { results: { [key: number]: { [key: number]: { transcript: string } } } };
    type SpeechRecognitionInstance = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: ((event: SpeechEvent) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    };
    type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser.");
      return;
    }

    if (!isListening) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      setIsListening(true);
      recognition.start();

      recognition.onresult = (event: SpeechEvent) => {
        const transcript = event.results[0][0].transcript;
        setInput(input ? `${input} ${transcript}` : transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    } else {
      setIsListening(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 pt-1">
      {/* Outer Chassis */}
      <div className="rounded-2xl p-1.5 bg-slate-100/80 border border-slate-200/90 shadow-lg shadow-slate-900/5 transition-all focus-within:border-slate-300 focus-within:shadow-xl">
        {/* Inner Card Core */}
        <div className="rounded-xl bg-white border border-slate-200/60 p-2.5 flex flex-col gap-2">
          {/* Tool Context Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            <span className="text-slate-400 font-medium px-1 flex-shrink-0">Direct to:</span>
            {TOOL_CHIPS.map((chip) => {
              const Icon = chip.icon;
              const isSelected = input.includes(chip.label);
              return (
                <button
                  key={chip.slug}
                  type="button"
                  onClick={() => handleChipClick(chip.label)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border transition cursor-pointer flex-shrink-0 ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-xs"
                      : `${chip.color} hover:opacity-90`
                  }`}
                >
                  <Icon size={12} weight="bold" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Text Input Row */}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Prism to review emails, post team updates, or update CRM deals…"
              rows={1}
              className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none p-1.5 leading-relaxed min-h-[44px] max-h-[160px] font-sans"
            />

            {/* Actions: Voice Dictation + Send/Stop */}
            <div className="flex items-center gap-1.5 pb-1 flex-shrink-0">
              <button
                type="button"
                onClick={toggleVoice}
                title={isListening ? "Listening…" : "Voice dictation"}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  isListening
                    ? "bg-rose-50 text-rose-600 border-rose-200 animate-pulse"
                    : "bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 border-slate-200/60"
                }`}
              >
                {isListening ? (
                  <MicrophoneSlash size={16} weight="bold" />
                ) : (
                  <Microphone size={16} weight="bold" />
                )}
              </button>

              {isLoading ? (
                <button
                  type="button"
                  onClick={onStop}
                  title="Stop generating"
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <Square size={14} weight="fill" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!input.trim()}
                  onClick={() => onSubmit()}
                  title="Send to Prism"
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 transition-all"
                >
                  <ArrowUp size={14} weight="bold" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-1.5 text-center text-[10.5px] text-slate-400">
        Prism autonomous AI employee · Press <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[9px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[9px]">Shift+Enter</kbd> for newline
      </div>
    </div>
  );
}
