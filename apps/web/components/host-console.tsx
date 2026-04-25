"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import type { SessionSnapshot } from "@interactive-presentation/types";

import { HostPollResults } from "@/components/host-poll-results";
import { HostCountdownResults } from "@/components/host-countdown-results";
import { HostOpenTextResults } from "@/components/host-open-text-results";
import { HostReactionResults } from "@/components/host-reaction-results";
import { HostQuizResults } from "@/components/host-quiz-results";
import { useSessionConnection } from "@/lib/use-session-connection";

type Mode = "prompt" | "poll" | "quiz" | "reactions" | "open_text" | "countdown" | "slides";
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

function statLabel(value: string, label: string) {
  return (
    <div className="rounded-[22px] border border-black/8 bg-white/80 p-5">
      <p className="text-xs uppercase tracking-[0.18em] soft-text">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
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

  // ── Mode switcher ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("prompt");

  // ── Prompt state ─────────────────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const [presets, setPresets] = useState<string[]>([]);

  // ── Poll state ───────────────────────────────────────────────────────────
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

  // ── Presets persistence ──────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("host-presets");
    if (saved) {
      try { setPresets(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const savePreset = () => {
    if (!draft.trim() || presets.includes(draft.trim())) return;
    const next = [draft.trim(), ...presets];
    setPresets(next);
    localStorage.setItem("host-presets", JSON.stringify(next));
  };

  const deletePreset = (text: string) => {
    const next = presets.filter((p) => p !== text);
    setPresets(next);
    localStorage.setItem("host-presets", JSON.stringify(next));
  };

  // ── Token resolution ─────────────────────────────────────────────────────
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

  // ── Initial snapshot fetch ────────────────────────────────────────────────
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
    startPrompt,
    startPoll,
    startQuiz,
    startReactions,
    startOpenText,
    startCountdown,
    startSlideDeck,
    setSlide,
    nextSlide,
    prevSlide,
    revealPollResults,
    revealQuizAnswer,
    clearInteraction,
    closeSession
  } = useSessionConnection({
    sessionCode,
    role: "host",
    hostToken,
    initialSnapshot,
    enabled: Boolean(hostToken && initialSnapshot)
  });

  // ── Prompt before closing ────────────────────────────────────────────────
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
  const activeSlides = snapshot?.currentInteraction?.type === "slides" ? snapshot.currentInteraction : null;
  const activePrompt = snapshot?.currentInteraction?.type === "prompt" ? snapshot.currentInteraction : null;

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
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const loadingTask = pdfjs.getDocument(source);
      const pdf = await loadingTask.promise;
      setSlideTotalSlides(pdf.numPages);
    } catch (error) {
      setSlideLoadError(error instanceof Error ? error.message : "Could not load PDF.");
      setSlideTotalSlides(0);
    } finally {
      setSlideLoading(false);
    }
  };

  const handleSlideFile = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setSlideSourceUrl(result);
      if (!slideTitle.trim()) {
        setSlideTitle(file.name.replace(/\.pdf$/i, ""));
      }
      await resolveSlideCount(result);
    };
    reader.readAsDataURL(file);
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
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const doc = await pdfjs.getDocument(slides.payload.sourceUrl).promise;
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
          await page.render({ canvas, canvasContext: context, viewport }).promise;
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
    }
  }, [isClosed]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="app-shell flex items-center justify-center px-6 py-10">
        <div className="panel w-full max-w-xl rounded-[28px] p-8 text-center">
          <p className="soft-text">Loading session…</p>
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

  return (
    <main className="app-shell px-6 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <header className="panel rounded-[28px] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] soft-text">Live host dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
                Session {sessionCode}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 soft-text">
                Launch crowd prompts or live polls, watch the room respond in real time, and clear back to lobby when the moment is done.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold">
                {connectionState === "connected" ? "Connected live" : "Connecting…"}
              </span>
              <a
                className="ghost-button inline-flex rounded-full border border-black/10 px-4 py-2 text-sm font-semibold transition hover:bg-white"
                href={joinUrl || `/join?code=${sessionCode}`}
                target="_blank"
              >
                Open join screen
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6">
            {/* Stats row */}
            <div className="grid gap-4 md:grid-cols-3">
              {statLabel(sessionCode, "Invite code")}
              {statLabel(String(snapshot.participantCount), "Audience connected")}
              {statLabel(roomStateLabel, "Room state")}
            </div>

            {/* Active poll live view replaces the control panel */}
            {activePoll ? (
              <HostPollResults
                onClear={clearInteraction}
                onReveal={revealPollResults}
                poll={activePoll}
              />
            ) : activeQuiz ? (
              <HostQuizResults
                onClear={clearInteraction}
                onReveal={revealQuizAnswer}
                quiz={activeQuiz}
              />
            ) : activeReactions ? (
              <HostReactionResults
                latestReactionEmoji={latestReactionEmoji}
                onClear={clearInteraction}
                reactions={activeReactions}
              />
            ) : activeOpenText ? (
              <HostOpenTextResults interaction={activeOpenText} onClear={clearInteraction} />
            ) : activeCountdown ? (
              <HostCountdownResults interaction={activeCountdown} onClear={clearInteraction} />
            ) : activeSlides ? (
              <div className="panel rounded-[28px] p-6 md:p-8">
                <p className="text-sm uppercase tracking-[0.22em] soft-text">Slides live</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {activeSlides.payload.title ?? "Presentation"}
                </h2>
                <p className="mt-2 text-sm soft-text">
                  Slide {activeSlides.payload.currentSlideIndex + 1} of {activeSlides.payload.totalSlides}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
                    onClick={prevSlide}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="accent-button inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold"
                    onClick={nextSlide}
                    type="button"
                  >
                    Next
                  </button>
                  <input
                    className="h-10 w-20 rounded-full border border-black/10 bg-white px-3 text-center text-sm outline-none focus:border-black"
                    min={1}
                    onChange={(e) => setSlideJumpIndex(Number(e.target.value))}
                    type="number"
                    value={slideJumpIndex}
                  />
                  <button
                    className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-semibold transition hover:bg-white"
                    onClick={() => setSlide(Math.max(0, Math.min(activeSlides.payload.totalSlides - 1, slideJumpIndex - 1)))}
                    type="button"
                  >
                    Go
                  </button>
                </div>
                <p className="mt-3 text-xs soft-text">Use Left/Right arrow keys to navigate.</p>
                <div className="mt-6 border-t border-black/5 pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm soft-text">
                      <input
                        checked={autoLaunchTriggers}
                        onChange={(e) => setAutoLaunchTriggers(e.target.checked)}
                        type="checkbox"
                      />
                      Auto-launch mapped interaction
                    </label>
                    {slideTriggers[activeSlides.payload.currentSlideIndex] && (
                      <button
                        className="accent-button inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold"
                        onClick={() => {
                          const currentTrigger = slideTriggers[activeSlides.payload.currentSlideIndex];
                          if (!currentTrigger) return;
                          if (currentTrigger.type === "prompt") {
                            startPrompt(currentTrigger.prompt);
                            return;
                          }
                          const validOptions = currentTrigger.options.map((o) => o.trim()).filter(Boolean);
                          if (!currentTrigger.question.trim() || validOptions.length < 2) return;
                          startPoll(currentTrigger.question, validOptions);
                        }}
                        type="button"
                      >
                        Launch mapped interaction now
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex w-fit gap-1 rounded-2xl border border-black/8 bg-black/3 p-1">
                    <button
                      className={[
                        "rounded-xl px-3 py-2 text-sm font-semibold transition",
                        triggerType === "prompt" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                      ].join(" ")}
                      onClick={() => setTriggerType("prompt")}
                      type="button"
                    >
                      Prompt trigger
                    </button>
                    <button
                      className={[
                        "rounded-xl px-3 py-2 text-sm font-semibold transition",
                        triggerType === "poll" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                      ].join(" ")}
                      onClick={() => setTriggerType("poll")}
                      type="button"
                    >
                      Poll trigger
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <input
                      className="h-10 w-20 rounded-full border border-black/10 bg-white px-3 text-center text-sm outline-none focus:border-black"
                      min={1}
                      onChange={(e) => setTriggerSlideIndex(Number(e.target.value))}
                      type="number"
                      value={triggerSlideIndex}
                    />
                    {triggerType === "prompt" ? (
                      <input
                        className="h-10 min-w-64 flex-1 rounded-full border border-black/10 bg-white px-4 text-sm outline-none focus:border-black"
                        maxLength={140}
                        onChange={(e) => setTriggerPromptText(e.target.value)}
                        placeholder="Prompt mapped to this slide"
                        value={triggerPromptText}
                      />
                    ) : (
                      <>
                        <input
                          className="h-10 min-w-64 flex-1 rounded-full border border-black/10 bg-white px-4 text-sm outline-none focus:border-black"
                          maxLength={180}
                          onChange={(e) => setTriggerPollQuestion(e.target.value)}
                          placeholder="Poll question mapped to this slide"
                          value={triggerPollQuestion}
                        />
                        <input
                          className="h-10 min-w-64 flex-1 rounded-full border border-black/10 bg-white px-4 text-sm outline-none focus:border-black"
                          onChange={(e) => setTriggerPollOptionsText(e.target.value)}
                          placeholder="Poll options (comma-separated)"
                          value={triggerPollOptionsText}
                        />
                      </>
                    )}
                    <button
                      className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-semibold transition hover:bg-white"
                      onClick={() => {
                        const idx = Math.max(0, triggerSlideIndex - 1);
                        if (triggerType === "prompt") {
                          if (!triggerPromptText.trim()) return;
                          setSlideTriggers((current) => ({
                            ...current,
                            [idx]: {
                              type: "prompt",
                              prompt: triggerPromptText.trim()
                            }
                          }));
                          setTriggerPromptText("");
                          return;
                        }

                        const options = triggerPollOptionsText
                          .split(/[\n,|]/)
                          .map((option) => option.trim())
                          .filter(Boolean)
                          .slice(0, 10);
                        if (!triggerPollQuestion.trim() || options.length < 2) return;
                        setSlideTriggers((current) => ({
                          ...current,
                          [idx]: {
                            type: "poll",
                            question: triggerPollQuestion.trim(),
                            options
                          }
                        }));
                        setTriggerPollQuestion("");
                      }}
                      type="button"
                    >
                      Map interaction
                    </button>
                    <button
                      className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-semibold transition hover:bg-white"
                      onClick={() => {
                        const idx = Math.max(0, triggerSlideIndex - 1);
                        setSlideTriggers((current) => {
                          if (!(idx in current)) return current;
                          const next = { ...current };
                          delete next[idx];
                          return next;
                        });
                      }}
                      type="button"
                    >
                      Clear mapping
                    </button>
                  </div>
                  <p className="mt-3 text-xs soft-text">
                    Poll options can be comma, pipe, or newline separated. Minimum 2 options.
                  </p>
                </div>
                <div className="mt-6 border-t border-black/5 pt-6">
                  <p className="text-xs uppercase tracking-[0.2em] soft-text">Filmstrip</p>
                  {slideThumbLoading && <p className="mt-2 text-sm soft-text">Generating thumbnails...</p>}
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {slideThumbnails.map((thumb, index) => {
                      const isActive = index === activeSlides.payload.currentSlideIndex;
                      return (
                        <button
                          className={[
                            "shrink-0 overflow-hidden rounded-lg border transition",
                            isActive ? "border-[var(--accent)]" : "border-black/10 hover:border-black/30"
                          ].join(" ")}
                          key={`${activeSlides.payload.deckId}:${index}`}
                          onClick={() => setSlide(index)}
                          type="button"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={`Slide ${index + 1}`}
                            className="h-16 w-28 object-cover"
                            src={thumb}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-6 border-t border-black/5 pt-6">
                  <button
                    className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
                    onClick={() => {
                      resetSlideLocalState();
                      clearInteraction();
                    }}
                    type="button"
                  >
                    End slides
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel rounded-[28px] p-6 md:p-8">
                {/* Mode tabs */}
                <div className="flex gap-1 rounded-2xl border border-black/8 bg-black/3 p-1 w-fit">
                  {(["prompt", "poll", "quiz", "reactions", "open_text", "countdown", "slides"] as Mode[]).map((m) => (
                    <button
                      className={[
                        "rounded-xl px-4 py-2 text-sm font-semibold transition",
                        mode === m
                          ? "bg-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      ].join(" ")}
                      key={m}
                      onClick={() => setMode(m)}
                      type="button"
                    >
                      {m === "prompt"
                        ? "Crowd Prompt"
                        : m === "poll"
                          ? "Live Poll"
                          : m === "quiz"
                            ? "Quiz"
                            : m === "reactions"
                              ? "Reactions"
                              : m === "open_text"
                                ? "Open text"
                                : m === "countdown"
                                  ? "Countdown"
                                  : "Slides"}
                    </button>
                  ))}
                </div>

                {/* ── Prompt mode ── */}
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
                          className="ghost-button inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
                          onClick={clearInteraction}
                          type="button"
                        >
                          Clear prompt
                        </button>
                      )}
                      <button
                        className="ghost-button inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
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
                              className="group flex items-center overflow-hidden rounded-full border border-black/10 bg-white shadow-sm"
                              key={preset}
                            >
                              <button
                                className="px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                                disabled={isClosed}
                                onClick={() => { setDraft(preset); startPrompt(preset); }}
                                type="button"
                              >
                                {preset.length > 30 ? `${preset.substring(0, 30)}…` : preset}
                              </button>
                              <button
                                className="flex h-full items-center border-l border-black/10 bg-slate-50 px-3 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                                onClick={() => deletePreset(preset)}
                                title="Delete preset"
                                type="button"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Poll mode ── */}
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
                    <div className="mt-5 flex gap-3">
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

                {/* ── Quiz mode ── */}
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
                    <div className="mt-5 flex gap-3">
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

                {/* ── Reactions mode ── */}
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
                    <div className="mt-5 flex gap-3">
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

                {/* ── Open text mode ── */}
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
                    <div className="mt-5 flex gap-3">
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

                {/* ── Countdown mode ── */}
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
                          className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-semibold transition hover:bg-white"
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
                    <div className="mt-5 flex gap-3">
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

                {/* ── Slides mode ── */}
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
                    <input
                      accept="application/pdf"
                      className="mt-3 block w-full text-sm"
                      onChange={(e) => void handleSlideFile(e.target.files?.[0] ?? null)}
                      type="file"
                    />
                    <input
                      className="mt-3 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black"
                      onChange={(e) => {
                        const value = e.target.value;
                        setSlideSourceUrl(value);
                        if (value.startsWith("http://") || value.startsWith("https://")) {
                          void resolveSlideCount(value);
                        }
                      }}
                      placeholder="Or paste a direct PDF URL"
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
                    <div className="mt-5 flex gap-3">
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

                {/* Danger zone */}
                <div className="mt-8 border-t border-black/10 pt-6">
                  <button
                    className="ghost-button inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-[var(--danger)] transition hover:bg-red-50"
                    disabled={isClosed}
                    onClick={() => {
                      if (confirm("Are you sure you want to end this session for everyone?")) {
                        resetSlideLocalState();
                        closeSession();
                      }
                    }}
                    type="button"
                  >
                    End session permanently
                  </button>
                </div>
                {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="grid gap-6">
            {/* QR / Join link */}
            <div className="panel rounded-[28px] p-6 md:p-8">
              <p className="text-sm uppercase tracking-[0.22em] soft-text">Join link</p>
              <div className="mt-5 flex flex-col items-center gap-5 rounded-[24px] border border-black/8 bg-white/85 p-6 text-center">
                <QRCodeSVG
                  bgColor="#ffffff"
                  fgColor="#111827"
                  includeMargin
                  size={192}
                  value={joinUrl || `https://example.com/join?code=${sessionCode}`}
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] soft-text">Audience URL</p>
                  <p className="mt-2 break-all text-sm text-slate-700">
                    {joinUrl || `/join?code=${sessionCode}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Current output preview */}
            <div className="panel rounded-[28px] p-6 md:p-8">
              <p className="text-sm uppercase tracking-[0.22em] soft-text">Current output</p>
              <div className="mt-5 min-h-48 rounded-[24px] border border-black/8 bg-white p-6">
                {activePrompt && (
                  <p className="text-4xl font-semibold tracking-tight">{activePrompt.payload.text}</p>
                )}
                {activePoll && (
                  <>
                    <p className="text-sm font-medium soft-text">Poll active</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">{activePoll.payload.question}</p>
                    <p className="mt-3 text-sm soft-text">{Object.values(activePoll.votes).reduce((a, b) => a + b, 0)} votes so far</p>
                  </>
                )}
                {activeQuiz && (
                  <>
                    <p className="text-sm font-medium soft-text">Quiz active</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">{activeQuiz.payload.question}</p>
                    <p className="mt-3 text-sm soft-text">{Object.values(activeQuiz.votes).reduce((a, b) => a + b, 0)} answers so far</p>
                  </>
                )}
                {activeReactions && (
                  <>
                    <p className="text-sm font-medium soft-text">Reactions active</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">{activeReactions.payload.prompt}</p>
                    <p className="mt-3 text-sm soft-text">
                      {Object.values(activeReactions.reactionCounts).reduce((a, b) => a + b, 0)} reactions so far
                    </p>
                  </>
                )}
                {activeOpenText && (
                  <>
                    <p className="text-sm font-medium soft-text">Open text active</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">{activeOpenText.payload.prompt}</p>
                    <p className="mt-3 text-sm soft-text">
                      {activeOpenText.responseCount} responses collected
                    </p>
                  </>
                )}
                {activeCountdown && (
                  <>
                    <p className="text-sm font-medium soft-text">Countdown active</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">{activeCountdown.payload.label}</p>
                    <p className="mt-3 text-sm soft-text">
                      {activeCountdown.payload.durationSeconds}s timer
                    </p>
                  </>
                )}
                {activeSlides && (
                  <>
                    <p className="text-sm font-medium soft-text">Slides active</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">
                      {activeSlides.payload.title ?? "Presentation"}
                    </p>
                    <p className="mt-3 text-sm soft-text">
                      Slide {activeSlides.payload.currentSlideIndex + 1} of {activeSlides.payload.totalSlides}
                    </p>
                  </>
                )}
                {!snapshot.currentInteraction && (
                  <p className="text-base leading-7 soft-text">
                    The audience is waiting in the blank lobby. Launch an interaction and this panel mirrors what they see.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
