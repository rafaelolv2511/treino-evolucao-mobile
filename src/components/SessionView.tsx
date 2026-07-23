"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CardioInput,
  HistoryBundle,
  dayAggregate,
  monthAggregate,
  weekAggregate,
  bestLoadOfLog,
  calendarWeekSummary,
  formatDuration,
  formatElapsed,
  fmtKg,
  isNewRecord,
  personalRecordBefore,
  suggestLoad,
  weeklySeriesForExercise,
} from "@/lib/calc";
import {
  deleteWorkoutSession,
  getOrCreateWorkoutSession,
  markSessionCompleted,
  startWorkoutTimer,
  saveExerciseLog,
  updatePlanJson,
  weekNumberFrom,
} from "@/lib/db";
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
import { Modal, TabBar, useBackClose } from "./ui";
import Icon from "./Icons";
import ShareCard, { ShareStats } from "./ShareCard";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SessionView({
  profile,
  plan,
  session,
  history,
  fullHistory,
  onBack,
  onChanged,
  concludeSignal = null,
}: {
  profile: ProfileRow;
  plan: TrainingPlanRow;
  session: PlanSession;
  history: HistoryBundle;
  fullHistory: HistoryBundle;
  onBack: () => void;
  onChanged: () => void;
  concludeSignal?: number | null;
}) {
  const [tab, setTab] = useState<"exercicios" | "mobilidade">("exercicios");
  const [date, setDate] = useState(todayISO());
  const [workoutSession, setWorkoutSession] = useState<WorkoutSessionRow | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanExercise | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  useBackClose(focusIndex !== null, () => setFocusIndex(null));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [concludeHint, setConcludeHint] = useState(false);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [startingTimer, setStartingTimer] = useState(false);
  const timerRef = useRef<RestTimerHandle | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  // Readota a sessão de hoje se ela já existe (reabertura da tela no meio do treino).
  useEffect(() => {
    if (workoutSession) return;
    const mine = history.sessions.filter((item) => item.session_key === session.sessionKey);
    const inProgress = mine
      .filter((item) => item.started_at && !item.completed_at)
      .sort((a, b) => (b.started_at! < a.started_at! ? -1 : 1))[0];
    const existing = inProgress ?? mine.find((item) => item.workout_date === todayISO());
    if (existing) setWorkoutSession(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.sessions, session.sessionKey]);

  const persistedWorkoutSession = workoutSession
    ? history.sessions.find((item) => item.id === workoutSession.id)
    : null;
  const startedAt = workoutSession?.started_at ?? persistedWorkoutSession?.started_at ?? null;
  const completedAt = workoutSession?.completed_at ?? persistedWorkoutSession?.completed_at ?? null;

  useEffect(() => {
    if (!startedAt || completedAt) return;
    setClockNow(Date.now());
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, completedAt]);

  const elapsedSeconds =
    workoutSession?.duration_seconds ??
    persistedWorkoutSession?.duration_seconds ??
    (startedAt
      ? Math.max(0, Math.floor(((completedAt ? Date.parse(completedAt) : clockNow) - Date.parse(startedAt)) / 1000))
      : null);
  const running = Boolean(startedAt && !completedAt);
  const elapsedLabel = elapsedSeconds == null ? null : running ? formatElapsed(elapsedSeconds) : formatDuration(elapsedSeconds);

  const currentWeek = useMemo(() => {
    const dates = history.sessions.map((s) => s.workout_date);
    const all = workoutSession ? dates : [...dates, date];
    const first = [...all].sort()[0];
    return first ? weekNumberFrom(first, workoutSession?.workout_date ?? date) : 1;
  }, [history.sessions, date, workoutSession]);

  // Resumo do dia: registrados, quantos subiram de carga, recordes e % média de aumento.
  const summary = useMemo(() => {
    const base = {
      logged: 0,
      total: session.exercises.length,
      improved: 0,
      prs: 0,
      improvedNames: [] as string[],
      avgIncreasePct: null as number | null,
      todayLoads: [] as { name: string; load: number }[],
    };
    if (!workoutSession) return base;
    const logsToday = history.logs.filter((l) => l.workout_session_id === workoutSession.id);
    const increases: number[] = [];
    for (const ex of session.exercises) {
      const log = logsToday.find((l) => l.exercise_id === ex.exerciseId);
      if (!log) continue;
      const { load } = bestLoadOfLog(log.id, history.sets);
      if (load === null) continue;
      base.logged++;
      base.todayLoads.push({ name: ex.name, load });
      const real = weeklySeriesForExercise(ex.exerciseId, history).filter((p) => !p.inherited && p.loadKg !== null);
      const prevWeeks = real.filter((p) => p.week < workoutSession.week_number);
      const prevLoad = prevWeeks.length ? prevWeeks[prevWeeks.length - 1].loadKg! : null;
      if (prevLoad !== null && prevLoad > 0) {
        increases.push(((load - prevLoad) / prevLoad) * 100);
        if (load > prevLoad) {
          base.improved++;
          base.improvedNames.push(ex.name);
        }
      }
      const pr = personalRecordBefore(ex.exerciseId, workoutSession.id, history);
      if (pr !== null && load > pr) base.prs++;
    }
    if (increases.length) base.avgIncreasePct = increases.reduce((a, b) => a + b, 0) / increases.length;
    return base;
  }, [workoutSession, history, session.exercises]);

  const progressPct = summary.total > 0 ? Math.round((summary.logged / summary.total) * 100) : 0;
  const canConclude = summary.total > 0 && summary.logged / summary.total >= 0.4;

  // Treinos concluídos nesta semana (check-ins reais), para o card compartilhável.
  const weeklyDone = useMemo(() => {
    const effective = [...fullHistory.sessions];
    if (workoutSession) {
      const index = effective.findIndex((item) => item.id === workoutSession.id);
      if (index >= 0) effective[index] = workoutSession;
      else effective.push(workoutSession);
    }
    return calendarWeekSummary(workoutSession?.workout_date ?? date, effective).concluidosNaSemana;
  }, [fullHistory.sessions, workoutSession, date]);

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

  const handledConcludeSignal = useRef<number | null>(null);
  useEffect(() => {
    if (!concludeSignal || !workoutSession || workoutSession.completed_at) return;
    if (handledConcludeSignal.current === concludeSignal) return;
    handledConcludeSignal.current = concludeSignal;
    requestConclude();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concludeSignal, workoutSession]);

  async function playWorkout() {
    if (!workoutSession || startedAt) return;
    setStartingTimer(true);
    try {
      const value = await startWorkoutTimer(workoutSession.id);
      setWorkoutSession((current) => (current ? { ...current, started_at: current.started_at ?? value } : current));
      onChanged();
    } finally {
      setStartingTimer(false);
    }
  }

  function requestConclude(loggedOverride = summary.logged): boolean {
    if (!workoutSession) return false;
    const enoughLogged = summary.total > 0 && loggedOverride / summary.total >= 0.4;
    if (!enoughLogged) {
      setConcludeHint(true);
      setTimeout(() => setConcludeHint(false), 3500);
      return false;
    }
    setCardioOpen(true);
    return true;
  }

  async function concludeWorkout(loggedOverride = summary.logged, cardio: CardioInput | null = null): Promise<boolean> {
    if (!workoutSession) return false;
    const enoughLogged = summary.total > 0 && loggedOverride / summary.total >= 0.4;
    if (!enoughLogged) {
      setConcludeHint(true);
      setTimeout(() => setConcludeHint(false), 3500);
      return false;
    }
    setConcluding(true);
    try {
      const completed = await markSessionCompleted(workoutSession.id, cardio);
      setWorkoutSession(completed);
      onChanged();
      setShowSummary(true);
      return true;
    } finally {
      setConcluding(false);
    }
  }

  async function cancelSession() {
    if (!workoutSession) return;
    setCanceling(true);
    try {
      await deleteWorkoutSession(workoutSession.id);
      setWorkoutSession(null);
      setCancelOpen(false);
      onChanged();
    } finally {
      setCanceling(false);
    }
  }

  async function saveExerciseEdit(patch: { name: string; description: string; sets: number }) {
    if (!editing) return;
    const json = structuredClone(plan.source_json);
    for (const s of json.sessions) {
      const ex = s.exercises.find((e) => e.exerciseId === editing.exerciseId);
      if (ex) {
        ex.name = patch.name;
        ex.description = patch.description;
        ex.sets = patch.sets;
      }
    }
    await updatePlanJson(plan.id, json);
    setEditing(null);
    onChanged();
  }

  const groups = useMemo(() => {
    const map = new Map<string, PlanExercise[]>();
    for (const e of session.exercises) {
      const arr = map.get(e.primaryMuscleGroup) ?? [];
      arr.push(e);
      map.set(e.primaryMuscleGroup, arr);
    }
    return [...map.entries()];
  }, [session.exercises]);

  const flatExercises = session.exercises;

  const todayForShare = workoutSession?.workout_date ?? date;
  const weakAggregateSafe = useMemo(
    () => weekAggregate(fullHistory, todayForShare, summary.prs),
    [fullHistory, todayForShare, summary.prs]
  );
  const monthAggregateSafe = useMemo(
    () => monthAggregate(fullHistory, todayForShare, weakAggregateSafe.streakSemanas),
    [fullHistory, todayForShare, weakAggregateSafe.streakSemanas]
  );

  const shareStats: ShareStats = {
    appName: "RTrainning",
    profileName: profile.name,
    sessionName: session.sessionName,
    planName: plan.plan_name,
    dateLabel: (workoutSession?.workout_date ?? date).split("-").reverse().join("/"),
    exercisesDone: summary.logged,
    exercisesTotal: summary.total,
    improved: summary.improved,
    prs: summary.prs,
    avgIncreasePct: summary.avgIncreasePct,
    weeklyDone,
    weeklyTarget: Math.max(1, plan.source_json.sessions.length),
    durationSeconds: workoutSession?.duration_seconds ?? null,
    caloriesEstimate: workoutSession?.calories_estimate ?? null,
    loads: summary.todayLoads,
    // Agregados Carbon: dia vem da sessão atual; semana e mês do histórico completo do perfil.
    day: workoutSession ? dayAggregate(history, workoutSession.id) : undefined,
    week: weakAggregateSafe,
    month: monthAggregateSafe,
  };

  function isDone(ex: PlanExercise): boolean {
    if (!workoutSession) return false;
    const log = history.logs.find(
      (l) => l.workout_session_id === workoutSession.id && l.exercise_id === ex.exerciseId
    );
    if (!log) return false;
    return history.sets.some((s) => s.exercise_log_id === log.id && s.load_kg !== null);
  }

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
                  <span className="shrink-0 rounded-xl bg-white/10 px-2.5 py-1 text-xs text-white/70">
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
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon name="calendar" size={15} /> Data do treino
                </p>
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
              <>
                <RestTimer handleRef={timerRef} floating={focusIndex !== null} />
                {/* Progresso do dia — discreto */}
                <div className="mb-4 flex items-center gap-3 px-1">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-aqua transition-[width] duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="num shrink-0 text-[10px] font-bold text-white/45">
                    {summary.logged}/{summary.total} · {progressPct}%
                  </span>
                  {startedAt ? (
                    elapsedLabel && (
                      <span
                        className={`num flex shrink-0 items-center gap-1 text-[10px] font-semibold ${
                          running ? "text-glow" : "text-white/45"
                        }`}
                      >
                        {running && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-glow" />}
                        <Icon name="timer" size={11} /> {elapsedLabel}
                      </span>
                    )
                  ) : null}
                </div>
                {!startedAt && !completedAt && (
                  <button
                    onClick={() => void playWorkout()}
                    disabled={startingTimer}
                    className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-3xl bg-aqua px-4 py-4 font-display text-base font-bold text-ink shadow-[0_8px_28px_rgba(68,226,217,0.35)] transition active:scale-[0.98]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/20">
                      <Icon name="play" size={15} />
                    </span>
                    {startingTimer ? "Iniciando…" : "Iniciar treino"}
                  </button>
                )}
              </>
            )}

            <div className="space-y-5">
              {groups.map(([group, exercises]) => (
                <div key={group}>
                  <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.2em] text-viol">{group}</p>
                  <div className="space-y-2.5">
                    {exercises.map((e) => {
                      const done = isDone(e);
                      const idx = flatExercises.findIndex((x) => x.exerciseId === e.exerciseId);
                      const prevPR = workoutSession
                        ? personalRecordBefore(e.exerciseId, workoutSession.id, history)
                        : null;
                      const log = workoutSession
                        ? history.logs.find(
                            (l) => l.workout_session_id === workoutSession.id && l.exercise_id === e.exerciseId
                          )
                        : undefined;
                      const best = log ? bestLoadOfLog(log.id, history.sets).load : null;
                      const isPR = isNewRecord(best, prevPR);
                      return (
                        <button
                          key={e.exerciseId}
                          onClick={() => (workoutSession ? setFocusIndex(idx) : null)}
                          className={`glass block w-full p-4 text-left transition active:scale-[0.99] ${
                            done ? "border-aqua/40 bg-aqua/[0.07]" : ""
                          } ${!workoutSession ? "opacity-70" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 truncate font-semibold">
                                {done && <Icon name="check" size={14} className="shrink-0 text-aqua" />}
                                <span className="truncate">{e.name}</span>
                              </p>
                              {isPR && (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-fire/10 px-2 py-0.5 text-[10px] font-bold text-fire">
                                  <Icon name="medal" size={12} /> PR batido
                                </span>
                              )}
                              <p className="mt-0.5 truncate text-[11px] text-white/50">
                                {e.primaryMuscleGroup}
                                {e.secondaryMuscleGroups?.length ? ` · ${e.secondaryMuscleGroups.join(", ")}` : ""}
                              </p>
                              <p className="num mt-1 text-xs text-white/65">
                                {e.sets}×{e.reps} · RIR {e.targetRIR} · desc. {e.suggestedRestSeconds}s
                                {done && best !== null && (
                                  <span className="ml-2 font-semibold text-aqua">{fmtKg(best)}</span>
                                )}
                              </p>
                            </div>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setEditing(e);
                              }}
                              onKeyDown={(ev) => ev.key === "Enter" && setEditing(e)}
                              className="shrink-0 rounded-xl bg-white/10 px-2 py-1 text-white/50"
                              aria-label={`Editar ${e.name}`}
                            >
                              <Icon name="pencil" size={14} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {workoutSession && (
              <>
                <button
                  onClick={() => requestConclude()}
                  disabled={concluding}
                  className={`btn mt-5 flex w-full items-center justify-center gap-2 ${
                    canConclude ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  <Icon name="check" size={17} />
                  {concluding ? "Concluindo…" : `Concluir treino (${summary.logged}/${summary.total})`}
                </button>
                {concludeHint && (
                  <p className="mt-2 text-center text-xs text-fire">
                    Registre pelo menos 40% dos exercícios para concluir o check-in ({Math.ceil(summary.total * 0.4)}{" "}
                    de {summary.total}).
                  </p>
                )}
                <button
                  onClick={() => setCancelOpen(true)}
                  className="mx-auto mt-3 flex items-center gap-1.5 text-xs text-white/40 underline-offset-2 hover:underline"
                >
                  <Icon name="trash" size={13} /> Cancelar treino de hoje
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modo tela cheia — um exercício por tela, rolagem vertical com snap */}
      {focusIndex !== null && workoutSession && (
        <FocusMode
          exercises={flatExercises}
          startIndex={focusIndex}
          history={history}
          workoutSession={workoutSession}
          currentWeek={currentWeek}
          onClose={() => setFocusIndex(null)}
          onSaved={onChanged}
          onSessionStarted={(value) =>
            setWorkoutSession((current) => (current ? { ...current, started_at: current.started_at ?? value } : current))
          }
          onTimer={(s) => timerRef.current?.start(s)}
          sessionName={session.sessionName}
          elapsedLabel={elapsedLabel}
          progress={{ logged: summary.logged, total: summary.total }}
          doneIds={new Set(flatExercises.filter(isDone).map((e) => e.exerciseId))}
          concluding={concluding}
          onConclude={async (logged) => {
            const ok = requestConclude(logged);
            if (ok) setFocusIndex(null);
            return ok;
          }}
        />
      )}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar treino de hoje">
        <p className="text-sm text-white/80">
          Isso apaga a sessão de hoje do <strong>{session.sessionName}</strong> — cargas registradas, anotações e o
          check-in do dia. O seu histórico das semanas anteriores continua intacto.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setCancelOpen(false)} className="btn btn-ghost flex-1">
            Voltar
          </button>
          <button onClick={cancelSession} disabled={canceling} className="btn btn-danger flex-1">
            {canceling ? "Cancelando…" : "Cancelar treino"}
          </button>
        </div>
      </Modal>

      <EditExerciseModal exercise={editing} onClose={() => setEditing(null)} onSave={saveExerciseEdit} />

      <CardioModal
        open={cardioOpen}
        concluding={concluding}
        onClose={() => setCardioOpen(false)}
        onConfirm={async (cardio) => {
          const ok = await concludeWorkout(summary.logged, cardio);
          if (ok) setCardioOpen(false);
        }}
      />

      <Modal open={showSummary} onClose={() => setShowSummary(false)} title={`${session.sessionName} concluído`}>
        <div className="mb-4 flex items-center justify-center gap-2 text-aqua">
          <Icon name="check" size={22} />
          <span className="font-display text-lg font-bold">Bom treino!</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="glass p-3">
            <p className="num font-display text-2xl font-bold text-glow">{summary.logged}</p>
            <p className="text-[10px] text-white/55">exercícios</p>
          </div>
          <div className="glass p-3">
            <p className="num font-display text-2xl font-bold text-aqua">{summary.improved}</p>
            <p className="text-[10px] text-white/55">subiram carga</p>
          </div>
          <div className="glass p-3">
            <p className="num font-display text-2xl font-bold text-fire">{summary.prs}</p>
            <p className="text-[10px] text-white/55">PRs batidos</p>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          <div className="glass p-3">
            <p className="num font-display text-xl font-bold text-white">
              {formatDuration(workoutSession?.duration_seconds)}
            </p>
            <p className="text-[10px] text-white/55">tempo total</p>
          </div>
          <div className="glass p-3">
            <p className="num font-display text-xl font-bold text-glow">
              {workoutSession?.calories_estimate != null
                ? `~${Math.round(workoutSession.calories_estimate)} kcal`
                : "—"}
            </p>
            <p className="text-[10px] text-white/55">estimativa</p>
          </div>
        </div>
        {workoutSession?.cardio_type && workoutSession?.cardio_minutes ? (
          <p className="mt-2 text-center text-[11px] text-white/60">
            Cardio: {workoutSession.cardio_type === "esteira" ? "esteira" : workoutSession.cardio_type === "bike" ? "bike" : "escada"} ·{" "}
            {workoutSession.cardio_minutes} min
            {workoutSession.cardio_km != null ? ` · ${workoutSession.cardio_km} km` : ""}
          </p>
        ) : null}
        {workoutSession?.calories_estimate == null && (
          <p className="mt-2 text-center text-[10px] text-white/45">
            Registre seu peso em Evolução para habilitar a estimativa.
          </p>
        )}
        {summary.improvedNames.length > 0 && (
          <p className="mt-3 text-xs text-white/60">Subiu de carga em: {summary.improvedNames.join(", ")}.</p>
        )}
        {summary.improved === 0 && summary.logged > 0 && (
          <p className="mt-3 text-xs text-white/55">
            Manteve as cargas hoje — consistência também é progresso. Bora pra próxima!
          </p>
        )}
        <button
          onClick={() => {
            setShowSummary(false);
            setShowShare(true);
          }}
          className="btn btn-primary mt-4 flex w-full items-center justify-center gap-2"
        >
          <Icon name="share" size={16} /> Compartilhar treino
        </button>
        <button onClick={() => setShowSummary(false)} className="btn btn-ghost mt-2 w-full">
          Fechar
        </button>
      </Modal>

      {showShare && <ShareCard stats={shareStats} onClose={() => setShowShare(false)} />}
    </div>
  );
}


// ── Passo de cardio antes de concluir ───────────────────────────────────────
function CardioModal({
  open,
  concluding,
  onClose,
  onConfirm,
}: {
  open: boolean;
  concluding: boolean;
  onClose: () => void;
  onConfirm: (cardio: CardioInput | null) => Promise<void>;
}) {
  const [type, setType] = useState<CardioInput["type"] | "nenhum">("nenhum");
  const [minutes, setMinutes] = useState("");
  const [km, setKm] = useState("");

  useEffect(() => {
    if (open) {
      setType("nenhum");
      setMinutes("");
      setKm("");
    }
  }, [open]);

  const minutesNum = Number(minutes.replace(",", "."));
  const kmNum = Number(km.replace(",", "."));
  const validCardio = type !== "nenhum" && minutes.trim() !== "" && Number.isFinite(minutesNum) && minutesNum > 0;
  const canConfirm = type === "nenhum" || validCardio;

  const options: { key: CardioInput["type"] | "nenhum"; label: string }[] = [
    { key: "nenhum", label: "Não fiz" },
    { key: "esteira", label: "Esteira" },
    { key: "bike", label: "Bike" },
    { key: "escada", label: "Escada" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Fez cardio hoje?" center>
      <p className="text-xs text-white/55">
        Minutos e km do cardio entram na estimativa de calorias do treino.
      </p>
      <div className="mt-3 flex gap-1 rounded-2xl bg-white/10 p-1">
        {options.map((option) => (
          <button
            key={option.key}
            onClick={() => setType(option.key)}
            className={`min-w-0 flex-1 rounded-xl px-1 py-2 text-xs font-semibold transition ${
              type === option.key ? "bg-white/14 text-white" : "text-white/45"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {type !== "nenhum" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Minutos</p>
            <input
              className="field w-full"
              inputMode="numeric"
              placeholder="20"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Km {type === "escada" ? "(opcional)" : "(opcional)"}
            </p>
            <input
              className="field w-full"
              inputMode="decimal"
              placeholder={type === "escada" ? "—" : "3,0"}
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          </div>
        </div>
      )}
      <button
        onClick={() =>
          void onConfirm(
            type === "nenhum"
              ? null
              : {
                  type,
                  minutes: minutesNum,
                  km: km.trim() !== "" && Number.isFinite(kmNum) && kmNum > 0 ? kmNum : null,
                }
          )
        }
        disabled={concluding || !canConfirm}
        className="btn btn-primary mt-4 flex w-full items-center justify-center gap-2"
      >
        <Icon name="check" size={16} /> {concluding ? "Concluindo…" : "Concluir treino"}
      </button>
      <button onClick={onClose} className="btn btn-ghost mt-2 w-full">
        Voltar
      </button>
    </Modal>
  );
}

// ── Modo foco: um exercício por tela, rolagem vertical com snap ─────────────

function FocusMode({
  exercises,
  startIndex,
  history,
  workoutSession,
  currentWeek,
  onClose,
  onSaved,
  onSessionStarted,
  onTimer,
  sessionName,
  elapsedLabel,
  progress,
  doneIds,
  concluding,
  onConclude,
}: {
  exercises: PlanExercise[];
  startIndex: number;
  history: HistoryBundle;
  workoutSession: WorkoutSessionRow;
  currentWeek: number;
  onClose: () => void;
  onSaved: () => void;
  onSessionStarted: (startedAt: string) => void;
  onTimer: (seconds: number) => void;
  sessionName: string;
  elapsedLabel: string | null;
  progress: { logged: number; total: number };
  doneIds: Set<string>;
  concluding: boolean;
  onConclude: (logged: number) => Promise<boolean>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(startIndex);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());
  const [finishHint, setFinishHint] = useState(false);
  const finishIndex = exercises.length;

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // posiciona no exercício tocado, sem animação, na abertura
  const positioned = useRef(false);
  if (typeof window !== "undefined" && !positioned.current) {
    positioned.current = true;
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = startIndex * el.clientHeight;
    });
  }

  function scrollToIndex(i: number) {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: Math.min(finishIndex, Math.max(0, i)) * el.clientHeight, behavior: "smooth" });
  }

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== visible) setVisible(Math.min(finishIndex, Math.max(0, idx)));
  }

  const isExDone = (id: string) => doneIds.has(id) || localDone.has(id);
  const doneCount = exercises.filter((e) => isExDone(e.exerciseId)).length;
  const pct = exercises.length ? Math.round((doneCount / exercises.length) * 100) : 0;
  const current = exercises[Math.min(visible, exercises.length - 1)];
  const requiredToConclude = Math.ceil(exercises.length * 0.4);
  const focusCanConclude = doneCount >= requiredToConclude;

  async function finishWorkout() {
    const ok = await onConclude(doneCount);
    if (!ok) {
      setFinishHint(true);
      setTimeout(() => setFinishHint(false), 3500);
    }
  }

  const overlay = (
    <div className="fixed inset-0 z-[9999] bg-ink" style={{ height: "100dvh" }}>
      <div className="pointer-events-none absolute inset-0 bg-orbs" aria-hidden="true" />
      <div className="relative z-10 flex h-full max-h-full flex-col overflow-hidden">
        {/* Cabeçalho fixo: voltar, sessão, posição */}
        <div className="flex items-center gap-3 px-5 pb-2 pt-4">
          <button
            onClick={onClose}
            className="btn btn-ghost !min-h-0 !rounded-2xl !px-3 !py-2.5"
            aria-label="Voltar para a lista"
          >
            <Icon name="arrowLeft" size={17} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{sessionName}</p>
            <p className="truncate text-[11px] text-white/45">
              {visible === finishIndex ? "Finalizar treino" : (current?.primaryMuscleGroup ?? "")}
            </p>
          </div>
          {elapsedLabel && (
            <span className="num flex shrink-0 items-center gap-1.5 rounded-2xl border border-glow/30 bg-glow/10 px-3 py-1.5 font-display text-sm font-bold tracking-wide text-glow shadow-[0_0_18px_rgba(68,226,217,0.25)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glow opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-glow" />
              </span>
              {elapsedLabel}
            </span>
          )}
          <span className="num shrink-0 rounded-2xl bg-white/10 px-3 py-1.5 text-sm font-bold text-glow">
            {visible === finishIndex ? "fim" : visible + 1}
            <span className="text-white/40">/{exercises.length}</span>
          </span>
        </div>

        {/* Progresso do dia + trilho de exercícios */}
        <div className="px-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-aqua transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="num shrink-0 text-[10px] font-bold text-white/45">
              {doneCount}/{exercises.length} · {pct}%
            </span>
          </div>
          <div className="mt-2 flex justify-center gap-1.5">
            {exercises.map((e, i) => (
              <button
                key={e.exerciseId}
                onClick={() => scrollToIndex(i)}
                aria-label={`Ir para ${e.name}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === visible
                    ? "w-6 bg-glow"
                    : isExDone(e.exerciseId)
                      ? "w-3 bg-aqua/80"
                      : "w-3 bg-white/15"
                }`}
              />
            ))}
            <button
              onClick={() => scrollToIndex(finishIndex)}
              aria-label="Ir para finalizar treino"
              className={`h-1.5 rounded-full transition-all duration-300 ${
                visible === finishIndex ? "w-6 bg-viol" : focusCanConclude ? "w-3 bg-aqua/80" : "w-3 bg-white/15"
              }`}
            />
          </div>
        </div>

        {/* Slides */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-pb-8"
        >
          {exercises.map((e, i) => (
            <div
              key={e.exerciseId}
              className="flex h-full snap-start flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2"
            >
              <ExerciseLogger
                exercise={e}
                history={history}
                workoutSession={workoutSession}
                currentWeek={currentWeek}
                onSaved={onSaved}
                onSessionStarted={onSessionStarted}
                onLocalDone={() => setLocalDone((prev) => new Set(prev).add(e.exerciseId))}
                onAdvance={() => scrollToIndex(i < exercises.length - 1 ? i + 1 : finishIndex)}
                onTimer={() => onTimer(e.suggestedRestSeconds)}
              />
              <div className="mt-2 flex shrink-0 items-center justify-center gap-2 pb-1 text-[11px] text-white/35">
                {i < exercises.length - 1 ? (
                  <>
                    <span className="h-px w-8 bg-white/15" />
                    <Icon name="chevronDown" size={13} />
                    <span className="max-w-[60%] truncate">{exercises[i + 1].name}</span>
                    <span className="h-px w-8 bg-white/15" />
                  </>
                ) : (
                  <>
                    <span className="h-px w-8 bg-white/15" />
                    <Icon name="chevronDown" size={13} />
                    <span>finalizar treino</span>
                    <span className="h-px w-8 bg-white/15" />
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="flex h-full snap-start flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
            <div className="glass glass-strong flex min-h-0 flex-1 flex-col justify-center overflow-hidden !rounded-3xl border-b border-white/20 p-6 text-center ring-1 ring-white/10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-aqua/15 text-aqua ring-1 ring-aqua/30">
                <Icon name="check" size={28} />
              </div>
              <p className="font-display mt-5 text-2xl font-bold">Finalizar treino</p>
              <p className="num mt-2 text-sm text-white/55">
                {doneCount}/{exercises.length} exercicios registrados · {pct}%
              </p>
              <div className="mx-auto mt-5 h-2 w-full max-w-56 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-aqua transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <button
                onClick={finishWorkout}
                disabled={concluding}
                className={`btn mt-7 w-full ${focusCanConclude ? "btn-primary" : "btn-ghost"}`}
              >
                {concluding ? "Concluindo..." : "Concluir treino"}
              </button>
              {(finishHint || !focusCanConclude) && (
                <p className="mt-3 text-xs leading-relaxed text-fire">
                  Registre pelo menos {requiredToConclude} de {exercises.length} exercicios para concluir o check-in.
                </p>
              )}
              <button onClick={onClose} className="btn btn-ghost mt-3 w-full">
                Voltar para lista
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

// ── Registro de um exercício (usado no modo foco) ───────────────────────────
function ExerciseLogger({
  exercise,
  history,
  workoutSession,
  currentWeek,
  onSaved,
  onSessionStarted,
  onLocalDone,
  onAdvance,
  onTimer,
}: {
  exercise: PlanExercise;
  history: HistoryBundle;
  workoutSession: WorkoutSessionRow;
  currentWeek: number;
  onSaved: () => void;
  onSessionStarted: (startedAt: string) => void;
  onLocalDone: () => void;
  onAdvance?: () => void;
  onTimer: () => void;
}) {
  const existingLog: ExerciseLogRow | undefined = useMemo(
    () =>
      history.logs.find((l) => l.workout_session_id === workoutSession.id && l.exercise_id === exercise.exerciseId),
    [history.logs, workoutSession, exercise.exerciseId]
  );
  const existingSets: SetLogRow[] = useMemo(
    () => (existingLog ? history.sets.filter((s) => s.exercise_log_id === existingLog.id) : []),
    [history.sets, existingLog]
  );

  const [notes, setNotes] = useState(existingLog?.notes ?? exercise.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
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
  const [saved, setSaved] = useState(existingSets.some((s) => s.load_kg !== null));

  const weekly = useMemo(() => weeklySeriesForExercise(exercise.exerciseId, history), [exercise.exerciseId, history]);
  const pastWeeks = weekly.filter((w) => w.week < currentWeek);
  const suggestion = useMemo(
    () => suggestLoad(exercise.exerciseId, history, exercise.reps, exercise.targetRIR),
    [exercise.exerciseId, history, exercise.reps]
  );

  const prevPR = useMemo(
    () => personalRecordBefore(exercise.exerciseId, workoutSession.id, history),
    [exercise.exerciseId, workoutSession, history]
  );
  const todayBest = useMemo(() => {
    const loads = rows
      .map((r) => (r.load.trim() === "" ? null : Number(r.load.replace(",", "."))))
      .filter((n): n is number => n !== null && !Number.isNaN(n));
    return loads.length ? Math.max(...loads) : null;
  }, [rows]);
  const willBePR = isNewRecord(todayBest, prevPR);

  async function save() {
    setSaving(true);
    try {
      const result = await saveExerciseLog(
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
      if (result.startedAt) onSessionStarted(result.startedAt);
      const hasLoad = rows.some((r) => r.load.trim() !== "");
      if (hasLoad) {
        setSaved(true);
        onLocalDone();
      }
      onSaved();
      if (hasLoad && onAdvance) setTimeout(onAdvance, 750);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`glass glass-strong flex min-h-0 flex-1 flex-col overflow-hidden !rounded-3xl border-b border-white/20 ring-1 ring-white/10 transition-all duration-500 ${
        saved
          ? "border-aqua/60 bg-aqua/10 shadow-[0_0_36px_rgba(68,226,217,0.18)]"
          : ""
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {/* Cabeçalho do exercício */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-viol">
              {exercise.primaryMuscleGroup}
            </p>
            <p className="font-display mt-1 text-2xl font-bold leading-tight">{exercise.name}</p>
            <p className="num mt-1.5 text-sm text-white/65">
              {exercise.sets}×{exercise.reps} · RIR {exercise.targetRIR} · desc. {exercise.suggestedRestSeconds}s
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {saved && (
              <span className="flex items-center gap-1 rounded-lg bg-aqua/20 px-2 py-1 text-[10px] font-bold text-aqua">
                <Icon name="check" size={12} /> Feito
              </span>
            )}
            {willBePR && (
              <span className="flex items-center gap-1 rounded-lg bg-fire/10 px-2 py-1 text-[10px] font-bold text-fire">
                <Icon name="medal" size={12} /> PR batido
              </span>
            )}
          </div>
        </div>

        {exercise.description && <p className="mt-1.5 line-clamp-2 text-xs italic leading-snug text-white/50">{exercise.description}</p>}

        {/* Semanas */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {pastWeeks.map((w) => (
            <div key={w.week} className={`week-pill ${w.inherited ? "inherited" : ""}`}>
              <p className="text-[10px] font-bold text-white/50">S{w.week}</p>
              <p className="num text-sm font-semibold">{w.loadKg !== null ? fmtKg(w.loadKg) : "—"}</p>
              {w.inherited && <p className="text-[9px] text-white/40">mantida</p>}
            </div>
          ))}
          <div className={`week-pill current ${saved ? "!border-aqua/70" : ""}`}>
            <p className={`text-[10px] font-bold ${saved ? "text-aqua" : "text-glow"}`}>S{currentWeek}</p>
            <p className="num flex items-center justify-center gap-1 text-sm font-semibold">
              hoje{saved && <Icon name="check" size={12} className="text-aqua" />}
            </p>
          </div>
        </div>

        {suggestion && <p className="mt-2 text-xs text-white/45">{suggestion}</p>}

        {/* Séries */}
        <div className="mt-3">
          <div className="mb-1.5 grid grid-cols-[2rem_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
            <span>Série</span>
            <span>Carga kg</span>
            <span>Reps</span>
            <span>RIR</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="mb-2 grid grid-cols-[2rem_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] items-center gap-2">
              <span className="num text-center text-base font-semibold text-white/45">{i + 1}</span>
              <input
                className="field-mini num !min-h-[56px] !rounded-[1.35rem] !px-2 !text-xl placeholder:text-center"
                inputMode="decimal"
                placeholder="kg"
                value={r.load}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, load: e.target.value } : x)))}
              />
              <input
                className="field-mini num !min-h-[56px] !rounded-[1.35rem] !px-1.5 !text-xl placeholder:text-center"
                inputMode="numeric"
                placeholder={exercise.reps}
                value={r.reps}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))}
              />
              <input
                className="field-mini num !min-h-[56px] !rounded-[1.35rem] !px-1.5 !text-xl placeholder:text-center"
                inputMode="numeric"
                placeholder={String(exercise.targetRIR)}
                value={r.rir}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, rir: e.target.value } : x)))}
              />
            </div>
          ))}

          {notes || notesOpen ? (
            <input
              className="field mt-1 !min-h-[52px] text-center text-base"
              placeholder="Anotação do exercício (opcional)"
              value={notes}
              autoFocus={notesOpen && !notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          ) : (
            <button
              onClick={() => setNotesOpen(true)}
              className="mt-1 w-full rounded-2xl border border-dashed border-white/10 py-2 text-xs text-white/40 transition active:scale-[0.99]"
            >
              + anotação
            </button>
          )}
        </div>
      </div>

      {/* Ações fixas no rodapé do card */}
      <div className="flex shrink-0 gap-2 border-t border-white/10 bg-black/10 p-3">
        <button onClick={onTimer} className="btn btn-ghost flex flex-1 items-center justify-center gap-1.5">
          <Icon name="timer" size={15} /> {exercise.suggestedRestSeconds}s
        </button>
        <button
          onClick={save}
          disabled={saving}
          className={`btn flex-[1.4] ${saved ? "!bg-aqua !text-[#06120F]" : "btn-primary"}`}
        >
          {saving ? "Salvando…" : saved ? "Salvo — atualizar" : "Salvar"}
        </button>
      </div>
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
  onSave: (patch: { name: string; description: string; sets: number }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [sets, setSets] = useState(3);
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (exercise && loadedFor !== exercise.exerciseId) {
    setName(exercise.name);
    setDesc(exercise.description ?? "");
    setSets(exercise.sets);
    setLoadedFor(exercise.exerciseId);
  }

  return (
    <Modal open={!!exercise} onClose={onClose} title="Editar exercício">
      <label className="mb-1 block text-sm text-white/70">Nome</label>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="mb-1 mt-3 block text-sm text-white/70">Descrição</label>
      <textarea className="field h-24" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <label className="mb-1 mt-3 block text-sm text-white/70">Quantidade de séries</label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSets(Math.max(1, sets - 1))}
          className="btn btn-ghost !min-h-[44px] !px-4"
          aria-label="Menos uma série"
        >
          −
        </button>
        <span className="num font-display w-10 text-center text-2xl font-bold">{sets}</span>
        <button
          onClick={() => setSets(Math.min(10, sets + 1))}
          className="btn btn-ghost !min-h-[44px] !px-4"
          aria-label="Mais uma série"
        >
          +
        </button>
      </div>
      <button
        onClick={async () => {
          setBusy(true);
          await onSave({ name, description: desc, sets });
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
