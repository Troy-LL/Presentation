"use client";

import { useState } from "react";

import type { OpenTextInteraction } from "@interactive-presentation/types";

type Props = {
  interaction: OpenTextInteraction;
  onSubmit: (text: string) => void;
};

export function AudienceOpenText({ interaction, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || submitted) return;
    onSubmit(trimmed);
    setSubmitted(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6">
      <div className="w-full max-w-xl">
        <p className="text-center text-sm uppercase tracking-[0.28em] text-slate-300">Open text</p>
        <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          {interaction.payload.prompt}
        </h1>
        <textarea
          className="mt-7 min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-slate-400 sm:px-5 sm:py-4 sm:text-base"
          disabled={submitted}
          maxLength={280}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your response..."
          value={text}
        />
        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">{text.length}/280</p>
          <button
            className="accent-button inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
