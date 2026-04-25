"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      return;
    }

    router.push(`/lobby/${normalizedCode}`);
  }

  return (
    <form className="flex flex-col gap-4 md:max-w-md" onSubmit={handleSubmit}>
      <label className="text-sm font-semibold uppercase tracking-[0.18em] soft-text" htmlFor="invite-code">
        Session code
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="invite-code"
          autoComplete="off"
          className="h-14 flex-1 rounded-full border border-black/10 bg-white px-6 text-lg uppercase tracking-[0.35em] outline-none ring-0 placeholder:text-slate-300 focus:border-black"
          maxLength={5}
          onChange={(event) => setCode(event.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
          placeholder="XK29A"
          value={code}
        />
        <button
          className="accent-button inline-flex h-14 items-center justify-center rounded-full px-7 text-sm font-semibold transition"
          type="submit"
        >
          Join session
        </button>
      </div>
    </form>
  );
}

