import type * as Party from "partykit/server";

import type {
  ClientMessage,
  CountdownInteraction,
  InteractionMetric,
  InteractionMetricOption,
  OpenTextInteraction,
  OpenTextResponse,
  PollInteraction,
  PromptInteraction,
  ReactionsInteraction,
  SessionHistoryEntry,
  SlideDeckInteraction,
  QuizInteraction,
  HostPreset,
  ServerMessage,
  SessionMetrics,
  SessionSnapshot,
  SessionStatus,
  VoiceSessionState
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
    | null;
  /** Independent slide deck — persists while non-slide interactions run. */
  currentSlideDeck: SlideDeckInteraction | null;
  participants: Map<string, string>;
  uniqueParticipantIds: Set<string>;
  hosts: Set<string>;
  peakConcurrentParticipants: number;
  history: SessionHistoryEntry[];
  sessionMetrics: SessionMetrics;
  hostPresets: HostPreset[];
  voiceSession: VoiceSessionState;
  lastResponseByParticipant: Map<string, string>;
  reactionTimestamps: Map<string, number[]>;
  lastNudgeAt: number | null;
  lastActiveSlideIndex: number | null;
};

function createEmptyState(sessionCode: string): RoomState {
  const createdAt = new Date().toISOString();
  return {
    sessionCode,
    status: "lobby",
    createdAt,
    hostToken: null,
    currentInteraction: null,
    currentSlideDeck: null,
    participants: new Map(),
    uniqueParticipantIds: new Set(),
    hosts: new Set(),
    peakConcurrentParticipants: 0,
    history: [],
    sessionMetrics: {
      sessionCode,
      startedAt: createdAt,
      endedAt: null,
      totalUniqueParticipants: 0,
      peakConcurrentParticipants: 0,
      interactionMetrics: []
    },
    hostPresets: [],
    voiceSession: {
      enabled: false,
      mode: "continuous",
      globalCommands: true,
      lastTriggeredAt: null
    },
    lastResponseByParticipant: new Map(),
    reactionTimestamps: new Map(),
    lastNudgeAt: null,
    lastActiveSlideIndex: null
  };
}

function snapshotFromState(state: RoomState): SessionSnapshot {
  return {
    sessionCode: state.sessionCode,
    status: state.status,
    currentInteraction: state.currentInteraction,
    currentSlideDeck: state.currentSlideDeck,
    participantCount: state.participants.size,
    activeHosts: state.hosts.size,
    createdAt: state.createdAt
  };
}

function serialize(message: ServerMessage) {
  return JSON.stringify(message);
}

function getInteractionPromptText(
  interaction:
    | PromptInteraction
    | PollInteraction
    | QuizInteraction
    | ReactionsInteraction
    | OpenTextInteraction
    | CountdownInteraction
    | SlideDeckInteraction
) {
  switch (interaction.type) {
    case "prompt":
      return interaction.payload.text;
    case "poll":
    case "quiz":
      return interaction.payload.question;
    case "reactions":
      return interaction.payload.prompt;
    case "open_text":
      return interaction.payload.prompt;
    case "countdown":
      return interaction.payload.label;
    case "slides":
      return interaction.payload.title ?? "Presentation";
  }
}

function buildOptionBreakdown(
  interaction: PollInteraction | QuizInteraction | ReactionsInteraction
): InteractionMetricOption[] {
  if (interaction.type === "reactions") {
    return [];
  }

  return interaction.payload.options.map((option) => ({
    optionId: option.id,
    optionText: option.text,
    voteCount: interaction.votes[option.id] ?? 0
  }));
}

export default class SessionServer implements Party.Server {
  private state: RoomState;
  private static readonly MAX_OPEN_TEXT_LENGTH = 280;
  private static readonly MAX_OPEN_TEXT_RESPONSES = 200;
  private static readonly MAX_HISTORY_ENTRIES = 120;

  constructor(readonly room: Party.Room) {
    this.state = createEmptyState(this.room.id);
  }

