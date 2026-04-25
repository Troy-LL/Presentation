"use client";

import { useState } from "react";

import type { QuizInteraction } from "@interactive-presentation/types";

type Props = {
  quiz: QuizInteraction;
  onSubmitAnswer: (optionId: string) => void;
};

export function AudienceQuiz({ quiz, onSubmitAnswer }: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const totalVotes = Object.values(quiz.votes).reduce((a, b) => a + b, 0);

  const handleAnswer = (optionId: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(optionId);
    onSubmitAnswer(optionId);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 sm:px-6">
      <div className="w-full max-w-xl">
        <p className="text-center text-sm uppercase tracking-[0.28em] text-slate-300">Live quiz</p>
        <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          {quiz.payload.question}
        </h1>

        <div className="mt-8 flex flex-col gap-3">
          {quiz.payload.options.map((option) => {
            const isSelected = selectedAnswer === option.id;
            const isCorrect = option.id === quiz.payload.correctOptionId;
            const reveal = quiz.answerRevealed;

            return (
              <button
                className={[
                  "min-h-12 w-full rounded-2xl border px-5 py-4 text-left transition",
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
                  <span className="text-[15px] font-medium text-slate-800 sm:text-base">{option.text}</span>
                  {quiz.answerRevealed && isCorrect && (
                    <span className="text-sm font-semibold text-green-700">Correct</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {selectedAnswer && !quiz.answerRevealed && (
          <p className="mt-6 text-center text-sm text-slate-400">
            Answer submitted - waiting for reveal...
          </p>
        )}
        {quiz.answerRevealed && (
          <p className="mt-6 text-center text-sm text-slate-500">
            {totalVotes} {totalVotes === 1 ? "answer" : "answers"} total
          </p>
        )}
      </div>
    </main>
  );
}
