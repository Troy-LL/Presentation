"use client";

import { QRCodeSVG } from "qrcode.react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import type {
  HostPreset,
  SessionHistoryEntry,
  SessionMetrics,
  SessionSnapshot,
  VoiceListeningMode
} from "@interactive-presentation/types";

import { HostPollResults } from "@/components/host-poll-results";
import { HostCountdownResults } from "@/components/host-countdown-results";
import { HostOpenTextResults } from "@/components/host-open-text-results";
import { HostReactionResults } from "@/components/host-reaction-results";
import { HostQuizResults } from "@/components/host-quiz-results";
import { VoiceCommandToggle } from "@/components/host/voice-command-toggle";
import { HostLayoutShell } from "@/components/host/host-layout-shell";
import { HostToolbar, Mode } from "@/components/host/host-toolbar";
import { HostGuideModal } from "@/components/host/host-guide-modal";
import { SessionEndModal } from "@/components/host/SessionEndModal";
import { MultiDeviceBadge } from "@/components/host/multi-device-badge";
import { downloadSessionMetricsReport, type ReportFormat } from "@/lib/exportReport";
import { useSessionConnection } from "@/lib/use-session-connection";
import { useVoiceCommands } from "@/lib/use-voice-commands";
import { useHostLayout } from "@/hooks/use-host-layout";
type SlideTrigger =
  | {
      type: "prompt";
      prompt: string;
    }
  | {
      type: "poll";
      question: string;
      options: string[];
    };

const EMPTY_OPTIONS = ["", "", ""];
const SESSION_END_AUTO_DISMISS_SECONDS = 30;

type HostAnalytics = {
  totalResponses: string;
  participationRate: string;
  topSignal: string;
  engagement: string;
};

function getTopTextOption<T extends { id: string; text: string }>(
  options: T[],
  counts: Record<string, number>
) {
  return options.reduce<{ text: string; count: number } | null>((best, option) => {
    const count = counts[option.id] ?? 0;
    if (!best || count > best.count) return { text: option.text, count };
    return best;
  }, null);
}

function getTopEmoji(counts: Record<string, number>) {
  return Object.entries(counts).reduce<{ emoji: string; count: number } | null>((best, [emoji, count]) => {
    if (!best || count > best.count) return { emoji, count };
    return best;
  }, null);
}

function getRoomStateLabel(snapshot: SessionSnapshot | null) {
  if (!snapshot) return "Lobby idle";
  if (snapshot.status === "closed") return "Closed";
  if (snapshot.status !== "active") return "Lobby idle";

  const interaction = snapshot.currentInteraction;
  if (!interaction) return "Prompt live";

  switch (interaction.type) {
    case "poll":
      return "Poll live";
    case "quiz":
      return "Quiz live";
    case "reactions":
      return "Reactions live";
    case "open_text":
      return "Open text live";
    case "countdown":
      return "Countdown live";
    case "slides":
      return "Slides live";
    default:
      return "Prompt live";
  }
}

