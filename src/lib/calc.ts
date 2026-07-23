import {
  CardioType,
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

export interface CardioInput {
  type: CardioType;
  minutes: number;
  km: number | null;
}

export interface CalorieEstimateInput {
  weightKg: number | null;
  durationSeconds: number | null;
  exerciseCount?: number;
  loadedExerciseCount?: number;
  totalSets?: number;
  totalVolumeKg?: number;
  averageRir?: number | null;
  cardio?: CardioInput | null;
}

/**
 * MET do cardio por modalidade, derivado do Compendium of Physical Activities:
 * - esteira: com km informado, velocidade = km / (min/60). Caminhada (< 6,5 km/h):
 *   MET = 2 + 0,5 x velocidade (3–5 tipico). Corrida (>= 6,5 km/h): MET ~ velocidade
 *   em km/h (10 km/h ~ 10 MET), limitado a 12. Sem km: 4,5 (ritmo moderado).
 * - bike (ergometrica): por velocidade quando ha km — < 16 km/h: 4; 16–19: 6,8;
 *   19–22: 8; > 22: 10. Sem km: 6,8 (esforco moderado).
 * - escada (simulador): 9 fixo; km nao se aplica.
 */
function cardioMet(cardio: CardioInput): number {
  if (cardio.type === "escada") return 9;
  const speed =
    cardio.km != null && cardio.km > 0 && cardio.minutes > 0 ? cardio.km / (cardio.minutes / 60) : null;
  if (cardio.type === "esteira") {
    if (speed === null) return 4.5;
    if (speed < 6.5) return Math.max(2.5, 2 + 0.5 * speed);
    return Math.min(12, speed);
  }
  // bike
  if (speed === null) return 6.8;
  if (speed < 16) return 4;
  if (speed < 19) return 6.8;
  if (speed < 22) return 8;
  return 10;
}

/**
 * Estimativa MET para musculacao: kcal = MET x peso x horas.
 * Parte de 4,0 MET (treino moderado, inclusive isometria/peso corporal) e soma
 * sinais de cobertura com carga, volume relativo, densidade de series e RIR.
 * Os bonus sao limitados e o MET final fica entre 3,5 e 6,0. Exercicios sem
 * carga nunca reduzem a base. A duracao usada apenas na estimativa e limitada
 * a 4h para um treino esquecido aberto nao produzir um numero enganoso; o tempo
 * bruto persistido permanece integral.
 *
 * Cardio (esteira/bike/escada) e somado como componente proprio:
 * kcal_cardio = MET_cardio x peso x horas_cardio. Para nao contar o mesmo
 * minuto duas vezes, os minutos de cardio informados sao subtraidos do tempo
 * usado no componente de musculacao (piso zero) — assumindo que o cardio
 * aconteceu dentro da janela da sessao. Minutos de cardio sao limitados a 3h.
 */
export function estimateCalories(input: CalorieEstimateInput): number | null {
  const { weightKg, durationSeconds } = input;
  if (!weightKg || weightKg <= 0 || !durationSeconds || durationSeconds <= 0) return null;

  const durationMinutes = durationSeconds / 60;
  const exerciseCount = Math.max(0, input.exerciseCount ?? 0);
  const loadedExerciseCount = Math.max(0, input.loadedExerciseCount ?? 0);
  const totalSets = Math.max(0, input.totalSets ?? 0);
  const totalVolumeKg = Math.max(0, input.totalVolumeKg ?? 0);
  const coverage = exerciseCount > 0 ? Math.min(1, loadedExerciseCount / exerciseCount) : 0;
  const volumePerKg = totalVolumeKg / weightKg;
  const setDensity = durationMinutes > 0 ? totalSets / durationMinutes : 0;
  const rirEffort = input.averageRir == null ? 0 : Math.max(0, Math.min(1, (3 - input.averageRir) / 3));

  const met = Math.max(
    3.5,
    Math.min(6, 4 + coverage * 0.7 + Math.min(0.7, (volumePerKg / 120) * 0.7) + Math.min(0.3, setDensity * 0.45) + rirEffort * 0.3)
  );

  const cardio = input.cardio && input.cardio.minutes > 0 ? input.cardio : null;
  const cardioMinutes = cardio ? Math.min(cardio.minutes, 3 * 60) : 0;
  const boundedMinutes = Math.min(durationSeconds, 4 * 60 * 60) / 60;
  const strengthMinutes = Math.max(0, boundedMinutes - cardioMinutes);
  const strengthKcal = met * weightKg * (strengthMinutes / 60);
  const cardioKcal = cardio ? cardioMet(cardio) * weightKg * (cardioMinutes / 60) : 0;
  return Math.round(strengthKcal + cardioKcal);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) return `${hours}h${rest ? ` ${rest}min` : ""}`;
  return minutes > 0 ? `${minutes} min` : "<1 min";
}

