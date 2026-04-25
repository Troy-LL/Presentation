"use client";

import { useEffect, useMemo, useState } from "react";

import type { CountdownInteraction } from "@interactive-presentation/types";

type Props = {
  interaction: CountdownInteraction;
  onClear: () => void;
};

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function HostCountdownResults({ interaction, onClear }: Props) {
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
    <div className="panel rounded-[28px] p-6 md:p-8">
      <p className="text-sm uppercase tracking-[0.22em] soft-text">Countdown</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{interaction.payload.label}</h2>
      <p className="mt-4 text-6xl font-semibold tracking-tight">{formatRemaining(remainingSeconds)}</p>
      <p className="mt-2 text-sm soft-text">
        {remainingSeconds === 0 ? "Timer complete." : `${interaction.payload.durationSeconds}s total`}
      </p>

      <div className="mt-6 border-t border-black/5 pt-6">
        <button
          className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
          onClick={onClear}
          type="button"
        >
          End countdown
        </button>
      </div>
    </div>
  );
}