function parseReactionEmojis(input: string) {
  return input
    .split(/\s+/)
    .map((emoji) => emoji.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseVoicePhrases(trigger: string | undefined) {
  if (!trigger) return [];
  return Array.from(
    new Set(
      trigger
        .split(/[\n,;|]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);
}

function formatVoicePhrasesForBadge(trigger: string | undefined) {
  const phrases = parseVoicePhrases(trigger);
  if (phrases.length === 0) return null;
  if (phrases.length === 1) return phrases[0];
  return `${phrases[0]} +${phrases.length - 1}`;
}

function statLabel(value: string, label: string) {
  return (
    <div className="card-hover flex h-full flex-col overflow-hidden rounded-[22px] border border-black/8 bg-white/80 p-5">
      <p className="text-xs uppercase tracking-[0.18em] soft-text">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight" title={value}>{value}</p>
    </div>
  );
}

function analyticsCard(label: string, value: string, hint: string) {
  return (
    <div className="card-hover flex h-full flex-col overflow-hidden rounded-[20px] border border-black/8 bg-white/80 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] soft-text">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight" title={value}>{value}</p>
      <p className="mt-1 truncate text-xs soft-text" title={hint}>{hint}</p>
    </div>
  );
}

function calculateHostAnalytics(snapshot: SessionSnapshot | null): HostAnalytics {
  if (!snapshot) {
    return {
      totalResponses: "0",
      participationRate: "0%",
      topSignal: "-",
      engagement: "0"
    };
  }

  const participants = snapshot.participantCount;
  const interaction = snapshot.currentInteraction;

  if (!interaction) {
    return {
      totalResponses: "0",
      participationRate: participants > 0 ? "0%" : "-",
      topSignal: "Lobby",
      engagement: participants > 0 ? String(participants) : "0"
    };
  }

  if (interaction.type === "poll") {
    const totalVotes = Object.values(interaction.votes).reduce((acc, count) => acc + count, 0);
    const topOption = getTopTextOption(interaction.payload.options, interaction.votes);
    const rate = participants > 0 ? `${Math.min(100, Math.round((totalVotes / participants) * 100))}%` : "-";

    return {
      totalResponses: String(totalVotes),
      participationRate: rate,
      topSignal: topOption && topOption.count > 0 ? topOption.text : "No votes yet",
      engagement: participants > 0 ? `${totalVotes}/${participants}` : String(totalVotes)
    };
  }

  if (interaction.type === "quiz") {
    const totalAnswers = Object.values(interaction.votes).reduce((acc, count) => acc + count, 0);
    const topOption = getTopTextOption(interaction.payload.options, interaction.votes);
    const rate = participants > 0 ? `${Math.min(100, Math.round((totalAnswers / participants) * 100))}%` : "-";

    return {
      totalResponses: String(totalAnswers),
      participationRate: rate,
      topSignal: topOption && topOption.count > 0 ? topOption.text : "No answers yet",
      engagement: participants > 0 ? `${totalAnswers}/${participants}` : String(totalAnswers)
    };
  }

  if (interaction.type === "reactions") {
    const totalReactions = Object.values(interaction.reactionCounts).reduce((acc, count) => acc + count, 0);
    const topEmoji = getTopEmoji(interaction.reactionCounts);
    const avgPerParticipant = participants > 0 ? (totalReactions / participants).toFixed(1) : "0.0";
    const proxyResponders = Math.min(participants, totalReactions);

    return {
      totalResponses: String(totalReactions),
      participationRate: participants > 0 ? `${Math.round((proxyResponders / participants) * 100)}%` : "-",
      topSignal: topEmoji && topEmoji.count > 0 ? topEmoji.emoji : "No reactions yet",
      engagement: `${avgPerParticipant} avg per person`
    };
  }

  if (interaction.type === "open_text") {
    const totalResponses = interaction.responseCount;
    const rate = participants > 0 ? `${Math.min(100, Math.round((totalResponses / participants) * 100))}%` : "-";

    return {
      totalResponses: String(totalResponses),
      participationRate: rate,
      topSignal: interaction.responses[0]?.text ?? "No responses yet",
      engagement: participants > 0 ? `${totalResponses}/${participants}` : String(totalResponses)
    };
  }

  return {
    totalResponses: "0",
    participationRate: participants > 0 ? "0%" : "-",
    topSignal:
      interaction.type === "countdown"
        ? "Timer running"
        : interaction.type === "slides"
          ? "Slides live"
          : "Prompt live",
    engagement: participants > 0 ? String(participants) : "0"
  };
}

export function HostConsole({
  sessionCode,
  tokenFromUrl
}: {
  sessionCode: string;
  tokenFromUrl?: string;
}) {
  const [initialSnapshot, setInitialSnapshot] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<SessionHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sessionEndModalOpen, setSessionEndModalOpen] = useState(false);
  const [sessionEndPhase, setSessionEndPhase] = useState<"confirm" | "download">("confirm");
  const [sessionEndMetrics, setSessionEndMetrics] = useState<SessionMetrics | null>(null);
  const [sessionEndError, setSessionEndError] = useState<string | null>(null);
  const [sessionEndBusy, setSessionEndBusy] = useState(false);
  const [sessionEndCountdown, setSessionEndCountdown] = useState(SESSION_END_AUTO_DISMISS_SECONDS);

  // ─ Mode switcher & Layout ────────────────────────
  const [mode, setMode] = useState<Mode>("prompt");
  const { layoutMode, variant, setVariant } = useHostLayout();

  // ─ Prompt state ─────────────────────────────
  const [draft, setDraft] = useState("");
  const [presets, setPresets] = useState<HostPreset[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingVoiceTrigger, setEditingVoiceTrigger] = useState("");
  const [editingTriggerConfidence, setEditingTriggerConfidence] = useState(0.75);
  const [highlightedPresetId, setHighlightedPresetId] = useState<string | null>(null);

  // ─ Poll state ──────────────────────────────
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [reactionPrompt, setReactionPrompt] = useState("How are we feeling?");
  const [reactionEmojis, setReactionEmojis] = useState("👏 🔥 ❤️ 😂");
  const [openTextPrompt, setOpenTextPrompt] = useState("Share one takeaway from this slide.");
  const [countdownLabel, setCountdownLabel] = useState("Time remaining");
  const [countdownSeconds, setCountdownSeconds] = useState(30);
  const [slideTitle, setSlideTitle] = useState("");
  const [slideSourceUrl, setSlideSourceUrl] = useState("");
  const [slideTotalSlides, setSlideTotalSlides] = useState(0);
  const [slideLoading, setSlideLoading] = useState(false);
  const [slideLoadError, setSlideLoadError] = useState<string | null>(null);
  const [slideJumpIndex, setSlideJumpIndex] = useState(1);
  const [slideThumbnails, setSlideThumbnails] = useState<string[]>([]);
  const [slideThumbLoading, setSlideThumbLoading] = useState(false);
  const [triggerSlideIndex, setTriggerSlideIndex] = useState(1);
  const [triggerType, setTriggerType] = useState<"prompt" | "poll">("prompt");
  const [triggerPromptText, setTriggerPromptText] = useState("");
  const [triggerPollQuestion, setTriggerPollQuestion] = useState("");
  const [triggerPollOptionsText, setTriggerPollOptionsText] = useState("Yes\nNo");
  const [slideTriggers, setSlideTriggers] = useState<Record<number, SlideTrigger>>({});
  const [autoLaunchTriggers, setAutoLaunchTriggers] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastTriggeredSlideRef = useRef<number | null>(null);

  const resetSlideLocalState = () => {
    // Wipe local slide metadata/assets so a closed session does not retain old deck memory.
    setSlideTitle("");
    setSlideSourceUrl("");
    setSlideTotalSlides(0);
    setSlideLoadError(null);
    setSlideLoading(false);
    setSlideJumpIndex(1);
    setSlideThumbnails([]);
    setSlideThumbLoading(false);
    setTriggerSlideIndex(1);
    setTriggerType("prompt");
    setTriggerPromptText("");
    setTriggerPollQuestion("");
    setTriggerPollOptionsText("Yes\nNo");
    setSlideTriggers({});
    setAutoLaunchTriggers(false);
    lastTriggeredSlideRef.current = null;
  };

  // ─ Voice Activation state ────────────────────────
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceConfidence, setVoiceConfidence] = useState(0.75);
  const [voiceMode, setVoiceMode] = useState<VoiceListeningMode>("continuous");
   const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceGlobalCommands] = useState(true);
  const [lastVoiceTriggeredAt, setLastVoiceTriggeredAt] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const isCloudMode = process.env.NEXT_PUBLIC_MODE === "cloud";

  // ─ Presets persistence ─────────────────────────
  useEffect(() => {
    if (!isCloudMode) {
      const savedPresets = localStorage.getItem("host-presets-v2");
      if (savedPresets) {
        try { setPresets(JSON.parse(savedPresets)); } catch { /* ignore */ }
      }
    }

    const savedVoice = localStorage.getItem("host-voice-enabled");
    if (savedVoice === "true") setVoiceEnabled(true);

    const savedConf = localStorage.getItem("host-voice-confidence");
    if (savedConf) setVoiceConfidence(parseFloat(savedConf));
    const savedMode = localStorage.getItem("host-voice-mode");
    if (savedMode === "continuous" || savedMode === "push-to-listen") {
      setVoiceMode(savedMode);
    }

    const savedMuted = localStorage.getItem("host-voice-muted");
    if (savedMuted === "true") setVoiceMuted(true);
  }, [isCloudMode]);

  useEffect(() => {
    localStorage.setItem("host-voice-enabled", String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem("host-voice-confidence", String(voiceConfidence));
  }, [voiceConfidence]);

  useEffect(() => {
    localStorage.setItem("host-voice-mode", voiceMode);
  }, [voiceMode]);

  useEffect(() => {
    localStorage.setItem("host-voice-muted", String(voiceMuted));
  }, [voiceMuted]);

  const persistPresets = (next: HostPreset[]) => {
    setPresets(next);
    if (isCloudMode) {
      updateHostPresets(next);
      return;
    }
    localStorage.setItem("host-presets-v2", JSON.stringify(next));
  };

  const savePreset = () => {
    if (!draft.trim()) return;
    if (presets.some((p) => p.text === draft.trim())) return;
    const next: HostPreset[] = [{ id: crypto.randomUUID(), text: draft.trim() }, ...presets];
    persistPresets(next);
  };

  const deletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    persistPresets(next);
  };

  const updatePresetVoiceTrigger = (id: string, trigger: string, triggerConfidence?: number) => {
    const normalizedTrigger = parseVoicePhrases(trigger).join("; ");
    const next = presets.map((p) =>
      p.id === id
        ? {
            ...p,
            voiceTrigger: normalizedTrigger || undefined,
            triggerConfidence: normalizedTrigger
              ? (Number.isFinite(triggerConfidence)
                ? Math.min(1, Math.max(0.5, triggerConfidence as number))
                : p.triggerConfidence)
              : undefined
          }
        : p
    );
    persistPresets(next);
  };

  // ─ Token resolution ───────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `host-token:${sessionCode}`;
    const token = tokenFromUrl ?? window.sessionStorage.getItem(storageKey);
    if (token) {
      window.sessionStorage.setItem(storageKey, token);
      setHostToken(token);
      if (tokenFromUrl) window.history.replaceState({}, "", `/host/${sessionCode}`);
      return;
    }
    setLoadError("This host room needs a valid host link. Start from /host/new to create one.");
  }, [sessionCode, tokenFromUrl]);

  // ─ Initial snapshot fetch ────────────────────────
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionCode}`);
        const payload = (await res.json()) as SessionSnapshot | { error?: string };
        const apiError = "error" in payload ? payload.error : undefined;
        if (!res.ok || !("sessionCode" in payload)) throw new Error(apiError ?? "Session lookup failed.");
        if (active) setInitialSnapshot(payload);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : "Session lookup failed.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [sessionCode]);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join?code=${sessionCode}`;
  }, [sessionCode]);

  const {
    snapshot,
    connectionState,
    error,
    latestReactionEmoji,
    hostPresets: cloudHostPresets,
    voiceSession: cloudVoiceSession,
    startPrompt,
    startPoll,
    startQuiz,
    startReactions,
    startOpenText,
    startCountdown,
    startSlideDeck,
    sendAttentionNudge,
    setSlide,
    nextSlide,
    prevSlide,
    revealPollResults,
    revealQuizAnswer,
    clearInteraction,
    closeSlides,
    updateHostPresets,
    updateVoiceSession
  } = useSessionConnection({
    sessionCode,
    role: "host",
    hostToken,
    initialSnapshot,
    enabled: Boolean(hostToken && initialSnapshot)
  });

  useEffect(() => {
    if (!isCloudMode) return;
    setPresets(cloudHostPresets);
  }, [isCloudMode, cloudHostPresets]);

  useEffect(() => {
    if (!isCloudMode || !cloudVoiceSession) return;
    setVoiceEnabled(cloudVoiceSession.enabled);
    setVoiceMode(cloudVoiceSession.mode);
  }, [isCloudMode, cloudVoiceSession]);

  useEffect(() => {
    if (!isCloudMode) return;
    updateVoiceSession({
      enabled: voiceEnabled,
      mode: voiceMode,
      globalCommands: voiceGlobalCommands,
      lastTriggeredAt: lastVoiceTriggeredAt
    });
  }, [
    isCloudMode,
    voiceEnabled,
    voiceMode,
    voiceGlobalCommands,
    lastVoiceTriggeredAt,
    updateVoiceSession
  ]);

  // ─ Voice Commands ────────────────────────────
  const voiceCommands = useMemo(() => {
    // Built-in global commands — ordered longest phrase first to prevent short-phrase shadowing
    const globals = [
      {
        id: "global:back_to_lobby",
        // Listed BEFORE prev_slide so "back to lobby" doesn't get eaten by "go back"
        phrases: [
          "back to lobby",
          "clear screen",
          "go to lobby",
          "return to lobby",
          "show lobby",
          "reset screen"
        ],
        action: clearInteraction,
      },
      {
        id: "global:next_slide",
        phrases: ["next slide", "advance slide", "go forward", "move forward", "continue slide"],
        action: nextSlide,
      },
      {
        id: "global:prev_slide",
        phrases: ["go back", "previous slide", "go to previous", "back one slide", "last slide"],
        action: prevSlide,
      },
      {
        id: "global:end_interaction",
        phrases: [
          "end poll",
          "close it",
          "stop poll",
          "stop quiz",
          "end quiz",
          "close interaction",
          "clear prompt",
          "end interaction"
        ],
        action: clearInteraction,
      },
      {
        id: "global:start_timer",
        phrases: ["start timer", "launch timer", "start countdown", "begin countdown", "start the clock"],
        action: () => startCountdown(countdownLabel, countdownSeconds),
      },
    ];

    // Per-preset voice triggers
    const presetCommands = presets
      .filter((p) => parseVoicePhrases(p.voiceTrigger).length > 0)
      .map((p) => ({
        id: `preset:${p.id}`,
        phrases: parseVoicePhrases(p.voiceTrigger),
        action: () => startPrompt(p.text),
        confidence: p.triggerConfidence,
      }));

    return voiceGlobalCommands ? [...presetCommands, ...globals] : presetCommands;
  }, [
    nextSlide,
    prevSlide,
    clearInteraction,
    startCountdown,
    startPrompt,
    countdownLabel,
    countdownSeconds,
    presets,
    voiceGlobalCommands
  ]);

  const {
    isListening,
    isSupported: voiceSupported,
    lastMatchedPhrase,
    isPushToListenActive
  } = useVoiceCommands({
    enabled: voiceEnabled && !voiceMuted && snapshot?.status !== "closed",
    mode: voiceMode,
    commands: voiceCommands,
    minConfidence: voiceConfidence,
    onMatch: (_, commandId) => {
      const now = new Date().toISOString();
      setLastVoiceTriggeredAt(now);

      if (commandId?.startsWith("preset:")) {
        const presetId = commandId.replace("preset:", "");
        setHighlightedPresetId(presetId);
        window.setTimeout(() => {
          setHighlightedPresetId((current) => (current === presetId ? null : current));
        }, 1500);
      }
    }
  });

  // ─ Prompt before closing ────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Prompt warning unless explicitly closed
      if (snapshot && snapshot.status !== "closed") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [snapshot]);

  const isClosed = snapshot?.status === "closed";
  const isActive = snapshot?.status === "active";
  const activePoll = snapshot?.currentInteraction?.type === "poll" ? snapshot.currentInteraction : null;
  const activeQuiz = snapshot?.currentInteraction?.type === "quiz" ? snapshot.currentInteraction : null;
  const activeReactions = snapshot?.currentInteraction?.type === "reactions" ? snapshot.currentInteraction : null;
  const activeOpenText = snapshot?.currentInteraction?.type === "open_text" ? snapshot.currentInteraction : null;
  const activeCountdown = snapshot?.currentInteraction?.type === "countdown" ? snapshot.currentInteraction : null;
  const activeSlides = snapshot?.currentSlideDeck ?? null;
  const activePrompt = snapshot?.currentInteraction?.type === "prompt" ? snapshot.currentInteraction : null;
  const deferredSnapshot = useDeferredValue(snapshot);

  const roomStateLabel = isClosed
    ? "Closed"
    : isActive
      ? activePoll
        ? "Poll live"
        : activeQuiz
          ? "Quiz live"
          : activeReactions
            ? "Reactions live"
            : activeOpenText
              ? "Open text live"
              : activeCountdown
                ? "Countdown live"
                : activeSlides
                  ? "Slides live"
                  : "Prompt live"
      : "Lobby idle";
  const analytics = useMemo(() => calculateHostAnalytics(deferredSnapshot), [deferredSnapshot]);
  const currentInteractionId = snapshot?.currentInteraction?.id ?? null;

  // poll option helpers
  const setOption = (index: number, value: string) => {
    const next = [...pollOptions];
    next[index] = value;
    setPollOptions(next);
  };
  const addOption = () => setPollOptions([...pollOptions, ""]);
  const removeOption = (index: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };
  const validPollOptions = pollOptions.filter((o) => o.trim()).length >= 2;
  const setQuizOption = (index: number, value: string) => {
    const next = [...quizOptions];
    next[index] = value;
    setQuizOptions(next);
    if (correctOptionIndex >= next.length) {
      setCorrectOptionIndex(next.length - 1);
    }
  };
  const addQuizOption = () => setQuizOptions([...quizOptions, ""]);
  const removeQuizOption = (index: number) => {
    if (quizOptions.length <= 2) return;
    const next = quizOptions.filter((_, i) => i !== index);
    setQuizOptions(next);
    if (correctOptionIndex === index) {
      setCorrectOptionIndex(0);
    } else if (correctOptionIndex > index) {
      setCorrectOptionIndex((prev) => prev - 1);
    }
  };
  const validQuizOptions = quizOptions.filter((o) => o.trim()).length >= 2;
  const hasValidCorrectOption = Boolean(quizOptions[correctOptionIndex]?.trim());
  const parsedReactionEmojis = reactionEmojis
    .split(/\s+/)
    .map((emoji) => emoji.trim())
    .filter(Boolean)
    .slice(0, 8);
  const validReactionsConfig = reactionPrompt.trim().length > 0 && parsedReactionEmojis.length >= 2;
  const validCountdown = Number.isFinite(countdownSeconds) && countdownSeconds >= 3 && countdownSeconds <= 3600;
  const validSlideDeck = slideSourceUrl.trim().length > 0 && slideTotalSlides > 0;

  useEffect(() => {
    if (!activeSlides) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextSlide();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevSlide();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeSlides, nextSlide, prevSlide]);

  const resolveSlideCount = async (source: string) => {
    setSlideLoading(true);
    setSlideLoadError(null);
    try {
      const { getDocument, GlobalWorkerOptions, version } = await import("pdfjs-dist");

      if (!GlobalWorkerOptions.workerSrc) {
        GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version || "4.4.168"}/build/pdf.worker.min.mjs`;
      }

      const loadingTask = getDocument(source);
      const pdf = await loadingTask.promise;
      setSlideTotalSlides(pdf.numPages);
    } catch (error) {
      console.error("PDF load error:", error);
      setSlideLoadError(error instanceof Error ? error.message : "Could not load PDF.");
      setSlideTotalSlides(0);
    } finally {
      setSlideLoading(false);
    }
  };

  const handleSlideFile = async (file: File | null) => {
    if (!file || file.type !== "application/pdf") return;
    
    setSlideLoading(true);
    setSlideLoadError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload PDF.");
      }

      const { url } = await response.json();
      
      setSlideSourceUrl(url);
      if (!slideTitle.trim()) {
        setSlideTitle(file.name.replace(/\.pdf$/i, ""));
      }
      await resolveSlideCount(url);
    } catch (err) {
      setSlideLoadError(err instanceof Error ? err.message : "Could not upload PDF.");
      setSlideSourceUrl("");
    } finally {
      setSlideLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleSlideFile(file);
    }
  };

  useEffect(() => {
    if (activeSlides) {
      setSlideJumpIndex(activeSlides.payload.currentSlideIndex + 1);
    }
  }, [activeSlides]);

  useEffect(() => {
    if (!activeSlides) {
      setSlideThumbnails([]);
      setSlideTriggers({});
      setAutoLaunchTriggers(false);
      lastTriggeredSlideRef.current = null;
      return;
    }
    const slides = activeSlides;

    let active = true;
    async function loadThumbnails() {
      setSlideThumbLoading(true);
      try {
        const { getDocument, GlobalWorkerOptions, version } = await import("pdfjs-dist");

        if (!GlobalWorkerOptions.workerSrc) {
          GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version || "4.4.168"}/build/pdf.worker.min.mjs`;
        }

        const doc = await getDocument(slides.payload.sourceUrl).promise;
        const maxSlides = Math.min(slides.payload.totalSlides, 40);
        const thumbs: string[] = [];
        for (let i = 1; i <= maxSlides; i += 1) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 0.35 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport }).promise;
          thumbs.push(canvas.toDataURL("image/png"));
        }
        if (active) {
          setSlideThumbnails(thumbs);
        }
      } finally {
        if (active) {
          setSlideThumbLoading(false);
        }
      }
    }

    void loadThumbnails();
    return () => {
      active = false;
    };
  }, [activeSlides, activeSlides?.payload.sourceUrl, activeSlides?.payload.totalSlides]);

  useEffect(() => {
    if (!activeSlides || !autoLaunchTriggers) return;
    const currentIndex = activeSlides.payload.currentSlideIndex;
    const mappedTrigger = slideTriggers[currentIndex];
    if (!mappedTrigger || lastTriggeredSlideRef.current === currentIndex) return;
    if (mappedTrigger.type === "prompt") {
      startPrompt(mappedTrigger.prompt);
    } else {
      const validOptions = mappedTrigger.options.map((o) => o.trim()).filter(Boolean);
      if (mappedTrigger.question.trim() && validOptions.length >= 2) {
        startPoll(mappedTrigger.question, validOptions);
      } else {
        return;
      }
    }
    lastTriggeredSlideRef.current = currentIndex;
  }, [activeSlides, autoLaunchTriggers, slideTriggers, startPoll, startPrompt]);

  useEffect(() => {
    if (isClosed) {
      resetSlideLocalState();
      setSessionEndModalOpen(false);
    }
  }, [isClosed]);

  useEffect(() => {
    if (!hostToken || !initialSnapshot) return;

    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch(
          `/api/sessions/${sessionCode}/history?hostToken=${encodeURIComponent(hostToken)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as { history?: SessionHistoryEntry[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load session history.");
        }
        if (active) {
          setHistoryEntries(payload.history ?? []);
        }
      } catch (caught) {
        if (active) {
          setHistoryError(caught instanceof Error ? caught.message : "Could not load session history.");
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();
    return () => {
      active = false;
    };
  }, [hostToken, initialSnapshot, sessionCode, currentInteractionId, snapshot?.status]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      setFullscreenError(null);
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenError("Fullscreen is unavailable in this browser context.");
    }
  };

  const openSessionEndModal = () => {
    setSessionEndModalOpen(true);
    setSessionEndPhase("confirm");
    setSessionEndMetrics(null);
    setSessionEndError(null);
    setSessionEndBusy(false);
    setSessionEndCountdown(SESSION_END_AUTO_DISMISS_SECONDS);
  };

  const closeSessionEndModal = () => {
    if (sessionEndBusy || sessionEndPhase === "download") {
      return;
    }
    setSessionEndModalOpen(false);
    setSessionEndError(null);
  };

  const finalizeSessionClosure = async () => {
    if (!hostToken) {
      setSessionEndError("Host token missing.");
      return;
    }

    try {
      setSessionEndBusy(true);
      setSessionEndError(null);
      setSessionEndModalOpen(false);
      resetSlideLocalState();

      const response = await fetch(`/api/sessions/${sessionCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "close_session",
          hostToken
        }),
        cache: "no-store"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not close the session.");
      }
    } catch (caught) {
      setSessionEndError(caught instanceof Error ? caught.message : "Could not close the session.");
      setSessionEndBusy(false);
    }
  };

  const autoCloseSessionRef = useRef(() => {
    setSessionEndError(null);
    void finalizeSessionClosure();
  });

  useEffect(() => {
    autoCloseSessionRef.current = () => {
      setSessionEndError(null);
      void finalizeSessionClosure();
    };
  });

  const prepareSessionMetrics = async () => {
    if (!hostToken) {
      throw new Error("Host token missing.");
    }

    const response = await fetch(
      `/api/sessions/${sessionCode}/metrics?hostToken=${encodeURIComponent(hostToken)}`,
      { cache: "no-store" }
    );
    const payload = (await response.json()) as SessionMetrics | { error?: string } | null;
    if (!response.ok) {
      throw new Error(payload && "error" in payload ? payload.error ?? "Could not load session metrics." : "Could not load session metrics.");
    }

    if (!payload || !("sessionCode" in payload)) {
      throw new Error("Could not load session metrics.");
    }

    return payload;
  };

  const confirmEndSession = async () => {
    try {
      setSessionEndBusy(true);
      setSessionEndError(null);
      const metrics = await prepareSessionMetrics();
      setSessionEndMetrics(metrics);
      setSessionEndPhase("download");
      setSessionEndCountdown(SESSION_END_AUTO_DISMISS_SECONDS);
    } catch (caught) {
      setSessionEndError(
        caught instanceof Error
          ? `${caught.message} Closing session without report export.`
          : "Could not prepare session report. Closing session without report export."
      );
      await finalizeSessionClosure();
    } finally {
      setSessionEndBusy(false);
    }
  };

  const handleReportDownload = async (format: ReportFormat) => {
    if (!sessionEndMetrics) {
      setSessionEndError("No session metrics were available to export.");
      return;
    }

    try {
      setSessionEndBusy(true);
      setSessionEndError(null);
      await downloadSessionMetricsReport(sessionEndMetrics, format);
      await finalizeSessionClosure();
    } catch (caught) {
      setSessionEndError(caught instanceof Error ? caught.message : "Could not export the report.");
      setSessionEndBusy(false);
    }
  };

  const skipSessionReport = () => {
    setSessionEndError(null);
    void finalizeSessionClosure();
  };

  useEffect(() => {
    if (!sessionEndModalOpen || sessionEndPhase !== "download" || sessionEndBusy) {
      return;
    }

    const timer = window.setInterval(() => {
      setSessionEndCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          autoCloseSessionRef.current();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sessionEndBusy, sessionEndModalOpen, sessionEndPhase]);

  // ─ Loading / error states ────────────────────────
  if (loading) {
    return (
      <main className="app-shell flex items-center justify-center px-6 py-10">
        <div className="panel w-full max-w-xl rounded-[28px] p-8 text-center">
          <p className="soft-text">Loading session...</p>
        </div>
      </main>
    );
  }

  if (loadError || !snapshot) {
    return (
      <main className="app-shell flex items-center justify-center px-6 py-10">
        <div className="panel w-full max-w-xl rounded-[28px] p-8">
          <p className="text-sm uppercase tracking-[0.2em] soft-text">Host room</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Session unavailable</h1>
          <p className="mt-4 text-base leading-7 soft-text">{loadError ?? "Session not found."}</p>
          <Link
            className="accent-button mt-8 inline-flex rounded-full px-5 py-3 text-sm font-semibold"
            href="/host/new"
          >
            Create a fresh room
          </Link>
        </div>
      </main>
    );
  }

  const header = (
    <header className="panel relative flex flex-col gap-4 rounded-3xl p-5 md:flex-row md:items-center md:justify-between shrink-0 z-50">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Session {sessionCode}</h1>
          <div className="mt-1 flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                snapshot.status === "closed"
                  ? "bg-slate-400"
                  : connectionState === "connected"
                    ? "bg-[var(--success)]"
                    : "bg-amber-400"
              }`}
            />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {snapshot.status === "closed"
                ? "Ended"
                : connectionState === "connected"
                  ? "Live"
                  : "Connecting..."}
            </span>
          </div>
        </div>
        <div className="hidden h-10 w-px bg-black/10 md:block" />
        <button
          className="danger-button hidden md:inline-flex rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isClosed || sessionEndBusy}
          onClick={openSessionEndModal}
          type="button"
        >
          End Session
        </button>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        {hostToken && (
          <MultiDeviceBadge 
            activeHosts={snapshot?.activeHosts ?? 1} 
            hostToken={hostToken} 
          />
        )}
        {/* Mobile End Session button pushed left */}
        <button
          className="danger-button inline-flex md:hidden rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 mr-auto"
          disabled={isClosed || sessionEndBusy}
          onClick={openSessionEndModal}
          type="button"
        >
          End Session
        </button>
        <button
          className="ghost-button inline-flex rounded-full px-4 py-2 text-sm font-semibold"
          onClick={() => void toggleFullscreen()}
          type="button"
        >
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
        <VoiceCommandToggle
          confidence={voiceConfidence}
          enabled={voiceEnabled}
          isListening={isListening}
          isPushToListenActive={isPushToListenActive}
          isSupported={voiceSupported}
          lastMatchedPhrase={lastMatchedPhrase}
          mode={voiceMode}
          onConfidenceChange={setVoiceConfidence}
          onModeChange={setVoiceMode}
          onMutedChange={setVoiceMuted}
          onToggle={setVoiceEnabled}
          muted={voiceMuted}
        />
      </div>
      {fullscreenError && <p className="absolute bottom-2 left-5 text-xs text-[var(--danger)]">{fullscreenError}</p>}
    </header>
  );

  const toolbar = (
    <HostToolbar 
      mode={mode} 
      setMode={setMode} 
      onNudge={(msg) => sendAttentionNudge(msg)} 
      onShowGuide={() => setShowGuide(true)}
      layout={layoutMode}
      variant={variant}
      onVariantToggle={() => {
        if (layoutMode === "phone") {
          setVariant(variant === "heads-up" ? "standard" : "heads-up");
        } else {
          setVariant(variant === "compact" ? "standard" : "compact");
        }
      }}
    />
  );

  const sidebar = (
    <>
      <div className="grid gap-4 shrink-0">
        {statLabel(sessionCode, "Invite code")}
        {statLabel(String(snapshot.participantCount), "Audience connected")}
        {statLabel(roomStateLabel, "Room state")}
      </div>
      <div className="grid gap-3 shrink-0">
        {analyticsCard("Responses", analytics.totalResponses, "Live for active interaction")}
        {analyticsCard("Participation", analytics.participationRate, "Response rate vs connected audience")}
        {analyticsCard("Top signal", analytics.topSignal.length > 34 ? `${analytics.topSignal.slice(0, 34)}...` : analytics.topSignal, "Most selected/used right now")}
        {analyticsCard("Engagement", analytics.engagement, "Quick activity snapshot")}
      </div>
      <div className="panel rounded-[28px] p-6 md:p-8 mt-auto shrink-0">
        <p className="text-sm uppercase tracking-[0.22em] soft-text text-center">Join link</p>
        <div className="mt-5 flex flex-col items-center gap-5">
          <div className="rounded-2xl bg-white p-3 shadow-sm border border-black/5">
            <QRCodeSVG bgColor="#ffffff" fgColor="#111827" size={140} value={joinUrl || `https://example.com/join?code=${sessionCode}`} />
          </div>
          <p className="break-all text-xs font-mono text-slate-500 text-center px-4">
            {joinUrl || `/join?code=${sessionCode}`}
          </p>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(joinUrl || `${window.location.origin}/join?code=${sessionCode}`);
            }}
            className="accent-button mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-bold shadow-lg shadow-[var(--accent)]/15 active:scale-95"
            type="button"
          >
            Copy join link
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <HostLayoutShell
        layout={layoutMode}
        variant={variant}
        toolbar={toolbar}
        header={header}
        sidebar={sidebar}
        voiceEnabled={voiceEnabled}
        isFullscreen={isFullscreen}
        isClosed={snapshot.status === "closed"}
        slidesActive={!!activeSlides}
        currentSlide={activeSlides?.payload.currentSlideIndex}
        totalSlides={activeSlides?.payload.totalSlides}
        onPrevSlide={prevSlide}
        onNextSlide={nextSlide}
        onToggleFullscreen={() => void toggleFullscreen()}
        onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
        onEndSession={openSessionEndModal}
        content={
          <div className="flex flex-col gap-6 w-full xl:flex-row min-w-0">
            <div className="flex flex-col gap-6 flex-1 min-w-0">

              {/* ── Active interaction live results — always shown when an interaction runs ── */}
              {activePoll && (
                <HostPollResults
                  onClear={clearInteraction}
                  onReveal={revealPollResults}
                  poll={activePoll}
                />
              )}
              {activeQuiz && (
                <HostQuizResults
                  onClear={clearInteraction}
                  onReveal={revealQuizAnswer}
                  quiz={activeQuiz}
                />
              )}
              {activeReactions && (
                <HostReactionResults
                  latestReactionEmoji={latestReactionEmoji}
                  onClear={clearInteraction}
                  reactions={activeReactions}
                />
              )}
              {activeOpenText && (
                <HostOpenTextResults interaction={activeOpenText} onClear={clearInteraction} />
              )}
              {activeCountdown && (
                <HostCountdownResults interaction={activeCountdown} onClear={clearInteraction} />
              )}

              {/* ── Persistent slide strip — visible when slides are active, never blocks interaction tools ── */}
              {activeSlides && (
                <div className="panel rounded-[28px] p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-widest soft-text">Slides live</p>
                      <p className="mt-1 text-sm font-semibold tracking-tight truncate">
                        {activeSlides.payload.title ?? "Presentation"}
                      </p>
                      <p className="text-xs soft-text">
                        Slide {activeSlides.payload.currentSlideIndex + 1} of {activeSlides.payload.totalSlides}
                      </p>
                    </div>
                    <button
                      className="ghost-button inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold"
                      onClick={() => { resetSlideLocalState(); closeSlides(); }}
                      type="button"
                    >
                      End slides
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      className="ghost-button inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold"
                      onClick={prevSlide}
                      type="button"
                    >
                      ← Prev
                    </button>
                    <button
                      className="accent-button inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold"
                      onClick={nextSlide}
                      type="button"
                    >
                      Next →
                    </button>
                    <input
                      className="h-9 w-16 rounded-full border border-black/10 bg-white px-3 text-center text-sm outline-none focus:border-black"
                      min={1}
                      max={activeSlides.payload.totalSlides}
                      onChange={(e) => setSlideJumpIndex(Number(e.target.value))}
                      type="number"
                      value={slideJumpIndex}
                    />
                    <button
                      className="ghost-button inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-semibold"
                      onClick={() => setSlide(Math.max(0, Math.min(activeSlides.payload.totalSlides - 1, slideJumpIndex - 1)))}
                      type="button"
                    >
                      Go
                    </button>
                  </div>
                  {slideThumbnails.length > 0 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {slideThumbnails.map((thumb, index) => {
                        const isActiveThumbnail = index === activeSlides.payload.currentSlideIndex;
                        return (
                          <button
                            className={[
                              "shrink-0 overflow-hidden rounded-lg border transition",
                              isActiveThumbnail ? "border-[var(--accent)]" : "border-black/10 hover:border-black/30"
                            ].join(" ")}
                            key={`${activeSlides.payload.deckId}:${index}`}
                            onClick={() => setSlide(index)}
                            type="button"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt={`Slide ${index + 1}`}
                              className="h-14 w-24 object-cover"
                              src={thumb}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {slideThumbLoading && <p className="mt-2 text-xs soft-text">Generating thumbnails…</p>}
                </div>
              )}

              {/* ── Interaction tools panel — ALWAYS visible regardless of slide state ── */}
              <div className="panel flex min-h-[600px] flex-col rounded-[28px] p-6 md:p-8">
                  <div className="flex-1 min-w-0">


                  {/* ─ Prompt mode ─ */}
                  {mode === "prompt" && (
                    <div className="mt-6">
                      <h2 className="text-xl font-semibold tracking-tight">Push one message to every phone</h2>
                      <textarea
                        className="mt-4 min-h-36 w-full rounded-[20px] border border-black/10 bg-white px-5 py-4 text-2xl leading-tight outline-none focus:border-black"
                        maxLength={140}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Type the line the whole room should see."
                        value={draft}
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!draft.trim() || !hostToken || isClosed}
                          onClick={() => startPrompt(draft)}
                          type="button"
                        >
                          Launch prompt
                        </button>
                        {isActive && activePrompt && (
                          <button
                            className="ghost-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
                            onClick={clearInteraction}
                            type="button"
                          >
                            Clear prompt
                          </button>
                        )}
                        <button
                          className="ghost-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
                          disabled={!draft.trim()}
                          onClick={savePreset}
                          title="Save this text for future use"
                          type="button"
                        >
                          Save as preset
                        </button>
                      </div>

                      {/* Presets */}
                      {presets.length > 0 && (
                        <div className="mt-6 border-t border-black/5 pt-6">
                          <p className="text-xs uppercase tracking-[0.2em] soft-text">Your presets</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {presets.map((preset) => (
                              <div
                                className={[
                                  "group flex flex-col overflow-hidden rounded-[20px] border bg-white shadow-sm transition-all duration-300",
                                  highlightedPresetId === preset.id
                                    ? "border-[var(--accent)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                                    : "border-black/10"
                                ].join(" ")}
                                key={preset.id}
                              >
                                <div className="flex items-center">
                                  <button
                                    className="flex-1 px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                                    disabled={isClosed}
                                    onClick={() => { setDraft(preset.text); startPrompt(preset.text); }}
                                    type="button"
                                  >
                                    {preset.text.length > 30 ? `${preset.text.substring(0, 30)}...` : preset.text}
                                  </button>
                                  {/* Voice trigger badge */}
                                  {formatVoicePhrasesForBadge(preset.voiceTrigger) && (
                                    <span className="mr-2 flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                                      {formatVoicePhrasesForBadge(preset.voiceTrigger)}
                                    </span>
                                  )}
                                  {/* Edit trigger toggle */}
                                  <button
                                    className="flex h-full items-center border-l border-black/10 px-3 text-slate-400 opacity-0 transition hover:bg-slate-50 hover:text-slate-700 group-hover:opacity-100"
                                    onClick={() => {
                                      if (editingPresetId === preset.id) {
                                        setEditingPresetId(null);
                                      } else {
                                        setEditingPresetId(preset.id);
                                        setEditingVoiceTrigger((parseVoicePhrases(preset.voiceTrigger)).join("; "));
                                        setEditingTriggerConfidence(preset.triggerConfidence ?? voiceConfidence);
                                      }
                                    }}
                                    title="Set voice trigger"
                                    type="button"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                                  </button>
                                  <button
                                    className="flex h-full items-center border-l border-black/10 bg-slate-50 px-3 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                                    onClick={() => deletePreset(preset.id)}
                                    title="Delete preset"
                                    type="button"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                                    </svg>
                                  </button>
                                </div>
                                {/* Voice trigger editor — expands on mic icon click */}
                                {editingPresetId === preset.id && (
                                  <div className="border-t border-black/5 px-4 py-3">
                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest soft-text">When I say...</p>
                                    <p className="mb-2 text-[11px] soft-text">Use multiple aliases separated by commas, semicolons, or new lines.</p>
                                    <div className="flex gap-2">
                                      <input
                                        autoFocus
                                        className="flex-1 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                                        onChange={(e) => setEditingVoiceTrigger(e.target.value)}
                                        placeholder="e.g. let's vote; start voting; launch poll"
                                        type="text"
                                        value={editingVoiceTrigger}
                                      />
                                      <input
                                        aria-label="Trigger confidence"
                                        className="w-24 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                                        max={1}
                                        min={0.5}
                                        onChange={(e) => setEditingTriggerConfidence(Number(e.target.value))}
                                        step={0.05}
                                        type="number"
                                        value={editingTriggerConfidence}
                                      />
                                      <button
                                        className="accent-button rounded-full px-4 py-1.5 text-xs font-semibold"
                                        onClick={() => {
                                          updatePresetVoiceTrigger(preset.id, editingVoiceTrigger, editingTriggerConfidence);
                                          setEditingPresetId(null);
                                        }}
                                        type="button"
                                      >
                                        Save
                                      </button>
                                      {parseVoicePhrases(preset.voiceTrigger).length > 0 && (
                                        <button
                                          className="ghost-button rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-500"
                                          onClick={() => {
                                            updatePresetVoiceTrigger(preset.id, "");
                                            setEditingPresetId(null);
                                          }}
                                          type="button"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─ Poll mode ─ */}
                  {mode === "poll" && (
                    <div className="mt-6">
                      <h2 className="text-xl font-semibold tracking-tight">Create a live poll</h2>
                      <input
                        className="mt-4 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        maxLength={200}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="What's your question?"
                        value={pollQuestion}
                      />
                      <div className="mt-4 flex flex-col gap-2">
                        {pollOptions.map((opt, i) => (
                          <div className="flex gap-2" key={i}>
                            <input
                              className="flex-1 rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                              maxLength={100}
                              onChange={(e) => setOption(i, e.target.value)}
                              placeholder={`Option ${i + 1}`}
                              value={opt}
                            />
                            {pollOptions.length > 2 && (
                              <button
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/10 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                onClick={() => removeOption(i)}
                                type="button"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {pollOptions.length < 10 && (
                        <button
                          className="mt-2 text-sm font-medium text-slate-500 underline underline-offset-2 transition hover:text-slate-800"
                          onClick={addOption}
                          type="button"
                        >
                          + Add option
                        </button>
                      )}
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!pollQuestion.trim() || !validPollOptions || isClosed}
                          onClick={() => startPoll(pollQuestion, pollOptions)}
                          type="button"
                        >
                          Launch poll
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─ Quiz mode ─ */}
                  {mode === "quiz" && (
                    <div className="mt-6">
                      <h2 className="text-xl font-semibold tracking-tight">Create a live quiz</h2>
                      <input
                        className="mt-4 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        maxLength={200}
                        onChange={(e) => setQuizQuestion(e.target.value)}
                        placeholder="What's your quiz question?"
                        value={quizQuestion}
                      />
                      <div className="mt-4 flex flex-col gap-2">
                        {quizOptions.map((opt, i) => (
                          <div className="flex items-center gap-2" key={i}>
                            <button
                              aria-label={`Mark option ${i + 1} as correct`}
                              className={[
                                "h-8 w-8 shrink-0 rounded-full border text-sm font-semibold transition",
                                correctOptionIndex === i
                                  ? "border-green-400 bg-green-50 text-green-700"
                                  : "border-black/15 bg-white text-slate-500 hover:border-black/30"
                              ].join(" ")}
                              onClick={() => setCorrectOptionIndex(i)}
                              type="button"
                            >
                              ✓
                            </button>
                            <input
                              className="flex-1 rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                              maxLength={100}
                              onChange={(e) => setQuizOption(i, e.target.value)}
                              placeholder={`Option ${i + 1}`}
                              value={opt}
                            />
                            {quizOptions.length > 2 && (
                              <button
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/10 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                onClick={() => removeQuizOption(i)}
                                type="button"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {quizOptions.length < 10 && (
                        <button
                          className="mt-2 text-sm font-medium text-slate-500 underline underline-offset-2 transition hover:text-slate-800"
                          onClick={addQuizOption}
                          type="button"
                        >
                          + Add option
                        </button>
                      )}
                      <p className="mt-3 text-sm soft-text">
                        Tap the check icon beside an option to mark it as the correct answer.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!quizQuestion.trim() || !validQuizOptions || !hasValidCorrectOption || isClosed}
                          onClick={() => startQuiz(quizQuestion, quizOptions, correctOptionIndex)}
                          type="button"
                        >
                          Launch quiz
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─ Reactions mode ─ */}
                  {mode === "reactions" && (
                    <div className="mt-6">
                      <h2 className="text-xl font-semibold tracking-tight">Start emoji reactions</h2>
                      <input
                        className="mt-4 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        maxLength={140}
                        onChange={(e) => setReactionPrompt(e.target.value)}
                        placeholder="Prompt shown on audience phones"
                        value={reactionPrompt}
                      />
                      <input
                        className="mt-3 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        onChange={(e) => setReactionEmojis(e.target.value)}
                        placeholder="👏 🔥 ❤️ 😂"
                        value={reactionEmojis}
                      />
                      <p className="mt-2 text-sm soft-text">
                        Add 2-8 emojis separated by spaces.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!validReactionsConfig || isClosed}
                          onClick={() => startReactions(reactionPrompt, parsedReactionEmojis)}
                          type="button"
                        >
                          Launch reactions
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─ Open text mode ─ */}
                  {mode === "open_text" && (
                    <div className="mt-6">
                      <h2 className="text-xl font-semibold tracking-tight">Start open text responses</h2>
                      <input
                        className="mt-4 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        maxLength={180}
                        onChange={(e) => setOpenTextPrompt(e.target.value)}
                        placeholder="Prompt shown to audience"
                        value={openTextPrompt}
                      />
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!openTextPrompt.trim() || isClosed}
                          onClick={() => startOpenText(openTextPrompt)}
                          type="button"
                        >
                          Launch open text
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─ Countdown mode ─ */}
                  {mode === "countdown" && (
                    <div className="mt-6">
                      <h2 className="text-xl font-semibold tracking-tight">Start countdown timer</h2>
                      <input
                        className="mt-4 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        maxLength={80}
                        onChange={(e) => setCountdownLabel(e.target.value)}
                        placeholder="Timer label shown on audience"
                        value={countdownLabel}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[10, 30, 60, 120].map((seconds) => (
                          <button
                            className="ghost-button inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold"
                            key={seconds}
                            onClick={() => setCountdownSeconds(seconds)}
                            type="button"
                          >
                            {seconds}s
                          </button>
                        ))}
                      </div>
                      <input
                        className="mt-3 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        min={3}
                        onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                        step={1}
                        type="number"
                        value={countdownSeconds}
                      />
                      <p className="mt-2 text-sm soft-text">Allowed range: 3-3600 seconds.</p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!countdownLabel.trim() || !validCountdown || isClosed}
                          onClick={() => startCountdown(countdownLabel, countdownSeconds)}
                          type="button"
                        >
                          Start countdown
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─ Slides mode ─ */}
                  {mode === "slides" && (
                    <div className="mt-6">
                      <h2 className="text-xl font-semibold tracking-tight">Start synced slides</h2>
                      <input
                        className="mt-4 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        maxLength={120}
                        onChange={(e) => setSlideTitle(e.target.value)}
                        placeholder="Deck title (optional)"
                        value={slideTitle}
                      />

                      <div
                        className={[
                          "group mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed transition-all",
                          isDragging
                            ? "border-[var(--accent)] bg-[var(--accent)]/5 scale-[1.01]"
                            : "border-black/10 bg-black/3 hover:border-black/20 hover:bg-black/[0.04]"
                        ].join(" ")}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <input
                          accept="application/pdf"
                          className="hidden"
                          id="slide-upload"
                          onChange={(e) => void handleSlideFile(e.target.files?.[0] ?? null)}
                          type="file"
                        />
                        <label
                          className="flex w-full flex-col items-center justify-center gap-3 px-6 py-8 text-center"
                          htmlFor="slide-upload"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition group-hover:scale-110">
                            <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {isDragging ? "Drop your PDF here" : "Click or drag PDF to upload"}
                            </p>
                            <p className="mt-1 text-xs soft-text">Up to 40 slides supported</p>
                          </div>
                        </label>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="h-px flex-1 bg-black/5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest soft-text">OR</span>
                        <div className="h-px flex-1 bg-black/5" />
                      </div>

                      <input
                        className="mt-4 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                        onChange={(e) => {
                          const value = e.target.value;
                          setSlideSourceUrl(value);
                          if (value.startsWith("http://") || value.startsWith("https://")) {
                            void resolveSlideCount(value);
                          }
                        }}
                        placeholder="Paste a direct PDF URL"
                        value={slideSourceUrl}
                      />
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-sm soft-text">
                          {slideLoading
                            ? "Reading PDF..."
                            : slideTotalSlides > 0
                              ? `${slideTotalSlides} slides detected`
                              : "No deck loaded yet"}
                        </span>
                        {slideLoadError && <span className="text-sm text-[var(--danger)]">{slideLoadError}</span>}
                      </div>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          className="accent-button inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!validSlideDeck || isClosed || slideLoading}
                          onClick={() =>
                            startSlideDeck(
                              crypto.randomUUID(),
                              slideTitle.trim() || null,
                              slideSourceUrl,
                              slideTotalSlides
                            )
                          }
                          type="button"
                        >
                          Start slides
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                  {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
                </div>
              </div>
            <div className="flex flex-col gap-6 flex-1 min-w-0">
              {/* Current output preview */}
              <div className="panel flex flex-col min-h-[400px] rounded-[28px] p-6 md:p-8">
                <p className="text-sm uppercase tracking-[0.22em] soft-text shrink-0">Current output</p>
                <div className="mt-5 min-h-48 min-w-0 rounded-[24px] border border-black/8 bg-white p-6">
                  {activePrompt && (
                    <p className="text-4xl font-semibold tracking-tight truncate">{activePrompt.payload.text}</p>
                  )}
                  {activePoll && (
                    <>
                      <p className="text-sm font-medium soft-text">Poll active</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight truncate">{activePoll.payload.question}</p>
                      <p className="mt-3 text-sm soft-text">{Object.values(activePoll.votes).reduce((a, b) => a + b, 0)} votes so far</p>
                    </>
                  )}
                  {activeQuiz && (
                    <>
                      <p className="text-sm font-medium soft-text">Quiz active</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight truncate">{activeQuiz.payload.question}</p>
                      <p className="mt-3 text-sm soft-text">{Object.values(activeQuiz.votes).reduce((a, b) => a + b, 0)} answers so far</p>
                    </>
                  )}
                  {activeReactions && (
                    <>
                      <p className="text-sm font-medium soft-text">Reactions active</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight truncate">{activeReactions.payload.prompt}</p>
                      <p className="mt-3 text-sm soft-text">
                        {Object.values(activeReactions.reactionCounts).reduce((a, b) => a + b, 0)} reactions so far
                      </p>
                    </>
                  )}
                  {activeOpenText && (
                    <>
                      <p className="text-sm font-medium soft-text">Open text active</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight truncate">{activeOpenText.payload.prompt}</p>
                      <p className="mt-3 text-sm soft-text">
                        {activeOpenText.responseCount} responses collected
                      </p>
                    </>
                  )}
                  {activeCountdown && (
                    <>
                      <p className="text-sm font-medium soft-text">Countdown active</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight truncate">{activeCountdown.payload.label}</p>
                      <p className="mt-3 text-sm soft-text">
                        {activeCountdown.payload.durationSeconds}s timer
                      </p>
                    </>
                  )}
                  {!snapshot.currentInteraction && !activeSlides && (
                    <p className="text-base leading-7 soft-text">
                      The audience is waiting in the blank lobby. Launch an interaction and this panel mirrors what they see.
                    </p>
                  )}
                  {!snapshot.currentInteraction && activeSlides && (
                    <p className="text-base leading-7 soft-text">
                      Slides are live. Use the slide controls below or switch to any interaction tool above.
                    </p>
                  )}
                </div>
              </div>

              <div className="panel rounded-[28px] p-6 md:p-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm uppercase tracking-[0.22em] soft-text">Session history</p>
                  {historyLoading && <span className="text-xs soft-text">Refreshing...</span>}
                </div>

                {historyError ? (
                  <p className="mt-4 text-sm text-[var(--danger)]">{historyError}</p>
                ) : historyEntries.length === 0 ? (
                  <p className="mt-4 text-sm soft-text">No completed interactions yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {historyEntries.slice(0, 8).map((entry) => (
                      <div
                        className="rounded-2xl border border-black/8 bg-white/85 p-4"
                        key={entry.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold uppercase tracking-[0.12em] soft-text">
                            {entry.interactionType.replace("_", " ")}
                          </p>
                          <p className="text-xs soft-text">
                            {new Date(entry.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900">{entry.title}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs soft-text">
                          <span>Responses: {entry.responses}</span>
                          <span>Audience: {entry.participantCountAtClose}</span>
                          {entry.topSignal ? <span>Top: {entry.topSignal}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        }
      />
      <SessionEndModal
        error={sessionEndError}
        isBusy={sessionEndBusy}
        isOpen={sessionEndModalOpen}
        metrics={sessionEndMetrics}
        onCancel={closeSessionEndModal}
        onConfirm={() => void confirmEndSession()}
        onDownload={(format) => void handleReportDownload(format)}
        onSkip={skipSessionReport}
        phase={sessionEndPhase}
        remainingSeconds={sessionEndCountdown}
      />
      <HostGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
}


