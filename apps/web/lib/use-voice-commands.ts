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

/**
 * Token-intersection fuzzy matcher.
 *
 * Splits both the transcript and the trigger phrase into word tokens and checks
 * what fraction of the phrase's tokens appear anywhere in the transcript.
 * A match is declared when at least `threshold` of the phrase words are present.
 *
 * Examples:
 *   fuzzyMatch("alright let's now do a vote", "let's vote", 0.7) → true  (2/2 = 100%)
 *   fuzzyMatch("next please", "next slide", 0.5) → true  (1/2 = 50% >= 0.5)
 *   fuzzyMatch("hello world", "end poll", 0.7) → false  (0/2 = 0%)
 */
function fuzzyMatch(transcript: string, phrase: string, threshold = 0.8): boolean {
  const phraseTokens = phrase.toLowerCase().split(/\s+/);
  const transcriptTokens = transcript.toLowerCase().split(/\s+/);

  const matchCount = phraseTokens.filter((token) =>
    transcriptTokens.some(
      (t) => t === token || t.startsWith(token) || token.startsWith(t)
    )
  ).length;

  return matchCount / phraseTokens.length >= threshold;
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

        const matched = cmd.phrases.some((phrase) =>
          fuzzyMatch(transcript, phrase, threshold)
        );

        if (matched && confidence >= threshold) {
          const matchedPhrase = cmd.phrases[0];
          console.log(
            `[Voice] "${transcript}" -> "${matchedPhrase}" (confidence ${confidence.toFixed(2)})`
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
