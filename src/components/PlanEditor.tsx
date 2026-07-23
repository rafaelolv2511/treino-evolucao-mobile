"use client";

import { useState } from "react";
import { updatePlanJson } from "@/lib/db";
import { PlanExercise, TrainingPlanJson, TrainingPlanRow } from "@/lib/types";
import { Modal } from "./ui";
import Icon from "./Icons";

const EMPTY: PlanExercise = {
  exerciseId: "",
  name: "",
  description: "",
  primaryMuscleGroup: "",
  secondaryMuscleGroups: [],
  sets: 3,
  reps: "8-10",
  targetRIR: 2,
  suggestedRestSeconds: 90,
  initialLoadKg: null,
  notes: "",
};

export default function PlanEditor({
  open,
  onClose,
  plan,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  plan: TrainingPlanRow;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<TrainingPlanJson | null>(null);
  const [editing, setEditing] = useState<{ sessionKey: string; exercise: PlanExercise; isNew: boolean } | null>(null);
  const [renaming, setRenaming] = useState<{ sessionKey: string; exerciseId: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const json = draft ?? plan.source_json;
  if (open && draft === null) setDraft(structuredClone(plan.source_json));

  function mutate(fn: (j: TrainingPlanJson) => void) {
    const next = structuredClone(json);
    fn(next);
    setDraft(next);
  }

  function moveExercise(exerciseId: string, fromKey: string, toKey: string) {
    mutate((j) => {
      const from = j.sessions.find((s) => s.sessionKey === fromKey)!;
      const to = j.sessions.find((s) => s.sessionKey === toKey)!;
      const idx = from.exercises.findIndex((e) => e.exerciseId === exerciseId);
      if (idx >= 0) to.exercises.push(from.exercises.splice(idx, 1)[0]);
    });
  }

  function removeExercise(exerciseId: string, fromKey: string) {
    mutate((j) => {
      const from = j.sessions.find((s) => s.sessionKey === fromKey)!;
      from.exercises = from.exercises.filter((e) => e.exerciseId !== exerciseId);
    });
  }

  function renameExercise(sessionKey: string, exerciseId: string, name: string) {
    if (!name.trim()) return;
    mutate((j) => {
      const s = j.sessions.find((x) => x.sessionKey === sessionKey)!;
      const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
      if (ex) ex.name = name.trim();
    });
    setRenaming(null);
  }

  function upsertExercise(sessionKey: string, ex: PlanExercise, isNew: boolean) {
    setError(null);
    if (!ex.exerciseId.trim() || !ex.name.trim() || !ex.primaryMuscleGroup.trim()) {
      setError("Preencha exerciseId, nome e grupo muscular.");
      return false;
    }
    const allIds = json.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId));
    if (isNew && allIds.includes(ex.exerciseId)) {
      setError(`exerciseId "${ex.exerciseId}" já existe no treino. Use um identificador único.`);
      return false;
    }
    mutate((j) => {
      const s = j.sessions.find((x) => x.sessionKey === sessionKey)!;
      if (isNew) s.exercises.push(ex);
      else {
        const idx = s.exercises.findIndex((e) => e.exerciseId === ex.exerciseId);
        if (idx >= 0) s.exercises[idx] = ex;
      }
    });
    return true;
  }

  async function saveAll() {
    setBusy(true);
    setError(null);
    try {
      await updatePlanJson(plan.id, json);
      setDraft(null);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Falha ao salvar as alterações.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setDraft(null);
        onClose();
      }}
      title="Edição geral do treino"
    >
      <p className="mb-3 text-xs text-white/55">
        As alterações valem apenas para este perfil. O histórico de cargas por exerciseId é preservado.
      </p>

      <div className="space-y-4">
        {json.sessions.map((s) => (
          <div key={s.sessionKey} className="rounded-2xl border border-white/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-sm font-bold">
                {s.sessionKey} · {s.sessionName}
              </p>
              <button
                onClick={() => setEditing({ sessionKey: s.sessionKey, exercise: { ...EMPTY }, isNew: true })}
                className="btn btn-ghost flex !min-h-0 items-center gap-1 !px-2.5 !py-1 text-xs"
              >
                <Icon name="plus" size={13} /> Exercício
              </button>
            </div>
            <div className="space-y-2">
              {s.exercises.map((e) => (
                <div key={e.exerciseId} className="rounded-xl bg-white/5 p-2.5">
                  <p className="truncate text-sm font-semibold">{e.name}</p>
                  <p className="num text-[11px] text-white/50">
                    {e.primaryMuscleGroup} · {e.sets}×{e.reps} · RIR {e.targetRIR} · {e.suggestedRestSeconds}s
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setRenaming({ sessionKey: s.sessionKey, exerciseId: e.exerciseId, name: e.name })}
                      className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white/85"
                    >
                      <Icon name="pencil" size={12} /> Renomear
                    </button>
                    <button
                      onClick={() => setEditing({ sessionKey: s.sessionKey, exercise: { ...e }, isNew: false })}
                      className="rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white/85"
                    >
                      Editar tudo
                    </button>
                    {json.sessions.length > 1 && (
                      <select
                        className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-white/85"
                        value=""
                        onChange={(ev) => ev.target.value && moveExercise(e.exerciseId, s.sessionKey, ev.target.value)}
                      >
                        <option value="" className="bg-ink text-white">
                          Mover para…
                        </option>
                        {json.sessions
                          .filter((x) => x.sessionKey !== s.sessionKey)
                          .map((x) => (
                            <option key={x.sessionKey} value={x.sessionKey} className="bg-ink text-white">
                              Treino {x.sessionKey}
                            </option>
                          ))}
                      </select>
                    )}
                    <button
                      onClick={() => removeExercise(e.exerciseId, s.sessionKey)}
                      className="rounded-lg bg-red-400/10 px-2 py-1 text-[11px] text-red-300"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              {s.exercises.length === 0 && <p className="text-xs text-white/40">Sessão sem exercícios.</p>}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      <button onClick={saveAll} disabled={busy} className="btn btn-primary mt-4 w-full">
        {busy ? "Salvando…" : "Salvar alterações no perfil"}
      </button>

      {renaming && (
        <div className="mt-4 rounded-2xl border border-glow/30 bg-glow/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <Icon name="pencil" size={14} /> Renomear exercício
          </p>
          <input
            className="field !min-h-[44px] text-sm"
            value={renaming.name}
            onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
            autoFocus
          />
          <div className="mt-3 flex gap-2">
            <button onClick={() => setRenaming(null)} className="btn btn-ghost flex-1 !min-h-[44px]">
              Cancelar
            </button>
            <button
              onClick={() => renameExercise(renaming.sessionKey, renaming.exerciseId, renaming.name)}
              disabled={!renaming.name.trim()}
              className="btn btn-primary flex-1 !min-h-[44px]"
            >
              Salvar nome
            </button>
          </div>
        </div>
      )}

      {editing && (
        <ExerciseForm
          editing={editing}
          onCancel={() => setEditing(null)}
          onConfirm={(ex) => {
            if (upsertExercise(editing.sessionKey, ex, editing.isNew)) setEditing(null);
          }}
        />
      )}
    </Modal>
  );
}

function ExerciseForm({
  editing,
  onCancel,
  onConfirm,
}: {
  editing: { sessionKey: string; exercise: PlanExercise; isNew: boolean };
  onCancel: () => void;
  onConfirm: (ex: PlanExercise) => void;
}) {
  const [ex, setEx] = useState<PlanExercise>(editing.exercise);
  const set = (patch: Partial<PlanExercise>) => setEx({ ...ex, ...patch });

  return (
    <div className="mt-4 rounded-2xl border border-glow/30 bg-glow/5 p-3">
      <p className="mb-2 text-sm font-bold">
        {editing.isNew ? `Novo exercício — Treino ${editing.sessionKey}` : `Editar — ${editing.exercise.name}`}
      </p>
      <div className="space-y-2">
        {editing.isNew && (
          <input
            className="field !min-h-[44px] text-sm"
            placeholder="exerciseId (ex.: supino_reto_barra)"
            value={ex.exerciseId}
            onChange={(e) => set({ exerciseId: e.target.value.trim().toLowerCase().replace(/\s+/g, "_") })}
          />
        )}
        <input className="field !min-h-[44px] text-sm" placeholder="Nome" value={ex.name} onChange={(e) => set({ name: e.target.value })} />
        <input
          className="field !min-h-[44px] text-sm"
          placeholder="Grupo muscular principal"
          value={ex.primaryMuscleGroup}
          onChange={(e) => set({ primaryMuscleGroup: e.target.value })}
        />
        <input
          className="field !min-h-[44px] text-sm"
          placeholder="Grupos secundários (separados por vírgula)"
          value={(ex.secondaryMuscleGroups ?? []).join(", ")}
          onChange={(e) =>
            set({ secondaryMuscleGroups: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-white/60">
            Séries
            <input className="field-mini num mt-1" inputMode="numeric" value={ex.sets} onChange={(e) => set({ sets: Number(e.target.value) || 1 })} />
          </label>
          <label className="text-xs text-white/60">
            Repetições
            <input className="field-mini mt-1" value={ex.reps} onChange={(e) => set({ reps: e.target.value })} />
          </label>
          <label className="text-xs text-white/60">
            RIR alvo
            <input className="field-mini num mt-1" inputMode="numeric" value={ex.targetRIR} onChange={(e) => set({ targetRIR: Number(e.target.value) || 0 })} />
          </label>
          <label className="text-xs text-white/60">
            Descanso (s)
            <input className="field-mini num mt-1" inputMode="numeric" value={ex.suggestedRestSeconds} onChange={(e) => set({ suggestedRestSeconds: Number(e.target.value) || 60 })} />
          </label>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onCancel} className="btn btn-ghost flex-1 !min-h-[44px]">
          Cancelar
        </button>
        <button onClick={() => onConfirm(ex)} className="btn btn-primary flex-1 !min-h-[44px]">
          Confirmar
        </button>
      </div>
    </div>
  );
}
