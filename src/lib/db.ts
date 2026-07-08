import { supabase } from "./supabase";
import {
  BodyMetricRow,
  ExerciseLogRow,
  ProfileNoteRow,
  ProfileRow,
  SetLogRow,
  TrainingPlanJson,
  TrainingPlanRow,
  WorkoutSessionRow,
} from "./types";

export const MAX_PROFILES = 8;

// ── Perfis ──────────────────────────────────────────────────────────────────
export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createProfile(name: string): Promise<ProfileRow> {
  const existing = await listProfiles();
  if (existing.length >= MAX_PROFILES) throw new Error(`Limite de ${MAX_PROFILES} perfis atingido.`);
  const { data, error } = await supabase.from("profiles").insert({ name: name.trim() }).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("Já existe um perfil com esse nome.");
    throw error;
  }
  return data;
}

export async function deleteProfile(profileId: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", profileId);
  if (error) throw error;
}

export async function getProfile(profileId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Salva a foto do perfil (data URL redimensionada no cliente). */
export async function updateProfileAvatar(profileId: string, avatar: string | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw error;
}

// ── Planos de treino ────────────────────────────────────────────────────────
export async function getActivePlan(profileId: string): Promise<TrainingPlanRow | null> {
  const { data, error } = await supabase
    .from("training_plans")
    .select("*")
    .eq("profile_id", profileId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deactivatePlans(profileId: string): Promise<void> {
  const { error } = await supabase
    .from("training_plans")
    .update({ active: false })
    .eq("profile_id", profileId)
    .eq("active", true);
  if (error) throw error;
}

export async function insertPlan(profileId: string, plan: TrainingPlanJson): Promise<TrainingPlanRow> {
  const { data, error } = await supabase
    .from("training_plans")
    .insert({
      profile_id: profileId,
      plan_name: plan.planName,
      source_json: plan,
      start_date: plan.startDate ?? null,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlanJson(planId: string, plan: TrainingPlanJson): Promise<void> {
  const { error } = await supabase
    .from("training_plans")
    .update({ source_json: plan, plan_name: plan.planName })
    .eq("id", planId);
  if (error) throw error;
}

// ── Peso corporal ───────────────────────────────────────────────────────────
export async function listBodyMetrics(profileId: string): Promise<BodyMetricRow[]> {
  const { data, error } = await supabase
    .from("body_metrics")
    .select("*")
    .eq("profile_id", profileId)
    .order("date");
  if (error) throw error;
  return data ?? [];
}

export async function upsertBodyMetric(profileId: string, date: string, weightKg: number): Promise<void> {
  const { error } = await supabase
    .from("body_metrics")
    .upsert({ profile_id: profileId, date, weight_kg: weightKg }, { onConflict: "profile_id,date" });
  if (error) throw error;
}

export async function deleteBodyMetric(id: string): Promise<void> {
  const { error } = await supabase.from("body_metrics").delete().eq("id", id);
  if (error) throw error;
}

// ── Sessões de treino ───────────────────────────────────────────────────────
export async function listWorkoutSessions(profileId: string, planId?: string): Promise<WorkoutSessionRow[]> {
  let q = supabase.from("workout_sessions").select("*").eq("profile_id", profileId).order("workout_date");
  if (planId) q = q.eq("training_plan_id", planId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Cria (ou reaproveita) a sessão de treino do dia. Semana calculada a partir da 1ª data do plano ativo. */
export async function getOrCreateWorkoutSession(
  profileId: string,
  planId: string,
  sessionKey: string,
  workoutDate: string
): Promise<WorkoutSessionRow> {
  const { data: existing, error: e1 } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("training_plan_id", planId)
    .eq("session_key", sessionKey)
    .eq("workout_date", workoutDate)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) return existing;

  const all = await listWorkoutSessions(profileId, planId);
  const dates = [...all.map((s) => s.workout_date), workoutDate].sort();
  const first = dates[0];
  const week = weekNumberFrom(first, workoutDate);

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      profile_id: profileId,
      training_plan_id: planId,
      session_key: sessionKey,
      workout_date: workoutDate,
      week_number: week,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** S1 = semana da primeira data registrada no plano; semanas seguintes por blocos de 7 dias. */
export function weekNumberFrom(firstDate: string, date: string): number {
  const a = new Date(firstDate + "T00:00:00");
  const b = new Date(date + "T00:00:00");
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/** Apaga o treino de um dia inteiro (sessão + registros e séries em cascata). */
export async function deleteWorkoutSession(workoutSessionId: string): Promise<void> {
  const { error } = await supabase.from("workout_sessions").delete().eq("id", workoutSessionId);
  if (error) throw error;
}

/** Limpa o registro de um exercício em um dia (log + séries em cascata). */
export async function deleteExerciseLog(workoutSessionId: string, exerciseId: string): Promise<void> {
  const { error } = await supabase
    .from("exercise_logs")
    .delete()
    .eq("workout_session_id", workoutSessionId)
    .eq("exercise_id", exerciseId);
  if (error) throw error;
}

/**
 * Limpa todos os registros de treino e peso de um perfil, mantendo o plano
 * (treino) importado. Útil para zerar dados de teste sem reimportar o JSON.
 * As séries e logs são apagados em cascata ao remover as sessões.
 */
export async function clearProfileTrainingData(profileId: string): Promise<void> {
  const { error: e1 } = await supabase.from("workout_sessions").delete().eq("profile_id", profileId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("body_metrics").delete().eq("profile_id", profileId);
  if (e2) throw e2;
}

/** Todas as sessões de todos os perfis (para o ranking de check-ins). */
export async function listSessionsAllProfiles(): Promise<Pick<WorkoutSessionRow, "profile_id" | "workout_date">[]> {
  const { data, error } = await supabase.from("workout_sessions").select("profile_id, workout_date");
  if (error) throw error;
  return data ?? [];
}

/**
 * Histórico completo de TODOS os perfis, para o ranking por evolução.
 * Retorna sessões, logs e séries; a agregação por perfil é feita na página.
 */
export async function listFullHistoryAllProfiles(): Promise<{
  sessions: WorkoutSessionRow[];
  logs: ExerciseLogRow[];
  sets: SetLogRow[];
}> {
  const { data: sessions, error: e1 } = await supabase.from("workout_sessions").select("*");
  if (e1) throw e1;
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return { sessions: sessions ?? [], logs: [], sets: [] };

  const { data: logs, error: e2 } = await supabase
    .from("exercise_logs")
    .select("*")
    .in("workout_session_id", sessionIds);
  if (e2) throw e2;
  const logIds = (logs ?? []).map((l) => l.id);

  let sets: SetLogRow[] = [];
  if (logIds.length > 0) {
    const { data: setData, error: e3 } = await supabase.from("set_logs").select("*").in("exercise_log_id", logIds);
    if (e3) throw e3;
    sets = setData ?? [];
  }
  return { sessions: sessions ?? [], logs: logs ?? [], sets };
}

// ── Logs de exercício e séries ──────────────────────────────────────────────
export async function listExerciseLogsForSessions(sessionIds: string[]): Promise<ExerciseLogRow[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabase.from("exercise_logs").select("*").in("workout_session_id", sessionIds);
  if (error) throw error;
  return data ?? [];
}

export async function listSetLogsForExerciseLogs(logIds: string[]): Promise<SetLogRow[]> {
  if (logIds.length === 0) return [];
  const { data, error } = await supabase
    .from("set_logs")
    .select("*")
    .in("exercise_log_id", logIds)
    .order("set_number");
  if (error) throw error;
  return data ?? [];
}

export interface SetInput {
  set_number: number;
  load_kg: number | null;
  reps_done: number | null;
  rir_done: number | null;
}

/** Salva o registro de um exercício em uma sessão (upsert do log + substitui séries). */
export async function saveExerciseLog(
  workoutSessionId: string,
  exercise: { exerciseId: string; name: string; primaryMuscleGroup: string; targetRIR: number },
  notes: string,
  sets: SetInput[]
): Promise<void> {
  const { data: log, error: e1 } = await supabase
    .from("exercise_logs")
    .upsert(
      {
        workout_session_id: workoutSessionId,
        exercise_id: exercise.exerciseId,
        exercise_name_snapshot: exercise.name,
        primary_muscle_group_snapshot: exercise.primaryMuscleGroup,
        target_rir: exercise.targetRIR,
        notes,
      },
      { onConflict: "workout_session_id,exercise_id" }
    )
    .select()
    .single();
  if (e1) throw e1;

  const { error: e2 } = await supabase.from("set_logs").delete().eq("exercise_log_id", log.id);
  if (e2) throw e2;

  const rows = sets
    .filter((s) => s.load_kg !== null || s.reps_done !== null || s.rir_done !== null)
    .map((s) => ({ ...s, exercise_log_id: log.id, carried_forward: false }));
  if (rows.length > 0) {
    const { error: e3 } = await supabase.from("set_logs").insert(rows);
    if (e3) throw e3;
  }
}

// ── Observações do perfil ───────────────────────────────────────────────────
export async function getNotes(profileId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("profile_notes").select("*").eq("profile_id", profileId);
  if (error) throw error;
  const map: Record<string, string> = { geral: "", evolucao: "" };
  (data ?? []).forEach((n: ProfileNoteRow) => (map[n.note_type] = n.note));
  return map;
}

export async function saveNote(profileId: string, noteType: "geral" | "evolucao", note: string): Promise<void> {
  const { error } = await supabase
    .from("profile_notes")
    .upsert(
      { profile_id: profileId, note_type: noteType, note, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,note_type" }
    );
  if (error) throw error;
}

// ── Relatórios exportados ───────────────────────────────────────────────────
export async function saveExportedReport(
  profileId: string,
  planId: string | null,
  reportJson: object,
  reportMarkdown: string
): Promise<void> {
  const { error } = await supabase.from("exported_reports").insert({
    profile_id: profileId,
    training_plan_id: planId,
    report_json: reportJson,
    report_markdown: reportMarkdown,
  });
  if (error) throw error;
}
