"use client";

import type { ReactionsInteraction } from "@interactive-presentation/types";

type Props = {
  reactions: ReactionsInteraction;
  latestReactionEmoji: string | null;
  onClear: () => void;
};

export function HostReactionResults({ reactions, latestReactionEmoji, onClear }: Props) {
  const totalReactions = Object.values(reactions.reactionCounts).reduce((a, b) => a + b, 0);
  const sorted = [...reactions.payload.emojis].sort(
    (a, b) => (reactions.reactionCounts[b] ?? 0) - (reactions.reactionCounts[a] ?? 0)
  );

  return (
    <div className="panel min-h-[600px] rounded-[28px] p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] soft-text">Live reactions</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{reactions.payload.prompt}</h2>
        </div>
        <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-sm soft-text">
          {totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {sorted.map((emoji) => (
          <div className="rounded-2xl border border-black/8 bg-white/80 px-4 py-3" key={emoji}>
            <div className="flex items-center justify-between">
              <span className="text-2xl">{emoji}</span>
              <span className="text-sm font-semibold text-slate-600">{reactions.reactionCounts[emoji] ?? 0}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/5 pt-6">
        {latestReactionEmoji ? (
          <span className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm">
            Latest: <span className="text-xl align-middle">{latestReactionEmoji}</span>
          </span>
        ) : null}
        <button
          className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
          onClick={onClear}
          type="button"
        >
          End reactions
        </button>
      </div>
    </div>
  );
}
