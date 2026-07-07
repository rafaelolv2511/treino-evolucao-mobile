"use client";

import { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="glass glass-strong fade-in max-h-[88dvh] w-full max-w-md overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost !min-h-0 !rounded-xl !px-3 !py-1.5" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="glass flex gap-1 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
            value === t.key ? "bg-white/10 text-white shadow-inner" : "text-white/55"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass fade-in p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold tracking-wide">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Spinner({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-white/60">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-glow" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
