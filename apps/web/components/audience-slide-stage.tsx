"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import type { SlideDeckInteraction } from "@interactive-presentation/types";

type Props = {
  interaction: SlideDeckInteraction;
  /** When true the component takes only its natural height (for coexistence layout) */
  compact?: boolean;
};

export function AudienceSlideStage({ interaction, compact = false }: Props) {
  const [pageDataUrl, setPageDataUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const slideLabel = useMemo(
    () => `${interaction.payload.currentSlideIndex + 1} / ${interaction.payload.totalSlides}`,
    [interaction.payload.currentSlideIndex, interaction.payload.totalSlides]
  );

  useEffect(() => {
    let active = true;

    async function renderSlide() {
      setLoading(true);
      setLoadError(null);
      try {
        const { getDocument, GlobalWorkerOptions, version } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version || "4.4.168"}/build/pdf.worker.min.mjs`;

        const doc = await getDocument(interaction.payload.sourceUrl).promise;
        const page = await doc.getPage(interaction.payload.currentSlideIndex + 1);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas rendering unavailable.");
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        if (active) {
          setPageDataUrl(canvas.toDataURL("image/png"));
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Failed to render slide.");
          setPageDataUrl(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void renderSlide();
    return () => {
      active = false;
    };
  }, [interaction.payload.currentSlideIndex, interaction.payload.sourceUrl]);

  const wrapperClass = compact
    ? "flex w-full flex-col"
    : "flex min-h-screen w-full flex-col items-center justify-center bg-white px-4 py-6 md:px-6 md:py-8";

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-6xl mx-auto">
        {/* ── Slide canvas ─────────────────────────────────────────────── */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {/* Slide image */}
          <AnimatePresence mode="wait">
            {pageDataUrl && (
              <motion.img
                animate={{ opacity: 1, x: 0 }}
                className="h-full w-full object-contain"
                exit={{ opacity: 0, x: -20 }}
                initial={{ opacity: 0, x: 20 }}
                key={`${interaction.payload.deckId}:${interaction.payload.currentSlideIndex}`}
                src={pageDataUrl}
              />
            )}
          </AnimatePresence>

          {/* Loading spinner — only allowed absolute inside canvas */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/65 text-sm font-medium text-slate-600">
              Rendering slide...
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-medium text-red-600">
              {loadError}
            </div>
          )}
        </div>

        {/* ── Metadata bar — OUTSIDE the canvas, below it ──────────────── */}
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          {/* Left: filename */}
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-500">
            {interaction.payload.title ?? "Presentation"}
          </p>

          {/* Centre: sync badge */}
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
            Synced live with host
          </span>

          {/* Right: slide counter */}
          <p className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
            {slideLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
