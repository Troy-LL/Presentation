import { ReactNode } from "react";
import { HostLayoutMode } from "../../hooks/use-host-layout";

type Props = {
  layout: HostLayoutMode;
  toolbar: ReactNode;
  header: ReactNode;
  content: ReactNode;
  sidebar: ReactNode | null;
};

export function HostLayoutShell({ layout, toolbar, header, content, sidebar }: Props) {
  const isPhone = layout === "phone";

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f0ede6] text-slate-900 selection:bg-[var(--accent)] selection:text-white">
      {/* Background blobs (from globals.css or layout) */}
      <div className="pointer-events-none fixed -left-[20vw] -top-[20vw] h-[60vw] w-[60vw] rounded-full bg-[var(--accent)]/10 mix-blend-multiply blur-[100px]" />
      <div className="pointer-events-none fixed -bottom-[20vw] -right-[20vw] h-[50vw] w-[50vw] rounded-full bg-blue-400/10 mix-blend-multiply blur-[100px]" />

      <main className="relative flex h-full w-full flex-col md:flex-row p-2 sm:p-4 md:p-6 lg:p-8 gap-4 md:gap-6 overflow-hidden max-w-[1920px] mx-auto">
        {/* Desktop Side Toolbar */}
        {!isPhone && toolbar}

        {/* Main Content Column */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-6 overflow-hidden">
          {/* Header Area (Session Code, Multi-device, Fullscreen) */}
          <div className="shrink-0">{header}</div>

          {/* Central Workspace Area (Stats + Main Tool Panel) */}
          <div className="flex min-h-0 flex-1 gap-6 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-3xl hide-scrollbar pb-24 md:pb-0">
              {content}
            </div>

            {/* Desktop Right Sidebar */}
            {sidebar && layout === "desktop" && (
              <div className="hidden min-w-[320px] max-w-[400px] flex-col gap-6 overflow-y-auto hide-scrollbar lg:flex">
                {sidebar}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Phone Bottom Toolbar (Absolute pinned to bottom to float over content) */}
      {isPhone && (
        <div className="absolute bottom-0 left-0 w-full z-40 bg-gradient-to-t from-[#f0ede6] via-[#f0ede6]/90 to-transparent pt-6">
          {toolbar}
        </div>
      )}
    </div>
  );
}
