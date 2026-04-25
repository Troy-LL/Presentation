export type SessionStatus = "lobby" | "active" | "closed";

export type InteractionType = "prompt" | "poll";

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

// ─── Union ────────────────────────────────────────────────────────────────────

export type CurrentInteraction = PromptInteraction | PollInteraction | null;

export type SessionSnapshot = {
  sessionCode: string;
  status: SessionStatus;
  currentInteraction: CurrentInteraction;
  participantCount: number;
  createdAt: string;
};

export type SessionResponse = {
  sessionCode: string;
  hostToken: string;
  joinUrl: string;
  qrValue: string;
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
      type: "client.submit_vote";
      optionId: string;
    }
  | {
      type: "client.reveal_poll_results";
      hostToken: string;
    }
  | {
      type: "client.clear_interaction";
      hostToken: string;
    }
  | {
      type: "client.close_session";
      hostToken: string;
    };

// ─── Server → Client ─────────────────────────────────────────────────────────

export type ServerMessage =
  | {
      type: "server.session_snapshot";
      snapshot: SessionSnapshot;
    }
  | {
      type: "server.participant_count";
      participantCount: number;
    }
  | {
      type: "server.interaction_started";
      interaction: PromptInteraction | PollInteraction;
    }
  | {
      type: "server.poll_votes_updated";
      votes: Record<string, number>;
    }
  | {
      type: "server.poll_results_revealed";
    }
  | {
      type: "server.interaction_cleared";
    }
  | {
      type: "server.error";
      message: string;
    };

