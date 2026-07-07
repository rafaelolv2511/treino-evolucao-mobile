"use client";

import { useState } from "react";
import { validatePlanJson } from "@/lib/validatePlan";
import { buildFullReport, downloadFile } from "@/lib/report";
import { deactivatePlans, getNotes, insertPlan, listBodyMetrics, saveExportedReport } from "@/lib/db";
import { HistoryBundle } from "@/lib/calc";
import { ProfileRow, TrainingPlanRow } from "@/lib/types";
import { Modal } from "./ui";

const EXAMPLE = `{
  "profileName": "Rafael",
  "planName": "Treino Hipertrofia Julho",
  "startDate": "2026-07-03",
  "sessions": [
    {
      "sessionKey": "A",
      "sessionName": "Treino A",
      "focus": "Peito e tríceps",
      "exercises": [
        {
          "exerciseId": "supino_inclinado_haltere",
          "name": "Supino inclinado com halteres",
          "description": "Executar com controle e amplitude segura.",
          "primaryMuscleGroup": "Peito",
          "secondaryMuscleGroups": ["Ombro", "Tríceps"],
          "sets": 3,
          "reps": "8-10",
          "targetRIR": 2,
          "suggestedRestSeconds": 90,
          "initialLoadKg": null,
          "notes": ""
        }
      ],
      "mobility": [
        {
          "mobilityId": "mobilidade_ombro_aquecimento",
          "name": "Mobilidade de ombro",
          "description": "Movimento controlado antes do treino.",
          "durationSeconds": 60,
          "reps": null,
          "notes": ""
        }
      ]
    }
  ]
}`;

export default function ImportPlan({
  open,
  onClose,
  profile,
  currentPlan,
  history,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  profile: ProfileRow;
  currentPlan: TrainingPlanRow | null;
  history: HistoryBundle;
  onImported: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function handleFile(file: File) {
    setRaw(await file.text());
    setErrors([]);
  }

  async function handleImport() {
    const result = validatePlanJson(raw);
    if (!result.ok || !result.plan) {
      setErrors(result.errors);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      // Preserva o ciclo anterior antes de substituir o JSON
      if (currentPlan && history.sessions.length > 0) {
        const [metrics, notes] = await Promise.all([listBodyMetrics(profile.id), getNotes(profile.id)]);
        const report = buildFullReport(profile.name, currentPlan, history, metrics, notes);
        await saveExportedReport(profile.id, currentPlan.id, report.json, report.markdown);
        downloadFile(
          `relatorio-${profile.name.toLowerCase().replace(/\s+/g, "-")}-${currentPlan.plan_name
            .toLowerCase()
            .replace(/\s+/g, "-")}.md`,
          report.markdown,
          "text/markdown"
        );
      }
      await deactivatePlans(profile.id);
      await insertPlan(profile.id, result.plan);
      setDone(
        currentPlan && history.sessions.length > 0
          ? "Treino importado. O relatório do ciclo anterior foi salvo e baixado automaticamente."
          : "Treino importado com sucesso."
      );
      setRaw("");
      onImported();
    } catch (e: any) {
      setErrors([e.message ?? "Falha ao importar o treino."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setDone(null);
        onClose();
      }}
      title="Importar treino (JSON)"
    >
      {done ? (
        <div>
          <p className="text-sm text-emerald-300">{done}</p>
          <button
            onClick={() => {
              setDone(null);
              onClose();
            }}
            className="btn btn-primary mt-4 w-full"
          >
            Começar a treinar
          </button>
        </div>
      ) : (
        <div>
          {currentPlan && (
            <p className="mb-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
              Este perfil já tem o treino <strong>{currentPlan.plan_name}</strong>. Ao importar um novo, o relatório
              completo do ciclo atual é salvo e baixado automaticamente antes da troca.
            </p>
          )}

          <label className="btn btn-ghost w-full cursor-pointer">
            📄 Escolher arquivo .json
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          <p className="my-2 text-center text-xs text-white/40">ou cole o JSON abaixo</p>
          <textarea
            className="field h-40 font-mono text-xs"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder='{"profileName": "...", "planName": "...", "sessions": [...]}'
          />

          <button onClick={() => setShowExample(!showExample)} className="mt-2 text-xs text-glow/80 underline">
            {showExample ? "Esconder exemplo de JSON válido" : "Ver exemplo de JSON válido"}
          </button>
          {showExample && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-2xl bg-black/40 p-3 text-[10px] leading-relaxed text-white/70">
              {EXAMPLE}
            </pre>
          )}

          {errors.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">
              {errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}

          <button onClick={handleImport} disabled={busy || !raw.trim()} className="btn btn-primary mt-4 w-full">
            {busy ? "Validando e salvando…" : "Validar e importar"}
          </button>
        </div>
      )}
    </Modal>
  );
}
