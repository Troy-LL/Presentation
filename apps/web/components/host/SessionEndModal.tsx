"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { SessionMetrics } from "@interactive-presentation/types";
import type { ReportFormat } from "@/lib/exportReport";
import { MetricsReportPreview } from "@/components/host/MetricsReportPreview";

type SessionEndModalProps = {
  isOpen: boolean;
  phase: "confirm" | "download";
  metrics: SessionMetrics | null;
  isBusy: boolean;
  error: string | null;
  remainingSeconds: number;
  onCancel: () => void;
  onConfirm: () => void;
  onDownload: (format: ReportFormat) => void;
  onSkip: () => void;
};

export function SessionEndModal({
  isOpen,
  phase,
  metrics,
  isBusy,
  error,
  remainingSeconds,
  onCancel,
  onConfirm,
  onDownload,
  onSkip
}: SessionEndModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={phase === "confirm" ? onCancel : undefined}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl"
      >
        <AnimatePresence mode="wait">
          {phase === "confirm" ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">End Session?</h3>
              <p className="mt-2 text-base leading-7 text-slate-500">
                This will disconnect all participants and close the room. You can download a report of all interaction metrics after ending.
              </p>
              
              {error && (
                <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">
                  {error}
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={onCancel}
                  disabled={isBusy}
                  className="rounded-full px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Keep Live
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isBusy}
                  className="rounded-full bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 hover:bg-red-700 disabled:opacity-50"
                >
                  {isBusy ? "Preparing..." : "End Session"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="report"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Auto-skip in</span>
                  <p className="text-sm font-mono font-bold text-slate-900">{remainingSeconds}s</p>
                </div>
              </div>

              <h3 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">Session Complete</h3>
              <p className="mt-1 text-sm text-slate-500">The session has been closed. Download your metrics report below.</p>

              {metrics && <div className="mt-6"><MetricsReportPreview metrics={metrics} /></div>}
              
              {error && (
                <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">
                  {error}
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={onSkip}
                  disabled={isBusy}
                  className="rounded-full px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Skip
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDownload("csv")}
                    disabled={isBusy || !metrics}
                    className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none disabled:opacity-50"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => onDownload("pdf")}
                    disabled={isBusy || !metrics}
                    className="flex-1 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 hover:bg-slate-800 sm:flex-none disabled:opacity-50"
                  >
                    {isBusy ? "Exporting..." : "Download PDF Report"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
