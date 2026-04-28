import Link from "next/link";

export const metadata = {
  title: "LocalHost — Real-time Audience Interaction",
  description:
    "A lightweight live audience tool for classrooms, study sessions, and live events. Join a room or host your own — no accounts needed.",
};

export default function HomePage() {
  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-16 md:py-24">
      {/* ── Wordmark / hero ── */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--accent)]">
          LocalHost
        </p>
        <h1 className="mt-5 text-5xl font-semibold tracking-tighter sm:text-6xl md:text-7xl lg:text-[5.5rem]">
          Make every room<br className="hidden sm:block" />
          <span className="text-[var(--accent)]"> come alive.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed soft-text md:text-xl">
          Live polls, quizzes, reactions, and real-time prompts —
          synced instantly to every device in the room.
        </p>
      </div>

      {/* ── Two paths ── */}
      <div className="mt-14 grid w-full max-w-4xl gap-5 sm:grid-cols-2">
        {/* JOIN */}
        <Link
          href="/join"
          id="home-join-btn"
          className="group panel panel-interactive flex flex-col gap-6 rounded-[32px] p-8 md:p-10"
        >
          {/* Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/20 transition-all duration-200 group-hover:bg-[var(--accent)]/18">
            <svg
              className="h-7 w-7 text-[var(--accent)]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Join a Session
            </h2>
            <p className="mt-2 text-base leading-relaxed soft-text">
              Enter a room code or scan a QR code to jump into live polls,
              quizzes, and reactions.
            </p>
          </div>

          <div className="mt-auto flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
            Enter room code
            <svg
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </Link>

        {/* HOST */}
        <Link
          href="/host/new"
          id="home-host-btn"
          className="group panel panel-interactive flex flex-col gap-6 rounded-[32px] p-8 md:p-10"
        >
          {/* Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/6 ring-1 ring-black/10 transition-all duration-200 group-hover:bg-slate-900/10">
            <svg
              className="h-7 w-7 text-slate-700 transition-colors duration-200 group-hover:text-slate-900"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Host a Session
            </h2>
            <p className="mt-2 text-base leading-relaxed soft-text">
              Create a room, share your invite code, and control exactly what
              every screen in the audience sees.
            </p>
          </div>

          <div className="mt-auto flex items-center gap-2 text-sm font-bold text-slate-700 transition-colors group-hover:text-slate-900">
            Open host dashboard
            <svg
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </Link>
      </div>

      {/* ── Feature chips ── */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
        {[
          "Live Polls",
          "Quiz Mode",
          "Emoji Reactions",
          "Crowd Prompts",
          "Countdown Timer",
          "Synced Slides",
          "Voice Commands",
        ].map((f) => (
          <span
            key={f}
            className="rounded-full border border-black/8 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 backdrop-blur-sm"
          >
            {f}
          </span>
        ))}
      </div>

      {/* ── Quick Manual ── */}
      <div className="mt-20 w-full max-w-4xl border-t border-black/5 pt-16">
        <h2 className="text-center text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
          How it works
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          <div className="text-center sm:text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-xs font-bold text-white mb-5 mx-auto sm:mx-0">1</div>
            <h3 className="font-bold text-slate-900">Create a Session</h3>
            <p className="mt-2 text-sm soft-text leading-relaxed">
              Launch a room in seconds. No account required. You&apos;ll get a unique code to share with your audience.
            </p>
          </div>
          <div className="text-center sm:text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-xs font-bold text-white mb-5 mx-auto sm:mx-0">2</div>
            <h3 className="font-bold text-slate-900">Audience Joins</h3>
            <p className="mt-2 text-sm soft-text leading-relaxed">
              Participants enter the code or scan a QR on their phones. They&apos;ll wait in a lobby until you launch an interaction.
            </p>
          </div>
          <div className="text-center sm:text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-xs font-bold text-white mb-5 mx-auto sm:mx-0">3</div>
            <h3 className="font-bold text-slate-900">Go Live</h3>
            <p className="mt-2 text-sm soft-text leading-relaxed">
              Trigger polls, quizzes, or slides. Every screen in the room stays perfectly in sync with your dashboard.
            </p>
          </div>
        </div>
      </div>

      <footer className="mt-14 text-center text-xs soft-text">
        © 2026 LocalHost. Open source &amp; no-account required.
      </footer>
    </main>
  );
}
