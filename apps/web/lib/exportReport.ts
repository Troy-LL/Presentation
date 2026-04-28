import type { SessionMetrics } from "@interactive-presentation/types";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: unknown) => void;
    lastAutoTable?: {
      finalY: number;
    };
  }
}

export type ReportFormat = "csv" | "pdf";

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "-";
  const safeSeconds = Math.max(0, seconds);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildFilename(metrics: SessionMetrics, extension: ReportFormat) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `session-${metrics.sessionCode}-metrics-${stamp}.${extension}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number) {
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv(metrics: SessionMetrics) {
  const sessionDurationSeconds = metrics.endedAt
    ? Math.max(0, Math.round((new Date(metrics.endedAt).getTime() - new Date(metrics.startedAt).getTime()) / 1000))
    : null;

  const rows: string[] = [];
  rows.push("Session Summary");
  rows.push("Field,Value");
  rows.push(`Session Code,${escapeCsv(metrics.sessionCode)}`);
  rows.push(`Date,${escapeCsv(formatDateTime(metrics.startedAt))}`);
  rows.push(`Duration,${escapeCsv(formatDuration(sessionDurationSeconds))}`);
  rows.push(`Started At,${escapeCsv(formatDateTime(metrics.startedAt))}`);
  rows.push(`Ended At,${escapeCsv(formatDateTime(metrics.endedAt))}`);
  rows.push(`Total Participants,${metrics.totalUniqueParticipants}`);
  rows.push(`Peak Concurrent,${metrics.peakConcurrentParticipants}`);
  rows.push("");

  rows.push("Per Interaction");
  rows.push(
    [
      "Type",
      "Question/Prompt",
      "Slide Number At Launch",
      "Responses",
      "Response Rate",
      "Duration",
      "Started At",
      "Ended At"
    ].join(",")
  );

  for (const metric of metrics.interactionMetrics) {
    rows.push(
      [
        escapeCsv(metric.interactionType),
        escapeCsv(metric.promptText),
        escapeCsv(metric.slideIndexAtLaunch === null ? "-" : metric.slideIndexAtLaunch + 1),
        metric.totalResponsesReceived,
        escapeCsv(formatPercent(metric.responseRate)),
        escapeCsv(metric.durationSeconds ?? "-"),
        escapeCsv(formatDateTime(metric.startedAt)),
        escapeCsv(formatDateTime(metric.endedAt))
      ].join(",")
    );
  }

  const breakdownMetrics = metrics.interactionMetrics.filter((metric) => metric.optionBreakdown.length > 0);
  if (breakdownMetrics.length > 0) {
    rows.push("");
    rows.push("Poll And Quiz Breakdowns");
    rows.push("Interaction Type,Question/Prompt,Option,Vote Count,Vote Percentage");

    for (const metric of breakdownMetrics) {
      const totalVotes = metric.optionBreakdown.reduce((sum, option) => sum + option.voteCount, 0);
      for (const option of metric.optionBreakdown) {
        rows.push(
          [
            escapeCsv(metric.interactionType),
            escapeCsv(metric.promptText),
            escapeCsv(option.optionText),
            option.voteCount,
            escapeCsv(totalVotes > 0 ? formatPercent(option.voteCount / totalVotes) : "0.0%")
          ].join(",")
        );
      }
    }
  }

  const openTextMetrics = metrics.interactionMetrics.filter((metric) => metric.openTextResponses.length > 0);
  if (openTextMetrics.length > 0) {
    rows.push("");
    rows.push("Open Text Responses");
    rows.push("Question/Prompt,Response");

    for (const metric of openTextMetrics) {
      for (const response of metric.openTextResponses) {
        rows.push([escapeCsv(metric.promptText), escapeCsv(response)].join(","));
      }
    }
  }

  return rows.join("\n");
}

async function buildPdf(metrics: SessionMetrics) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // ─── Header ────────────────────────────────────────────────────────────────
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("Session Metrics Report", 40, 50);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Generated on ${new Date().toLocaleString()}`, 40, 65);

  // ─── Session Summary ───────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Session Summary", 40, 95);

  const sessionDurationSeconds = metrics.endedAt
    ? Math.max(0, Math.round((new Date(metrics.endedAt).getTime() - new Date(metrics.startedAt).getTime()) / 1000))
    : null;

  doc.autoTable({
    startY: 105,
    margin: { left: 40, right: 40 },
    head: [["Metric", "Value"]],
    body: [
      ["Session Code", metrics.sessionCode],
      ["Started At", formatDateTime(metrics.startedAt)],
      ["Ended At", formatDateTime(metrics.endedAt)],
      ["Total Duration", formatDuration(sessionDurationSeconds)],
      ["Total Unique Participants", metrics.totalUniqueParticipants.toString()],
      ["Peak Concurrent Participants", metrics.peakConcurrentParticipants.toString()],
    ],
    theme: "striped",
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255] },
  });

  // ─── Interactions Table ────────────────────────────────────────────────────
  let lastY = (doc.lastAutoTable?.finalY ?? 105) + 30;

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Interactions Breakdown", 40, lastY);

  const interactionRows = metrics.interactionMetrics.map((im) => [
    im.interactionType,
    im.promptText,
    im.slideIndexAtLaunch !== null ? `Slide ${im.slideIndexAtLaunch + 1}` : "-",
    im.totalResponsesReceived,
    formatPercent(im.responseRate),
    im.durationSeconds ? `${im.durationSeconds}s` : "-",
  ]);

  doc.autoTable({
    startY: lastY + 10,
    margin: { left: 40, right: 40 },
    head: [["Type", "Prompt/Question", "Slide", "Responses", "Rate", "Duration"]],
    body: interactionRows,
    theme: "grid",
    headStyles: { fillColor: [71, 85, 105] },
    columnStyles: {
      1: { cellWidth: 200 },
    },
  });

  // ─── Detailed Breakdowns ───────────────────────────────────────────────────
  lastY = (doc.lastAutoTable?.finalY ?? lastY) + 30;

  metrics.interactionMetrics.forEach((im, index) => {
    // Check if we need a new page
    if (lastY > 750) {
      doc.addPage();
      lastY = 40;
    }

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. ${im.interactionType.toUpperCase()}: ${im.promptText}`, 40, lastY);
    doc.setFont("helvetica", "normal");
    lastY += 15;

    if (im.optionBreakdown && im.optionBreakdown.length > 0) {
      doc.autoTable({
        startY: lastY,
        margin: { left: 40, right: 40 },
        head: [["Option", "Votes", "Percentage"]],
        body: im.optionBreakdown.map((opt) => [
          opt.optionText,
          opt.voteCount,
          formatPercent(im.totalResponsesReceived > 0 ? opt.voteCount / im.totalResponsesReceived : 0),
        ]),
        theme: "plain",
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] },
      });
      lastY = (doc.lastAutoTable?.finalY ?? lastY) + 25;
    } else if (im.openTextResponses && im.openTextResponses.length > 0) {
      doc.autoTable({
        startY: lastY,
        margin: { left: 40, right: 40 },
        head: [["Open Text Responses"]],
        body: im.openTextResponses.map((text) => [text]),
        theme: "plain",
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] },
      });
      lastY = (doc.lastAutoTable?.finalY ?? lastY) + 25;
    } else {
      lastY += 10;
    }
  });

  return doc.output("blob");
}

export async function downloadSessionMetricsReport(metrics: SessionMetrics, format: ReportFormat) {
  if (format === "csv") {
    const csv = buildCsv(metrics);
    triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), buildFilename(metrics, "csv"));
    return;
  }

  const pdfBlob = await buildPdf(metrics);
  triggerDownload(pdfBlob, buildFilename(metrics, "pdf"));
}
