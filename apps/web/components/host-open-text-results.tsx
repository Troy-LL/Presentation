"use client";

import type { OpenTextInteraction } from "@interactive-presentation/types";

type Props = {
  interaction: OpenTextInteraction;
  onClear: () => void;
};

export function HostOpenTextResults({ interaction, onClear }: Props) {
  return (
    <div className="panel min-h-[600px] rounded-[28px] p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] soft-text">Open text</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{interaction.payload.prompt}</h2>
        </div>
        <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-sm soft-text">
          {interaction.responseCount} {interaction.responseCount === 1 ? "response" : "responses"}
        </span>
      </div>

      <div className="mt-6 max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-black/8 bg-white/80 p-3">
        {interaction.responses.length === 0 ? (
          <p className="px-2 py-3 text-sm soft-text">Waiting for audience responses...</p>
        ) : (
          interaction.responses.map((response) => (
            <div className="rounded-xl border border-black/8 bg-white px-4 py-3 text-sm" key={response.id}>
              {response.text}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 border-t border-black/5 pt-6">
        <button
          className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
          onClick={onClear}
          type="button"
        >
          End open text
        </button>
      </div>
    </div>
  );
}
