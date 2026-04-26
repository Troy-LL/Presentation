"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import type { HostLayoutMode, HostLayoutVariant } from "../../hooks/use-host-layout";

type Props = {
  layout: HostLayoutMode;
  variant: HostLayoutVariant;
  toolbar: ReactNode;
  header: ReactNode;
  content: ReactNode;
  sidebar: ReactNode | null;
  onEndSession: () => void;
  onToggleFullscreen: () => void;
  onToggleVoice: () => void;
  voiceEnabled: boolean;
  isFullscreen: boolean;
  isClosed: boolean;
  slidesActive?: boolean;
  currentSlide?: number;
  totalSlides?: number;
  onPrevSlide?: () => void;
  onNextSlide?: () => void;
};

export function HostLayoutShell({
  layout, variant, toolbar, header, content, sidebar,
  onEndSession, onToggleFullscreen, onToggleVoice,
  voiceEnabled, isFullscreen, isClosed,
  slidesActive, currentSlide, totalSlides, onPrevSlide, onNextSlide,
}: Props) {
  const isPhone = layout === "phone";
  const isHeadsUp = isPhone && variant === "heads-up";
  const isDesktopCompact = layout === "desktop" && variant === "compact";
  const [trayOpen, setTrayOpen] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trayOpen) return;
    const h = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setTrayOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [trayOpen]);

  function onTouchStart(e: React.TouchEvent) { touchStartY.current = e.touches[0]?.clientY ?? null; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const d = touchStartY.current - (e.changedTouches[0]?.clientY ?? 0);
    if (d > 40) setTrayOpen(true);
    if (d < -40) {
      setTrayOpen(false);
    }
    touchStartY.current = null;
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#faf7ef] text-slate-900">
      <div className="pointer-events-none fixed -left-[20vw] -top-[20vw] h-[60vw] w-[60vw] rounded-full bg-[var(--accent)]/10 mix-blend-multiply blur-[100px]" />
      <div className="pointer-events-none fixed -bottom-[20vw] -right-[20vw] h-[50vw] w-[50vw] rounded-full bg-blue-400/10 mix-blend-multiply blur-[100px]" />

      <main className="relative flex h-full w-full flex-col p-2 sm:p-3 md:flex-row md:p-5 lg:p-7 gap-3 md:gap-5 overflow-hidden max-w-[1920px] mx-auto">
        {!isPhone && toolbar}
        <div className="flex min-w-0 min-h-0 flex-1 flex-col gap-3 md:gap-5">
          {!isHeadsUp && <div className="shrink-0 z-20">{header}</div>}
          <div className="flex min-h-0 flex-1 gap-5 overflow-hidden">
            <div className={["flex min-w-0 flex-1 flex-col overflow-y-auto rounded-3xl hide-scrollbar", isPhone ? "pb-28" : "pb-0"].join(" ")}>
              {content}
            </div>
            {sidebar && layout === "desktop" && !isDesktopCompact && (
              <div className="hidden min-w-[300px] max-w-[380px] flex-col gap-5 overflow-y-auto hide-scrollbar lg:flex">
                {sidebar}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Phone bottom toolbar */}
      {isPhone && (
        <div className="absolute bottom-0 left-0 w-full z-40" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="pointer-events-none h-8 bg-gradient-to-t from-[#faf7ef] to-transparent" />
          {toolbar}
        </div>
      )}

      {/* Quick Settings Tray */}
      {isPhone && (
        <>
          <div
            className={["fixed inset-0 z-50 bg-black/25 transition-opacity duration-300", trayOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"].join(" ")}
            onClick={() => {
              setTrayOpen(false);
            }}
          />
          <div
            ref={trayRef}
            className={["fixed bottom-0 left-0 right-0 z-[60] rounded-t-[28px] bg-[#f5f3ee] shadow-2xl border border-black/10 transition-transform duration-300 ease-out", trayOpen ? "translate-y-0" : "translate-y-full"].join(" ")}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-black/20" />
            </div>
            <div className="px-5 pb-10 pt-3">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Quick Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { onToggleFullscreen(); setTrayOpen(false); }} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3.5 text-sm font-semibold text-slate-800 transition active:scale-95 active:bg-black/5" type="button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-slate-500">
                    {isFullscreen ? <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /> : <path d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-18h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2" />}
                  </svg>
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
                <button onClick={() => { onToggleVoice(); setTrayOpen(false); }} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3.5 text-sm font-semibold text-slate-800 transition active:scale-95 active:bg-black/5" type="button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${voiceEnabled ? "text-[var(--accent)]" : "text-slate-500"}`}>
                    <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {voiceEnabled ? "Voice On" : "Voice Off"}
                </button>
                {slidesActive && (
                  <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-slate-500"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                    <span className="flex-1 text-sm font-semibold text-slate-700">Slide {(currentSlide ?? 0) + 1} / {totalSlides ?? 1}</span>
                    <div className="flex gap-2">
                      <button onClick={onPrevSlide} className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 transition active:scale-90 active:bg-black/10" type="button">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M15 18l-6-6 6-6" /></svg>
                      </button>
                      <button onClick={onNextSlide} className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 transition active:scale-90 active:bg-black/10" type="button">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    </div>
                  </div>
                )}
                {!isClosed && (
                  <button
                    onClick={() => {
                      onEndSession();
                      setTrayOpen(false);
                    }}
                    className="col-span-2 flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3.5 text-sm font-semibold text-slate-500 transition active:scale-95 active:bg-red-50 active:text-[var(--danger)]"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    End Session
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
