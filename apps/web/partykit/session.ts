import type * as Party from "partykit/server";

import type {
  ClientMessage,
  CountdownInteraction,
  OpenTextInteraction,
  OpenTextResponse,
  PollInteraction,
  PromptInteraction,
  ReactionsInteraction,
  SlideDeckInteraction,
  QuizInteraction,
  ServerMessage,
  SessionSnapshot,
  SessionStatus
} from "@interactive-presentation/types";

type RoomState = {
  sessionCode: string;
  status: SessionStatus;
  createdAt: string;
  hostToken: string | null;
  currentInteraction:
    | PromptInteraction
    | PollInteraction
    | QuizInteraction
    | ReactionsInteraction
    | OpenTextInteraction
    | CountdownInteraction
    | SlideDeckInteraction
    | null;
  participants: Map<string, string>;
  hosts: Set<string>;
  // Rate limiting: participantId → interaction ID they last responded to
  lastResponseByParticipant: Map<string, string>;
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
  private static readonly MAX_OPEN_TEXT_LENGTH = 280;
  private static readonly MAX_OPEN_TEXT_RESPONSES = 200;

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
    // If hosts are still connected, skip self-destruct and reset the normal inactivity timer
    if (this.state.hosts.size > 0) {
      this.bumpAlarm();
      return;
    }

    // No host connected or session was inactive: close it down and wipe storage to save DB space
    this.state.status = "closed";
    this.broadcast({
      type: "server.session_snapshot",
      snapshot: snapshotFromState(this.state)
    });
    await this.room.storage.deleteAll();
  }

  onConnect(connection: Party.Connection) {
    void connection;
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

    if (hostLeft && this.state.hosts.size === 0 && this.state.status !== "closed") {
      // Host left. Set a 15-second grace period alarm in case they just refreshed the page.
      // If they don't return, onAlarm will trigger and wipe the room's DB.
      this.room.storage.setAlarm(Date.now() + 15 * 1000);
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
        this.state.lastResponseByParticipant.clear(); // Reset rate limit for new interaction
        await this.room.storage.put("status", "active");
        this.broadcast({
          type: "server.interaction_started",
          interaction: this.state.currentInteraction
        });
        return;

      case "client.start_poll": {
        const question = message.question.trim();
        const options = message.options
          .map((option) => option.trim())
          .filter(Boolean)
          .slice(0, 10)
          .map((text) => ({ id: crypto.randomUUID(), text }));

        if (!this.canControlRoom(sender.id, message.hostToken) || !question || options.length < 2) {
          sender.send(serialize({ type: "server.error", message: "Poll launch rejected." }));
          return;
        }

        const votes: Record<string, number> = {};
        for (const opt of options) {
          votes[opt.id] = 0;
        }

        this.state.currentInteraction = {
          id: crypto.randomUUID(),
          type: "poll",
          payload: { question, options },
          votes,
          resultsRevealed: false,
          startedAt: new Date().toISOString(),
          closedAt: null
        };
        this.state.status = "active";
        this.state.lastResponseByParticipant.clear(); // Reset rate limit for new interaction
        await this.room.storage.put("status", "active");
        this.broadcast({
          type: "server.interaction_started",
          interaction: this.state.currentInteraction
        });
        return;
      }

      case "client.start_quiz": {
        const question = message.question.trim();
        const options = message.options
          .map((option) => option.trim())
          .filter(Boolean)
          .slice(0, 10)
          .map((text) => ({ id: crypto.randomUUID(), text }));
        const correctOptionId = options[message.correctOptionIndex]?.id;

        if (
          !this.canControlRoom(sender.id, message.hostToken) ||
          !question ||
          options.length < 2 ||
          !correctOptionId
        ) {
          sender.send(serialize({ type: "server.error", message: "Quiz launch rejected." }));
          return;
        }

        const votes: Record<string, number> = {};
        for (const opt of options) {
          votes[opt.id] = 0;
        }

        this.state.currentInteraction = {
          id: crypto.randomUUID(),
          type: "quiz",
          payload: { question, options, correctOptionId },
          votes,
          answerRevealed: false,
          startedAt: new Date().toISOString(),
          closedAt: null
        };
        this.state.status = "active";
        this.state.lastResponseByParticipant.clear();
        await this.room.storage.put("status", "active");
        this.broadcast({
          type: "server.interaction_started",
          interaction: this.state.currentInteraction
        });
        return;
      }

      case "client.start_reactions": {
        const prompt = message.prompt.trim();
        const emojis = message.emojis.map((emoji) => emoji.trim()).filter(Boolean).slice(0, 8);

        if (!this.canControlRoom(sender.id, message.hostToken) || !prompt || emojis.length < 2) {
          sender.send(serialize({ type: "server.error", message: "Reaction mode launch rejected." }));
          return;
        }

        const reactionCounts: Record<string, number> = {};
        for (const emoji of emojis) {
          reactionCounts[emoji] = 0;
        }

        this.state.currentInteraction = {
          id: crypto.randomUUID(),
          type: "reactions",
          payload: { prompt, emojis },
          reactionCounts,
          startedAt: new Date().toISOString(),
          closedAt: null
        };
        this.state.status = "active";
        this.state.reactionTimestamps.clear();
        await this.room.storage.put("status", "active");
        this.broadcast({
          type: "server.interaction_started",
          interaction: this.state.currentInteraction
        });
        return;
      }
      case "client.start_open_text": {
        const prompt = message.prompt.trim();

        if (!this.canControlRoom(sender.id, message.hostToken) || !prompt) {
          sender.send(serialize({ type: "server.error", message: "Open text launch rejected." }));
          return;
        }

        this.state.currentInteraction = {
          id: crypto.randomUUID(),
          type: "open_text",
          payload: { prompt },
          responses: [],
          responseCount: 0,
          startedAt: new Date().toISOString(),
          closedAt: null
        };
        this.state.status = "active";
        this.state.lastResponseByParticipant.clear();
        await this.room.storage.put("status", "active");
        this.broadcast({
          type: "server.interaction_started",
          interaction: this.state.currentInteraction
        });
        return;
      }
      case "client.start_countdown": {
        const label = message.label.trim();
        const durationSeconds = Math.floor(message.durationSeconds);

        if (
          !this.canControlRoom(sender.id, message.hostToken) ||
          !label ||
          !Number.isFinite(durationSeconds) ||
          durationSeconds < 3 ||
          durationSeconds > 3600
        ) {
          sender.send(serialize({ type: "server.error", message: "Countdown launch rejected." }));
          return;
        }

        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000).toISOString();

        this.state.currentInteraction = {
          id: crypto.randomUUID(),
          type: "countdown",
          payload: {
            label,
            durationSeconds,
            endsAt
          },
          startedAt: startedAt.toISOString(),
          closedAt: null
        };
        this.state.status = "active";
        await this.room.storage.put("status", "active");
        this.broadcast({
          type: "server.interaction_started",
          interaction: this.state.currentInteraction
        });
        this.broadcast({
          type: "server.countdown_started",
          interaction: this.state.currentInteraction
        });
        return;
      }
      case "client.start_slide_deck": {
        const title = message.title?.trim() || null;
        const sourceUrl = message.sourceUrl.trim();
        const totalSlides = Math.floor(message.totalSlides);

        if (
          !this.canControlRoom(sender.id, message.hostToken) ||
          !message.deckId.trim() ||
          !sourceUrl ||
          !Number.isFinite(totalSlides) ||
          totalSlides < 1 ||
          totalSlides > 2000
        ) {
          sender.send(serialize({ type: "server.error", message: "Slide deck launch rejected." }));
          return;
        }

        this.state.currentInteraction = {
          id: crypto.randomUUID(),
          type: "slides",
          payload: {
            deckId: message.deckId.trim(),
            title,
            sourceUrl,
            totalSlides,
            currentSlideIndex: 0
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

      case "client.submit_quiz_answer": {
        const quiz = this.state.currentInteraction;
        if (!quiz || quiz.type !== "quiz") return;

        const participantId = this.state.participants.get(sender.id) ?? sender.id;
        if (this.hasAlreadyResponded(participantId)) return;
        if (!(message.optionId in quiz.votes)) return;

        quiz.votes[message.optionId] = (quiz.votes[message.optionId] ?? 0) + 1;
        this.recordResponse(participantId);

        this.broadcast({
          type: "server.quiz_votes_updated",
          votes: { ...quiz.votes }
        });
        return;
      }

      case "client.send_reaction": {
        const reactions = this.state.currentInteraction;
        if (!reactions || reactions.type !== "reactions") return;
        if (!(message.emoji in reactions.reactionCounts)) return;

        const participantId = this.state.participants.get(sender.id) ?? sender.id;
        if (!this.isWithinReactionRateLimit(participantId)) return;

        reactions.reactionCounts[message.emoji] = (reactions.reactionCounts[message.emoji] ?? 0) + 1;
        this.broadcast({
          type: "server.reactions_updated",
          reactionCounts: { ...reactions.reactionCounts },
          latestEmoji: message.emoji
        });
        return;
      }
      case "client.submit_text_response": {
        const interaction = this.state.currentInteraction;
        if (!interaction || interaction.type !== "open_text") return;

        const participantId = this.state.participants.get(sender.id) ?? sender.id;
        if (this.hasAlreadyResponded(participantId)) return;

        const text = message.text.trim().slice(0, SessionServer.MAX_OPEN_TEXT_LENGTH);
        if (!text) return;

        const response: OpenTextResponse = {
          id: crypto.randomUUID(),
          participantId,
          text,
          submittedAt: new Date().toISOString()
        };

        interaction.responses = [response, ...interaction.responses].slice(
          0,
          SessionServer.MAX_OPEN_TEXT_RESPONSES
        );
        interaction.responseCount += 1;
        this.recordResponse(participantId);

        this.broadcast({
          type: "server.open_text_responses_updated",
          responses: interaction.responses,
          responseCount: interaction.responseCount
        });
        return;
      }
      case "client.set_slide": {
        const interaction = this.state.currentInteraction;
        if (
          !this.canControlRoom(sender.id, message.hostToken) ||
          !interaction ||
          interaction.type !== "slides"
        ) {
          sender.send(serialize({ type: "server.error", message: "Slide update rejected." }));
          return;
        }

        const index = Math.floor(message.index);
        if (
          !Number.isFinite(index) ||
          index < 0 ||
          index >= interaction.payload.totalSlides
        ) {
          sender.send(serialize({ type: "server.error", message: "Slide index out of range." }));
          return;
        }

        interaction.payload.currentSlideIndex = index;
        this.broadcast({
          type: "server.slide_set",
          index
        });
        this.broadcast({
          type: "server.interaction_started",
          interaction
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

      case "client.reveal_quiz_answer": {
        const quiz = this.state.currentInteraction;
        if (!this.canControlRoom(sender.id, message.hostToken) || !quiz || quiz.type !== "quiz") {
          sender.send(serialize({ type: "server.error", message: "Reveal rejected." }));
          return;
        }

        quiz.answerRevealed = true;
        this.broadcast({ type: "server.quiz_answer_revealed" });
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
        this.state.reactionTimestamps.clear();
        this.broadcast({
          type: "server.interaction_cleared"
        });
        return;

      case "client.close_session":
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Close session rejected." }));
          return;
        }

        this.state.status = "closed";
        this.broadcast({
          type: "server.session_snapshot",
          snapshot: snapshotFromState(this.state)
        });
        await this.room.storage.deleteAll();
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
        console.warn(`[POST] Invalid initialize_session payload for room ${this.room.id}.`);
        return Response.json({ error: "Invalid session initialization request." }, { status: 400 });
      }

      if (this.state.hostToken) {
        console.warn(`[POST] Session already exists for room ${this.room.id}.`);
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
