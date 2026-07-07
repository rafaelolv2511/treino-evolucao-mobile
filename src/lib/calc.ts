import {
  ExerciseEvolution,
  ExerciseLogRow,
  GroupEvolution,
  SetLogRow,
  TrainingPlanJson,
  WeeklyLoadPoint,
  WorkoutSessionRow,
} from "./types";

export interface HistoryBundle {
  sessions: WorkoutSessionRow[];
  logs: ExerciseLogRow[];
  sets: SetLogRow[];
}

/** Carga representativa de um log = maior carga válida entre as séries preenchidas. */
export function bestLoadOfLog(logId: string, sets: SetLogRow[]): { load: number | null; rir: number | null } {
  const mine = sets.filter((s) => s.exercise_log_id === logId && s.load_kg !== null);
  if (mine.length === 0) return { load: null, rir: null };
  const best = mine.reduce((a, b) => ((b.load_kg ?? 0) > (a.load_kg ?? 0) ? b : a));
  const lastRir = mine[mine.length - 1].rir_done;
  return { load: Number(best.load_kg), rir: lastRir };
}

/**
 * Série semanal por exerciseId. Semanas sem preenchimento herdam a última carga
 * válida (inherited = true) apenas para análise — nunca como novo recorde.
 */
export function weeklySeriesForExercise(exerciseId: string, h: HistoryBundle): WeeklyLoadPoint[] {
  const sessionById = new Map(h.sessions.map((s) => [s.id, s]));
  const logs = h.logs
    .filter((l) => l.exercise_id === exerciseId)
    .map((l) => ({ log: l, session: sessionById.get(l.workout_session_id) }))
    .filter((x) => !!x.session) as { log: ExerciseLogRow; session: WorkoutSessionRow }[];

  if (h.sessions.length === 0) return [];
  const maxWeek = Math.max(...h.sessions.map((s) => s.week_number));

  const byWeek = new Map<number, { load: number | null; rir: number | null; date: string }>();
  for (const { log, session } of logs) {
    const { load, rir } = bestLoadOfLog(log.id, h.sets);
    if (load === null) continue;
    const prev = byWeek.get(session.week_number);
    if (!prev || load > (prev.load ?? 0)) {
      byWeek.set(session.week_number, { load, rir, date: session.workout_date });
    }
  }

  const points: WeeklyLoadPoint[] = [];
  let lastValid: number | null = null;
  let lastRir: number | null = null;
  for (let w = 1; w <= maxWeek; w++) {
    const real = byWeek.get(w);
    if (real && real.load !== null) {
      lastValid = real.load;
      lastRir = real.rir;
      points.push({ week: w, date: real.date, loadKg: real.load, rir: real.rir, inherited: false });
    } else if (lastValid !== null) {
      points.push({ week: w, date: null, loadKg: lastValid, rir: lastRir, inherited: true });
    } else {
      points.push({ week: w, date: null, loadKg: null, rir: null, inherited: false });
    }
  }
  return points;
}

/** Evolução por exercício: primeira carga válida vs. carga válida mais recente (herdadas não contam como recorde). */
export function evolutionForExercise(
  exerciseId: string,
  name: string,
  muscleGroup: string,
  h: HistoryBundle,
  notes: string[]
): ExerciseEvolution {
  const weekly = weeklySeriesForExercise(exerciseId, h);
  const real = weekly.filter((p) => !p.inherited && p.loadKg !== null);
  const first = real[0] ?? null;
  const last = real[real.length - 1] ?? null;

  let pct: number | null = null;
  if (first && last && first.loadKg && first.loadKg > 0 && last.loadKg !== null) {
    pct = ((last.loadKg - first.loadKg) / first.loadKg) * 100;
  }

  return {
    exerciseId,
    name,
    muscleGroup,
    firstLoadKg: first?.loadKg ?? null,
    firstDate: first?.date ?? null,
    lastLoadKg: last?.loadKg ?? null,
    lastDate: last?.date ?? null,
    evolutionPct: pct,
    carriedWeeks: weekly.filter((p) => p.inherited).map((p) => p.week),
    weekly,
    notes,
  };
}

/** Evolução completa do plano, agrupada por grupo muscular principal. */
export function evolutionForPlan(plan: TrainingPlanJson, h: HistoryBundle): {
  exercises: ExerciseEvolution[];
  groups: GroupEvolution[];
  overallPct: number | null;
} {
  const logNotes = new Map<string, string[]>();
  for (const l of h.logs) {
    if (l.notes && l.notes.trim()) {
      const arr = logNotes.get(l.exercise_id) ?? [];
      arr.push(l.notes.trim());
      logNotes.set(l.exercise_id, arr);
    }
  }

  const exercises: ExerciseEvolution[] = [];
  for (const s of plan.sessions) {
    for (const e of s.exercises) {
      exercises.push(
        evolutionForExercise(e.exerciseId, e.name, e.primaryMuscleGroup, h, logNotes.get(e.exerciseId) ?? [])
      );
    }
  }

  const byGroup = new Map<string, ExerciseEvolution[]>();
  for (const ex of exercises) {
    const arr = byGroup.get(ex.muscleGroup) ?? [];
    arr.push(ex);
    byGroup.set(ex.muscleGroup, arr);
  }

  const groups: GroupEvolution[] = [...byGroup.entries()].map(([muscleGroup, exs]) => {
    const valid = exs.filter((e) => e.evolutionPct !== null);
    const pct = valid.length > 0 ? valid.reduce((a, b) => a + (b.evolutionPct ?? 0), 0) / valid.length : null;
    return { muscleGroup, evolutionPct: pct, exercises: exs };
  });

  const validAll = exercises.filter((e) => e.evolutionPct !== null);
  const overallPct =
    validAll.length > 0 ? validAll.reduce((a, b) => a + (b.evolutionPct ?? 0), 0) / validAll.length : null;

  return { exercises, groups, overallPct };
}

/** Última carga e RIR válidos (não herdados) de um exercício, para a sugestão. */
export function lastValidLoad(exerciseId: string, h: HistoryBundle): { load: number; rir: number | null } | null {
  const weekly = weeklySeriesForExercise(exerciseId, h).filter((p) => !p.inherited && p.loadKg !== null);
  if (weekly.length === 0) return null;
  const last = weekly[weekly.length - 1];
  return { load: last.loadKg as number, rir: last.rir };
}

/** Sugestão discreta de carga baseada no último RIR registrado. O usuário sempre decide. */
export function suggestLoad(exerciseId: string, h: HistoryBundle): string | null {
  const last = lastValidLoad(exerciseId, h);
  if (!last) return null;
  const { load, rir } = last;
  const round = (n: number) => Math.round(n * 2) / 2; // arredonda para 0,5 kg
  if (rir === null) return `Sugestão: manter ${fmtKg(load)}`;
  if (rir >= 3) return `Sugestão: tentar ${fmtKg(round(load * 1.05))}`;
  if (rir === 2) return `Sugestão: manter ${fmtKg(load)} ou tentar ${fmtKg(round(load * 1.025))}`;
  return `Sugestão: manter ${fmtKg(load)} ou reduzir para ${fmtKg(round(load * 0.95))}`;
}

export function fmtKg(n: number | null): string {
  if (n === null) return "—";
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")}kg`;
}

export function fmtPct(n: number | null): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1).replace(".", ",")}%`;
}
