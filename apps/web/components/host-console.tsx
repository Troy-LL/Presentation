"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { SessionSnapshot } from "@interactive-presentation/types";

import { HostPollResults } from "@/components/host-poll-results";
import { useSessionConnection } from "@/lib/use-session-connection";

type Mode = "prompt" | "poll";

const EMPTY_OPTIONS = ["", "", ""];

function statLabel(value: string, label: string) {
  return (
    <div className="rounded-[22px] border border-black/8 bg-white/80 p-5">
      <p className="text-xs uppercase tracking-[0.18em] soft-text">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function HostConsole({
  sessionCode,
  tokenFromUrl
}: {
  sessionCode: string;
  tokenFromUrl?: string;
}) {
  const [initialSnapshot, setInitialSnapshot] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);

  // ── Mode switcher ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("prompt");

  // ── Prompt state ─────────────────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const [presets, setPresets] = useState<string[]>([]);

  // ── Poll state ───────────────────────────────────────────────────────────
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(EMPTY_OPTIONS);

  // ── Presets persistence ──────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("host-presets");
    if (saved) {
      try { setPresets(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const savePreset = () => {
    if (!draft.trim() || presets.includes(draft.trim())) return;
    const next = [draft.trim(), ...presets];
    setPresets(next);
    localStorage.setItem("host-presets", JSON.stringify(next));
  };

  const deletePreset = (text: string) => {
    const next = presets.filter((p) => p !== text);
    setPresets(next);
    localStorage.setItem("host-presets", JSON.stringify(next));
  };

  // ── Token resolution ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `host-token:${sessionCode}`;
    const token = tokenFromUrl ?? window.sessionStorage.getItem(storageKey);
    if (token) {
      window.sessionStorage.setItem(storageKey, token);
      setHostToken(token);
      if (tokenFromUrl) window.history.replaceState({}, "", `/host/${sessionCode}`);
      return;
    }
    setLoadError("This host room needs a valid host link. Start from /host/new to create one.");
  }, [sessionCode, tokenFromUrl]);

  // ── Initial snapshot fetch ────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionCode}`);
        const payload = (await res.json()) as SessionSnapshot | { error?: string };
        const apiError = "error" in payload ? payload.error : undefined;
        if (!res.ok || !("sessionCode" in payload)) throw new Error(apiError ?? "Session lookup failed.");
        if (active) setInitialSnapshot(payload);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : "Session lookup failed.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [sessionCode]);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join?code=${sessionCode}`;
  }, [sessionCode]);

  const {
    snapshot,
    connectionState,
    error,
    startPrompt,
    startPoll,
    revealPollResults,
    clearInteraction,
    closeSession
  } = useSessionConnection({
    sessionCode,
    role: "host",
    hostToken,
    initialSnapshot,
    enabled: Boolean(hostToken && initialSnapshot)
  });

  // ── Prompt before closing ────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Prompt warning unless explicitly closed
      if (snapshot && snapshot.status !== "closed") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [snapshot]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="app-shell flex items-center justify-center px-6 py-10">
        <div className="panel w-full max-w-xl rounded-[28px] p-8 text-center">
          <p className="soft-text">Loading session…</p>
        </div>
      </main>
    );
  }

  if (loadError || !snapshot) {
    return (
      <main className="app-shell flex items-center justify-center px-6 py-10">
        <div className="panel w-full max-w-xl rounded-[28px] p-8">
          <p className="text-sm uppercase tracking-[0.2em] soft-text">Host room</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Session unavailable</h1>
          <p className="mt-4 text-base leading-7 soft-text">{loadError ?? "Session not found."}</p>
          <Link
            className="accent-button mt-8 inline-flex rounded-full px-5 py-3 text-sm font-semibold"
            href="/host/new"
          >
            Create a fresh room
          </Link>
        </div>
      </main>
    );
  }

  const isClosed = snapshot.status === "closed";
  const isActive = snapshot.status === "active";
  const activePoll = snapshot.currentInteraction?.type === "poll" ? snapshot.currentInteraction : null;
  const activePrompt = snapshot.currentInteraction?.type === "prompt" ? snapshot.currentInteraction : null;

  const roomStateLabel = isClosed ? "Closed" : isActive ? (activePoll ? "Poll live" : "Prompt live") : "Lobby idle";

  // poll option helpers
  const setOption = (index: number, value: string) => {
    const next = [...pollOptions];
    next[index] = value;
    setPollOptions(next);
  };
  const addOption = () => setPollOptions([...pollOptions, ""]);
  const removeOption = (index: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };
  const validPollOptions = pollOptions.filter((o) => o.trim()).length >= 2;

  return (
    <main className="app-shell px-6 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="panel rounded-[28px] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] soft-text">Live host dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                Session {sessionCode}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 soft-text">
                Launch crowd prompts or live polls, watch the room respond in real time, and clear back to lobby when the moment is done.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold">
                {connectionState === "connected" ? "Connected live" : "Connecting…"}
              </span>
              <a
                className="ghost-button inline-flex rounded-full border border-black/10 px-4 py-2 text-sm font-semibold transition hover:bg-white"
                href={joinUrl || `/join?code=${sessionCode}`}
                target="_blank"
              >
                Open join screen
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6">
            {/* Stats row */}
            <div className="grid gap-4 md:grid-cols-3">
              {statLabel(sessionCode, "Invite code")}
              {statLabel(String(snapshot.participantCount), "Audience connected")}
              {statLabel(roomStateLabel, "Room state")}
            </div>

            {/* Active poll live view replaces the control panel */}
            {activePoll ? (
              <HostPollResults
                onClear={clearInteraction}
                onReveal={revealPollResults}
                poll={activePoll}
              />
            ) : (
              <div className="panel rounded-[28px] p-6 md:p-8">
                {/* Mode tabs */}
                <div className="flex gap-1 rounded-2xl border border-black/8 bg-black/3 p-1 w-fit">
                  {(["prompt", "poll"] as Mode[]).map((m) => (
                    <button
                      className={[
                        "rounded-xl px-4 py-2 text-sm font-semibold transition",
                        mode === m
                          ? "bg-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      ].join(" ")}
                      key={m}
                      onClick={() => setMode(m)}
                      type="button"
                    >
                      {m === "prompt" ? "Crowd Prompt" : "Live Poll"}
                    </button>
                  ))}
                </div>

                {/* ── Prompt mode ── */}
                {mode === "prompt" && (
                  <div className="mt-6">
                    <h2 className="text-xl font-semibold tracking-tight">Push one message to every phone</h2>
                    <textarea
                      className="mt-4 min-h-36 w-full rounded-[20px] border border-black/10 bg-white px-5 py-4 text-2xl leading-tight outline-none focus:border-black"
                      maxLength={140}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Type the line the whole room should see."
                      value={draft}
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!draft.trim() || !hostToken || isClosed}
                        onClick={() => startPrompt(draft)}
                        type="button"
                      >
                        Launch prompt
                      </button>
                      {isActive && activePrompt && (
                        <button
                          className="ghost-button inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
                          onClick={clearInteraction}
                          type="button"
                        >
                          Clear prompt
                        </button>
                      )}
                      <button
                        className="ghost-button inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
                        disabled={!draft.trim()}
                        onClick={savePreset}
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
                              className="group flex items-center overflow-hidden rounded-full border border-black/10 bg-white shadow-sm"
                              key={preset}
                            >
                              <button
                                className="px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                                disabled={isClosed}
                                onClick={() => { setDraft(preset); startPrompt(preset); }}
                                type="button"
                              >
                                {preset.length > 30 ? `${preset.substring(0, 30)}…` : preset}
                              </button>
                              <button
                                className="flex h-full items-center border-l border-black/10 bg-slate-50 px-3 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                                onClick={() => deletePreset(preset)}
                                title="Delete preset"
                                type="button"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Poll mode ── */}
                {mode === "poll" && (
                  <div className="mt-6">
                    <h2 className="text-xl font-semibold tracking-tight">Create a live poll</h2>
                    <input
                      className="mt-4 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                      maxLength={200}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="What's your question?"
                      value={pollQuestion}
                    />
                    <div className="mt-4 flex flex-col gap-2">
                      {pollOptions.map((opt, i) => (
                        <div className="flex gap-2" key={i}>
                          <input
                            className="flex-1 rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                            maxLength={100}
                            onChange={(e) => setOption(i, e.target.value)}
                            placeholder={`Option ${i + 1}`}
                            value={opt}
                          />
                          {pollOptions.length > 2 && (
                            <button
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/10 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                              onClick={() => removeOption(i)}
                              type="button"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {pollOptions.length < 10 && (
                      <button
                        className="mt-2 text-sm font-medium text-slate-500 underline underline-offset-2 transition hover:text-slate-800"
                        onClick={addOption}
                        type="button"
                      >
                        + Add option
                      </button>
                    )}
                    <div className="mt-5 flex gap-3">
                      <button
                        className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!pollQuestion.trim() || !validPollOptions || isClosed}
                        onClick={() => startPoll(pollQuestion, pollOptions)}
                        type="button"
                      >
                        Launch poll
                      </button>
                    </div>
                  </div>
                )}

                {/* Danger zone */}
                <div className="mt-8 border-t border-black/10 pt-6">
                  <button
                    className="ghost-button inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-[var(--danger)] transition hover:bg-red-50"
                    disabled={isClosed}
                    onClick={() => {
                      if (confirm("Are you sure you want to end this session for everyone?")) {
                        closeSession();
                      }
                    }}
                    type="button"
                  >
                    End session permanently
                  </button>
                </div>
                {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="grid gap-6">
            {/* QR / Join link */}
            <div className="panel rounded-[28px] p-6 md:p-8">
              <p className="text-sm uppercase tracking-[0.22em] soft-text">Join link</p>
              <div className="mt-5 flex flex-col items-center gap-5 rounded-[24px] border border-black/8 bg-white/85 p-6 text-center">
                <QRCodeSVG
                  bgColor="#ffffff"
                  fgColor="#111827"
                  includeMargin
                  size={192}
                  value={joinUrl || `https://example.com/join?code=${sessionCode}`}
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] soft-text">Audience URL</p>
                  <p className="mt-2 break-all text-sm text-slate-700">
                    {joinUrl || `/join?code=${sessionCode}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Current output preview */}
            <div className="panel rounded-[28px] p-6 md:p-8">
              <p className="text-sm uppercase tracking-[0.22em] soft-text">Current output</p>
              <div className="mt-5 min-h-48 rounded-[24px] border border-black/8 bg-white p-6">
                {activePrompt && (
                  <p className="text-4xl font-semibold tracking-tight">{activePrompt.payload.text}</p>
                )}
                {activePoll && (
                  <>
                    <p className="text-sm font-medium soft-text">Poll active</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">{activePoll.payload.question}</p>
                    <p className="mt-3 text-sm soft-text">{Object.values(activePoll.votes).reduce((a, b) => a + b, 0)} votes so far</p>
                  </>
                )}
                {!snapshot.currentInteraction && (
                  <p className="text-base leading-7 soft-text">
                    The audience is waiting in the blank lobby. Launch a prompt or poll and this panel mirrors what they see.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
