"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/calc";
import { WorkoutSessionRow } from "@/lib/types";
import Icon from "./Icons";
import { useOverlayOpen } from "./ui";

/**
 * Pílula flutuante do treino em andamento (estilo contador do app Fitness).
 * Aparece em todas as telas do perfil a partir do play e some ao concluir.
 * Tocar no tempo abre a sessão; "Encerrar" abre a sessão já no passo de conclusão.
 */
export default function WorkoutTimerBar({
  session,
  sessionName,
  onOpen,
  onFinish,
}: {
  session: WorkoutSessionRow;
  sessionName: string;
  onOpen: () => void;
  onFinish: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const overlayOpen = useOverlayOpen();

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session.id]);

  const elapsed = session.started_at ? Math.max(0, Math.floor((now - Date.parse(session.started_at)) / 1000)) : 0;

  // Some enquanto qualquer modal estiver aberto (cardio, resumo, compartilhar…)
  if (overlayOpen) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.9rem)] z-40 flex justify-center px-4">
      <div className="pointer-events-auto rounded-full bg-gradient-to-r from-aqua/70 via-aqua/40 to-aqua/70 p-[1.5px] shadow-[0_10px_34px_rgba(0,0,0,0.6),0_0_22px_rgba(68,226,217,0.22)]">
        <div className="flex items-center gap-1 rounded-full bg-[#0B0F16]/95 py-1 pl-1.5 pr-1 backdrop-blur-xl">
        <button onClick={onOpen} className="flex items-center gap-2 rounded-full px-2.5 py-1.5 transition active:scale-95">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glow opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-glow" />
          </span>
          <span className="max-w-[8rem] truncate text-[11px] font-semibold text-white/70">{sessionName}</span>
          <span className="num font-display text-sm font-bold tracking-wide text-glow">{formatElapsed(elapsed)}</span>
        </button>
          <button
            onClick={onFinish}
            className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/85 transition active:scale-95"
          >
            <Icon name="check" size={12} /> Encerrar
          </button>
        </div>
      </div>
    </div>
  );
}
