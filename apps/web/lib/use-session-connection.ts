"use client";

import PartySocket from "partysocket";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ClientMessage,
  ServerMessage,
  SessionSnapshot
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
  const socketRef = useRef<PartySocket | null>(null);
  const prevInteractionRef = useRef<SessionSnapshot["currentInteraction"]>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

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
        case "server.interaction_cleared":
          if (prevInteractionRef.current !== null) {
            setSessionEnded(true);
          }
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
        if (!socketRef.current || !hostToken) {
          return;
        }

        const message: ClientMessage = {
          type: "client.start_prompt",
          hostToken,
          text: text.trim()
        };

        socketRef.current.send(JSON.stringify(message));
      },
      clearInteraction() {
        if (!socketRef.current || !hostToken) {
          return;
        }

        const message: ClientMessage = {
          type: "client.clear_interaction",
          hostToken
        };

        socketRef.current.send(JSON.stringify(message));
      },
      closeSession() {
        if (!socketRef.current || !hostToken) {
          return;
        }

        const message: ClientMessage = {
          type: "client.close_session",
          hostToken
        };

        socketRef.current.send(JSON.stringify(message));
      }
    }),
    [hostToken]
  );

  return {
    snapshot,
    connectionState,
    sessionEnded,
    error,
    ...actions
  };
}

