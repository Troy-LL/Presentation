import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  activeHosts: number;
  hostToken: string;
};

export function MultiDeviceBadge({ activeHosts, hostToken }: Props) {
  const [showQr, setShowQr] = useState(false);

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
              <QRCodeSVG size={140} value={hostToken} />
            </div>
            
            <p className="mt-3 text-center text-[10px] font-mono tracking-wider text-slate-500">
              {hostToken.substring(0, 8)}...
            </p>
          </div>
        </>
      )}
    </div>
  );
}
