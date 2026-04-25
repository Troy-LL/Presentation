"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import type { SlideDeckInteraction } from "@interactive-presentation/types";

type Props = {
  interaction: SlideDeckInteraction;
};

export function AudienceSlideStage({ interaction }: Props) {
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
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const doc = await pdfjs.getDocument(interaction.payload.sourceUrl).promise;
        const page = await doc.getPage(interaction.payload.currentSlideIndex + 1);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas rendering unavailable.");
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvas, canvasContext: context, viewport }).promise;
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-6 md:px-6 md:py-8">
      <div className="w-full max-w-6xl">
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {/* Layer 1: Slide image */}
          <div className="absolute inset-0">
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
          </div>

          {/* Layer 2: Interaction overlay */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />

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

          {/* Layer 3: Controls/status */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 sm:text-xs">
                {interaction.payload.title ?? "Presentation"}
              </p>
              <p className="rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/90">
                {slideLabel}
              </p>
            </div>

            <div className="flex items-center justify-end">
              <p className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm sm:text-xs">
                Synced live with host
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
