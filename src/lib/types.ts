// ── Estrutura do JSON de treino ─────────────────────────────────────────────
export type CardioType = "esteira" | "bike" | "escada";

export interface PlanExercise {
  exerciseId: string;
  name: string;
  description?: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups?: string[];
  sets: number;
  reps: string;
  targetRIR: number;
  suggestedRestSeconds: number;
  initialLoadKg?: number | null;
  notes?: string;
}

export interface PlanMobility {
  mobilityId: string;
  name: string;
  description?: string;
  durationSeconds?: number | null;
  reps?: string | number | null;
  notes?: string;
}

export interface PlanSession {
  sessionKey: string; // A..E
  sessionName: string;
  focus?: string;
  exercises: PlanExercise[];
  mobility: PlanMobility[];
}

export interface TrainingPlanJson {
  profileName: string;
  planName: string;
  startDate?: string;
  sessions: PlanSession[];
}

// ── Linhas do Supabase ──────────────────────────────────────────────────────
export interface ProfileGroupRow {
  id: string;
  name: string;
  created_at: string;
}

export interface ProfileGroupMembershipRow {
  profile_id: string;
  group_id: string;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  name: string;
  group_id?: string | null;
  group_ids?: string[];
  pin_hash?: string | null;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingPlanRow {
  id: string;
  profile_id: string;
  plan_name: string;
  source_json: TrainingPlanJson;
  start_date: string | null;
  active: boolean;
  created_at: string;
}

export interface BodyMetricRow {
  id: string;
  profile_id: string;
  date: string;
  weight_kg: number;
  created_at: string;
}

export interface WorkoutSessionRow {
  id: string;
  profile_id: string;
  training_plan_id: string;
  session_key: string;
  workout_date: string;
  week_number: number;
  completed_at?: string | null;
  started_at?: string | null;
  duration_seconds?: number | null;
  calories_estimate?: number | null;
  cardio_type?: CardioType | null;
  cardio_minutes?: number | null;
  cardio_km?: number | null;
  created_at: string;
}

export interface ExerciseLogRow {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  exercise_name_snapshot: string;
  primary_muscle_group_snapshot: string;
  target_rir: number | null;
  notes: string;
  created_at: string;
}

export interface SetLogRow {
  id: string;
  exercise_log_id: string;
  set_number: number;
  load_kg: number | null;
  reps_done: number | null;
  rir_done: number | null;
  carried_forward: boolean;
  created_at: string;
}

export interface ProfileNoteRow {
  id: string;
  profile_id: string;
  note: string;
  note_type: "geral" | "evolucao";
  created_at: string;
  updated_at: string;
}

// ── Estruturas de análise ───────────────────────────────────────────────────
/** Ponto semanal de carga de um exercício. inherited = carga mantida da semana anterior (sem preenchimento). */
export interface WeeklyLoadPoint {
  week: number;
  date: string | null;
  loadKg: number | null;
  rir: number | null;
  reps?: number | null;
  inherited: boolean;
}

export interface ExerciseEvolution {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  firstLoadKg: number | null;
  firstDate: string | null;
  lastLoadKg: number | null;
  lastDate: string | null;
  evolutionPct: number | null;
  carriedWeeks: number[]; // semanas em que a carga foi apenas mantida
  weekly: WeeklyLoadPoint[];
  notes: string[];
}

export interface GroupEvolution {
  muscleGroup: string;
  evolutionPct: number | null;
  exercises: ExerciseEvolution[];
}
