"use client";

import { useEffect, useMemo, useState } from "react";

import type { CountdownInteraction } from "@interactive-presentation/types";

type Props = {
  interaction: CountdownInteraction;
};

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function AudienceCountdown({ interaction }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const remainingSeconds = useMemo(() => {
    const endMs = new Date(interaction.payload.endsAt).getTime();
    return Math.max(0, Math.ceil((endMs - now) / 1000));
  }, [interaction.payload.endsAt, now]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 text-center sm:px-6">
      <div className="w-full max-w-xl">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-300">Countdown</p>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          {interaction.payload.label}
        </h1>
        <p className="mt-6 text-6xl font-semibold tracking-tight text-slate-950 sm:text-7xl md:mt-8 md:text-8xl">
          {formatRemaining(remainingSeconds)}
        </p>
        <p className="mt-4 text-sm text-slate-500">
          {remainingSeconds === 0 ? "Time is up." : "Timer is running..."}
        </p>
      </div>
    </main>
  );
}
