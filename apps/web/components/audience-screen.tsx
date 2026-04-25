"use client";

import { useEffect, useState } from "react";

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

        if (!active) {
          return;
        }

        setInitialSnapshot(payload);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setLoadError(
          caughtError instanceof Error ? caughtError.message : "This session does not exist."
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

  const {
    snapshot,
    connectionState,
    error,
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Joining session…</p>
      </main>
    );
  }

  if (loadError || !snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
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
    );
  }

  if (snapshot.status === "closed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Session Closed</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Thanks for participating!
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            This presentation room has been automatically closed due to inactivity, or the host has permanently ended it.
          </p>
        </div>
      </main>
    );
  }

  if (snapshot.currentInteraction?.type === "poll") {
    return (
      <AudiencePoll
        onVote={submitVote}
        poll={snapshot.currentInteraction}
      />
    );
  }

  if (snapshot.currentInteraction?.type === "prompt") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-8 text-center">
        <div className="max-w-5xl">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-300">Live prompt</p>
          <h1 className="mt-8 text-5xl font-semibold tracking-tight text-slate-950 md:text-7xl">
            {snapshot.currentInteraction.payload.text}
          </h1>
          {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
        </div>
      </main>
    );
  }

  if (snapshot.currentInteraction?.type === "quiz") {
    return (
      <AudienceQuiz
        onSubmitAnswer={submitQuizAnswer}
        quiz={snapshot.currentInteraction}
      />
    );
  }

  if (snapshot.currentInteraction?.type === "reactions") {
    return (
      <AudienceReactions
        onSendReaction={sendReaction}
        reactions={snapshot.currentInteraction}
      />
    );
  }

  if (snapshot.currentInteraction?.type === "open_text") {
    return (
      <AudienceOpenText
        interaction={snapshot.currentInteraction}
        onSubmit={submitTextResponse}
      />
    );
  }

  if (snapshot.currentInteraction?.type === "countdown") {
    return <AudienceCountdown interaction={snapshot.currentInteraction} />;
  }

  if (snapshot.currentInteraction?.type === "slides") {
    return <AudienceSlideStage interaction={snapshot.currentInteraction} />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-white px-6 text-center">
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
  );
}