  async onStart() {
    const createdAt = await this.room.storage.get<string>("createdAt");
    const status = await this.room.storage.get<SessionStatus>("status");
    const hostToken = await this.room.storage.get<string>("hostToken");
    const history = await this.room.storage.get<SessionHistoryEntry[]>("history");
    const sessionMetrics = await this.room.storage.get<SessionMetrics>("sessionMetrics");
    const uniqueParticipantIds = await this.room.storage.get<string[]>("uniqueParticipantIds");
    const hostPresets = await this.room.storage.get<HostPreset[]>("hostPresets");
    const voiceSession = await this.room.storage.get<VoiceSessionState>("voiceSession");
    const lastActiveSlideIndex = await this.room.storage.get<number>("lastActiveSlideIndex");
    const currentSlideDeck = await this.room.storage.get<SlideDeckInteraction>("currentSlideDeck");

    if (createdAt) {
      this.state.createdAt = createdAt;
    }
    if (status) {
      this.state.status = status;
    }
    if (hostToken) {
      this.state.hostToken = hostToken;
    }
    if (history) {
      this.state.history = history;
    }
    if (sessionMetrics) {
      this.state.sessionMetrics = sessionMetrics;
      this.state.peakConcurrentParticipants = sessionMetrics.peakConcurrentParticipants;
    }
    if (uniqueParticipantIds) {
      this.state.uniqueParticipantIds = new Set(uniqueParticipantIds);
      this.state.sessionMetrics.totalUniqueParticipants = this.state.uniqueParticipantIds.size;
    }
    if (hostPresets) {
      this.state.hostPresets = hostPresets;
    }
    if (voiceSession) {
      this.state.voiceSession = voiceSession;
    }
    if (typeof lastActiveSlideIndex === "number") {
      this.state.lastActiveSlideIndex = lastActiveSlideIndex;
    }
    if (currentSlideDeck) {
      this.state.currentSlideDeck = currentSlideDeck;
    }
  }

  private async persistMetrics() {
    await Promise.all([
      this.room.storage.put("sessionMetrics", this.state.sessionMetrics),
      this.room.storage.put("uniqueParticipantIds", Array.from(this.state.uniqueParticipantIds)),
      this.room.storage.put("lastActiveSlideIndex", this.state.lastActiveSlideIndex),
      this.room.storage.put("currentSlideDeck", this.state.currentSlideDeck)
    ]);
  }

  private beginInteractionMetric(
    interaction:
      | PromptInteraction
      | PollInteraction
      | QuizInteraction
      | ReactionsInteraction
      | OpenTextInteraction
      | CountdownInteraction
      | SlideDeckInteraction
  ) {
    const participantsConnectedAtLaunch = this.state.participants.size;
    const metric: InteractionMetric = {
      interactionId: interaction.id,
      interactionType: interaction.type,
      promptText: getInteractionPromptText(interaction),
      slideIndexAtLaunch:
        interaction.type === "slides"
          ? interaction.payload.currentSlideIndex
          : this.state.lastActiveSlideIndex,
      participantsConnectedAtLaunch,
      totalResponsesReceived: 0,
      responseRate: 0,
      optionBreakdown:
        interaction.type === "poll" || interaction.type === "quiz" || interaction.type === "reactions"
          ? buildOptionBreakdown(interaction)
          : [],
      openTextResponses: [],
      startedAt: interaction.startedAt,
      endedAt: null,
      durationSeconds: null
    };

    this.state.sessionMetrics.interactionMetrics = [
      ...this.state.sessionMetrics.interactionMetrics,
      metric
    ];
  }

  private updateCurrentInteractionMetric(
    interactionId: string,
    updater: (metric: InteractionMetric) => InteractionMetric
  ) {
    this.state.sessionMetrics.interactionMetrics = this.state.sessionMetrics.interactionMetrics.map((metric) =>
      metric.interactionId === interactionId ? updater(metric) : metric
    );
  }

  private refreshMetricFromInteraction(
    interaction:
      | PromptInteraction
      | PollInteraction
      | QuizInteraction
      | ReactionsInteraction
      | OpenTextInteraction
      | CountdownInteraction
      | SlideDeckInteraction
  ) {
    this.updateCurrentInteractionMetric(interaction.id, (metric) => {
      if (interaction.type === "poll" || interaction.type === "quiz") {
        const optionBreakdown = buildOptionBreakdown(interaction);
        const totalResponsesReceived = optionBreakdown.reduce((sum, option) => sum + option.voteCount, 0);
        return {
          ...metric,
          optionBreakdown,
          totalResponsesReceived,
          responseRate:
            metric.participantsConnectedAtLaunch > 0
              ? totalResponsesReceived / metric.participantsConnectedAtLaunch
              : 0
        };
      }

      if (interaction.type === "reactions") {
        const totalResponsesReceived = Object.values(interaction.reactionCounts).reduce(
          (sum, count) => sum + count,
          0
        );
        return {
          ...metric,
          totalResponsesReceived,
          responseRate:
            metric.participantsConnectedAtLaunch > 0
              ? totalResponsesReceived / metric.participantsConnectedAtLaunch
              : 0
        };
      }

      if (interaction.type === "open_text") {
        return {
          ...metric,
          totalResponsesReceived: interaction.responseCount,
          responseRate:
            metric.participantsConnectedAtLaunch > 0
              ? interaction.responseCount / metric.participantsConnectedAtLaunch
              : 0,
          openTextResponses: interaction.responses.map((response) => response.text)
        };
      }

      return metric;
    });
  }

