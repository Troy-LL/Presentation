import type * as Party from "partykit/server";

import type {
  ClientMessage,
  PollInteraction,
  PromptInteraction,
  ServerMessage,
  SessionSnapshot,
  SessionStatus
} from "@interactive-presentation/types";

type RoomState = {
  sessionCode: string;
  status: SessionStatus;
  createdAt: string;
  hostToken: string | null;
  currentInteraction: PromptInteraction | PollInteraction | null;
  participants: Map<string, string>;
  hosts: Set<string>;
  // Rate limiting: participantId → interaction ID they last responded to
  lastResponseByParticipant: Map<string, string>;
  // Rate limiting: participantId → timestamps of recent emoji reactions
  reactionTimestamps: Map<string, number[]>;
};

function createEmptyState(sessionCode: string): RoomState {
  return {
    sessionCode,
    status: "lobby",
    createdAt: new Date().toISOString(),
    hostToken: null,
    currentInteraction: null,
    participants: new Map(),
    hosts: new Set(),
    lastResponseByParticipant: new Map(),
    reactionTimestamps: new Map()
  };
}

function snapshotFromState(state: RoomState): SessionSnapshot {
  return {
    sessionCode: state.sessionCode,
    status: state.status,
    currentInteraction: state.currentInteraction,
    participantCount: state.participants.size,
    createdAt: state.createdAt
  };
}

function serialize(message: ServerMessage) {
  return JSON.stringify(message);
}

export default class SessionServer implements Party.Server {
  private state: RoomState;

  constructor(readonly room: Party.Room) {
    this.state = createEmptyState(this.room.id);
  }

  async onStart() {
    const status = await this.room.storage.get<SessionStatus>("status");
    const hostToken = await this.room.storage.get<string>("hostToken");

    if (status) {
      this.state.status = status;
    }
    if (hostToken) {
      this.state.hostToken = hostToken;
    }
  }

  private bumpAlarm() {
    // Set alarm for 5 minutes (300,000 ms) in the future
    this.room.storage.setAlarm(Date.now() + 5 * 60 * 1000);
  }

  async onAlarm() {
    // Check if any clients are still connected (Host or Audience)
    const connections = Array.from(this.room.getConnections());
    if (connections.length > 0) {
      // Activity detected via active connection. Reschedule shutdown.
      this.bumpAlarm();
      return;
    }

    this.state.status = "closed";
    await this.room.storage.put("status", "closed");
    this.broadcast({
      type: "server.session_snapshot",
      snapshot: snapshotFromState(this.state)
    });
  }

  onConnect(connection: Party.Connection) {
    this.bumpAlarm();
    return;
  }

  onClose(connection: Party.Connection) {
    const participantLeft = this.state.participants.delete(connection.id);
    const hostLeft = this.state.hosts.delete(connection.id);

    if (participantLeft || hostLeft) {
      this.broadcast({
        type: "server.participant_count",
        participantCount: this.state.participants.size
      });
    }
  }