/** Contador ao vivo estilo app Fitness: 07:42 ou 1:07:42. */
export function formatElapsed(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Semana de calendario fixa, de segunda a domingo, usada somente nos cards de conclusao/compartilhamento. */
export function calendarWeekSummary(today: string, sessions: WorkoutSessionRow[]): {
  concluidosNaSemana: number;
  inicioSemanaISO: string;
  fimSemanaISO: string;
} {
  const current = new Date(`${today}T12:00:00`);
  const mondayOffset = (current.getDay() + 6) % 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const inicioSemanaISO = isoDate(monday);
  const fimSemanaISO = isoDate(sunday);
  const dates = new Set(
    sessions
      .filter((session) => session.completed_at && session.workout_date >= inicioSemanaISO && session.workout_date <= fimSemanaISO)
      .map((session) => session.workout_date)
  );
  return { concluidosNaSemana: dates.size, inicioSemanaISO, fimSemanaISO };
}

/** Carga representativa de um log = maior carga válida entre as séries preenchidas. */
export function bestLoadOfLog(
  logId: string,
  sets: SetLogRow[]
): { load: number | null; rir: number | null; reps: number | null } {
  const mine = sets.filter((s) => s.exercise_log_id === logId && s.load_kg !== null);
  if (mine.length === 0) return { load: null, rir: null, reps: null };
  const best = mine.reduce((a, b) => ((b.load_kg ?? 0) > (a.load_kg ?? 0) ? b : a));
  const lastRir = mine[mine.length - 1].rir_done;
  return { load: Number(best.load_kg), rir: lastRir, reps: best.reps_done };
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

  const byWeek = new Map<number, { load: number | null; rir: number | null; reps: number | null; date: string }>();
  for (const { log, session } of logs) {
    const { load, rir, reps } = bestLoadOfLog(log.id, h.sets);
    if (load === null) continue;
    const prev = byWeek.get(session.week_number);
    if (!prev || load > (prev.load ?? 0)) {
      byWeek.set(session.week_number, { load, rir, reps, date: session.workout_date });
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
      points.push({ week: w, date: real.date, loadKg: real.load, rir: real.rir, reps: real.reps, inherited: false } as WeeklyLoadPoint);
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
export function lastValidLoad(
  exerciseId: string,
  h: HistoryBundle
): { load: number; rir: number | null; reps: number | null } | null {
  const weekly = weeklySeriesForExercise(exerciseId, h).filter((p) => !p.inherited && p.loadKg !== null);
  if (weekly.length === 0) return null;
  const last = weekly[weekly.length - 1] as any;
  return { load: last.loadKg as number, rir: last.rir, reps: last.reps ?? null };
}

/**
 * Sugestão discreta de carga baseada no último RIR E nas repetições feitas
 * em relação à faixa alvo (ex.: "8-12"). O usuário sempre decide.
 */
export function parseRepsRange(reps: string): { min: number; max: number } | null {
  const m = String(reps).match(/(\d+)\s*[-a]\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const single = String(reps).match(/^(\d+)/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return null;
}

/**
 * Sugestão de carga baseada em TODAS as séries, não numa carga isolada.
 *
 * Método (determinístico e documentado):
 * 1. Para cada série válida (carga > 0, reps > 0, não herdada) das até 2 últimas
 *    sessões registradas do exercício, estima-se a força da série via Epley com
 *    esforço efetivo: e1RM = carga x (1 + (reps + RIR) / 30). Reps + RIR = quantas
 *    reps a pessoa CONSEGUIRIA fazer. RIR não informado assume 2 (conservador).
 * 2. A força central da sessão é a MEDIANA dos e1RM das séries — mediana ignora
 *    o outlier clássico de "peguei pesado demais na primeira série e caí depois".
 * 3. Sessões são combinadas com peso 70% (mais recente) / 30% (anterior), dando
 *    estabilidade sem ancorar no passado.
 * 4. A carga sugerida é a que corresponde ao MEIO da faixa alvo de reps com o RIR
 *    alvo do exercício: sugerida = e1RM / (1 + (repsAlvo + rirAlvo) / 30).
 * 5. Viés de progressão: mediana de reps >= teto da faixa com folga (RIR >= 2 ou
 *    não informado) empurra +2,5%; mediana abaixo do piso puxa -2,5%.
 * 6. Trava de segurança: a sugestão final fica a no máximo ±10% da carga típica
 *    (mediana das cargas da última sessão) e é arredondada a 0,5 kg.
 */
export function suggestLoad(exerciseId: string, h: HistoryBundle, targetReps?: string, targetRir?: number | null): string | null {
  const round = (n: number) => Math.round(n * 2) / 2;
  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Sessões concluíveis do exercício, da mais recente para trás, com séries válidas.
  const sessionsById = new Map(h.sessions.map((s) => [s.id, s]));
  const logs = h.logs
    .filter((log) => log.exercise_id === exerciseId)
    .map((log) => ({ log, session: sessionsById.get(log.workout_session_id) }))
    .filter((x): x is { log: ExerciseLogRow; session: WorkoutSessionRow } => Boolean(x.session))
    .sort((a, b) => (a.session.workout_date < b.session.workout_date ? 1 : -1));

  const sessionsData: { e1rm: number; loads: number[]; reps: number[]; rirs: number[]; fallbackLoad: number }[] = [];
  for (const { log } of logs) {
    const sets = h.sets.filter(
      (set) =>
        set.exercise_log_id === log.id &&
        !set.carried_forward &&
        set.load_kg !== null &&
        set.load_kg > 0
    );
    if (sets.length === 0) continue;
    const withReps = sets.filter((set) => set.reps_done !== null && set.reps_done > 0);
    const e1rms = withReps.map(
      (set) => set.load_kg! * (1 + (set.reps_done! + (set.rir_done ?? 2)) / 30)
    );
    sessionsData.push({
      // Sem nenhuma rep informada não dá para estimar e1RM; a mediana de carga
      // vira o fallback e a sugestão degrada para "manter".
      e1rm: e1rms.length ? median(e1rms) : 0,
      loads: sets.map((set) => set.load_kg!),
      reps: withReps.map((set) => set.reps_done!),
      rirs: sets.filter((set) => set.rir_done !== null).map((set) => set.rir_done!),
      fallbackLoad: median(sets.map((set) => set.load_kg!)),
    });
    if (sessionsData.length === 2) break;
  }

  if (sessionsData.length === 0) return null;
  const latest = sessionsData[0];
  const typical = latest.fallbackLoad;

  // Sem reps registradas: não há base para equação — comportamento antigo, honesto.
  if (latest.e1rm === 0 || latest.reps.length === 0) return `Sugestão: manter ${fmtKg(typical)}`;

  const previous = sessionsData[1];
  const blendedE1rm =
    previous && previous.e1rm > 0 ? latest.e1rm * 0.7 + previous.e1rm * 0.3 : latest.e1rm;

  const range = targetReps ? parseRepsRange(targetReps) : null;
  const midReps = range ? (range.min + range.max) / 2 : 10;
  const rirGoal = targetRir ?? 2;
  let suggested = blendedE1rm / (1 + (midReps + rirGoal) / 30);

  // Viés de progressão pelos sinais agregados da última sessão.
  const medReps = median(latest.reps);
  const medRir = latest.rirs.length ? median(latest.rirs) : null;
  if (range && medReps >= range.max && (medRir === null || medRir >= 2)) suggested *= 1.025;
  if (range && medReps < range.min) suggested *= 0.975;

  // Trava: nunca sugerir salto maior que ±10% da carga típica da última sessão.
  suggested = Math.min(typical * 1.1, Math.max(typical * 0.9, suggested));
  const finalLoad = round(suggested);
  const diff = (finalLoad - typical) / typical;

  if (diff >= 0.02) return `Sugestão: subir para ${fmtKg(finalLoad)} (séries indicam folga)`;
  if (diff <= -0.02) return `Sugestão: reduzir para ${fmtKg(finalLoad)} (séries acima do sustentável)`;
  return `Sugestão: manter ${fmtKg(typical)}`;
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

// ── Recorde pessoal (PR) ────────────────────────────────────────────────────
/**
 * Maior carga já registrada de um exercício ANTES de uma sessão específica.
 * Usada para saber se a carga de hoje é um novo recorde.
 */
export function personalRecordBefore(
  exerciseId: string,
  beforeSessionId: string,
  h: HistoryBundle
): number | null {
  const sessionById = new Map(h.sessions.map((s) => [s.id, s]));
  const target = sessionById.get(beforeSessionId);
  if (!target) return null;
  let best: number | null = null;
  for (const log of h.logs) {
    if (log.exercise_id !== exerciseId) continue;
    const session = sessionById.get(log.workout_session_id);
    if (!session) continue;
    // considera apenas sessões anteriores (data menor, ou mesma data mas outra sessão)
    const isBefore =
      session.workout_date < target.workout_date ||
      (session.workout_date === target.workout_date && session.id !== beforeSessionId);
    if (!isBefore) continue;
    const { load } = bestLoadOfLog(log.id, h.sets);
    if (load !== null && (best === null || load > best)) best = load;
  }
  return best;
}

/** true se `loadKg` supera o recorde anterior desse exercício (é um novo PR). */
export function isNewRecord(loadKg: number | null, previousPR: number | null): boolean {
  if (loadKg === null) return false;
  if (previousPR === null) return false; // primeira carga não conta como "novo" recorde
  return loadKg > previousPR;
}

// ── Detecção de estagnação ──────────────────────────────────────────────────
export interface StagnationInfo {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  weeksStalled: number; // há quantas semanas a carga não sobe
  currentLoadKg: number;
}

/**
 * Exercícios cuja carga não aumenta há N semanas ou mais (considerando apenas
 * semanas realmente registradas, não herdadas). Alimenta o aviso gentil na Evolução.
 */
export function stagnantExercises(
  plan: TrainingPlanJson,
  h: HistoryBundle,
  minWeeks = 3
): StagnationInfo[] {
  const out: StagnationInfo[] = [];
  for (const s of plan.sessions) {
    for (const e of s.exercises) {
      const real = weeklySeriesForExercise(e.exerciseId, h).filter((p) => !p.inherited && p.loadKg !== null);
      if (real.length < minWeeks) continue;
      const current = real[real.length - 1].loadKg!;
      // conta há quantas semanas registradas a carga não supera a atual
      let stalled = 0;
      for (let i = real.length - 1; i >= 0; i--) {
        if ((real[i].loadKg ?? 0) >= current) stalled++;
        else break;
      }
      // stalled inclui a semana atual; "parada há X semanas" = stalled - 1 semanas sem subir
      const weeksStalled = stalled;
      if (weeksStalled >= minWeeks) {
        out.push({
          exerciseId: e.exerciseId,
          name: e.name,
          muscleGroup: e.primaryMuscleGroup,
          weeksStalled,
          currentLoadKg: current,
        });
      }
    }
  }
  return out.sort((a, b) => b.weeksStalled - a.weeksStalled);
}

/**
 * Evolução geral de um perfil (média das evoluções por exercício válidas),
 * usando o histórico completo — para o ranking por progresso.
 */
/**
 * Evolução % de um período, comparando com a carga ANTERIOR ao período.
 *
 * Motivo: `overallEvolutionPct` agrupa por semana do plano e exige 2 pontos
 * semanais. Numa semana de calendário cabe apenas UMA semana do plano, então o
 * ranking semanal nunca produzia valor (verificado no banco: 1 ponto por
 * exercício por perfil). Aqui a régua é a data, não a semana do plano:
 * - baseline = última carga válida ANTES do período (se existir);
 *   sem histórico anterior, usa a primeira carga válida dentro do período.
 * - atual = última carga válida DENTRO do período.
 * - pct por exercício = ((atual - baseline) / baseline) × 100; média simples.
 * A fórmula e a regra "sempre por exerciseId" são as mesmas de sempre.
 */
export function evolutionPctInPeriod(h: HistoryBundle, inPeriod: (date: string) => boolean): number | null {
  const sessionById = new Map(h.sessions.map((s) => [s.id, s]));
  const byExercise = new Map<string, { date: string; load: number; inPeriod: boolean }[]>();

  for (const log of h.logs) {
    const session = sessionById.get(log.workout_session_id);
    if (!session) continue;
    const { load } = bestLoadOfLog(log.id, h.sets);
    if (load === null || load <= 0) continue;
    const arr = byExercise.get(log.exercise_id) ?? [];
    arr.push({ date: session.workout_date, load, inPeriod: inPeriod(session.workout_date) });
    byExercise.set(log.exercise_id, arr);
  }

  const pcts: number[] = [];
  for (const points of byExercise.values()) {
    points.sort((a, b) => (a.date < b.date ? -1 : 1));
    const inside = points.filter((p) => p.inPeriod);
    if (inside.length === 0) continue;
    const firstInsideDate = inside[0].date;
    const before = points.filter((p) => !p.inPeriod && p.date < firstInsideDate);
    const baseline = before.length ? before[before.length - 1].load : inside[0].load;
    const current = inside[inside.length - 1].load;
    // Sem histórico anterior E sem repetição no período não há o que comparar.
    if (before.length === 0 && inside.length < 2) continue;
    if (baseline > 0) pcts.push(((current - baseline) / baseline) * 100);
  }

  if (pcts.length === 0) return null;
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}

export function overallEvolutionPct(exerciseIds: string[], h: HistoryBundle): number | null {
  const pcts: number[] = [];
  for (const id of exerciseIds) {
    const real = weeklySeriesForExercise(id, h).filter((p) => !p.inherited && p.loadKg !== null);
    if (real.length < 2) continue;
    const first = real[0].loadKg!;
    const last = real[real.length - 1].loadKg!;
    if (first > 0) pcts.push(((last - first) / first) * 100);
  }
  if (pcts.length === 0) return null;
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}

// ── Agregações para os compartilháveis (identidade Carbon) ─────────────────
// Regra da marca: nunca destacar o kg de um exercício isolado — só agregados.

export interface DayAggregate {
  volumeKg: number;
  series: number;
  splitMuscular: { grupo: string; pct: number }[];
  exerciseNames: { name: string; sets: number; reps: string }[];
}

/** Volume, séries e divisão por grupo muscular de UMA sessão. */
export function dayAggregate(h: HistoryBundle, workoutSessionId: string): DayAggregate {
  const logs = h.logs.filter((l) => l.workout_session_id === workoutSessionId);
  let volumeKg = 0;
  let series = 0;
  const byGroup = new Map<string, number>();
  const exerciseNames: { name: string; sets: number; reps: string }[] = [];

  for (const log of logs) {
    const sets = h.sets.filter((s) => s.exercise_log_id === log.id && !s.carried_forward && s.load_kg !== null);
    if (sets.length === 0) continue;
    let exVolume = 0;
    for (const set of sets) {
      const reps = set.reps_done ?? 0;
      exVolume += (set.load_kg ?? 0) * (reps > 0 ? reps : 1);
      series += 1;
    }
    volumeKg += exVolume;
    const group = log.primary_muscle_group_snapshot || "Geral";
    byGroup.set(group, (byGroup.get(group) ?? 0) + exVolume);
    const repsList = sets.map((s) => s.reps_done).filter((r): r is number => r != null);
    exerciseNames.push({
      name: log.exercise_name_snapshot,
      sets: sets.length,
      reps: repsList.length ? String(Math.round(repsList.reduce((a, b) => a + b, 0) / repsList.length)) : "—",
    });
  }

  const total = [...byGroup.values()].reduce((a, b) => a + b, 0);
  const splitMuscular = total
    ? [...byGroup.entries()]
        .map(([grupo, value]) => ({ grupo, pct: Math.round((value / total) * 100) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 4)
    : [];

  return { volumeKg: Math.round(volumeKg), series, splitMuscular, exerciseNames };
}

export interface WeekAggregate {
  semanaNum: number;
  diasCheck: ("descanso" | "treino" | "hoje")[];
  volumePorDia: number[];
  volumeKg: number;
  horas: number;
  kcal: number;
  prs: number;
  streakSemanas: number;
  letrasTreino: string[];
}

/** Número ISO da semana (para rotular "SEM 42"). */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function mondayOf(iso: string): Date {
  const d = new Date(`${iso}T12:00:00`);
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  return d;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Semana de calendário (segunda→domingo) que contém `todayISO`. */
export function weekAggregate(h: HistoryBundle, todayISO: string, prsHoje = 0): WeekAggregate {
  const monday = mondayOf(todayISO);
  const days: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toISO(d);
  });

  const completed = h.sessions.filter((s) => s.completed_at);
  const doneDates = new Set(completed.map((s) => s.workout_date));

  const diasCheck = days.map((iso) =>
    iso === todayISO && doneDates.has(iso) ? "hoje" : doneDates.has(iso) ? "treino" : "descanso"
  ) as ("descanso" | "treino" | "hoje")[];

  const volumePorDia = days.map((iso) => {
    const ids = completed.filter((s) => s.workout_date === iso).map((s) => s.id);
    return ids.reduce((sum, id) => sum + dayAggregate(h, id).volumeKg, 0);
  });

  const inWeek = completed.filter((s) => days.includes(s.workout_date));
  const volumeKg = volumePorDia.reduce((a, b) => a + b, 0);
  const horas = inWeek.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) / 3600;
  const kcal = inWeek.reduce((sum, s) => sum + (s.calories_estimate ?? 0), 0);
  const letrasTreino = [...new Set(inWeek.map((s) => s.session_key))].sort();

  // Streak: semanas consecutivas (para trás) com ao menos um treino concluído.
  let streakSemanas = 0;
  for (let back = 0; back < 104; back++) {
    const ref = new Date(monday);
    ref.setDate(monday.getDate() - back * 7);
    const start = toISO(ref);
    const end = new Date(ref);
    end.setDate(ref.getDate() + 6);
    const endISO = toISO(end);
    const has = completed.some((s) => s.workout_date >= start && s.workout_date <= endISO);
    if (has) streakSemanas += 1;
    else if (back > 0) break;
  }

  return {
    semanaNum: isoWeekNumber(new Date(`${todayISO}T12:00:00`)),
    diasCheck,
    volumePorDia,
    volumeKg,
    horas,
    kcal: Math.round(kcal),
    prs: prsHoje,
    streakSemanas,
    letrasTreino,
  };
}

export interface MonthAggregate {
  mes: string;
  diasNoMes: number;
  volumeKg: number;
  treinos: number;
  prs: number;
  consistenciaPct: number;
  evolucaoCargaPct: number | null;
  evolucaoPorLift: { nome: string; pct: number }[];
  volumePorSemana: number[];
  calendario: boolean[];
  streakSemanas: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Mês de calendário que contém `todayISO`. */
export function monthAggregate(h: HistoryBundle, todayISO: string, streakSemanas = 0): MonthAggregate {
  const ref = new Date(`${todayISO}T12:00:00`);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const diasNoMes = new Date(year, month + 1, 0).getDate();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const completed = h.sessions.filter((s) => s.completed_at && s.workout_date.startsWith(prefix));
  const doneDates = new Set(completed.map((s) => s.workout_date));

  const calendario = Array.from({ length: diasNoMes }, (_, i) =>
    doneDates.has(`${prefix}-${String(i + 1).padStart(2, "0")}`)
  );

  const volumeKg = completed.reduce((sum, s) => sum + dayAggregate(h, s.id).volumeKg, 0);

  // Volume por semana do mês (blocos de 7 dias a partir do dia 1).
  const volumePorSemana: number[] = [];
  for (let start = 1; start <= diasNoMes; start += 7) {
    let acc = 0;
    for (let d = start; d < start + 7 && d <= diasNoMes; d++) {
      const iso = `${prefix}-${String(d).padStart(2, "0")}`;
      acc += completed.filter((s) => s.workout_date === iso).reduce((sum, s) => sum + dayAggregate(h, s.id).volumeKg, 0);
    }
    volumePorSemana.push(acc);
  }

  // Evolução de carga no mês: baseline = carga anterior ao mês (regra da marca:
  // média + por lift em %, nunca kg absoluto de um exercício isolado).
  const inMonth = (date: string) => date.startsWith(prefix);
  const evolucaoCargaPct = evolutionPctInPeriod(h, inMonth);

  const sessionById = new Map(h.sessions.map((s) => [s.id, s]));
  const byExercise = new Map<string, { name: string; points: { date: string; load: number; inside: boolean }[] }>();
  for (const log of h.logs) {
    const session = sessionById.get(log.workout_session_id);
    if (!session) continue;
    const { load } = bestLoadOfLog(log.id, h.sets);
    if (load === null || load <= 0) continue;
    const entry = byExercise.get(log.exercise_id) ?? { name: log.exercise_name_snapshot, points: [] };
    entry.points.push({ date: session.workout_date, load, inside: inMonth(session.workout_date) });
    byExercise.set(log.exercise_id, entry);
  }
  const evolucaoPorLift: { nome: string; pct: number }[] = [];
  for (const { name, points } of byExercise.values()) {
    points.sort((a, b) => (a.date < b.date ? -1 : 1));
    const inside = points.filter((p) => p.inside);
    if (inside.length === 0) continue;
    const before = points.filter((p) => !p.inside && p.date < inside[0].date);
    const baseline = before.length ? before[before.length - 1].load : inside[0].load;
    if (before.length === 0 && inside.length < 2) continue;
    if (baseline > 0) {
      const pct = ((inside[inside.length - 1].load - baseline) / baseline) * 100;
      if (pct !== 0) evolucaoPorLift.push({ nome: name, pct });
    }
  }
  evolucaoPorLift.sort((a, b) => b.pct - a.pct);

  // Consistência: dias treinados sobre dias úteis já decorridos do mês.
  const isCurrentMonth = todayISO.startsWith(prefix);
  const lastDay = isCurrentMonth ? Number(todayISO.slice(8, 10)) : diasNoMes;
  let uteis = 0;
  for (let d = 1; d <= lastDay; d++) {
    const wd = new Date(year, month, d).getDay();
    if (wd !== 0 && wd !== 6) uteis += 1;
  }
  const treinosEmUteis = [...doneDates].filter((iso) => {
    const d = new Date(`${iso}T12:00:00`).getDay();
    return d !== 0 && d !== 6;
  }).length;

  return {
    mes: MESES[month],
    diasNoMes,
    volumeKg,
    treinos: doneDates.size,
    prs: 0,
    consistenciaPct: uteis ? Math.round((treinosEmUteis / uteis) * 100) : 0,
    evolucaoCargaPct,
    evolucaoPorLift: evolucaoPorLift.slice(0, 5),
    volumePorSemana,
    calendario,
    streakSemanas,
  };
}

/** 12.5k / 842 — formato Carbon para números grandes. */
export function fmtCompact(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(".0", "")}k`;
  }
  return String(Math.round(n));
}
