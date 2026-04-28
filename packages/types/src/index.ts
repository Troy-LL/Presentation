export type SessionStatus = "lobby" | "active" | "closed";

export type VoiceListeningMode = "continuous" | "push-to-listen";

export type HostPreset = {
  id: string;
  text: string;
  voiceTrigger?: string;
  triggerConfidence?: number;
};

export type VoiceSessionState = {
  enabled: boolean;
  mode: VoiceListeningMode;
  globalCommands: boolean;
  lastTriggeredAt: string | null;
};

export type InteractionType =
  | "prompt"
  | "poll"
  | "quiz"
  | "reactions"
  | "open_text"
  | "countdown"
  | "slides";

// ─── Prompt ──────────────────────────────────────────────────────────────────

export type PromptInteraction = {
  id: string;
  type: "prompt";
  payload: {
    text: string;
  };
  startedAt: string;
  closedAt: string | null;
};

// ─── Poll ─────────────────────────────────────────────────────────────────────

export type PollOption = {
  id: string;
  text: string;
};

export type PollInteraction = {
  id: string;
  type: "poll";
  payload: {
    question: string;
    options: PollOption[];
  };
  /** vote counts keyed by option id */
  votes: Record<string, number>;
  /** whether the host has revealed results to the audience */
  resultsRevealed: boolean;
  startedAt: string;
  closedAt: string | null;
};

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export type QuizInteraction = {
  id: string;
  type: "quiz";
  payload: {
    question: string;
    options: PollOption[];
    correctOptionId: string;
  };
  /** answer counts keyed by option id */
  votes: Record<string, number>;
  /** whether the host has revealed the correct answer to the audience */
  answerRevealed: boolean;
  startedAt: string;
  closedAt: string | null;
};

// ─── Reactions ────────────────────────────────────────────────────────────────

export type ReactionsInteraction = {
  id: string;
  type: "reactions";
  payload: {
    prompt: string;
    emojis: string[];
  };
  reactionCounts: Record<string, number>;
  startedAt: string;
  closedAt: string | null;
};

// ─── Open text ────────────────────────────────────────────────────────────────

export type OpenTextResponse = {
  id: string;
  participantId: string;
  text: string;
  submittedAt: string;
};

export type OpenTextInteraction = {
  id: string;
  type: "open_text";
  payload: {
    prompt: string;
  };
  responses: OpenTextResponse[];
  responseCount: number;
  startedAt: string;
  closedAt: string | null;
};

// ─── Countdown ────────────────────────────────────────────────────────────────

export type CountdownInteraction = {
  id: string;
  type: "countdown";
  payload: {
    label: string;
    durationSeconds: number;
    endsAt: string;
  };
  startedAt: string;
  closedAt: string | null;
};

// ─── Slides ───────────────────────────────────────────────────────────────────

export type SlideDeckInteraction = {
  id: string;
  type: "slides";
  payload: {
    deckId: string;
    title: string | null;
    sourceUrl: string;
    totalSlides: number;
    currentSlideIndex: number;
  };
  startedAt: string;
  closedAt: string | null;
};

// ─── Union ────────────────────────────────────────────────────────────────────

export type CurrentInteraction =
  | PromptInteraction
  | PollInteraction
  | QuizInteraction
  | ReactionsInteraction
  | OpenTextInteraction
  | CountdownInteraction
  | SlideDeckInteraction
  | null;

export type SessionSnapshot = {
  sessionCode: string;
  status: SessionStatus;
  currentInteraction: CurrentInteraction;
  /** The active slide deck, independent of currentInteraction. Persists across non-slide interactions. */
  currentSlideDeck: SlideDeckInteraction | null;
  participantCount: number;
  activeHosts: number;
  createdAt: string;
};

export type SessionResponse = {
  sessionCode: string;
  hostToken: string;
  joinUrl: string;
  qrValue: string;
};

export type SessionHistoryEntry = {
  id: string;
  interactionType: Exclude<InteractionType, "slides"> | "slides";
  title: string;
  startedAt: string;
  endedAt: string;
  responses: number;
  participantCountAtClose: number;
  topSignal: string | null;
};

export type SessionHistoryResponse = {
  sessionCode: string;
  history: SessionHistoryEntry[];
};

export type InteractionMetricOption = {
  optionId: string;
  optionText: string;
  voteCount: number;
};

