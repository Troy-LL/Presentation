"use client";

import type { PollInteraction } from "@interactive-presentation/types";

type Props = {
  poll: PollInteraction;
  onReveal: () => void;
  onClear: () => void;
};

export function HostPollResults({ poll, onReveal, onClear }: Props) {
  const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(...Object.values(poll.votes), 1);

  return (
    <div className="panel rounded-[28px] p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] soft-text">Live poll</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{poll.payload.question}</h2>
        </div>
        <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-sm soft-text">
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {poll.payload.options.map((option) => {
          const count = poll.votes[option.id] ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isLeading = count === maxVotes && count > 0;

          return (
            <div key={option.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={[
                    "text-sm font-medium",
                    isLeading ? "text-[var(--accent-strong)]" : "text-slate-700"
                  ].join(" ")}
                >
                  {isLeading && "▲ "}
                  {option.text}
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-500",
                    isLeading ? "bg-[var(--accent)]" : "bg-slate-300"
                  ].join(" ")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 border-t border-black/5 pt-6">
        {!poll.resultsRevealed && (
          <button
            className="accent-button inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold"
            onClick={onReveal}
            type="button"
          >
            Reveal results to audience
          </button>
        )}
        {poll.resultsRevealed && (
          <span className="inline-flex h-10 items-center rounded-full bg-green-50 px-4 text-sm font-medium text-green-700 border border-green-200">
            ✓ Results revealed
          </span>
        )}
        <button
          className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
          onClick={onClear}
          type="button"
        >
          End poll
        </button>
      </div>
    </div>
  );
}
