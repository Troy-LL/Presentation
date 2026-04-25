import { z } from "zod";

import type { SessionHistoryResponse, SessionSnapshot } from "@interactive-presentation/types";

const snapshotSchema = z.object({
  sessionCode: z.string(),
  status: z.union([z.literal("lobby"), z.literal("active"), z.literal("closed")]),
  currentInteraction: z
    .object({
      id: z.string(),
      type: z.string(),
      payload: z.record(z.string(), z.unknown()),
      startedAt: z.string(),
      closedAt: z.string().nullable()
    })
    .passthrough()
    .nullable(),
  participantCount: z.number(),
  createdAt: z.string()
});

function getPartyBaseUrl() {
  let url = process.env.PARTYKIT_SERVER_URL ?? "http://127.0.0.1:1999";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/$/, "");
}

function roomUrl(sessionCode: string) {
  return `${getPartyBaseUrl()}/parties/session/${sessionCode}`;
}

export async function initializeSessionRoom(sessionCode: string, hostToken: string) {
  const response = await fetch(roomUrl(sessionCode), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "initialize_session",
      hostToken
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Could not initialize the realtime room.");
  }
}

export async function getSessionSnapshot(sessionCode: string): Promise<SessionSnapshot> {
  const response = await fetch(roomUrl(sessionCode), {
    method: "GET",
    cache: "no-store"
  });

  if (response.status === 404) {
    throw new Error("Session not found.");
  }

  if (!response.ok) {
    throw new Error("Could not fetch session snapshot.");
  }

  return snapshotSchema.parse(await response.json()) as SessionSnapshot;
}

export async function getSessionHistory(
  sessionCode: string,
  hostToken: string
): Promise<SessionHistoryResponse> {
  const response = await fetch(roomUrl(sessionCode), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "get_history",
      hostToken
    }),
    cache: "no-store"
  });

  if (response.status === 404) {
    throw new Error("Session not found.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Could not fetch session history.");
  }

  const payload = (await response.json()) as SessionHistoryResponse;
  return payload;
}

