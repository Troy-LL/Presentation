import { HostLayoutMode } from "../../hooks/use-host-layout";
import { AttentionNudgeButton } from "./attention-nudge-button";

export type Mode = "prompt" | "poll" | "quiz" | "reactions" | "open_text" | "countdown" | "slides";

type Props = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  onNudge: (message: string) => void;
  layout: HostLayoutMode;
};

const TOOLS: { id: Mode; label: string; icon: string }[] = [
  { id: "prompt", label: "Crowd Prompt", icon: "✨" },
  { id: "poll", label: "Live Poll", icon: "📊" },
  { id: "quiz", label: "Quiz", icon: "❓" },
  { id: "reactions", label: "Reactions", icon: "😂" },
  { id: "open_text", label: "Open Text", icon: "💬" },
  { id: "countdown", label: "Countdown", icon: "⏱️" },
  { id: "slides", label: "Slides", icon: "🖼️" },
];

export function HostToolbar({ mode, setMode, onNudge, layout }: Props) {
  const isPhone = layout === "phone";
  const isCondensed = layout === "condensed";

  return (
    <nav
      className={[
        "panel flex z-30 overflow-hidden shrink-0",
        isPhone 
          ? "w-full flex-row items-center justify-start gap-2 overflow-x-auto rounded-t-3xl border-b-0 p-3 pb-safe" // Bottom mobile
          : "flex-col gap-3 rounded-3xl p-4 md:p-6" // Desktop side
      ].join(" ")}
      style={{
        width: isPhone ? "100%" : isCondensed ? "88px" : "240px",
      }}
    >
      <div className={isPhone ? "hidden" : "mb-4 border-b border-black/10 pb-4"}>
        <h2 className={`font-semibold tracking-tight text-slate-800 ${isCondensed ? "text-center text-xs" : "text-sm uppercase tracking-[0.1em]"}`}>
          {isCondensed ? "Tools" : "Interactions"}
        </h2>
      </div>

      <div className={[
        "flex flex-1",
        isPhone ? "flex-row gap-2 min-w-max pr-4" : "flex-col gap-2 overflow-y-auto"
      ].join(" ")}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={[
              "flex items-center transition-all duration-200",
              isPhone ? "h-12 flex-row gap-2 rounded-2xl px-4 min-w-[120px]" : 
              isCondensed ? "h-14 w-14 flex-col justify-center rounded-2xl p-0 mx-auto" : 
              "h-12 flex-row gap-3 rounded-2xl px-4 w-full",
              mode === t.id
                ? "bg-white shadow-sm text-slate-900 ring-1 ring-black/5"
                : "bg-black/3 text-slate-600 hover:bg-black/5 hover:text-slate-900"
            ].join(" ")}
            title={t.label}
          >
            <span className={isCondensed ? "text-xl" : "text-lg"}>{t.icon}</span>
            {(!isCondensed || isPhone) && (
              <span className="text-sm font-semibold whitespace-nowrap">{t.label}</span>
            )}
          </button>
        ))}
      </div>

      <div className={isPhone ? "sticky right-0 flex shrink-0 items-center bg-gradient-to-r from-transparent via-[#f8f6f3] to-[#f8f6f3] pl-6 pr-1" : "mt-4 pt-4 border-t border-black/10"}>
        <AttentionNudgeButton onNudge={onNudge} collapsed={isCondensed || isPhone} />
      </div>
    </nav>
  );
}
