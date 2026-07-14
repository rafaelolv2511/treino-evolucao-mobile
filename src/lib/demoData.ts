import { HistoryBundle } from "./calc";
import {
  BodyMetricRow,
  ExerciseLogRow,
  SetLogRow,
  TrainingPlanJson,
  WorkoutSessionRow,
} from "./types";

/**
 * Gera ~2 meses (8 semanas) de treino simulado, em memória — nada é salvo no
 * Supabase. Serve para a página /demo mostrar o app "cheio" para novos usuários.
 */

export const DEMO_PLAN: TrainingPlanJson = {
  profileName: "Demo",
  planName: "Hipertrofia — Ciclo Demonstração",
  startDate: "2026-05-11",
  sessions: [
    {
      sessionKey: "A",
      sessionName: "Treino A",
      focus: "Peito e tríceps",
      exercises: [
        { exerciseId: "supino_reto", name: "Supino reto", primaryMuscleGroup: "Peito", secondaryMuscleGroups: ["Tríceps"], sets: 4, reps: "6-10", targetRIR: 2, suggestedRestSeconds: 120, initialLoadKg: null, notes: "" },
        { exerciseId: "supino_inclinado", name: "Supino inclinado", primaryMuscleGroup: "Peito", sets: 3, reps: "8-12", targetRIR: 2, suggestedRestSeconds: 90, initialLoadKg: null, notes: "" },
        { exerciseId: "triceps_corda", name: "Tríceps na corda", primaryMuscleGroup: "Tríceps", sets: 3, reps: "10-15", targetRIR: 1, suggestedRestSeconds: 60, initialLoadKg: null, notes: "" },
      ],
      mobility: [],
    },
    {
      sessionKey: "B",
      sessionName: "Treino B",
      focus: "Costas e bíceps",
      exercises: [
        { exerciseId: "puxada_frontal", name: "Puxada frontal", primaryMuscleGroup: "Costas", secondaryMuscleGroups: ["Bíceps"], sets: 4, reps: "8-12", targetRIR: 2, suggestedRestSeconds: 90, initialLoadKg: null, notes: "" },
        { exerciseId: "remada_baixa", name: "Remada baixa", primaryMuscleGroup: "Costas", sets: 3, reps: "8-12", targetRIR: 2, suggestedRestSeconds: 90, initialLoadKg: null, notes: "" },
        { exerciseId: "rosca_direta", name: "Rosca direta", primaryMuscleGroup: "Bíceps", sets: 3, reps: "8-12", targetRIR: 1, suggestedRestSeconds: 60, initialLoadKg: null, notes: "" },
      ],
      mobility: [],
    },
    {
      sessionKey: "C",
      sessionName: "Treino C",
      focus: "Pernas",
      exercises: [
        { exerciseId: "leg_press", name: "Leg press", primaryMuscleGroup: "Quadríceps", sets: 4, reps: "8-12", targetRIR: 2, suggestedRestSeconds: 120, initialLoadKg: null, notes: "" },
        { exerciseId: "cadeira_flexora", name: "Cadeira flexora", primaryMuscleGroup: "Posterior", sets: 3, reps: "10-15", targetRIR: 2, suggestedRestSeconds: 75, initialLoadKg: null, notes: "" },
        { exerciseId: "panturrilha", name: "Panturrilha em pé", primaryMuscleGroup: "Panturrilha", sets: 4, reps: "10-15", targetRIR: 1, suggestedRestSeconds: 60, initialLoadKg: null, notes: "" },
      ],
      mobility: [],
    },
  ],
};

// Carga inicial e ganho semanal médio por exercício (kg), com leve ruído/estagnação.
const START: Record<string, { base: number; step: number; reps: number }> = {
  supino_reto: { base: 60, step: 2.5, reps: 8 },
  supino_inclinado: { base: 22, step: 1, reps: 10 },
  triceps_corda: { base: 25, step: 1, reps: 12 },
  puxada_frontal: { base: 55, step: 2, reps: 10 },
  remada_baixa: { base: 50, step: 1.5, reps: 10 },
  rosca_direta: { base: 14, step: 0.5, reps: 10 },
  leg_press: { base: 120, step: 5, reps: 10 },
  cadeira_flexora: { base: 35, step: 1.5, reps: 12 },
  panturrilha: { base: 60, step: 2, reps: 12 },
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildDemoHistory(weeks = 8): { history: HistoryBundle; metrics: BodyMetricRow[] } {
  const start = new Date("2026-05-11T12:00:00");
  let seed = 20260711;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const sessions: WorkoutSessionRow[] = [];
  const logs: ExerciseLogRow[] = [];
  const sets: SetLogRow[] = [];
  const metrics: BodyMetricRow[] = [];

  const planId = "demo-plan";
  const profileId = "demo";
  const round = (n: number) => Math.round(n * 2) / 2;

  for (let w = 0; w < weeks; w++) {
    // 3 treinos por semana: A (seg), B (qua), C (sex)
    DEMO_PLAN.sessions.forEach((session, si) => {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + si * 2);
      const date = iso(d);
      const sessionId = `s-${w}-${session.sessionKey}`;
      sessions.push({
        id: sessionId,
        profile_id: profileId,
        training_plan_id: planId,
        session_key: session.sessionKey,
        workout_date: date,
        week_number: w + 1,
        started_at: `${date}T18:00:00.000Z`,
        completed_at: `${date}T18:52:00.000Z`,
        duration_seconds: 3120,
        calories_estimate: 380,
        created_at: date,
      });

      session.exercises.forEach((ex) => {
        const cfg = START[ex.exerciseId];
        if (!cfg) return;
        // rosca_direta: progride até a semana 5 e estagna (para demonstrar o aviso).
        let load: number;
        if (ex.exerciseId === "rosca_direta") {
          const cappedWeek = Math.min(w, 4); // trava a partir da 5ª semana (índice 4)
          load = round(cfg.base + cfg.step * cappedWeek);
        } else {
          load = round(cfg.base + cfg.step * w + (random() - 0.5));
        }
        const logId = `l-${w}-${ex.exerciseId}`;
        logs.push({
          id: logId,
          workout_session_id: sessionId,
          exercise_id: ex.exerciseId,
          exercise_name_snapshot: ex.name,
          primary_muscle_group_snapshot: ex.primaryMuscleGroup,
          target_rir: ex.targetRIR,
          notes: w === 2 && ex.exerciseId === "supino_reto" ? "Peguei firme, subiu fácil" : "",
          created_at: date,
        });
        for (let s = 1; s <= ex.sets; s++) {
          sets.push({
            id: `set-${logId}-${s}`,
            exercise_log_id: logId,
            set_number: s,
            load_kg: load,
            reps_done: cfg.reps + (random() > 0.6 ? 1 : 0),
            rir_done: ex.exerciseId === "rosca_direta" && w >= 5 ? 1 : 2,
            carried_forward: false,
            created_at: date,
          });
        }
      });
    });

    // peso corporal 1x por semana, leve tendência de recomposição
    const wd = new Date(start);
    wd.setDate(start.getDate() + w * 7);
    metrics.push({
      id: `m-${w}`,
      profile_id: profileId,
      date: iso(wd),
      weight_kg: Number((78.5 + w * 0.18 + (random() - 0.5) * 0.3).toFixed(1)),
      created_at: iso(wd),
    });
  }

  return { history: { sessions, logs, sets }, metrics };
}
