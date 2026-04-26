"use client";

import type { SessionMetrics } from "@interactive-presentation/types";

export function MetricsReportPreview({ metrics }: { metrics: SessionMetrics }) {
  const totalInteractions = metrics.interactionMetrics.length;
  const totalResponses = metrics.interactionMetrics.reduce((acc, curr) => acc + curr.totalResponsesReceived, 0);

  return (
    <div className="space-y-6 py-2">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Participants" value={metrics.totalUniqueParticipants.toString()} />
        <StatCard label="Peak Concurrent" value={metrics.peakConcurrentParticipants.toString()} />
        <StatCard label="Interactions" value={totalInteractions.toString()} />
        <StatCard label="Total Responses" value={totalResponses.toString()} />
      </div>

      <div className="rounded-2xl border border-black/5 bg-slate-50/50 p-4">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Interaction Activity</h4>
        <div className="mt-3 space-y-2">
          {metrics.interactionMetrics.slice(-3).reverse().map((im) => (
            <div key={im.interactionId} className="flex items-center justify-between gap-4 rounded-xl bg-white p-3 shadow-sm border border-black/5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{im.promptText}</p>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{im.interactionType.replace('_', ' ')}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-900">{im.totalResponsesReceived}</p>
                <p className="text-[10px] text-slate-400 font-medium">responses</p>
              </div>
            </div>
          ))}
          {totalInteractions === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">No interactions recorded in this session.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
