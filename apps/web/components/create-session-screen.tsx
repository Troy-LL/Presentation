"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { SessionResponse } from "@interactive-presentation/types";

export function CreateSessionScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function createSession() {
      try {
        const response = await fetch("/api/sessions", { method: "POST" });
        const payload = (await response.json()) as SessionResponse | { error?: string };
        const apiError = "error" in payload ? payload.error : undefined;

        if (!response.ok || !("sessionCode" in payload)) {
          throw new Error(apiError ?? "Could not create the session.");
        }

        if (!active) {
          return;
        }

        router.replace(`/host/${payload.sessionCode}?token=${payload.hostToken}`);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setError(
          caughtError instanceof Error ? caughtError.message : "Could not create the session."
        );
      }
    }

    void createSession();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="app-shell flex items-center justify-center px-6 py-10">
      <div className="panel w-full max-w-xl rounded-[28px] p-8 text-center md:p-10">
        <p className="text-sm uppercase tracking-[0.24em] soft-text">Host setup</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Opening a fresh room</h1>
        <p className="mt-4 text-base leading-7 soft-text">
          We&apos;re creating a session code, generating the join link, and wiring the live room.
        </p>
        {error ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700">
            {error}
          </div>
        ) : (
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent)]" />
            <span className="soft-text">Creating session…</span>
          </div>
        )}
      </div>
    </main>
  );
}