  private finalizeInteractionMetric(
    interaction:
      | PromptInteraction
      | PollInteraction
      | QuizInteraction
      | ReactionsInteraction
      | OpenTextInteraction
      | CountdownInteraction
      | SlideDeckInteraction,
    endedAt: string
  ) {
    this.refreshMetricFromInteraction(interaction);
    this.updateCurrentInteractionMetric(interaction.id, (metric) => ({
      ...metric,
      endedAt,
      durationSeconds: Math.max(
        0,
        Math.round((new Date(endedAt).getTime() - new Date(metric.startedAt).getTime()) / 1000)
      )
    }));
  }

  private buildSessionMetricsSnapshot(endedAt: string): SessionMetrics {
    const interactionMetrics = this.state.sessionMetrics.interactionMetrics.map((metric) => ({ ...metric }));
    const currentInteraction = this.state.currentInteraction;

    if (currentInteraction) {
      const currentMetricIndex = interactionMetrics.findIndex(
        (metric) => metric.interactionId === currentInteraction.id
      );

      if (currentMetricIndex >= 0) {
        const metric = interactionMetrics[currentMetricIndex];
        let totalResponsesReceived = metric.totalResponsesReceived;
        let optionBreakdown = metric.optionBreakdown;
        let openTextResponses = metric.openTextResponses;

        if (currentInteraction.type === "poll" || currentInteraction.type === "quiz") {
          optionBreakdown = buildOptionBreakdown(currentInteraction);
          totalResponsesReceived = optionBreakdown.reduce((sum, option) => sum + option.voteCount, 0);
        } else if (currentInteraction.type === "reactions") {
          totalResponsesReceived = Object.values(currentInteraction.reactionCounts).reduce(
            (sum, count) => sum + count,
            0
          );
        } else if (currentInteraction.type === "open_text") {
          totalResponsesReceived = currentInteraction.responseCount;
          openTextResponses = currentInteraction.responses.map((response) => response.text);
        }

        interactionMetrics[currentMetricIndex] = {
          ...metric,
          optionBreakdown,
          openTextResponses,
          totalResponsesReceived,
          responseRate:
            metric.participantsConnectedAtLaunch > 0
              ? totalResponsesReceived / metric.participantsConnectedAtLaunch
              : 0,
          endedAt,
          durationSeconds: Math.max(
            0,
            Math.round((new Date(endedAt).getTime() - new Date(metric.startedAt).getTime()) / 1000)
          )
        };
      }
    }

    return {
      ...this.state.sessionMetrics,
      endedAt,
      totalUniqueParticipants: this.state.uniqueParticipantIds.size,
      peakConcurrentParticipants: this.state.peakConcurrentParticipants,
      interactionMetrics
    };
  }

