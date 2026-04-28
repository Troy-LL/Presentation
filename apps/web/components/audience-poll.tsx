"use client";

import { useState } from "react";

import type { PollInteraction } from "@interactive-presentation/types";

type Props = {
  poll: PollInteraction;
  onVote: (optionId: string) => void;
  compact?: boolean;
};

export function AudiencePoll({ poll, onVote, compact = false }: Props) {
  const [voted, setVoted] = useState<string | null>(null);

  const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0);
  const shellClass = compact
    ? "flex h-full min-h-0 items-start justify-center bg-white px-4 py-4 sm:px-5 sm:py-5"
    : "flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6";

  const handleVote = (optionId: string) => {
    if (voted) return;
    setVoted(optionId);
    onVote(optionId);
  };

  const showResults = poll.resultsRevealed || voted !== null;

  return (
    <main className={shellClass}>
      <div className="w-full max-w-lg">
        <p className="text-center text-[11px] uppercase tracking-[0.28em] text-slate-300 sm:text-sm">Live poll</p>
        <h1 className={compact ? "mt-3 text-center text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl" : "mt-5 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl"}>
          {poll.payload.question}
        </h1>

        <div className={compact ? "mt-5 flex max-h-full flex-col gap-2 overflow-hidden" : "mt-8 flex flex-col gap-3"}>
          {poll.payload.options.map((option) => {
            const count = poll.votes[option.id] ?? 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isVoted = voted === option.id;

            return (
              <button
                className={[
                  "relative w-full overflow-hidden rounded-2xl border text-left transition",
                  compact ? "min-h-10 px-4 py-3" : "min-h-12 px-5 py-4",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                  voted
                    ? isVoted
                      ? "border-orange-400 bg-orange-50"
                      : "border-slate-100 bg-white opacity-70"
                    : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 active:scale-[0.99]"
                ].join(" ")}
                disabled={!!voted}
                key={option.id}
                onClick={() => handleVote(option.id)}
                type="button"
              >
                {/* Progress bar fill */}
                {showResults && (
                  <span
                    className="absolute inset-y-0 left-0 rounded-2xl bg-orange-100 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                )}

                  <span className="relative flex items-center justify-between gap-4">
                  <span className={compact ? "text-[14px] font-medium text-slate-800 sm:text-[15px]" : "text-[15px] font-medium text-slate-800 sm:text-base"}>{option.text}</span>
                  {showResults && (
                    <span className={compact ? "shrink-0 text-[11px] font-semibold text-slate-500 sm:text-xs" : "shrink-0 text-sm font-semibold text-slate-500"}>
                      {pct}%
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {voted && !poll.resultsRevealed && (
          <p className={compact ? "mt-4 text-center text-xs text-slate-400" : "mt-6 text-center text-sm text-slate-400"}>
            Vote recorded — waiting for results to be revealed…
          </p>
        )}
        {poll.resultsRevealed && (
          <p className={compact ? "mt-4 text-center text-xs text-slate-400" : "mt-6 text-center text-sm text-slate-400"}>
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"} total
          </p>
        )}
      </div>
    </main>
  );
}