export type InteractionMetric = {
  interactionId: string;
  interactionType: InteractionType;
  promptText: string;
  slideIndexAtLaunch: number | null;
  participantsConnectedAtLaunch: number;
  totalResponsesReceived: number;
  responseRate: number;
  optionBreakdown: InteractionMetricOption[];
  openTextResponses: string[];
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
};

export type SessionMetrics = {
  sessionCode: string;
  startedAt: string;
  endedAt: string | null;
  totalUniqueParticipants: number;
  peakConcurrentParticipants: number;
  interactionMetrics: InteractionMetric[];
};

// ─── Client → Server ─────────────────────────────────────────────────────────

export type ClientMessage =
  | {
      type: "client.join";
      participantId: string;
    }
  | {
      type: "client.host_connect";
      hostToken: string;
    }
  | {
      type: "client.start_prompt";
      hostToken: string;
      text: string;
    }
  | {
      type: "client.start_poll";
      hostToken: string;
      question: string;
      options: string[];
    }
  | {
      type: "client.start_quiz";
      hostToken: string;
      question: string;
      options: string[];
      correctOptionIndex: number;
    }
  | {
      type: "client.start_reactions";
      hostToken: string;
      prompt: string;
      emojis: string[];
    }
  | {
      type: "client.start_open_text";
      hostToken: string;
      prompt: string;
    }
  | {
      type: "client.start_countdown";
      hostToken: string;
      label: string;
      durationSeconds: number;
    }
  | {
      type: "client.start_slide_deck";
      hostToken: string;
      deckId: string;
      title: string | null;
      sourceUrl: string;
      totalSlides: number;
    }
  | {
      type: "client.send_attention_nudge";
      hostToken: string;
      message?: string;
    }
  | {
      type: "client.submit_vote";
      optionId: string;
    }
  | {
      type: "client.submit_quiz_answer";
      optionId: string;
    }
  | {
      type: "client.send_reaction";
      emoji: string;
    }
  | {
      type: "client.submit_text_response";
      text: string;
    }
  | {
      type: "client.set_slide";
      hostToken: string;
      index: number;
    }
  | {
      type: "client.reveal_poll_results";
      hostToken: string;
    }
  | {
      type: "client.reveal_quiz_answer";
      hostToken: string;
    }
  | {
      type: "client.clear_interaction";
      hostToken: string;
    }
  | {
      type: "client.close_slide_deck";
      hostToken: string;
    }
  | {
      type: "client.close_session";
      hostToken: string;
    }
  | {
      type: "client.update_host_presets";
      hostToken: string;
      presets: HostPreset[];
    }
  | {
      type: "client.update_voice_session";
      hostToken: string;
      voiceSession: VoiceSessionState;
    };

// ─── Server → Client ─────────────────────────────────────────────────────────

export type ServerMessage =
  | {
      type: "server.session_snapshot";
      snapshot: SessionSnapshot;
    }
  | {
      type: "server.session_closed";
      /** ISO 8601 timestamp string indicating when the session was closed. */
      endedAt: string;
    }
  | {
      type: "server.participant_count";
      participantCount: number;
    }
  | {
      type: "server.interaction_started";
      interaction:
        | PromptInteraction
        | PollInteraction
        | QuizInteraction
        | ReactionsInteraction
        | OpenTextInteraction
        | CountdownInteraction
        | SlideDeckInteraction;
    }
  | {
      type: "server.poll_votes_updated";
      votes: Record<string, number>;
    }
  | {
      type: "server.quiz_votes_updated";
      votes: Record<string, number>;
    }
  | {
      type: "server.reactions_updated";
      reactionCounts: Record<string, number>;
      latestEmoji: string;
    }
  | {
      type: "server.open_text_responses_updated";
      responses: OpenTextResponse[];
      responseCount: number;
    }
  | {
      type: "server.countdown_started";
      interaction: CountdownInteraction;
    }
  | {
      type: "server.slide_set";
      index: number;
    }
  | {
      type: "server.attention_nudge";
      message: string;
      sentAt: string;
    }
  | {
      type: "server.poll_results_revealed";
    }
  | {
      type: "server.quiz_answer_revealed";
    }
  | {
      type: "server.interaction_cleared";
    }
  | {
      type: "server.error";
      message: string;
    }
  | {
      type: "server.host_presets_updated";
      presets: HostPreset[];
    }
  | {
      type: "server.voice_session_updated";
      voiceSession: VoiceSessionState;
    }
  | {
      type: "server.slide_deck_updated";
      slideDeck: SlideDeckInteraction | null;
    };
