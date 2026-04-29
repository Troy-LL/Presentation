"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  activeHosts: number;
  hostToken: string;
  sessionCode: string;
};

export function MultiDeviceBadge({ activeHosts, hostToken, sessionCode }: Props) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const coHostUrl = typeof window !== "undefined"
    ? `${window.location.origin}/host/${sessionCode}?token=${hostToken}`
    : `/host/${sessionCode}?token=${hostToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coHostUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowQr(!showQr)}
        className="flex items-center gap-2 rounded-full border border-black/10 bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-white/80"
        title="Host Devices Connected"
      >
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] text-white">
          {activeHosts}
        </div>
        <span>{activeHosts === 1 ? "Host Device" : "Host Devices"}</span>
      </button>

      {showQr && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setShowQr(false)}
          />
          
          {/* Popover */}
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-black/10 bg-white p-5 shadow-xl md:right-auto md:left-1/2 md:-translate-x-1/2">
            <h3 className="text-sm font-semibold tracking-tight">Host Token</h3>
            <p className="mt-1 text-xs soft-text">
              Scan this from another device to add a co-host or control panel. Do not share with the audience.
            </p>
            
            <div className="mt-4 flex justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
              <QRCodeSVG size={140} value={coHostUrl} />
            </div>
            
            <button
              onClick={handleCopy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
