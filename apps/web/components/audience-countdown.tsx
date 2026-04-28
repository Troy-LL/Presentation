"use client";

import { useEffect, useMemo, useState } from "react";

import type { CountdownInteraction } from "@interactive-presentation/types";

type Props = {
  interaction: CountdownInteraction;
  compact?: boolean;
};

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function AudienceCountdown({ interaction, compact = false }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const shellClass = compact
    ? "flex h-full min-h-0 items-start justify-center bg-white px-4 py-4 text-center sm:px-5 sm:py-5"
    : "flex min-h-screen items-center justify-center bg-white px-4 py-6 text-center sm:px-6";

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const remainingSeconds = useMemo(() => {
    const endMs = new Date(interaction.payload.endsAt).getTime();
    return Math.max(0, Math.ceil((endMs - now) / 1000));
  }, [interaction.payload.endsAt, now]);

  return (
    <main className={shellClass}>
      <div className="w-full max-w-xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-slate-300 sm:text-sm">Countdown</p>
        <h1 className={compact ? "mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl" : "mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl"}>
          {interaction.payload.label}
        </h1>
        <p className={compact ? "mt-5 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl" : "mt-6 text-6xl font-semibold tracking-tight text-slate-950 sm:text-7xl md:mt-8 md:text-8xl"}>
          {formatRemaining(remainingSeconds)}
        </p>
        <p className={compact ? "mt-3 text-xs text-slate-500" : "mt-4 text-sm text-slate-500"}>
          {remainingSeconds === 0 ? "Time is up." : "Timer is running..."}
        </p>
      </div>
    </main>
  );
}
