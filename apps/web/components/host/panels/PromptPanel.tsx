"use client";

import type { HostPreset } from "@interactive-presentation/types";

interface Props {
  draft: string;
  isClosed: boolean;
  isActive: boolean;
  hasActivePrompt: boolean;
  presets: HostPreset[];
  highlightedPresetId: string | null;
  editingPresetId: string | null;
  editingVoiceTrigger: string;
  editingTriggerConfidence: number;
  voiceConfidence: number;
  onDraftChange: (value: string) => void;
  onLaunch: () => void;
  onClear: () => void;
  onSavePreset: () => void;
  onPresetClick: (preset: HostPreset) => void;
  onDeletePreset: (id: string) => void;
  onEditPreset: (preset: HostPreset | null) => void;
  onEditingVoiceTriggerChange: (value: string) => void;
  onEditingTriggerConfidenceChange: (value: number) => void;
  onUpdatePresetVoiceTrigger: (id: string, trigger: string, confidence?: number) => void;
}

export function PromptPanel({
  draft,
  isClosed,
  isActive,
  hasActivePrompt,
  presets,
  highlightedPresetId,
  editingPresetId,
  editingVoiceTrigger,
  editingTriggerConfidence,
  voiceConfidence,
  onDraftChange,
  onLaunch,
  onClear,
  onSavePreset,
  onPresetClick,
  onDeletePreset,
  onEditPreset,
  onEditingVoiceTriggerChange,
  onEditingTriggerConfidenceChange,
  onUpdatePresetVoiceTrigger,
}: Props) {
  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold tracking-tight">Push one message to every phone</h2>
      <textarea
        className="mt-4 min-h-36 w-full rounded-[20px] border border-black/10 bg-white px-5 py-4 text-2xl leading-tight outline-none focus:border-black"
        maxLength={140}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder="Type the line the whole room should see."
        value={draft}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!draft.trim() || isClosed}
          onClick={onLaunch}
          type="button"
        >
          Launch prompt
        </button>
        {isActive && hasActivePrompt && (
          <button
            className="ghost-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
            onClick={onClear}
            type="button"
          >
            Clear prompt
          </button>
        )}
        <button
          className="ghost-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
          disabled={!draft.trim()}
          onClick={onSavePreset}
          title="Save this text for future use"
          type="button"
        >
          Save as preset
        </button>
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div className="mt-6 border-t border-black/5 pt-6">
          <p className="text-xs uppercase tracking-[0.2em] soft-text">Your presets</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <div
                className={[
                  "group flex flex-col overflow-hidden rounded-[20px] border bg-white shadow-sm transition-all duration-300",
                  highlightedPresetId === preset.id
                    ? "border-[var(--accent)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                    : "border-black/10",
                ].join(" ")}
                key={preset.id}
              >
                <div className="flex items-center">
                  <button
                    className="flex-1 px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                    disabled={isClosed}
                    onClick={() => onPresetClick(preset)}
                    type="button"
                  >
                    {preset.text.length > 30 ? `${preset.text.substring(0, 30)}…` : preset.text}
                  </button>

                  {/* Voice trigger badge */}
                  {preset.voiceTrigger && (
                    <span className="mr-2 flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      <MicIcon />
                      {preset.voiceTrigger}
                    </span>
                  )}

                  {/* Edit trigger toggle */}
                  <button
                    className="flex h-full items-center border-l border-black/10 px-3 text-slate-400 opacity-0 transition hover:bg-slate-50 hover:text-slate-700 group-hover:opacity-100"
                    onClick={() => {
                      if (editingPresetId === preset.id) {
                        onEditPreset(null);
                      } else {
                        onEditPreset(preset);
                      }
                    }}
                    title="Set voice trigger"
                    type="button"
                  >
                    <MicIcon />
                  </button>
                  <button
                    className="flex h-full items-center border-l border-black/10 bg-slate-50 px-3 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    onClick={() => onDeletePreset(preset.id)}
                    title="Delete preset"
                    type="button"
                  >
                    <XIcon />
                  </button>
                </div>

                {/* Voice trigger editor – expands on mic icon click */}
                {editingPresetId === preset.id && (
                  <div className="border-t border-black/5 px-4 py-3">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest soft-text">When I say…</p>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        className="flex-1 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                        onChange={(e) => onEditingVoiceTriggerChange(e.target.value)}
                        placeholder="e.g. let's vote"
                        type="text"
                        value={editingVoiceTrigger}
                      />
                      <input
                        aria-label="Trigger confidence"
                        className="w-24 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                        max={1}
                        min={0.5}
                        onChange={(e) => onEditingTriggerConfidenceChange(Number(e.target.value))}
                        step={0.05}
                        type="number"
                        value={editingTriggerConfidence}
                      />
                      <button
                        className="accent-button rounded-full px-4 py-1.5 text-xs font-semibold"
                        onClick={() => {
                          onUpdatePresetVoiceTrigger(preset.id, editingVoiceTrigger, editingTriggerConfidence);
                          onEditPreset(null);
                        }}
                        type="button"
                      >
                        Save
                      </button>
                      {preset.voiceTrigger && (
                        <button
                          className="ghost-button rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-500"
                          onClick={() => {
                            onUpdatePresetVoiceTrigger(preset.id, "");
                            onEditPreset(null);
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}
