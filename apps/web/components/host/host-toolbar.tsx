"use client";

import { useState } from "react";
import type { HostLayoutMode, HostLayoutVariant } from "../../hooks/use-host-layout";
import { AttentionNudgeButton } from "./attention-nudge-button";
import { HostGuideModal } from "./host-guide-modal";

export type Mode = "prompt" | "poll" | "quiz" | "reactions" | "open_text" | "countdown" | "slides";

type Props = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  onNudge: (message: string) => void;
  onShowGuide: () => void;
  layout: HostLayoutMode;
  variant: HostLayoutVariant;
  onVariantToggle: () => void;
};

// Pure SVG icons — no emoji
const TOOLS: { id: Mode; label: string; icon: React.ReactNode }[] = [
  {
    id: "prompt",
    label: "Crowd Prompt",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: "poll",
    label: "Live Poll",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "quiz",
    label: "Quiz",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "reactions",
    label: "Reactions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "open_text",
    label: "Open Text",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: "countdown",
    label: "Countdown",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    id: "slides",
    label: "Slides",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
];

// Layout toggle icon
function LayoutToggleIcon({ variant, isPhone }: { variant: HostLayoutVariant; isPhone: boolean }) {
  if (isPhone) {
    // Heads-up vs Standard
    if (variant === "heads-up") {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 9v12" />
      </svg>
    );
  }
  // Desktop: compact vs standard
  if (variant === "compact") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M4 6h6M4 12h6M4 18h6M14 6h6M14 12h6M14 18h6" />
    </svg>
  );
}

export function HostToolbar({ mode, setMode, onNudge, onShowGuide, layout, variant, onVariantToggle }: Props) {
  const isPhone = layout === "phone";
  // On desktop, "compact" means icon-only + no right panel
  const isCondensed = layout === "condensed" || (layout === "desktop" && variant === "compact");

  if (isPhone) {
    return (
      <div className="flex w-full flex-col items-end gap-1.5 px-3 pb-safe">
        {/* Floating Secondary Controls (Nudge + Layout) */}
        <div className="flex items-center gap-1 rounded-2xl border border-black/8 bg-white/70 p-1 shadow-sm backdrop-blur-md mr-1">
          <AttentionNudgeButton onNudge={onNudge} collapsed={true} />
          <button
            onClick={onVariantToggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all duration-150 hover:bg-black/5 hover:text-slate-800 active:scale-90"
            title={variant === "heads-up" ? "Standard view" : "Heads-Up view"}
            type="button"
          >
            <LayoutToggleIcon variant={variant} isPhone={true} />
          </button>
        </div>

        {/* Main Tools Navbar */}
        <nav className="panel flex w-full flex-row items-center justify-start gap-1 overflow-x-auto hide-scrollbar rounded-[24px] p-2 shadow-2xl">
          <div className="flex flex-row gap-1 min-w-max pr-2">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={[
                  "group flex items-center transition-all duration-150 h-11 min-w-[44px] flex-row gap-2 rounded-[18px] px-3",
                  mode === t.id
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/8"
                    : "bg-transparent text-slate-500 hover:bg-black/5 hover:text-slate-800 active:scale-95 active:bg-black/8",
                ].join(" ")}
                title={t.label}
              >
                <span className={`shrink-0 transition-transform duration-150 ${mode === t.id ? "text-[var(--accent)]" : ""}`}>
                  {t.icon}
                </span>
                <span className="text-[13px] font-semibold whitespace-nowrap leading-none">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <nav
      className={[
        "panel flex z-30 shrink-0 flex-col gap-2 rounded-3xl p-3 md:p-4 overflow-hidden",
      ].join(" ")}
      style={{
        width: isCondensed ? "72px" : "220px",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Desktop header */}
      <div className={`mb-3 flex items-center border-b border-black/10 pb-3 ${isCondensed ? "justify-center" : "justify-between"}`}>
        {!isCondensed && (
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Interactions
          </h2>
        )}
        <button
          onClick={onVariantToggle}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all duration-150 hover:bg-black/5 hover:text-slate-700 active:scale-90"
          title={isCondensed ? "Expand toolbar" : "Collapse toolbar"}
          type="button"
        >
          <LayoutToggleIcon variant={variant} isPhone={false} />
        </button>
      </div>

      {/* Tool buttons */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto hide-scrollbar">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={[
              "group flex items-center transition-all duration-150",
              isCondensed
                ? "mx-auto h-10 w-10 flex-col justify-center rounded-xl p-0 shrink-0"
                : "h-11 w-full flex-row gap-3 rounded-xl px-3",
              mode === t.id
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/8"
                : "bg-transparent text-slate-500 hover:bg-black/5 hover:text-slate-800 active:scale-95 active:bg-black/8",
            ].join(" ")}
            title={t.label}
          >
            <span className={`shrink-0 transition-transform duration-150 ${mode === t.id ? "text-[var(--accent)]" : ""}`}>
              {t.icon}
            </span>
            {!isCondensed && (
              <span className="text-[13px] font-semibold whitespace-nowrap leading-none">{t.label}</span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom section: Nudge & Help */}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-black/10 pt-3">
        <button
          onClick={onShowGuide}
          className={[
            "group flex items-center transition-all duration-150",
            isCondensed
              ? "mx-auto h-10 w-10 flex-col justify-center rounded-xl p-0 shrink-0"
              : "h-10 w-full flex-row gap-3 rounded-xl px-3",
            "bg-transparent text-slate-500 hover:bg-black/5 hover:text-slate-800 active:scale-95 active:bg-black/8"
          ].join(" ")}
          title="User Manual"
          type="button"
        >
          <span className="shrink-0 transition-transform duration-150">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
            </svg>
          </span>
          {!isCondensed && (
            <span className="text-[13px] font-semibold whitespace-nowrap leading-none">Help & Guide</span>
          )}
        </button>
        <AttentionNudgeButton onNudge={onNudge} collapsed={isCondensed} />
      </div>
    </nav>
  );
}
