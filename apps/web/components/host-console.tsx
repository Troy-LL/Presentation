"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { SessionSnapshot } from "@interactive-presentation/types";

import { useSessionConnection } from "@/lib/use-session-connection";

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
  const [draft, setDraft] = useState("");
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [presets, setPresets] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("host-presets");
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse presets", e);
      }
    }
  }, []);

  const savePreset = () => {
    if (!draft.trim() || presets.includes(draft.trim())) return;
    const newPresets = [draft.trim(), ...presets];
    setPresets(newPresets);
    localStorage.setItem("host-presets", JSON.stringify(newPresets));
  };

  const deletePreset = (text: string) => {
    const newPresets = presets.filter((p) => p !== text);
    setPresets(newPresets);
    localStorage.setItem("host-presets", JSON.stringify(newPresets));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = `host-token:${sessionCode}`;
    const token = tokenFromUrl ?? window.sessionStorage.getItem(storageKey);

    if (token) {
      window.sessionStorage.setItem(storageKey, token);
      setHostToken(token);
      if (tokenFromUrl) {
        window.history.replaceState({}, "", `/host/${sessionCode}`);
      }
      return;
    }

    setLoadError("This host room needs a valid host link. Start from /host/new to create one.");
  }, [sessionCode, tokenFromUrl]);

  useEffect(() => {
    let active = true;

    async function loadSnapshot() {
      try {
        const response = await fetch(`/api/sessions/${sessionCode}`);
        const payload = (await response.json()) as SessionSnapshot | { error?: string };
        const apiError = "error" in payload ? payload.error : undefined;

        if (!response.ok || !("sessionCode" in payload)) {
          throw new Error(apiError ?? "Session lookup failed.");
        }

        if (!active) {
          return;
        }

        setInitialSnapshot(payload);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setLoadError(
          caughtError instanceof Error ? caughtError.message : "Session lookup failed."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      active = false;
    };
  }, [sessionCode]);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/join?code=${sessionCode}`;
  }, [sessionCode]);

  const { snapshot, connectionState, error, startPrompt, clearInteraction, closeSession } = useSessionConnection({
    sessionCode,
    role: "host",
    hostToken,
    initialSnapshot,
    enabled: Boolean(hostToken && initialSnapshot)
  });

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

  return (
    <main className="app-shell px-6 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="panel rounded-[28px] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] soft-text">Live host dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                Session {sessionCode}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 soft-text">
                Launch a full-screen crowd prompt, watch the room count climb, and clear back to the lobby when the moment is done.
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
            <div className="grid gap-4 md:grid-cols-3">
              {statLabel(sessionCode, "Invite code")}
              {statLabel(String(snapshot.participantCount), "Audience connected")}
              {statLabel(snapshot.status === "closed" ? "Closed" : snapshot.status === "active" ? "Prompt live" : "Lobby idle", "Room state")}
            </div>

            <div className="panel rounded-[28px] p-6 md:p-8">
              <p className="text-sm uppercase tracking-[0.22em] soft-text">Crowd prompt</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Push one message to every phone</h2>
              <textarea
                className="mt-6 min-h-40 w-full rounded-[24px] border border-black/10 bg-white px-5 py-4 text-2xl leading-tight outline-none focus:border-black"
                maxLength={140}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type the line the whole room should see."
                value={draft}
              />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  className="accent-button inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!draft.trim() || !hostToken || snapshot.status === "closed"}
                  onClick={() => startPrompt(draft)}
                  type="button"
                >
                  Launch prompt
                </button>
                <button
                  className="ghost-button inline-flex h-12 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
                  disabled={snapshot.status === "closed"}
                  onClick={() => clearInteraction()}
                  type="button"
                >
                  Return audience to lobby
                </button>
                <button
                  className="ghost-button inline-flex h-12 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
                  disabled={!draft.trim()}
                  onClick={savePreset}
                  title="Save this text for future use"
                  type="button"
                >
                  Save as preset
                </button>
              </div>

              {presets.length > 0 && (
                <div className="mt-8 border-t border-black/5 pt-6">
                  <p className="text-xs uppercase tracking-[0.2em] soft-text">Your presets</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {presets.map((preset) => (
                      <div
                        className="group flex items-center overflow-hidden rounded-full border border-black/10 bg-white shadow-sm transition hover:border-black/20"
                        key={preset}
                      >
                        <button
                          className="px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                          onClick={() => {
                            setDraft(preset);
                            startPrompt(preset);
                          }}
                          type="button"
                        >
                          {preset.length > 30 ? `${preset.substring(0, 30)}...` : preset}
                        </button>
                        <button
                          className="flex h-full items-center border-l border-black/10 bg-slate-50 px-3 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                          onClick={() => deletePreset(preset)}
                          title="Delete preset"
                          type="button"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M6 18L18 6M6 6l12 12"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-black/10">
                <button
                  className="ghost-button inline-flex h-10 items-center justify-center rounded-full text-sm font-semibold text-[var(--danger)] hover:bg-red-50 px-4 transition"
                  disabled={snapshot.status === "closed"}
                  onClick={() => {
                    if (confirm("Are you sure you want to end this session for everyone?")) {
                      closeSession();
                    }
                  }}
                  type="button"
                >
                  End connection permanently
                </button>
              </div>
              {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
            </div>
          </div>

          <div className="grid gap-6">
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

            <div className="panel rounded-[28px] p-6 md:p-8">
              <p className="text-sm uppercase tracking-[0.22em] soft-text">Current output</p>
              <div className="mt-5 min-h-48 rounded-[24px] border border-black/8 bg-white p-6">
                {snapshot.currentInteraction ? (
                  <p className="text-4xl font-semibold tracking-tight">
                    {snapshot.currentInteraction.payload.text}
                  </p>
                ) : (
                  <p className="text-base leading-7 soft-text">
                    The audience is waiting in the blank lobby. Launch a prompt and this panel mirrors what they see.
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
