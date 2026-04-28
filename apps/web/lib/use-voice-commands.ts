"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import type { VoiceListeningMode } from "@interactive-presentation/types";

type SpeechRecognitionResultLike = {
  transcript: string;
  confidence?: number;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal: boolean;
    0: SpeechRecognitionResultLike;
  }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const FILLER_WORDS = new Set([
  "a",
  "an",
  "and",
  "can",
  "could",
  "do",
  "for",
  "hey",
  "i",
  "just",
  "me",
  "my",
  "please",
  "show",
  "so",
  "some",
  "the",
  "to",
  "uh",
  "um",
  "we",
  "would",
  "you"
]);

const TERM_SYNONYMS: Record<string, string> = {
  backward: "back",
  begin: "start",
  clear: "close",
  continue: "resume",
  countdown: "timer",
  finish: "end",
  forward: "next",
  launch: "start",
  previous: "prev",
  prior: "prev",
  question: "prompt",
  quiz: "poll",
  resume: "start",
  return: "back",
  stop: "end",
  timer: "countdown"
};

type MatchScore = {
  score: number;
  matchedPhrase: string;
};

export interface VoiceCommand {
  id?: string;
  phrases: string[];
  action: () => void;
  confidence?: number;
}

interface UseVoiceCommandsProps {
  enabled: boolean;
  mode?: VoiceListeningMode;
  commands: VoiceCommand[];
  minConfidence?: number;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onMatch?: (phrase: string, commandId?: string) => void;
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(lets|let's)\b/g, "let us")
    .replace(/\bwhats\b/g, "what is")
    .replace(/\bim\b/g, "i am")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  if (!text) return [];

  return text
    .split(/\s+/)
    .map((token) => TERM_SYNONYMS[token] ?? token)
    .filter((token) => token && !FILLER_WORDS.has(token));
}

function computeOrderedCoverage(transcriptTokens: string[], phraseTokens: string[]): number {
  if (phraseTokens.length === 0) return 0;

  let cursor = 0;
  let matched = 0;

  for (const phraseToken of phraseTokens) {
    while (cursor < transcriptTokens.length) {
      const spokenToken = transcriptTokens[cursor];
      cursor += 1;
      if (
        spokenToken === phraseToken ||
        spokenToken.startsWith(phraseToken) ||
        phraseToken.startsWith(spokenToken)
      ) {
        matched += 1;
        break;
      }
    }
  }

  return matched / phraseTokens.length;
}

function findBestPhraseMatch(transcript: string, phrases: string[]): MatchScore | null {
  const normalizedTranscript = normalizeText(transcript);
  const transcriptTokens = tokenize(normalizedTranscript);

  let best: MatchScore | null = null;

  for (const phrase of phrases) {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedPhrase) continue;

    // Fast path for exact substring matches after normalization.
    if (
      normalizedTranscript === normalizedPhrase ||
      normalizedTranscript.includes(` ${normalizedPhrase} `) ||
      normalizedTranscript.startsWith(`${normalizedPhrase} `) ||
      normalizedTranscript.endsWith(` ${normalizedPhrase}`)
    ) {
      return { matchedPhrase: phrase, score: 1 };
    }

    const phraseTokens = tokenize(normalizedPhrase);
    if (phraseTokens.length === 0) continue;

    const orderedCoverage = computeOrderedCoverage(transcriptTokens, phraseTokens);
    const tokenCoverage =
      phraseTokens.filter((token) =>
        transcriptTokens.some(
          (spoken) =>
            spoken === token || spoken.startsWith(token) || token.startsWith(spoken)
        )
      ).length / phraseTokens.length;

    // Weighted towards in-order recognition, but allows flexible spoken variants.
    const score = orderedCoverage * 0.65 + tokenCoverage * 0.35;

    if (!best || score > best.score) {
      best = { matchedPhrase: phrase, score };
    }
  }

  return best;
}

/**
 * useVoiceCommands hook
 *
 * Handles the Web Speech API (SpeechRecognition) for hands-free dashboard control.
 * Supports continuous listening, auto-restart on silence, token-based fuzzy phrase
 * matching, and a configurable confidence threshold.
 */
export function useVoiceCommands({
  enabled,
  mode = "continuous",
  commands,
  minConfidence = 0.75,
  onTranscript,
  onMatch,
}: UseVoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastMatchedPhrase, setLastMatchedPhrase] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const shouldListenRef = useRef(false);
  const [isPushToListenActive, setIsPushToListenActive] = useState(false);

  const shouldListen = enabled && (mode === "continuous" || isPushToListenActive);

  // Sync ref to avoid stale closure issues in recognition callbacks
  useEffect(() => {
    shouldListenRef.current = shouldListen;
  }, [shouldListen]);

  useEffect(() => {
    if (!(enabled && mode === "push-to-listen")) {
      setIsPushToListenActive(false);
      return;
    }

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isEditableTarget(event.target)) return;
      event.preventDefault();
      setIsPushToListenActive(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      setIsPushToListenActive(false);
    };

    const onBlur = () => {
      setIsPushToListenActive(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, mode]);

  useEffect(() => {
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;
    }
  }, []);

  const handleResult = useCallback(
    (event: SpeechRecognitionEventLike) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      const transcript: string = lastResult[0].transcript.trim().toLowerCase();
      const confidence: number = lastResult[0].confidence ?? 1;
      const isFinal: boolean = lastResult.isFinal;

      onTranscript?.(transcript, isFinal);

      if (!isFinal) return;

      const now = Date.now();
      // Debounce: block re-fire within 3 seconds.
      if (now - lastTriggerTimeRef.current < 3000) return;

      for (const cmd of commands) {
        const threshold = cmd.confidence ?? minConfidence;

        const phraseMatch = findBestPhraseMatch(transcript, cmd.phrases);
        const phraseThreshold = Math.max(0.55, threshold - 0.2);
        const matched = Boolean(phraseMatch && phraseMatch.score >= phraseThreshold);

        if (matched && confidence >= threshold && phraseMatch) {
          const matchedPhrase = phraseMatch.matchedPhrase;
          console.log(
            `[Voice] "${transcript}" -> "${matchedPhrase}" (speech ${confidence.toFixed(2)}, phrase ${phraseMatch.score.toFixed(2)})`
          );
          setLastMatchedPhrase(matchedPhrase);
          onMatch?.(matchedPhrase, cmd.id);
          cmd.action();
          lastTriggerTimeRef.current = now;

          // Clear the visual flash after 2 seconds
          setTimeout(() => setLastMatchedPhrase(null), 2000);
          break;
        }
      }
    },
    [commands, minConfidence, onTranscript, onMatch]
  );

  useEffect(() => {
    if (!recognitionRef.current) return;

    const recognition = recognitionRef.current;

    recognition.onresult = handleResult;

    recognition.onerror = (event: { error: string }) => {
      if (event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
      }
      if (event.error === "not-allowed") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still enabled (browser stops after silence/timeout)
      if (shouldListenRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current) {
            try {
              recognition.start();
              setIsListening(true);
            } catch {
              /* ignore -- already running */
            }
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, [handleResult]);

  useEffect(() => {
    if (!recognitionRef.current) return;

    if (shouldListen) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        /* already running */
      }
    } else {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch {
        /* already stopped */
      }
    }
  }, [shouldListen]);

  return { isListening, isSupported, lastMatchedPhrase, isPushToListenActive };
}
