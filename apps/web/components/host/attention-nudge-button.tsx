import { useEffect, useState } from "react";

type Props = {
  onNudge: (message: string) => void;
  collapsed?: boolean;
};

export function AttentionNudgeButton({ onNudge, collapsed = false }: Props) {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleNudge = () => {
    if (cooldown > 0) return;
    onNudge("👀 Look up at the screen!");
    setCooldown(8); // 8 second cooldown matches server
  };

  return (
    <button
      className={[
        "group relative flex items-center justify-center gap-3 rounded-2xl transition-all duration-300",
        collapsed ? "mx-auto h-10 w-10 shrink-0" : "w-full px-4 py-3",
        cooldown > 0 
          ? "cursor-not-allowed bg-[var(--accent)]/50 text-white" 
          : "accent-button active:scale-95 text-white"
      ].join(" ")}
      disabled={cooldown > 0}
      onClick={handleNudge}
      title={collapsed ? "Attention Nudge" : undefined}
    >
      <div className="relative">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {cooldown > 0 && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-[var(--accent)] shadow-sm">
            {cooldown}
          </span>
        )}
      </div>
      
      {!collapsed && (
        <span className="text-sm font-semibold tracking-wide">
          {cooldown > 0 ? `Wait ${cooldown}s` : "Attention Nudge"}
        </span>
      )}
    </button>
  );
}