  async onMessage(rawMessage: string, sender: Party.Connection) {
    this.bumpAlarm();
    const message = JSON.parse(rawMessage) as ClientMessage;

    switch (message.type) {
      case "client.join":
        if (!this.state.hostToken || this.state.status === "closed") {
          sender.send(serialize({ type: "server.error", message: "Session not available." }));
          return;
        }

        this.state.participants.set(sender.id, message.participantId);
        sender.send(
          serialize({
            type: "server.session_snapshot",
            snapshot: snapshotFromState(this.state)
          })
        );
        this.broadcast({
          type: "server.participant_count",
          participantCount: this.state.participants.size
        });
        return;

      case "client.host_connect":
        console.log(`[host_connect] Room: ${this.room.id}. Stored token: ${this.state.hostToken}, Received: ${message.hostToken}`);
        if (!this.isValidHost(message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Host token rejected." }));
          return;
        }

        this.state.hosts.add(sender.id);
        sender.send(
          serialize({
            type: "server.session_snapshot",
            snapshot: snapshotFromState(this.state)
          })
        );
        return;

      case "client.start_prompt":
        if (!this.canControlRoom(sender.id, message.hostToken) || !message.text.trim()) {
          sender.send(serialize({ type: "server.error", message: "Prompt launch rejected." }));
          return;
        }

        this.state.currentInteraction = {
          id: crypto.randomUUID(),
          type: "prompt",
          payload: {
            text: message.text.trim()
          },
          startedAt: new Date().toISOString(),
          closedAt: null
        };
        this.state.status = "active";
        await this.room.storage.put("status", "active");
        this.broadcast({
          type: "server.interaction_started",
          interaction: this.state.currentInteraction
        });
        return;

      case "client.start_poll": {
        if (!this.canControlRoom(sender.id, message.hostToken) || !message.question.trim() || message.options.length < 2) {
          sender.send(serialize({ type: "server.error", message: "Poll launch rejected." }));
          return;
        }

        const options = message.options
          .filter((o) => o.trim())
          .map((o) => ({ id: crypto.randomUUID(), text: o.trim() }));

        const votes: Record<string, number> = {};
        for (const opt of options) {
          votes[opt.id] = 0;
        }

        this.state.currentInteraction = {
          id: crypto.randomUUID(),
          type: "poll",
          payload: { question: message.question.trim(), options },
          votes,
          resultsRevealed: false,
          startedAt: new Date().toISOString(),
          closedAt: null
        };
        this.state.status = "active";
        await this.room.storage.put("status", "active");
        this.broadcast({
          type: "server.interaction_started",
          interaction: this.state.currentInteraction
        });
        return;
      }

      case "client.submit_vote": {
        const poll = this.state.currentInteraction;
        if (!poll || poll.type !== "poll") return;

        // One vote per participant per poll
        const participantId = this.state.participants.get(sender.id) ?? sender.id;
        if (this.hasAlreadyResponded(participantId)) return;
        if (!(message.optionId in poll.votes)) return;

        poll.votes[message.optionId] = (poll.votes[message.optionId] ?? 0) + 1;
        this.recordResponse(participantId);

        // Debounced broadcast — flush immediately for now, can batch later
        this.broadcast({
          type: "server.poll_votes_updated",
          votes: { ...poll.votes }
        });
        return;
      }

      case "client.reveal_poll_results": {
        const poll = this.state.currentInteraction;
        if (!this.canControlRoom(sender.id, message.hostToken) || !poll || poll.type !== "poll") {
          sender.send(serialize({ type: "server.error", message: "Reveal rejected." }));
          return;
        }

        poll.resultsRevealed = true;
        this.broadcast({ type: "server.poll_results_revealed" });
        return;
      }

      case "client.clear_interaction":
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Clear interaction rejected." }));
          return;
        }

        this.state.currentInteraction = null;
        this.state.status = "lobby";
        await this.room.storage.put("status", "lobby");
        // Reset per-interaction rate limit state when a new round begins
        this.state.lastResponseByParticipant.clear();
        this.broadcast({
          type: "server.interaction_cleared"
        });
        return;

      case "client.close_session":
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Close session rejected." }));
          return;
        }

        await this.onAlarm();
        return;
    }
  }

  async onRequest(request: Party.Request) {
    this.bumpAlarm();

    if (request.method === "GET") {
      if (!this.state.hostToken) {
        return Response.json({ error: "Session not found." }, { status: 404 });
      }

      return Response.json(snapshotFromState(this.state));
    }

    if (request.method === "POST") {
      const payload = (await request.json()) as { action?: string; hostToken?: string };

      if (payload.action !== "initialize_session" || !payload.hostToken) {
        console.log(`[POST] Invalid request to room ${this.room.id}:`, payload);
        return Response.json({ error: "Invalid session initialization request." }, { status: 400 });
      }

      if (this.state.hostToken) {
        console.log(`[POST] 409 Conflict. Room: ${this.room.id}, expected to be null but got hostToken: ${this.state.hostToken}`);
        return Response.json({ error: "Session already exists." }, { status: 409 });
      }

      this.state = {
        ...createEmptyState(this.room.id),
        hostToken: payload.hostToken
      };
      
      await Promise.all([
        this.room.storage.put("hostToken", payload.hostToken),
        this.room.storage.put("status", "lobby")
      ]);

      return Response.json(snapshotFromState(this.state), { status: 201 });
    }

    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  private isValidHost(hostToken: string) {
    return Boolean(this.state.hostToken && this.state.hostToken === hostToken);
  }

  private canControlRoom(connectionId: string, hostToken: string) {
    return this.state.hosts.has(connectionId) && this.isValidHost(hostToken);
  }

  /**
   * Returns true if this participant has already responded to the current interaction.
   * Silently blocks duplicate submissions (one response per participant per interaction).
   */
  protected hasAlreadyResponded(participantId: string): boolean {
    if (!this.state.currentInteraction) {
      return false;
    }
    const interactionId = this.state.currentInteraction.id;
    const last = this.state.lastResponseByParticipant.get(participantId);
    return last === interactionId;
  }

  protected recordResponse(participantId: string): void {
    if (this.state.currentInteraction) {
      this.state.lastResponseByParticipant.set(participantId, this.state.currentInteraction.id);
    }
  }

  /**
   * Returns true if the participant is within the allowed emoji reaction rate (max 5/sec).
   * Older timestamps are pruned on each call to keep memory bounded.
   */
  protected isWithinReactionRateLimit(participantId: string): boolean {
    const now = Date.now();
    const windowMs = 1000;
    const maxPerWindow = 5;
    const timestamps = (this.state.reactionTimestamps.get(participantId) ?? []).filter(
      (t) => now - t < windowMs
    );
    if (timestamps.length >= maxPerWindow) {
      return false;
    }
    timestamps.push(now);
    this.state.reactionTimestamps.set(participantId, timestamps);
    return true;
  }

  private broadcast(message: ServerMessage) {
    this.room.broadcast(serialize(message));
  }
}
