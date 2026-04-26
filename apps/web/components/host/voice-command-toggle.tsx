"use client";

import type { VoiceListeningMode } from "@interactive-presentation/types";

interface VoiceCommandToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  mode: VoiceListeningMode;
  onModeChange: (mode: VoiceListeningMode) => void;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  isListening: boolean;
  isSupported: boolean;
  isPushToListenActive?: boolean;
  confidence: number;
  onConfidenceChange: (value: number) => void;
  lastMatchedPhrase: string | null;
}

export function VoiceCommandToggle({
  enabled,
  onToggle,
  mode,
  onModeChange,
  muted,
  onMutedChange,
  isListening,
  isSupported,
  isPushToListenActive,
  confidence,
  onConfidenceChange,
  lastMatchedPhrase,
}: VoiceCommandToggleProps) {
  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-black/5 bg-black/5 px-4 py-2 text-xs font-medium soft-text">
        <span className="h-2 w-2 rounded-full bg-black/20" />
        Voice unavailable (Use Chrome/Edge)
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Match flash badge */}
      {lastMatchedPhrase && (
        <div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {lastMatchedPhrase}
        </div>
      )}

      {/* Main toggle button */}
      <button
        onClick={() => onToggle(!enabled)}
        className={`group relative flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 active:scale-95 ${
          enabled
            ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)]"
            : "border-black/10 bg-white/50 text-black/60 hover:bg-white hover:text-black"
        }`}
        type="button"
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
              enabled
                ? isListening
                  ? "bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                  : "bg-[var(--accent)]/40"
                : "bg-black/20"
            }`}
          />
          {enabled && isListening && (
            <span className="absolute h-4 w-4 animate-ping rounded-full bg-[var(--accent)]/20" />
          )}
        </div>
        <span className="tracking-tight">
          {enabled ? (isListening ? "Listening…" : "Mic paused") : "Voice off"}
        </span>

        {/* Tooltip */}
        <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 scale-95 whitespace-nowrap rounded-lg bg-black px-3 py-1.5 text-[11px] font-medium text-white opacity-0 transition-all group-hover:-top-11 group-hover:scale-100 group-hover:opacity-100 shadow-xl z-50">
          {enabled ? "Click to disable voice" : "Click to enable voice activation"}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-black" />
        </div>
      </button>

      {/* Sensitivity slider — only visible when enabled */}
      {enabled && (
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5">
          <button
            className="rounded-full border border-black/10 px-2 py-1 text-[11px] font-semibold transition hover:bg-white"
            onClick={() => onMutedChange(!muted)}
            type="button"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1">
            <button
              className={[
                "rounded-full px-2 py-1 text-[11px] font-semibold transition",
                mode === "continuous" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              ].join(" ")}
              onClick={() => onModeChange("continuous")}
              type="button"
            >
              Continuous
            </button>
            <button
              className={[
                "rounded-full px-2 py-1 text-[11px] font-semibold transition",
                mode === "push-to-listen" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              ].join(" ")}
              onClick={() => onModeChange("push-to-listen")}
              type="button"
            >
              Hold Space
            </button>
          </div>
          {mode === "push-to-listen" && (
            <span className="text-[11px] font-semibold soft-text">
              {isPushToListenActive ? "Listening while Space is held" : "Hold Space to talk"}
            </span>
          )}
          <label className="text-[11px] font-semibold uppercase tracking-wide soft-text" htmlFor="voice-confidence">
            Sensitivity
          </label>
          <input
            id="voice-confidence"
            type="range"
            min={0.5}
            max={1.0}
            step={0.05}
            value={confidence}
            onChange={(e) => onConfidenceChange(parseFloat(e.target.value))}
            className="h-1.5 w-20 cursor-pointer accent-[var(--accent)]"
          />
          <span className="w-7 text-[11px] font-semibold tabular-nums soft-text">
            {Math.round(confidence * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
