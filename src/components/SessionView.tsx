"use client";

import { useMemo, useRef, useState } from "react";
import { HistoryBundle, bestLoadOfLog, fmtKg, isNewRecord, personalRecordBefore, suggestLoad, weeklySeriesForExercise } from "@/lib/calc";
import { getOrCreateWorkoutSession, saveExerciseLog, updatePlanJson, weekNumberFrom } from "@/lib/db";
import {
  ExerciseLogRow,
  PlanExercise,
  PlanSession,
  ProfileRow,
  SetLogRow,
  TrainingPlanRow,
  WorkoutSessionRow,
} from "@/lib/types";
import RestTimer, { RestTimerHandle } from "./RestTimer";
import { Modal, TabBar } from "./ui";
import Icon from "./Icons";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SessionView({
  profile,
  plan,
  session,
  history,
  onBack,
  onChanged,
}: {
  profile: ProfileRow;
  plan: TrainingPlanRow;
  session: PlanSession;
  history: HistoryBundle;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"exercicios" | "mobilidade">("exercicios");
  const [date, setDate] = useState(todayISO());
  const [workoutSession, setWorkoutSession] = useState<WorkoutSessionRow | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanExercise | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const timerRef = useRef<RestTimerHandle | null>(null);

  const currentWeek = useMemo(() => {
    const dates = history.sessions.map((s) => s.workout_date);
    const all = workoutSession ? dates : [...dates, date];
    const first = [...all].sort()[0];
    return first ? weekNumberFrom(first, workoutSession?.workout_date ?? date) : 1;
  }, [history.sessions, date, workoutSession]);

  // Resumo do dia: exercícios registrados, quantos subiram de carga e quantos recordes.
  const summary = useMemo(() => {
    if (!workoutSession) return { logged: 0, total: session.exercises.length, improved: 0, prs: 0, improvedNames: [] as string[] };
    const logsToday = history.logs.filter((l) => l.workout_session_id === workoutSession.id);
    let logged = 0;
    let improved = 0;
    let prs = 0;
    const improvedNames: string[] = [];
    for (const ex of session.exercises) {
      const log = logsToday.find((l) => l.exercise_id === ex.exerciseId);
      if (!log) continue;
      const { load } = bestLoadOfLog(log.id, history.sets);
      if (load === null) continue;
      logged++;
      // comparar com a semana anterior registrada (não herdada)
      const real = weeklySeriesForExercise(ex.exerciseId, history).filter((p) => !p.inherited && p.loadKg !== null);
      const prevWeeks = real.filter((p) => p.week < workoutSession.week_number);
      const prevLoad = prevWeeks.length ? prevWeeks[prevWeeks.length - 1].loadKg! : null;
      if (prevLoad !== null && load > prevLoad) {
        improved++;
        improvedNames.push(ex.name);
      }
      const pr = personalRecordBefore(ex.exerciseId, workoutSession.id, history);
      if (pr !== null && load > pr) prs++;
    }
    return { logged, total: session.exercises.length, improved, prs, improvedNames };
  }, [workoutSession, history, session.exercises]);

  async function startDay() {
    setStarting(true);
    setError(null);
    try {
      const ws = await getOrCreateWorkoutSession(profile.id, plan.id, session.sessionKey, date);
      setWorkoutSession(ws);
      onChanged();
    } catch (e: any) {
      setError(e.message ?? "Não foi possível iniciar o registro do dia.");
    } finally {
      setStarting(false);
    }
  }

  async function saveExerciseEdit(patch: { name: string; description: string }) {
    if (!editing) return;
    const json = structuredClone(plan.source_json);
    for (const s of json.sessions) {
      const ex = s.exercises.find((e) => e.exerciseId === editing.exerciseId);
      if (ex) {
        ex.name = patch.name;
        ex.description = patch.description;
      }
    }
    await updatePlanJson(plan.id, json);
    setEditing(null);
    onChanged();
  }

  // Agrupa exercícios por grupo muscular principal
  const groups = useMemo(() => {
    const map = new Map<string, PlanExercise[]>();
    for (const e of session.exercises) {
      const arr = map.get(e.primaryMuscleGroup) ?? [];
      arr.push(e);
      map.set(e.primaryMuscleGroup, arr);
    }
    return [...map.entries()];
  }, [session.exercises]);

  return (
    <div className="fade-in">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={onBack} className="btn btn-ghost !min-h-0 !px-3 !py-2 text-sm" aria-label="Voltar">
          <Icon name="arrowLeft" size={16} />
        </button>
        <div className="min-w-0">
          <h2 className="font-display truncate text-lg font-bold">{session.sessionName}</h2>
          {session.focus && <p className="truncate text-xs text-white/55">{session.focus}</p>}
        </div>
        {workoutSession && (
          <span className="ml-auto shrink-0 rounded-xl bg-glow/15 px-2.5 py-1 text-xs font-bold text-glow">
            S{workoutSession.week_number}
          </span>
        )}
      </div>

      <TabBar
        tabs={[
          { key: "exercicios", label: "Exercícios" },
          { key: "mobilidade", label: "Mobilidade" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-3">
        {tab === "mobilidade" ? (
          <div className="space-y-3">
            {session.mobility.length === 0 && (
              <p className="glass p-4 text-sm text-white/60">Esta sessão não tem mobilidade cadastrada no JSON.</p>
            )}
            {session.mobility.map((m) => (
              <div key={m.mobilityId} className="glass p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{m.name}</p>
                    {m.description && <p className="mt-1 text-xs text-white/60">{m.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-xl bg-white/8 px-2.5 py-1 text-xs text-white/70">
                    {m.durationSeconds ? `${m.durationSeconds}s` : m.reps ? `${m.reps} reps` : "livre"}
                  </span>
                </div>
                {m.notes && <p className="mt-2 text-xs italic text-white/45">{m.notes}</p>}
                {m.durationSeconds ? (
                  <button
                    onClick={() => timerRef.current?.start(m.durationSeconds!)}
                    className="btn btn-ghost mt-3 flex !min-h-0 items-center gap-1.5 !px-3 !py-2 text-xs"
                  >
                    <Icon name="timer" size={14} /> Cronometrar {m.durationSeconds}s
                  </button>
                ) : null}
              </div>
            ))}
            <RestTimer handleRef={timerRef} />
          </div>
        ) : (
          <div>
            {!workoutSession ? (
              <div className="glass glass-strong mb-4 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="calendar" size={15} /> Data do treino</p>
                <p className="mt-1 text-xs text-white/55">
                  Defina a data antes de registrar a primeira carga. Ela vale para toda a sessão de hoje.
                </p>
                <div className="mt-3 flex gap-2">
                  <input type="date" className="field flex-1" value={date} onChange={(e) => setDate(e.target.value)} />
                  <button onClick={startDay} disabled={starting || !date} className="btn btn-primary">
                    {starting ? "…" : "Começar"}
                  </button>
                </div>
                {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
              </div>
            ) : (
              <RestTimer handleRef={timerRef} />
            )}

            <div className="space-y-5">
              {groups.map(([group, exercises]) => (
                <div key={group}>
                  <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.2em] text-viol">{group}</p>
                  <div className="space-y-3">
                    {exercises.map((e) => (
                      <ExerciseCard
                        key={e.exerciseId}
                        exercise={e}
                        history={history}
                        workoutSession={workoutSession}
                        currentWeek={currentWeek}
                        locked={!workoutSession}
                        onSaved={onChanged}
                        onTimer={() => timerRef.current?.start(e.suggestedRestSeconds)}
                        onEdit={() => setEditing(e)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {workoutSession && summary.logged > 0 && (
              <button
                onClick={() => setShowSummary(true)}
                className="btn btn-ghost mt-5 flex w-full items-center justify-center gap-2"
              >
                <Icon name="check" size={17} /> Concluir treino ({summary.logged}/{summary.total})
              </button>
            )}
          </div>
        )}
      </div>

      <EditExerciseModal exercise={editing} onClose={() => setEditing(null)} onSave={saveExerciseEdit} />

      <Modal open={showSummary} onClose={() => setShowSummary(false)} title={`${session.sessionName} concluído`}>
        <div className="mb-4 flex items-center justify-center gap-2 text-ok">
          <Icon name="check" size={22} />
          <span className="font-display text-lg font-bold">Bom treino!</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="glass p-3">
            <p className="num font-display text-2xl font-bold text-glow">{summary.logged}</p>
            <p className="text-[10px] text-white/55">exercícios</p>
          </div>
          <div className="glass p-3">
            <p className="num font-display text-2xl font-bold text-ok">{summary.improved}</p>
            <p className="text-[10px] text-white/55">subiram carga</p>
          </div>
          <div className="glass p-3">
            <p className="num font-display text-2xl font-bold text-amber-300">{summary.prs}</p>
            <p className="text-[10px] text-white/55">recordes</p>
          </div>
        </div>
        {summary.improvedNames.length > 0 && (
          <p className="mt-3 text-xs text-white/60">
            Subiu de carga em: {summary.improvedNames.join(", ")}.
          </p>
        )}
        {summary.improved === 0 && summary.logged > 0 && (
          <p className="mt-3 text-xs text-white/55">
            Manteve as cargas hoje — consistência também é progresso. Bora pra próxima!
          </p>
        )}
        <button onClick={() => setShowSummary(false)} className="btn btn-primary mt-4 w-full">
          Fechar
        </button>
      </Modal>
    </div>
  );
}

// ── Card de exercício com colunas semanais ──────────────────────────────────
function ExerciseCard({
  exercise,
  history,
  workoutSession,
  currentWeek,
  locked,
  onSaved,
  onTimer,
  onEdit,
}: {
  exercise: PlanExercise;
  history: HistoryBundle;
  workoutSession: WorkoutSessionRow | null;
  currentWeek: number;
  locked: boolean;
  onSaved: () => void;
  onTimer: () => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);

  const existingLog: ExerciseLogRow | undefined = useMemo(
    () =>
      workoutSession
        ? history.logs.find((l) => l.workout_session_id === workoutSession.id && l.exercise_id === exercise.exerciseId)
        : undefined,
    [history.logs, workoutSession, exercise.exerciseId]
  );
  const existingSets: SetLogRow[] = useMemo(
    () => (existingLog ? history.sets.filter((s) => s.exercise_log_id === existingLog.id) : []),
    [history.sets, existingLog]
  );

  const [notes, setNotes] = useState(existingLog?.notes ?? exercise.notes ?? "");
  const [rows, setRows] = useState<{ load: string; reps: string; rir: string }[]>(() =>
    Array.from({ length: exercise.sets }, (_, i) => {
      const s = existingSets.find((x) => x.set_number === i + 1);
      return {
        load: s?.load_kg != null ? String(Number(s.load_kg)) : "",
        reps: s?.reps_done != null ? String(s.reps_done) : "",
        rir: s?.rir_done != null ? String(s.rir_done) : "",
      };
    })
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const weekly = useMemo(() => weeklySeriesForExercise(exercise.exerciseId, history), [exercise.exerciseId, history]);
  const pastWeeks = weekly.filter((w) => w.week < currentWeek);
  const suggestion = useMemo(() => suggestLoad(exercise.exerciseId, history), [exercise.exerciseId, history]);
  const hasDataToday = existingSets.some((s) => s.load_kg !== null);

  // Recorde pessoal: maior carga registrada antes de hoje, e se a de hoje superou.
  const prevPR = useMemo(
    () => (workoutSession ? personalRecordBefore(exercise.exerciseId, workoutSession.id, history) : null),
    [exercise.exerciseId, workoutSession, history]
  );
  const todayBestLoad = useMemo(() => {
    const loads = existingSets.map((s) => (s.load_kg == null ? null : Number(s.load_kg))).filter((n): n is number => n !== null);
    return loads.length ? Math.max(...loads) : null;
  }, [existingSets]);
  const isPR = isNewRecord(todayBestLoad, prevPR);

  async function save() {
    if (!workoutSession) return;
    setSaving(true);
    try {
      await saveExerciseLog(
        workoutSession.id,
        {
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          primaryMuscleGroup: exercise.primaryMuscleGroup,
          targetRIR: exercise.targetRIR,
        },
        notes,
        rows.map((r, i) => ({
          set_number: i + 1,
          load_kg: r.load.trim() === "" ? null : Number(r.load.replace(",", ".")),
          reps_done: r.reps.trim() === "" ? null : Number(r.reps),
          rir_done: r.rir.trim() === "" ? null : Number(r.rir),
        }))
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`glass overflow-hidden ${hasDataToday ? "border-emerald-400/25" : ""}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {hasDataToday && <span className="mr-1 inline-block align-middle text-ok"><Icon name="check" size={14} /></span>}
            {exercise.name}
          </p>
          {isPR && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              <Icon name="medal" size={12} /> Novo recorde
            </span>
          )}
          <p className="mt-0.5 truncate text-[11px] text-white/50">
            {exercise.primaryMuscleGroup}
            {exercise.secondaryMuscleGroups?.length ? ` · ${exercise.secondaryMuscleGroups.join(", ")}` : ""}
          </p>
          <p className="num mt-1 text-xs text-white/65">
            {exercise.sets}×{exercise.reps} · RIR {exercise.targetRIR} · desc. {exercise.suggestedRestSeconds}s
          </p>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(ev) => {
            ev.stopPropagation();
            onEdit();
          }}
          onKeyDown={(ev) => ev.key === "Enter" && onEdit()}
          className="shrink-0 rounded-xl bg-white/6 px-2 py-1 text-sm text-white/50"
          aria-label={`Editar ${exercise.name}`}
        >
          <Icon name="pencil" size={14} />
        </span>
        <span className={`mt-1 text-white/40 transition ${open ? "rotate-180" : ""}`}><Icon name="chevronDown" size={16} /></span>
      </button>

      {open && (
        <div className="border-t border-white/8 p-4 pt-3">
          {exercise.description && <p className="mb-3 text-xs italic text-white/50">{exercise.description}</p>}

          {/* Faixa semanal S1..Sn */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {pastWeeks.map((w) => (
              <div key={w.week} className={`week-pill ${w.inherited ? "inherited" : ""}`}>
                <p className="text-[10px] font-bold text-white/50">S{w.week}</p>
                <p className="num text-sm font-semibold">{w.loadKg !== null ? fmtKg(w.loadKg) : "—"}</p>
                {w.inherited && <p className="text-[9px] text-white/40">mantida</p>}
              </div>
            ))}
            <div className="week-pill current">
              <p className="text-[10px] font-bold text-glow">S{currentWeek}</p>
              <p className="num flex items-center justify-center gap-1 text-sm font-semibold">
                hoje{hasDataToday && <Icon name="check" size={12} className="text-ok" />}
              </p>
            </div>
          </div>

          {suggestion && <p className="mb-3 text-xs text-white/45">{suggestion}</p>}

          {locked ? (
            <p className="rounded-2xl bg-white/5 p-3 text-xs text-white/55">
              Defina a data do treino lá em cima para liberar o registro de cargas.
            </p>
          ) : (
            <div>
              <div className="mb-1 grid grid-cols-[2.2rem_1fr_1fr_1fr] gap-2 px-1 text-[10px] font-bold uppercase text-white/40">
                <span>Série</span>
                <span>Carga kg</span>
                <span>Reps</span>
                <span>RIR</span>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="mb-2 grid grid-cols-[2.2rem_1fr_1fr_1fr] items-center gap-2">
                  <span className="num text-center text-sm text-white/50">{i + 1}</span>
                  <input
                    className="field-mini num"
                    inputMode="decimal"
                    placeholder="kg"
                    value={r.load}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, load: e.target.value } : x)))}
                  />
                  <input
                    className="field-mini num"
                    inputMode="numeric"
                    placeholder={exercise.reps}
                    value={r.reps}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))}
                  />
                  <input
                    className="field-mini num"
                    inputMode="numeric"
                    placeholder={String(exercise.targetRIR)}
                    value={r.rir}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, rir: e.target.value } : x)))}
                  />
                </div>
              ))}

              <input
                className="field mt-1 !min-h-[44px] text-sm"
                placeholder="Anotação do exercício (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="mt-3 flex gap-2">
                <button onClick={onTimer} className="btn btn-ghost flex flex-1 items-center justify-center gap-1.5">
                  <Icon name="timer" size={15} /> {exercise.suggestedRestSeconds}s
                </button>
                <button onClick={save} disabled={saving} className="btn btn-primary flex-[1.4]">
                  {saving ? "Salvando…" : savedFlash ? "Salvo" : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditExerciseModal({
  exercise,
  onClose,
  onSave,
}: {
  exercise: PlanExercise | null;
  onClose: () => void;
  onSave: (patch: { name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (exercise && loadedFor !== exercise.exerciseId) {
    setName(exercise.name);
    setDesc(exercise.description ?? "");
    setLoadedFor(exercise.exerciseId);
  }

  return (
    <Modal open={!!exercise} onClose={onClose} title="Editar exercício">
      <label className="mb-1 block text-sm text-white/70">Nome</label>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="mb-1 mt-3 block text-sm text-white/70">Descrição</label>
      <textarea className="field h-24" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <button
        onClick={async () => {
          setBusy(true);
          await onSave({ name, description: desc });
          setBusy(false);
          setLoadedFor(null);
        }}
        disabled={busy || !name.trim()}
        className="btn btn-primary mt-4 w-full"
      >
        {busy ? "Salvando…" : "Salvar alterações"}
      </button>
    </Modal>
  );
}
