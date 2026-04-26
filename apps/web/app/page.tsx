import Link from "next/link";

export default function HomePage() {
  return (
    <main className="app-shell flex items-center justify-center px-4 py-12 md:py-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[var(--accent)]">
            Interactive Presentation App
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tighter sm:text-6xl md:text-7xl">
            Engagement, <br className="hidden sm:block" />
            instantly synced.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed soft-text md:text-xl">
            A lightweight, real-time audience interaction tool for classrooms, 
            study sessions, and live events. No accounts, no friction.
          </p>
        </div>

        <div className="grid w-full gap-6 md:grid-cols-2">
          {/* Join Path */}
          <Link 
            href="/join"
            className="group panel flex flex-col justify-between rounded-[32px] p-8 transition-all duration-300 hover:scale-[1.02] hover:border-[var(--accent)]/30 md:p-12"
          >
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 group-hover:bg-[var(--accent)]/10">
                <svg className="h-7 w-7 text-slate-700 group-hover:text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h2 className="mt-8 text-2xl font-semibold tracking-tight sm:text-3xl">Join a Session</h2>
              <p className="mt-3 text-base leading-relaxed soft-text">
                Scan a QR code or enter an invite code to participate in live polls, quizzes, and reactions.
              </p>
            </div>
            <div className="mt-12 flex items-center gap-2 font-semibold text-[var(--accent)]">
              Enter room code
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </Link>

          {/* Host Path */}
          <Link 
            href="/host/new"
            className="group panel flex flex-col justify-between rounded-[32px] p-8 transition-all duration-300 hover:scale-[1.02] hover:border-[var(--accent)]/30 md:p-12"
          >
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 group-hover:bg-[var(--accent)]/10">
                <svg className="h-7 w-7 text-slate-700 group-hover:text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 21h6l-.75-4M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="mt-8 text-2xl font-semibold tracking-tight sm:text-3xl">Start a Session</h2>
              <p className="mt-3 text-base leading-relaxed soft-text">
                Create a new session, share your QR code, and control what your audience sees from your dashboard.
              </p>
            </div>
            <div className="mt-12 flex items-center gap-2 font-semibold text-[var(--accent)]">
              Create host dashboard
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </Link>
        </div>

        <footer className="mt-12 text-center text-sm soft-text">
          <p>© 2026 Interactive Presentation App. Open source & lightweight.</p>
        </footer>
      </div>
    </main>
  );
}
