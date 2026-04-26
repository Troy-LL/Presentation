"use client";

import type { QuizInteraction } from "@interactive-presentation/types";

type Props = {
  quiz: QuizInteraction;
  onReveal: () => void;
  onClear: () => void;
};

export function HostQuizResults({ quiz, onReveal, onClear }: Props) {
  const totalAnswers = Object.values(quiz.votes).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(...Object.values(quiz.votes), 1);

  return (
    <div className="panel min-h-[600px] rounded-[28px] p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] soft-text">Live quiz</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{quiz.payload.question}</h2>
        </div>
        <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-sm soft-text">
          {totalAnswers} {totalAnswers === 1 ? "answer" : "answers"}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {quiz.payload.options.map((option) => {
          const count = quiz.votes[option.id] ?? 0;
          const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
          const isLeading = count === maxVotes && count > 0;
          const isCorrect = option.id === quiz.payload.correctOptionId;

          return (
            <div key={option.id}>
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className={[
                    "text-sm font-medium",
                    quiz.answerRevealed && isCorrect
                      ? "text-green-700"
                      : isLeading
                        ? "text-[var(--accent-strong)]"
                        : "text-slate-700"
                  ].join(" ")}
                >
                  {quiz.answerRevealed && isCorrect ? "✓ " : isLeading ? "▲ " : ""}
                  {option.text}
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-500",
                    quiz.answerRevealed && isCorrect
                      ? "bg-green-500"
                      : isLeading
                        ? "bg-[var(--accent)]"
                        : "bg-slate-300"
                  ].join(" ")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 border-t border-black/5 pt-6">
        {!quiz.answerRevealed && (
          <button
            className="accent-button inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold"
            onClick={onReveal}
            type="button"
          >
            Reveal correct answer
          </button>
        )}
        {quiz.answerRevealed && (
          <span className="inline-flex h-10 items-center rounded-full border border-green-200 bg-green-50 px-4 text-sm font-medium text-green-700">
            ✓ Answer revealed
          </span>
        )}
        <button
          className="ghost-button inline-flex h-10 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold transition hover:bg-white"
          onClick={onClear}
          type="button"
        >
          End quiz
        </button>
      </div>
    </div>
  );
}
