"use client";

import { useEffect, useRef, useState } from "react";

export interface RestTimerHandle {
  start: (seconds: number) => void;
}

export default function RestTimer({ handleRef }: { handleRef: React.MutableRefObject<RestTimerHandle | null> }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState(90);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    handleRef.current = {
      start: (seconds: number) => {
        setTotal(seconds);
        endAt.current = Date.now() + seconds * 1000;
        setRemaining(seconds);
      },
    };
  }, [handleRef]);

  useEffect(() => {
    if (remaining === null) return;
    const id = setInterval(() => {
      if (!endAt.current) return;
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
      }
    }, 250);
    return () => clearInterval(id);
  }, [remaining !== null, total]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const pct = remaining !== null && total > 0 ? (remaining / total) * 100 : 0;

  return (
    <div className="glass glass-strong sticky top-2 z-30 mb-4 p-3">
      {remaining === null ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/60">⏱ Descanso</span>
          <div className="ml-auto flex gap-2">
            {[60, 90, 120].map((s) => (
              <button key={s} onClick={() => handleRef.current?.start(s)} className="btn btn-ghost !min-h-0 !px-3 !py-2 text-xs">
                {s === 60 ? "1:00" : s === 90 ? "1:30" : "2:00"}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <span className={`num font-display text-2xl font-bold ${remaining === 0 ? "text-ok" : "text-glow"}`}>
              {remaining === 0 ? "Bora! 💪" : fmt(remaining)}
            </span>
            <div className="flex gap-2">
              <button onClick={() => handleRef.current?.start(total)} className="btn btn-ghost !min-h-0 !px-3 !py-1.5 text-xs">
                ↺
              </button>
              <button onClick={() => setRemaining(null)} className="btn btn-ghost !min-h-0 !px-3 !py-1.5 text-xs">
                ✕
              </button>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-glow to-viol transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
