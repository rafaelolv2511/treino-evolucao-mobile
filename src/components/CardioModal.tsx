"use client";

import { useEffect, useRef, useState } from "react";
import { CardioInput, formatElapsed } from "@/lib/calc";
import { CardioType } from "@/lib/types";
import Icon from "./Icons";
import { Modal } from "./ui";

const TIPOS: { key: CardioType; label: string }[] = [
  { key: "esteira", label: "Esteira" },
  { key: "bike", label: "Bike" },
  { key: "escada", label: "Escada" },
];

/**
 * Cardio com cronômetro próprio, independente do tempo geral do treino.
 * Fluxo: escolhe a modalidade → play → pausa/encerra → confere os minutos
 * (editáveis) e informa a quilometragem → salva.
 * Reabrir com um cardio já salvo permite editar direto, sem recontar.
 */
export default function CardioModal({
  open,
  saving,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  initial: CardioInput | null;
  onClose: () => void;
  onSave: (cardio: CardioInput | null) => void | Promise<void>;
}) {
  const [type, setType] = useState<CardioType | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // segundos acumulados
  const [minutes, setMinutes] = useState("");
  const [km, setKm] = useState("");
  const startedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? null);
    setMinutes(initial ? String(Math.round(initial.minutes)) : "");
    setKm(initial?.km != null ? String(initial.km) : "");
    setElapsed(initial ? Math.round(initial.minutes) * 60 : 0);
    setRunning(false);
    startedRef.current = null;
  }, [open, initial]);

  // Cronômetro: soma o tempo decorrido enquanto estiver rodando.
  useEffect(() => {
    if (!running) return;
    startedRef.current = Date.now();
    const id = window.setInterval(() => {
      if (startedRef.current == null) return;
      const delta = Math.floor((Date.now() - startedRef.current) / 1000);
      setElapsed((prev) => prev + delta);
      startedRef.current = Date.now();
    }, 1000);
    return () => {
      window.clearInterval(id);
      if (startedRef.current != null) {
        const delta = Math.floor((Date.now() - startedRef.current) / 1000);
        if (delta > 0) setElapsed((prev) => prev + delta);
        startedRef.current = null;
      }
    };
  }, [running]);

  // O cronômetro alimenta o campo de minutos, que continua editável à mão.
  useEffect(() => {
    if (running) setMinutes(String(Math.max(1, Math.round(elapsed / 60))));
  }, [elapsed, running]);

  const minutesNum = Number(minutes.replace(",", "."));
  const kmNum = Number(km.replace(",", "."));
  const valido = type !== null && minutes.trim() !== "" && Number.isFinite(minutesNum) && minutesNum > 0;

  function confirmar() {
    if (!valido || !type) return;
    void onSave({
      type,
      minutes: minutesNum,
      km: km.trim() !== "" && Number.isFinite(kmNum) && kmNum > 0 ? kmNum : null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Cardio" center>
      <p className="text-xs text-muted">
        Cronômetro à parte do tempo de treino. Minutos e km entram na estimativa de calorias.
      </p>

      <div className="mt-3 flex gap-1 rounded-2xl bg-white/10 p-1">
        {TIPOS.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`min-w-0 flex-1 rounded-xl px-1 py-2 text-xs font-semibold transition ${
              type === t.key ? "bg-aqua text-[#06120F]" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type && (
        <>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-iron bg-[#141414] px-4 py-4">
            <div className="flex items-center gap-2.5">
              {running && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aqua opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-aqua" />
                </span>
              )}
              <span className={`stat text-4xl ${running ? "text-aqua" : "text-giz"}`}>{formatElapsed(elapsed)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRunning((r) => !r)}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95 ${
                  running ? "border border-iron bg-[#1A1A1A] text-giz" : "bg-aqua text-[#06120F]"
                }`}
                aria-label={running ? "Pausar" : "Iniciar cardio"}
              >
                <Icon name={running ? "pause" : "play"} size={17} />
              </button>
              {(elapsed > 0 || running) && (
                <button
                  onClick={() => {
                    setRunning(false);
                    setElapsed(0);
                    setMinutes("");
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-iron bg-[#141414] text-muted transition active:scale-95"
                  aria-label="Zerar"
                >
                  <Icon name="x" size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="label mb-1 px-1">Minutos</p>
              <input
                className="field num w-full"
                inputMode="numeric"
                placeholder="20"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
            <div>
              <p className="label mb-1 px-1">Km {type === "escada" ? "(opcional)" : ""}</p>
              <input
                className="field num w-full"
                inputMode="decimal"
                placeholder={type === "escada" ? "—" : "3,0"}
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-faded">
            Os minutos vêm do cronômetro, mas você pode corrigir à mão.
          </p>
        </>
      )}

      <button
        onClick={confirmar}
        disabled={!valido || saving}
        className="btn btn-primary mt-4 w-full gap-2 disabled:opacity-40"
      >
        <Icon name="check" size={16} /> {saving ? "Salvando…" : "Salvar cardio"}
      </button>
      {initial && (
        <button onClick={() => void onSave(null)} disabled={saving} className="btn btn-ghost mt-2 w-full">
          Remover cardio
        </button>
      )}
      <button onClick={onClose} className="btn btn-ghost mt-2 w-full">
        Voltar
      </button>
    </Modal>
  );
}
