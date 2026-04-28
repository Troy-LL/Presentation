"use client";

import { useEffect, useRef, useState } from "react";

import type { SessionSnapshot } from "@interactive-presentation/types";

import { AudienceCountdown } from "@/components/audience-countdown";
import { AudienceOpenText } from "@/components/audience-open-text";
import { AudiencePoll } from "@/components/audience-poll";
import { AudienceQuiz } from "@/components/audience-quiz";
import { AudienceReactions } from "@/components/audience-reactions";
import { AudienceSlideStage } from "@/components/audience-slide-stage";
import { getOrCreateParticipantId } from "@/lib/identity";
import { useSessionConnection } from "@/lib/use-session-connection";

export function AudienceScreen({ sessionCode }: { sessionCode: string }) {
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize or resume audio context on interaction
  useEffect(() => {
    const handleInteraction = () => {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }
      if (audioContextRef.current?.state === "suspended") {
        void audioContextRef.current.resume();
      }
    };

    window.addEventListener("click", handleInteraction, { once: true });
    window.addEventListener("touchstart", handleInteraction, { once: true });
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  const playNudgeSound = () => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    setParticipantId(getOrCreateParticipantId(sessionCode));
  }, [sessionCode]);

  useEffect(() => {
    let active = true;

    async function loadSnapshot() {
      try {
        const response = await fetch(`/api/sessions/${sessionCode}`);
        const payload = (await response.json()) as SessionSnapshot | { error?: string };
        const apiError = "error" in payload ? payload.error : undefined;

        if (!response.ok || !("sessionCode" in payload)) {
          throw new Error(apiError ?? "This session does not exist.");
        }

        if (!active) return;
        setInitialSnapshot(payload);
      } catch (caughtError) {
        if (!active) return;
        setLoadError(
          caughtError instanceof Error ? caughtError.message : "This session does not exist."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSnapshot();
    return () => { active = false; };
  }, [sessionCode]);

  const {
    snapshot,
    connectionState,
    error,
    latestAttentionNudge,
    submitVote,
    submitQuizAnswer,
    sendReaction,
    submitTextResponse
  } = useSessionConnection({
    sessionCode,
    role: "audience",
    participantId,
    initialSnapshot,
    enabled: Boolean(participantId && initialSnapshot)
  });

  useEffect(() => {
    if (!latestAttentionNudge) return;
    setNudgeMessage(latestAttentionNudge.message);
    const colors = [
      "rgba(255, 95, 31, 0.15)",
      "rgba(59, 130, 246, 0.15)",
      "rgba(168, 85, 247, 0.15)",
      "rgba(34, 197, 94, 0.15)"
    ];
    setFlashColor(colors[Math.floor(Math.random() * colors.length)]);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([120, 80, 120]);
    }
    playNudgeSound();
    const timer = window.setTimeout(() => {
      setNudgeMessage(null);
      setFlashColor(null);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [latestAttentionNudge]);

  const flashOverlay = flashColor ? (
    <div
      className="pointer-events-none fixed inset-0 z-[60] transition-opacity duration-300"
      style={{ backgroundColor: flashColor }}
    />
  ) : null;

  const nudgeBanner = nudgeMessage ? (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
        {nudgeMessage}
      </div>
    </div>
  ) : null;

  // ─── Early states (before WS connection) ───────────────────────────────────

  if (loading) {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Joining session…</p>
        </main>
      </>
    );
  }

  if (loadError || !snapshot) {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6">
          <div className="max-w-md text-center">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Session unavailable</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              That room isn&apos;t active.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {loadError ?? "Try entering the code again from the join screen."}
            </p>
            <a
              className="mt-8 inline-flex rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900"
              href="/join"
            >
              Back to join
            </a>
          </div>
        </main>
      </>
    );
  }

  // ─── Live states (driven by WebSocket snapshot) ────────────────────────────

  // Bug 1 fix: check status from live snapshot, not just the initial load
  if (snapshot.status === "closed") {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6">
          <div className="max-w-md text-center">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Session Closed</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              Thanks for participating!
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The host has ended this session. Hope you enjoyed it!
            </p>
          </div>
        </main>
      </>
    );
  }

  const { currentSlideDeck, currentInteraction } = snapshot;
  const hasSlides = Boolean(currentSlideDeck);
  const hasInteraction = Boolean(currentInteraction) && currentInteraction?.type !== "slides";

  // ─── Coexistence: slides + interaction running simultaneously ──────────────
  if (hasSlides && hasInteraction) {
    const interactionNode = renderInteractionNode(currentInteraction!, {
      submitVote,
      submitQuizAnswer,
      sendReaction,
      submitTextResponse,
      error
    });

    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <main
          className="grid min-h-[100dvh] grid-rows-[minmax(0,var(--audience-slides-height,52dvh))_1px_minmax(0,var(--audience-interaction-height,48dvh))] bg-white lg:grid-cols-[minmax(0,1.2fr)_1px_minmax(320px,0.8fr)] lg:grid-rows-1"
          style={{
            ["--audience-slides-height" as string]: "52dvh",
            ["--audience-interaction-height" as string]: "48dvh"
          }}
        >
          {/* Slides area */}
          <div className="min-h-0 overflow-hidden lg:border-r lg:border-slate-100">
            <AudienceSlideStage compact interaction={currentSlideDeck!} />
          </div>

          {/* Divider */}
          <div className="h-px shrink-0 bg-slate-100 lg:h-full lg:w-px" />

          {/* Interaction area */}
          <div className="min-h-0 overflow-hidden lg:overflow-auto">
            {interactionNode}
          </div>
        </main>
      </>
    );
  }

  // ─── Slides only ───────────────────────────────────────────────────────────
  if (hasSlides) {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <AudienceSlideStage interaction={currentSlideDeck!} />
      </>
    );
  }

  // ─── Non-slide interaction only ────────────────────────────────────────────
  if (currentInteraction?.type === "poll") {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <AudiencePoll onVote={submitVote} poll={currentInteraction} />
      </>
    );
  }

  if (currentInteraction?.type === "prompt") {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <main className="flex min-h-screen items-center justify-center bg-white px-4 text-center sm:px-8">
          <div className="max-w-5xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-300 sm:text-sm">Live prompt</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:mt-8 sm:text-5xl md:text-7xl">
              {currentInteraction.payload.text}
            </h1>
            {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
          </div>
        </main>
      </>
    );
  }

  if (currentInteraction?.type === "quiz") {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <AudienceQuiz onSubmitAnswer={submitQuizAnswer} quiz={currentInteraction} />
      </>
    );
  }

  if (currentInteraction?.type === "reactions") {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <AudienceReactions onSendReaction={sendReaction} reactions={currentInteraction} />
      </>
    );
  }

  if (currentInteraction?.type === "open_text") {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <AudienceOpenText interaction={currentInteraction} onSubmit={submitTextResponse} />
      </>
    );
  }

  if (currentInteraction?.type === "countdown") {
    return (
      <>
        {nudgeBanner}
        {flashOverlay}
        <AudienceCountdown interaction={currentInteraction} />
      </>
    );
  }

  // ─── Lobby / waiting ───────────────────────────────────────────────────────
  return (
    <>
      {nudgeBanner}
      {flashOverlay}
      <main className="relative flex min-h-screen items-center justify-center bg-white px-4 py-6 text-center sm:px-6">
        {connectionState === "disconnected" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Reconnecting…
          </div>
        )}
        <div className="max-w-md">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-300">Session {sessionCode}</p>
          <div className="mt-8 h-24 rounded-full border border-slate-100 bg-slate-50/50" />
          {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
        </div>
      </main>
    </>
  );
}