  private buildHistoryEntry(
    interaction:
      | PromptInteraction
      | PollInteraction
      | QuizInteraction
      | ReactionsInteraction
      | OpenTextInteraction
      | CountdownInteraction
      | SlideDeckInteraction,
    endedAt: string
  ): SessionHistoryEntry {
    if (interaction.type === "poll") {
      const totalVotes = Object.values(interaction.votes).reduce((acc, count) => acc + count, 0);
      const leader = interaction.payload.options.reduce<{ text: string; count: number } | null>((best, option) => {
        const count = interaction.votes[option.id] ?? 0;
        if (!best || count > best.count) return { text: option.text, count };
        return best;
      }, null);

      return {
        id: crypto.randomUUID(),
        interactionType: interaction.type,
        title: interaction.payload.question,
        startedAt: interaction.startedAt,
        endedAt,
        responses: totalVotes,
        participantCountAtClose: this.state.participants.size,
        topSignal: leader && leader.count > 0 ? leader.text : null
      };
    }

    if (interaction.type === "quiz") {
      const totalAnswers = Object.values(interaction.votes).reduce((acc, count) => acc + count, 0);
      const leader = interaction.payload.options.reduce<{ text: string; count: number } | null>((best, option) => {
        const count = interaction.votes[option.id] ?? 0;
        if (!best || count > best.count) return { text: option.text, count };
        return best;
      }, null);

      return {
        id: crypto.randomUUID(),
        interactionType: interaction.type,
        title: interaction.payload.question,
        startedAt: interaction.startedAt,
        endedAt,
        responses: totalAnswers,
        participantCountAtClose: this.state.participants.size,
        topSignal: leader && leader.count > 0 ? leader.text : null
      };
    }

    if (interaction.type === "reactions") {
      const totalReactions = Object.values(interaction.reactionCounts).reduce((acc, count) => acc + count, 0);
      const topEmoji = Object.entries(interaction.reactionCounts).reduce<{ emoji: string; count: number } | null>(
        (best, [emoji, count]) => {
          if (!best || count > best.count) return { emoji, count };
          return best;
        },
        null
      );

      return {
        id: crypto.randomUUID(),
        interactionType: interaction.type,
        title: interaction.payload.prompt,
        startedAt: interaction.startedAt,
        endedAt,
        responses: totalReactions,
        participantCountAtClose: this.state.participants.size,
        topSignal: topEmoji && topEmoji.count > 0 ? topEmoji.emoji : null
      };
    }

    if (interaction.type === "open_text") {
      return {
        id: crypto.randomUUID(),
        interactionType: interaction.type,
        title: interaction.payload.prompt,
        startedAt: interaction.startedAt,
        endedAt,
        responses: interaction.responseCount,
        participantCountAtClose: this.state.participants.size,
        topSignal: interaction.responses[0]?.text ?? null
      };
    }

    if (interaction.type === "countdown") {
      return {
        id: crypto.randomUUID(),
        interactionType: interaction.type,
        title: interaction.payload.label,
        startedAt: interaction.startedAt,
        endedAt,
        responses: 0,
        participantCountAtClose: this.state.participants.size,
        topSignal: `${interaction.payload.durationSeconds}s`
      };
    }

    if (interaction.type === "slides") {
      return {
        id: crypto.randomUUID(),
        interactionType: interaction.type,
        title: interaction.payload.title ?? "Presentation",
        startedAt: interaction.startedAt,
        endedAt,
        responses: interaction.payload.currentSlideIndex + 1,
        participantCountAtClose: this.state.participants.size,
        topSignal: `Slide ${interaction.payload.currentSlideIndex + 1}/${interaction.payload.totalSlides}`
      };
    }

    return {
      id: crypto.randomUUID(),
      interactionType: interaction.type,
      title: "Interaction",
      startedAt: interaction.startedAt,
      endedAt,
      responses: 0,
      participantCountAtClose: this.state.participants.size,
      topSignal: null
    };
  }

  private async archiveCurrentInteraction() {
    const current = this.state.currentInteraction;
    if (!current) return;

    const endedAt = new Date().toISOString();
    current.closedAt = endedAt;
    this.finalizeInteractionMetric(current, endedAt);
    const entry = this.buildHistoryEntry(current, endedAt);
    this.state.history = [entry, ...this.state.history].slice(0, SessionServer.MAX_HISTORY_ENTRIES);
    await Promise.all([this.room.storage.put("history", this.state.history), this.persistMetrics()]);
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
    this.state.sessionMetrics.endedAt = new Date().toISOString();
    this.broadcast({
      type: "server.session_snapshot",
      snapshot: snapshotFromState(this.state)
    });
    await this.room.storage.deleteAll();
  }

  onConnect(connection: Party.Connection) {
    // Limit connections per IP to prevent bot swarms
    const ip = this.getConnectionAddress(connection);
    const connectionsFromIp = Array.from(this.room.getConnections()).filter(
      (c) => this.getConnectionAddress(c) === ip
    );
    
    if (connectionsFromIp.length > 5) {
      connection.send(serialize({ type: "server.error", message: "Too many connections from this device." }));
      connection.close();
      return;
    }

    this.bumpAlarm();
    return;
  }

