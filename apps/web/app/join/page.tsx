import Link from "next/link";

import { JoinForm } from "@/components/join-form";

export default async function JoinPage({
  searchParams
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const initialCode = code?.toUpperCase() ?? "";

  return (
    <main className="app-shell px-4 py-6 sm:px-6 md:px-10 md:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <div className="grid w-full gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <section className="panel rounded-[28px] p-6 sm:p-8 md:p-10">
            <p className="text-sm uppercase tracking-[0.24em] soft-text">Audience join</p>
            <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-6xl">
              Present something. Let the room answer back.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 soft-text sm:text-lg sm:leading-8">
              Join with a short code, wait in the lobby, and snap into the live prompt the second the host launches it.
            </p>
            <div className="mt-8">
              <JoinForm initialCode={initialCode} />
            </div>
          </section>

          <section className="grid gap-4">
            <div className="panel rounded-[24px] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] soft-text">
                Flow
              </p>
              <div className="mt-5 grid gap-4">
                {[
                  "Enter the session code from the room screen.",
                  "Wait on a blank lobby until the host activates the moment.",
                  "Prompt text appears live on every connected phone."
                ].map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-4 rounded-2xl border border-black/5 bg-white/75 p-4"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 border-t border-black/5 pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] soft-text">
                Hosting an event?
              </p>
              <Link
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-black"
                href="/host/new"
              >
                Start a new session
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
