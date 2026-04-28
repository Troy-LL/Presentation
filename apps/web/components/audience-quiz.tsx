"use client";

import { useState } from "react";

import type { QuizInteraction } from "@interactive-presentation/types";

type Props = {
  quiz: QuizInteraction;
  onSubmitAnswer: (optionId: string) => void;
  compact?: boolean;
};

export function AudienceQuiz({ quiz, onSubmitAnswer, compact = false }: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const totalVotes = Object.values(quiz.votes).reduce((a, b) => a + b, 0);
  const shellClass = compact
    ? "flex h-full min-h-0 items-start justify-center bg-white px-4 py-4 sm:px-5 sm:py-5"
    : "flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6";

  const handleAnswer = (optionId: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(optionId);
    onSubmitAnswer(optionId);
  };

  return (
    <main className={shellClass}>
      <div className="w-full max-w-xl">
        <p className="text-center text-[11px] uppercase tracking-[0.28em] text-slate-300 sm:text-sm">Live quiz</p>
        <h1 className={compact ? "mt-3 text-center text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl" : "mt-5 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl"}>
          {quiz.payload.question}
        </h1>

        <div className={compact ? "mt-5 flex max-h-full flex-col gap-2 overflow-hidden" : "mt-8 flex flex-col gap-3"}>
          {quiz.payload.options.map((option) => {
            const isSelected = selectedAnswer === option.id;
            const isCorrect = option.id === quiz.payload.correctOptionId;
            const reveal = quiz.answerRevealed;

            return (
              <button
                className={[
                  "w-full rounded-2xl border text-left transition",
                  compact ? "min-h-10 px-4 py-3" : "min-h-12 px-5 py-4",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                  reveal
                    ? isCorrect
                      ? "border-green-400 bg-green-50"
                      : isSelected
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200 bg-white"
                    : selectedAnswer
                      ? isSelected
                        ? "border-orange-400 bg-orange-50"
                        : "border-slate-100 bg-white opacity-70"
                      : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 active:scale-[0.99]"
                ].join(" ")}
                disabled={Boolean(selectedAnswer)}
                key={option.id}
                onClick={() => handleAnswer(option.id)}
                type="button"
              >
                <span className="flex items-center justify-between gap-4">
                  <span className={compact ? "text-[14px] font-medium text-slate-800 sm:text-[15px]" : "text-[15px] font-medium text-slate-800 sm:text-base"}>{option.text}</span>
                  {quiz.answerRevealed && isCorrect && (
                    <span className={compact ? "text-[11px] font-semibold text-green-700 sm:text-xs" : "text-sm font-semibold text-green-700"}>Correct</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {selectedAnswer && !quiz.answerRevealed && (
          <p className={compact ? "mt-4 text-center text-xs text-slate-400" : "mt-6 text-center text-sm text-slate-400"}>
            Answer submitted - waiting for reveal...
          </p>
        )}
        {quiz.answerRevealed && (
          <p className={compact ? "mt-4 text-center text-xs text-slate-500" : "mt-6 text-center text-sm text-slate-500"}>
            {totalVotes} {totalVotes === 1 ? "answer" : "answers"} total
          </p>
        )}
      </div>
    </main>
  );
}