  onClose(connection: Party.Connection) {
    const participantLeft = this.state.participants.delete(connection.id);
    const hostLeft = this.state.hosts.delete(connection.id);

    if (participantLeft || hostLeft) {
      this.broadcast({
        type: "server.session_snapshot",
        snapshot: snapshotFromState(this.state)
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
        this.state.uniqueParticipantIds.add(message.participantId);
        this.state.peakConcurrentParticipants = Math.max(
          this.state.peakConcurrentParticipants,
          this.state.participants.size
        );
        this.state.sessionMetrics.totalUniqueParticipants = this.state.uniqueParticipantIds.size;
        this.state.sessionMetrics.peakConcurrentParticipants = this.state.peakConcurrentParticipants;
        await this.persistMetrics();
        sender.send(
          serialize({
            type: "server.session_snapshot",
            snapshot: snapshotFromState(this.state)
          })
        );
        sender.send(
          serialize({
            type: "server.host_presets_updated",
            presets: this.state.hostPresets
          })
        );
        sender.send(
          serialize({
            type: "server.voice_session_updated",
            voiceSession: this.state.voiceSession
          })
        );
        this.broadcast({
          type: "server.participant_count",
          participantCount: this.state.participants.size
        });
        return;

      case "client.update_host_presets": {
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Preset update rejected." }));
          return;
        }

        const cleanedPresets = this.sanitizeHostPresets(message.presets);
        this.state.hostPresets = cleanedPresets;
        await this.room.storage.put("hostPresets", cleanedPresets);
        this.broadcast({
          type: "server.host_presets_updated",
          presets: cleanedPresets
        });
        return;
      }

      case "client.update_voice_session": {
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Voice session update rejected." }));
          return;
        }

        const cleanedVoiceSession = this.sanitizeVoiceSession(message.voiceSession);
        this.state.voiceSession = cleanedVoiceSession;
        await this.room.storage.put("voiceSession", cleanedVoiceSession);
        this.broadcast({
          type: "server.voice_session_updated",
          voiceSession: cleanedVoiceSession
        });
        return;
      }

      case "client.host_connect":
        if (!this.isValidHost(message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Host token rejected." }));
          return;
        }

        // Limit to 3 simultaneous host devices to prevent token leak abuse
        if (this.state.hosts.size >= 3 && !this.state.hosts.has(sender.id)) {
          sender.send(serialize({ type: "server.error", message: "Host limit reached (max 3)." }));
          return;
        }

        this.state.hosts.add(sender.id);
        
        // Broadcast snapshot so all connected hosts see the updated activeHosts count
        this.broadcast({
          type: "server.session_snapshot",
          snapshot: snapshotFromState(this.state)
        });
        return;

      case "client.start_prompt":
        if (!this.canControlRoom(sender.id, message.hostToken) || !message.text.trim()) {
          sender.send(serialize({ type: "server.error", message: "Prompt launch rejected." }));
          return;
        }

        await this.archiveCurrentInteraction();

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
        this.state.sessionMetrics.endedAt = null;
        this.beginInteractionMetric(this.state.currentInteraction);
        this.state.lastResponseByParticipant.clear(); // Reset rate limit for new interaction
        await Promise.all([this.room.storage.put("status", "active"), this.persistMetrics()]);
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

        await this.archiveCurrentInteraction();

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
        this.state.sessionMetrics.endedAt = null;
        this.beginInteractionMetric(this.state.currentInteraction);
        this.state.lastResponseByParticipant.clear(); // Reset rate limit for new interaction
        await Promise.all([this.room.storage.put("status", "active"), this.persistMetrics()]);
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

        await this.archiveCurrentInteraction();

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
        this.state.sessionMetrics.endedAt = null;
        this.beginInteractionMetric(this.state.currentInteraction);
        this.state.lastResponseByParticipant.clear();
        await Promise.all([this.room.storage.put("status", "active"), this.persistMetrics()]);
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

        await this.archiveCurrentInteraction();

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
        this.state.sessionMetrics.endedAt = null;
        this.beginInteractionMetric(this.state.currentInteraction);
        this.state.reactionTimestamps.clear();
        await Promise.all([this.room.storage.put("status", "active"), this.persistMetrics()]);
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

        await this.archiveCurrentInteraction();

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
        this.state.sessionMetrics.endedAt = null;
        this.beginInteractionMetric(this.state.currentInteraction);
        this.state.lastResponseByParticipant.clear();
        await Promise.all([this.room.storage.put("status", "active"), this.persistMetrics()]);
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

        await this.archiveCurrentInteraction();

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
        this.state.sessionMetrics.endedAt = null;
        this.beginInteractionMetric(this.state.currentInteraction);
        await Promise.all([this.room.storage.put("status", "active"), this.persistMetrics()]);
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

        // Slides live in currentSlideDeck — independent of currentInteraction.
        // Do NOT archive the current interaction; it keeps running in parallel.
        this.state.currentSlideDeck = {
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
        this.state.lastActiveSlideIndex = 0;
        this.state.sessionMetrics.endedAt = null;
        this.beginInteractionMetric(this.state.currentSlideDeck);
        await this.persistMetrics();
        this.broadcast({
          type: "server.slide_deck_updated",
          slideDeck: this.state.currentSlideDeck
        });
        // Also send a full snapshot so the host dashboard refreshes correctly
        this.broadcast({
          type: "server.session_snapshot",
          snapshot: snapshotFromState(this.state)
        });
        return;
      }

      case "client.send_attention_nudge": {
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Attention nudge rejected." }));
          return;
        }

        const now = Date.now();
        if (this.state.lastNudgeAt && now - this.state.lastNudgeAt < 8000) {
          sender.send(serialize({ type: "server.error", message: "Nudge is on cooldown." }));
          return;
        }

        this.state.lastNudgeAt = now;

        const cleanedMessage = message.message?.trim() || "Look at your device now";
        this.broadcast({
          type: "server.attention_nudge",
          message: cleanedMessage.slice(0, 80),
          sentAt: new Date().toISOString()
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
        this.refreshMetricFromInteraction(poll);

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
        this.refreshMetricFromInteraction(quiz);

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
        this.refreshMetricFromInteraction(reactions);
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
        this.refreshMetricFromInteraction(interaction);

        this.broadcast({
          type: "server.open_text_responses_updated",
          responses: interaction.responses,
          responseCount: interaction.responseCount
        });
        return;
      }
      case "client.set_slide": {
        const deck = this.state.currentSlideDeck;
        if (
          !this.canControlRoom(sender.id, message.hostToken) ||
          !deck
        ) {
          sender.send(serialize({ type: "server.error", message: "Slide update rejected." }));
          return;
        }

        const index = Math.floor(message.index);
        if (
          !Number.isFinite(index) ||
          index < 0 ||
          index >= deck.payload.totalSlides
        ) {
          sender.send(serialize({ type: "server.error", message: "Slide index out of range." }));
          return;
        }

        deck.payload.currentSlideIndex = index;
        this.state.lastActiveSlideIndex = index;
        await this.persistMetrics();
        this.broadcast({
          type: "server.slide_set",
          index
        });
        this.broadcast({
          type: "server.slide_deck_updated",
          slideDeck: deck
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

      case "client.clear_interaction": {
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Clear interaction rejected." }));
          return;
        }

        await this.archiveCurrentInteraction();

        this.state.currentInteraction = null;
        // If a slide deck is still active, stay "active"; otherwise return to lobby.
        this.state.status = this.state.currentSlideDeck ? "active" : "lobby";
        await Promise.all([this.room.storage.put("status", this.state.status), this.persistMetrics()]);
        // Reset per-interaction rate limit state when a new round begins
        this.state.lastResponseByParticipant.clear();
        this.state.reactionTimestamps.clear();
        this.broadcast({
          type: "server.interaction_cleared"
        });
        return;
      }

      case "client.close_slide_deck": {
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Close slide deck rejected." }));
          return;
        }

        const deck = this.state.currentSlideDeck;
        if (deck) {
          const endedAt = new Date().toISOString();
          deck.closedAt = endedAt;
          this.finalizeInteractionMetric(deck, endedAt);
          const entry = this.buildHistoryEntry(deck, endedAt);
          this.state.history = [entry, ...this.state.history].slice(0, SessionServer.MAX_HISTORY_ENTRIES);
        }

        this.state.currentSlideDeck = null;
        this.state.lastActiveSlideIndex = null;
        // Only revert to lobby if there's also no active non-slide interaction
        if (!this.state.currentInteraction) {
          this.state.status = "lobby";
          await this.room.storage.put("status", "lobby");
        }
        await Promise.all([this.room.storage.put("history", this.state.history), this.persistMetrics()]);
        this.broadcast({
          type: "server.slide_deck_updated",
          slideDeck: null
        });
        this.broadcast({
          type: "server.session_snapshot",
          snapshot: snapshotFromState(this.state)
        });
        return;
      }

      case "client.close_session":
        if (!this.canControlRoom(sender.id, message.hostToken)) {
          sender.send(serialize({ type: "server.error", message: "Close session rejected." }));
          return;
        }

        await this.archiveCurrentInteraction();

        // Also finalize the slide deck if one is running
        if (this.state.currentSlideDeck) {
          const endedAt = new Date().toISOString();
          this.state.currentSlideDeck.closedAt = endedAt;
          this.finalizeInteractionMetric(this.state.currentSlideDeck, endedAt);
          const entry = this.buildHistoryEntry(this.state.currentSlideDeck, endedAt);
          this.state.history = [entry, ...this.state.history].slice(0, SessionServer.MAX_HISTORY_ENTRIES);
          this.state.currentSlideDeck = null;
        }

        this.state.status = "closed";
        this.state.sessionMetrics.endedAt = new Date().toISOString();
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
      const payload = (await request.json()) as {
        action?: string;
        hostToken?: string;
      };

      if (payload.action === "initialize_session") {
        if (!payload.hostToken) {
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
          this.room.storage.put("createdAt", this.state.createdAt),
          this.room.storage.put("hostToken", payload.hostToken),
          this.room.storage.put("status", "lobby"),
          this.room.storage.put("history", this.state.history),
          this.room.storage.put("sessionMetrics", this.state.sessionMetrics),
          this.room.storage.put("uniqueParticipantIds", []),
          this.room.storage.put("hostPresets", this.state.hostPresets),
          this.room.storage.put("voiceSession", this.state.voiceSession),
          this.room.storage.put("lastActiveSlideIndex", this.state.lastActiveSlideIndex)
        ]);

        return Response.json(snapshotFromState(this.state), { status: 201 });
      }

      if (payload.action === "get_history") {
        if (!payload.hostToken || !this.isValidHost(payload.hostToken)) {
          return Response.json({ error: "Unauthorized history request." }, { status: 403 });
        }

        return Response.json({
          sessionCode: this.room.id,
          history: this.state.history
        });
      }

      if (payload.action === "get_metrics") {
        if (!payload.hostToken || !this.isValidHost(payload.hostToken)) {
          return Response.json({ error: "Unauthorized metrics request." }, { status: 403 });
        }

        return Response.json(this.buildSessionMetricsSnapshot(new Date().toISOString()));
      }

      return Response.json({ error: "Invalid session action." }, { status: 400 });
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

  private getConnectionAddress(connection: Party.Connection): string {
    const candidate = connection as Party.Connection & { address?: string };
    return candidate.address ?? connection.id;
  }

  private sanitizeHostPresets(presets: HostPreset[]): HostPreset[] {
    if (!Array.isArray(presets)) return [];

    return presets
      .slice(0, 50)
      .map((preset) => {
        const text = typeof preset.text === "string" ? preset.text.trim().slice(0, 140) : "";
        const trigger = typeof preset.voiceTrigger === "string" ? preset.voiceTrigger.trim().slice(0, 120) : "";
        const confidenceRaw = Number(preset.triggerConfidence);
        const confidence = Number.isFinite(confidenceRaw)
          ? Math.min(1, Math.max(0.5, confidenceRaw))
          : undefined;

        if (!text) {
          return null;
        }

        return {
          id: typeof preset.id === "string" && preset.id.trim() ? preset.id.trim() : crypto.randomUUID(),
          text,
          voiceTrigger: trigger || undefined,
          triggerConfidence: confidence
        } as HostPreset;
      })
      .filter((preset): preset is HostPreset => preset !== null);
  }

  private sanitizeVoiceSession(voiceSession: VoiceSessionState): VoiceSessionState {
    const mode = voiceSession?.mode === "push-to-listen" ? "push-to-listen" : "continuous";

    return {
      enabled: Boolean(voiceSession?.enabled),
      mode,
      globalCommands: voiceSession?.globalCommands !== false,
      lastTriggeredAt:
        typeof voiceSession?.lastTriggeredAt === "string" && voiceSession.lastTriggeredAt.trim()
          ? voiceSession.lastTriggeredAt
          : null
    };
  }

  private broadcast(message: ServerMessage) {
    this.room.broadcast(serialize(message));
  }
}
