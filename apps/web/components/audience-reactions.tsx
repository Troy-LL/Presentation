"use client";

import type { ReactionsInteraction } from "@interactive-presentation/types";

type Props = {
  reactions: ReactionsInteraction;
  onSendReaction: (emoji: string) => void;
};

export function AudienceReactions({ reactions, onSendReaction }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6">
      <div className="w-full max-w-xl">
        <p className="text-center text-sm uppercase tracking-[0.28em] text-slate-300">Reactions</p>
        <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          {reactions.payload.prompt}
        </h1>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {reactions.payload.emojis.map((emoji) => (
            <button
              className="min-h-14 rounded-2xl border border-slate-200 bg-white px-3 py-5 text-3xl transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] sm:px-4 sm:py-6 sm:text-4xl"
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
