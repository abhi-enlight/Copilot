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
import { useToast } from "@/hooks/useToast";

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
  const toast = useToast();
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onerror: ((event: any) => void) | null;
      onend: (() => void) | null;
    };
    type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info("Voice Input Unavailable", "Voice speech recognition is not supported in this browser. You can type directly in the prompt bar.");
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event?.error && event.error !== "no-speech") {
          toast.error(event.error, { context: "speech" });
        }
      };
      recognition.onend = () => setIsListening(false);
    } else {
      setIsListening(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pb-5 pt-2">
      {/* Double-bezel outer chassis */}
      <div className="input-dock-outer">
        <div className="input-dock-inner">
          {/* Voice Listening Active Banner */}
          {isListening && (
            <div className="px-3.5 py-1.5 bg-rose-50/90 border-b border-rose-100 flex items-center justify-between text-xs text-rose-700 font-medium animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                </span>
                <span>Listening for voice input… speak now</span>
              </div>
              <button
                type="button"
                onClick={toggleVoice}
                className="text-[11px] font-semibold text-rose-800 hover:underline cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Text input row */}
          <div className="flex items-end gap-2 px-3 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Prism to review emails, post team updates, or update CRM deals…"
              aria-label="Message Prism Operations"
              rows={1}
              className="flex-1 bg-transparent border-0 resize-none text-sm text-stone-900 placeholder-stone-400 focus:outline-none leading-relaxed min-h-[44px] max-h-[160px] font-[family-name:var(--font-geist-sans)]"
            />

            {/* Actions: Voice Dictation + Send/Stop */}
            <div className="flex items-center gap-1.5 pb-1 flex-shrink-0">
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={isListening ? "Stop voice dictation" : "Start voice dictation"}
                title={isListening ? "Listening…" : "Voice dictation"}
                className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer ${
                  isListening
                    ? "bg-rose-50 text-rose-600 border-rose-200 animate-pulse"
                    : "text-stone-400 hover:text-stone-700 hover:bg-stone-50 border-stone-200/60"
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
                  aria-label="Stop generating response"
                  title="Stop generating"
                  className="w-9 h-9 rounded-full bg-stone-900 hover:bg-stone-800 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-150 active:scale-[0.92]"
                >
                  <Square size={14} weight="fill" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!input.trim()}
                  onClick={() => onSubmit()}
                  aria-label="Send message to Prism"
                  title="Send to Prism"
                  className="w-9 h-9 rounded-full bg-stone-900 hover:bg-stone-800 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.12)] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 active:scale-[0.92]"
                >
                  <ArrowUp size={14} weight="bold" />
                </button>
              )}
            </div>
          </div>

          {/* Tool chips row — BELOW input */}
          <div className="px-3 pb-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[11px] text-stone-400 font-medium flex-shrink-0">Focus:</span>
            {TOOL_CHIPS.map((chip) => {
              const Icon = chip.icon;
              const isSelected = input.includes(chip.label);
              return (
                <button
                  key={chip.slug}
                  type="button"
                  onClick={() => handleChipClick(chip.label)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border flex-shrink-0 cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "bg-stone-900 text-white border-stone-900"
                      : `font-medium hover:opacity-90 ${chip.color}`
                  }`}
                >
                  <Icon size={11} weight="bold" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hint text below the bezel */}
      <div className="mt-2 text-center text-[10.5px] text-stone-400">
        Prism autonomous AI ·{" "}
        <kbd className="px-1 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-500 font-mono text-[9px]">↵</kbd>{" "}
        send &nbsp;{" "}
        <kbd className="px-1 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-500 font-mono text-[9px]">⇧↵</kbd>{" "}
        newline
      </div>
    </div>
  );
}
