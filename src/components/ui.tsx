"use client";

import { ReactNode, useEffect } from "react";
import Icon from "./Icons";

/**
 * Integra um estado interno (sessão aberta, modo foco…) ao histórico do navegador:
 * o gesto de voltar do celular fecha a camada atual em vez de sair do app.
 */
// Pilha global de camadas abertas — só a camada do topo responde ao gesto de voltar.
const backLayers: string[] = [];
let consumingBack = false;

export function useBackClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const marker = `layer-${Date.now()}-${Math.random()}`;
    backLayers.push(marker);
    window.history.pushState({ layer: marker }, "");
    const onPop = () => {
      // back() disparado internamente para consumir estado: nenhuma camada fecha.
      if (consumingBack) {
        window.setTimeout(() => {
          consumingBack = false;
        }, 0);
        return;
      }
      // Gesto real de voltar: fecha apenas a camada do topo da pilha.
      if (backLayers[backLayers.length - 1] !== marker) return;
      backLayers.pop();
      onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      const index = backLayers.indexOf(marker);
      if (index >= 0) backLayers.splice(index, 1);
      // Fechado pela UI (não pelo gesto): consome o estado que empilhamos sem fechar as demais camadas.
      if (window.history.state?.layer === marker) {
        consumingBack = true;
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

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
            <Icon name="x" size={16} />
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
