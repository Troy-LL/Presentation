"use client";

import PartySocket from "partysocket";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ClientMessage,
  HostPreset,
  ServerMessage,
  SessionSnapshot,
  VoiceSessionState
} from "@interactive-presentation/types";

type UseSessionConnectionOptions = {
  sessionCode: string;
  role: "host" | "audience";
  hostToken?: string | null;
  participantId?: string | null;
  enabled: boolean;
  initialSnapshot: SessionSnapshot | null;
};

function getPartyHost() {
  return process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";
}

export function useSessionConnection({
  sessionCode,
  role,
  hostToken,
  participantId,
  enabled,
  initialSnapshot
}: UseSessionConnectionOptions) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(initialSnapshot);
  const [connectionState, setConnectionState] = useState<"idle" | "connecting" | "connected" | "disconnected">(
    enabled ? "connecting" : "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [latestReactionEmoji, setLatestReactionEmoji] = useState<string | null>(null);
  const [latestAttentionNudge, setLatestAttentionNudge] = useState<{ message: string; sentAt: string } | null>(null);
  const [hostPresets, setHostPresets] = useState<HostPreset[]>([]);
  const [voiceSession, setVoiceSession] = useState<VoiceSessionState | null>(null);
  const socketRef = useRef<PartySocket | null>(null);
  const snapshotRef = useRef<SessionSnapshot | null>(initialSnapshot);
  const prevInteractionRef = useRef<SessionSnapshot["currentInteraction"]>(null);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    snapshotRef.current = initialSnapshot;
  }, [initialSnapshot]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = new PartySocket({
      host: getPartyHost(),
      room: sessionCode,
      party: "session"
    });

    socketRef.current = socket;
    setConnectionState("connecting");
    setError(null);

    socket.addEventListener("open", () => {
      setConnectionState("connected");

      const connectMessage: ClientMessage =
        role === "host" && hostToken
          ? { type: "client.host_connect", hostToken }
          : { type: "client.join", participantId: participantId ?? "" };

      socket.send(JSON.stringify(connectMessage));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage;

      switch (message.type) {
        case "server.session_snapshot":
          snapshotRef.current = message.snapshot;
          setSnapshot(message.snapshot);
          prevInteractionRef.current = message.snapshot.currentInteraction;
          break;
        case "server.participant_count":
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  participantCount: message.participantCount
                }
              : current
          );
          break;
        case "server.interaction_started":
          setLatestReactionEmoji(null);
          prevInteractionRef.current = message.interaction;
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  status: "active",
                  currentInteraction: message.interaction
                }
              : current
          );
          break;
        case "server.poll_votes_updated":
          setSnapshot((current) => {
            if (!current || current.currentInteraction?.type !== "poll") return current;
            return {
              ...current,
              currentInteraction: {
                ...current.currentInteraction,
                votes: message.votes
              }
            };
          });
          break;
        case "server.reactions_updated":
          setLatestReactionEmoji(message.latestEmoji);
          setSnapshot((current) => {
            if (!current || current.currentInteraction?.type !== "reactions") return current;
            return {
              ...current,
              currentInteraction: {
                ...current.currentInteraction,
                reactionCounts: message.reactionCounts
              }
            };
          });
          break;
        case "server.open_text_responses_updated":
          setSnapshot((current) => {
            if (!current || current.currentInteraction?.type !== "open_text") return current;
            return {
              ...current,
              currentInteraction: {
                ...current.currentInteraction,
                responses: message.responses,
                responseCount: message.responseCount
              }
            };
          });
          break;
        case "server.countdown_started":
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  status: "active",
                  currentInteraction: message.interaction
                }
              : current
          );
          break;
        case "server.slide_set":
          setSnapshot((current) => {
            if (!current || current.currentInteraction?.type !== "slides") return current;
            return {
              ...current,
              currentInteraction: {
                ...current.currentInteraction,
                payload: {
                  ...current.currentInteraction.payload,
                  currentSlideIndex: message.index
                }
              }
            };
          });
          break;
        case "server.attention_nudge":
          setLatestAttentionNudge({ message: message.message, sentAt: message.sentAt });
          break;
        case "server.quiz_votes_updated":
          setSnapshot((current) => {
            if (!current || current.currentInteraction?.type !== "quiz") return current;
            return {
              ...current,
              currentInteraction: {
                ...current.currentInteraction,
                votes: message.votes
              }
            };
          });
          break;
        case "server.poll_results_revealed":
          setSnapshot((current) => {
            if (!current || current.currentInteraction?.type !== "poll") return current;
            return {
              ...current,
              currentInteraction: {
                ...current.currentInteraction,
                resultsRevealed: true
              }
            };
          });
          break;
        case "server.quiz_answer_revealed":
          setSnapshot((current) => {
            if (!current || current.currentInteraction?.type !== "quiz") return current;
            return {
              ...current,
              currentInteraction: {
                ...current.currentInteraction,
                answerRevealed: true
              }
            };
          });
          break;
        case "server.interaction_cleared":
          setLatestReactionEmoji(null);
          prevInteractionRef.current = null;
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  status: "lobby",
                  currentInteraction: null
                }
              : current
          );
          break;
        case "server.error":
          setError(message.message);
          break;
        case "server.host_presets_updated":
          setHostPresets(message.presets);
          break;
        case "server.voice_session_updated":
          setVoiceSession(message.voiceSession);
          break;
      }
    });

    socket.addEventListener("close", () => {
      setConnectionState("disconnected");
    });

    socket.addEventListener("error", () => {
      setError("Realtime connection lost.");
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [enabled, hostToken, participantId, role, sessionCode]);

  const actions = useMemo(
    () => ({
      startPrompt(text: string) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.start_prompt", hostToken, text: text.trim() };
        socketRef.current.send(JSON.stringify(message));
      },
      startPoll(question: string, options: string[]) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.start_poll", hostToken, question, options };
        socketRef.current.send(JSON.stringify(message));
      },
      startQuiz(question: string, options: string[], correctOptionIndex: number) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = {
          type: "client.start_quiz",
          hostToken,
          question,
          options,
          correctOptionIndex
        };
        socketRef.current.send(JSON.stringify(message));
      },
      startReactions(prompt: string, emojis: string[]) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.start_reactions", hostToken, prompt, emojis };
        socketRef.current.send(JSON.stringify(message));
      },
      startOpenText(prompt: string) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.start_open_text", hostToken, prompt };
        socketRef.current.send(JSON.stringify(message));
      },
      startCountdown(label: string, durationSeconds: number) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = {
          type: "client.start_countdown",
          hostToken,
          label,
          durationSeconds
        };
        socketRef.current.send(JSON.stringify(message));
      },
      startSlideDeck(deckId: string, title: string | null, sourceUrl: string, totalSlides: number) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = {
          type: "client.start_slide_deck",
          hostToken,
          deckId,
          title,
          sourceUrl,
          totalSlides
        };
        socketRef.current.send(JSON.stringify(message));
      },
      sendAttentionNudge(text?: string) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = {
          type: "client.send_attention_nudge",
          hostToken,
          message: text?.trim() || undefined
        };
        socketRef.current.send(JSON.stringify(message));
      },
      submitVote(optionId: string) {
        if (!socketRef.current) return;
        const message: ClientMessage = { type: "client.submit_vote", optionId };
        socketRef.current.send(JSON.stringify(message));
      },
      submitQuizAnswer(optionId: string) {
        if (!socketRef.current) return;
        const message: ClientMessage = { type: "client.submit_quiz_answer", optionId };
        socketRef.current.send(JSON.stringify(message));
      },
      sendReaction(emoji: string) {
        if (!socketRef.current) return;
        const message: ClientMessage = { type: "client.send_reaction", emoji };
        socketRef.current.send(JSON.stringify(message));
      },
      submitTextResponse(text: string) {
        if (!socketRef.current) return;
        const message: ClientMessage = { type: "client.submit_text_response", text };
        socketRef.current.send(JSON.stringify(message));
      },
      setSlide(index: number) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.set_slide", hostToken, index };
        socketRef.current.send(JSON.stringify(message));
      },
      nextSlide() {
        if (!socketRef.current || !hostToken || snapshotRef.current?.currentInteraction?.type !== "slides") return;
        const current = snapshotRef.current.currentInteraction;
        const nextIndex = Math.min(current.payload.totalSlides - 1, current.payload.currentSlideIndex + 1);
        const message: ClientMessage = { type: "client.set_slide", hostToken, index: nextIndex };
        socketRef.current.send(JSON.stringify(message));
      },
      prevSlide() {
        if (!socketRef.current || !hostToken || snapshotRef.current?.currentInteraction?.type !== "slides") return;
        const current = snapshotRef.current.currentInteraction;
        const prevIndex = Math.max(0, current.payload.currentSlideIndex - 1);
        const message: ClientMessage = { type: "client.set_slide", hostToken, index: prevIndex };
        socketRef.current.send(JSON.stringify(message));
      },
      revealPollResults() {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.reveal_poll_results", hostToken };
        socketRef.current.send(JSON.stringify(message));
      },
      revealQuizAnswer() {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.reveal_quiz_answer", hostToken };
        socketRef.current.send(JSON.stringify(message));
      },
      clearInteraction() {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.clear_interaction", hostToken };
        socketRef.current.send(JSON.stringify(message));
      },
      closeSession() {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = { type: "client.close_session", hostToken };
        socketRef.current.send(JSON.stringify(message));
      },
      updateHostPresets(presets: HostPreset[]) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = {
          type: "client.update_host_presets",
          hostToken,
          presets
        };
        socketRef.current.send(JSON.stringify(message));
      },
      updateVoiceSession(voiceSessionState: VoiceSessionState) {
        if (!socketRef.current || !hostToken) return;
        const message: ClientMessage = {
          type: "client.update_voice_session",
          hostToken,
          voiceSession: voiceSessionState
        };
        socketRef.current.send(JSON.stringify(message));
      }
    }),
    [hostToken]
  );

  return {
    snapshot,
    connectionState,
    error,
    latestReactionEmoji,
    latestAttentionNudge,
    hostPresets,
    voiceSession,
    ...actions
  };
}

