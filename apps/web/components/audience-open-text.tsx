"use client";

import { useState } from "react";

import type { OpenTextInteraction } from "@interactive-presentation/types";

type Props = {
  interaction: OpenTextInteraction;
  onSubmit: (text: string) => void;
  compact?: boolean;
};

export function AudienceOpenText({ interaction, onSubmit, compact = false }: Props) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const shellClass = compact
    ? "flex h-full min-h-0 items-start justify-center bg-white px-4 py-4 sm:px-5 sm:py-5"
    : "flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6";

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || submitted) return;
    onSubmit(trimmed);
    setSubmitted(true);
  };

  return (
    <main className={shellClass}>
      <div className="w-full max-w-xl">
        <p className="text-center text-[11px] uppercase tracking-[0.28em] text-slate-300 sm:text-sm">Open text</p>
        <h1 className={compact ? "mt-3 text-center text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl" : "mt-5 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl"}>
          {interaction.payload.prompt}
        </h1>
        <textarea
          className={compact
            ? "mt-5 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] outline-none focus:border-slate-400 sm:px-5 sm:py-4 sm:text-[15px]"
            : "mt-7 min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-slate-400 sm:px-5 sm:py-4 sm:text-base"
          }
          disabled={submitted}
          maxLength={280}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your response..."
          value={text}
        />
        <div className={compact ? "mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between" : "mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"}>
          <p className={compact ? "text-[11px] text-slate-400" : "text-xs text-slate-400"}>{text.length}/280</p>
          <button
            className={compact ? "accent-button inline-flex h-10 w-full items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" : "accent-button inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"}
            disabled={!text.trim() || submitted}
            onClick={handleSubmit}
            type="button"
          >
            {submitted ? "Response sent" : "Submit response"}
          </button>
        </div>
      </div>
    </main>
  );
}
