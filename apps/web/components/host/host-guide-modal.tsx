"use client";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function HostGuideModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-black/10 bg-[#faf7ef] shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/5 p-6 md:p-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Host Guide</h2>
            <p className="mt-1 text-sm soft-text">Learn how to master your presentation</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-slate-500 transition hover:bg-black/10 hover:text-slate-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 hide-scrollbar">
          <div className="grid gap-10">
            {/* Section: Interactions */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--accent)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
                Interaction Types
              </h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/5 bg-white/50 p-4">
                  <h4 className="font-bold text-slate-800">Crowd Prompt</h4>
                  <p className="mt-1 text-sm soft-text">Ask a question or share a thought. It appears live on everyone&apos;s screen.</p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white/50 p-4">
                  <h4 className="font-bold text-slate-800">Live Polls & Quizzes</h4>
                  <p className="mt-1 text-sm soft-text">Gather instant feedback or test knowledge. Results update in real-time.</p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white/50 p-4">
                  <h4 className="font-bold text-slate-800">Emoji Reactions</h4>
                  <p className="mt-1 text-sm soft-text">Let the audience pulse with reactions. Perfect for temperature checks.</p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white/50 p-4">
                  <h4 className="font-bold text-slate-800">Synced Slides</h4>
                  <p className="mt-1 text-sm soft-text">Upload a PDF and keep every audience device in sync with your current slide.</p>
                </div>
              </div>
            </section>

            {/* Section: Voice Control */}
            <section className="rounded-3xl bg-black/5 p-6 md:p-7">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-900">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2M12 18v4M8 22h8" />
                </svg>
                Voice Commands
              </h3>
              <p className="mt-2 text-sm soft-text">Go hands-free by enabling the microphone. Use global phrases or custom preset triggers.</p>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-3">
                  <span className="text-sm font-medium text-slate-700">Navigate Slides</span>
                  <div className="flex gap-1.5">
                    <kbd className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold shadow-sm">&quot;Next slide&quot;</kbd>
                    <kbd className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold shadow-sm">&quot;Go back&quot;</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-3">
                  <span className="text-sm font-medium text-slate-700">Clear Screen</span>
                  <kbd className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold shadow-sm">&quot;Back to lobby&quot;</kbd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-3">
                  <span className="text-sm font-medium text-slate-700">Close Interaction</span>
                  <kbd className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold shadow-sm">&quot;Close it&quot;</kbd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-700">Custom Triggers</span>
                  <span className="text-xs soft-text italic">Assign phrases in the Preset Editor</span>
                </div>
              </div>
            </section>

            {/* Section: Remote Control */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-blue-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                Mobile Remote
              </h3>
              <p className="mt-3 text-sm leading-relaxed soft-text">
                Don&apos;t stay tied to the computer. Click the <span className="font-bold text-slate-800">Host Device</span> badge in the header, scan the QR code with your phone, and use it as a remote clicker to launch interactions and change slides from anywhere in the room.
              </p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-black/5 p-6 text-center">
          <button
            onClick={onClose}
            className="accent-button inline-flex h-12 w-full max-w-xs items-center justify-center rounded-2xl text-sm font-bold"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