// ─── Helper: render the interaction node for coexistence view ─────────────────

type InteractionActions = {
  submitVote: (optionId: string) => void;
  submitQuizAnswer: (optionId: string) => void;
  sendReaction: (emoji: string) => void;
  submitTextResponse: (text: string) => void;
  error: string | null;
};

function renderInteractionNode(
  interaction: NonNullable<SessionSnapshot["currentInteraction"]>,
  actions: InteractionActions
) {
  switch (interaction.type) {
    case "poll":
      return <AudiencePoll compact onVote={actions.submitVote} poll={interaction} />;
    case "quiz":
      return <AudienceQuiz compact onSubmitAnswer={actions.submitQuizAnswer} quiz={interaction} />;
    case "reactions":
      return <AudienceReactions compact onSendReaction={actions.sendReaction} reactions={interaction} />;
    case "open_text":
      return <AudienceOpenText compact interaction={interaction} onSubmit={actions.submitTextResponse} />;
    case "countdown":
      return <AudienceCountdown compact interaction={interaction} />;
    case "prompt":
      return (
        <div className="flex h-full min-h-0 items-center justify-center px-4 py-4 text-center sm:px-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 sm:text-xs">Live prompt</p>
            <p className="mt-3 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl md:text-2xl">
              {interaction.payload.text}
            </p>
          </div>
        </div>
      );
    default:
      return null;
  }
}
