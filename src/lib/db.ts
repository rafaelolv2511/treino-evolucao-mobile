import { supabase } from "./supabase";
import { CardioInput, estimateCalories } from "./calc";
import {
  BodyMetricRow,
  ProfileGroupRow,
  ProfileGroupMembershipRow,
  ExerciseLogRow,
  ProfileNoteRow,
  ProfileRow,
  SetLogRow,
  TrainingPlanJson,
  TrainingPlanRow,
  WorkoutSessionRow,
} from "./types";
import { normalizeGroupIds } from "./groups";

export const MAX_PROFILES = 8;

// ── Perfis ──────────────────────────────────────────────────────────────────
export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) throw error;
  const profiles: ProfileRow[] = data ?? [];
  if (profiles.length === 0) return profiles;

  const { data: membershipData, error: membershipError } = await supabase
    .from("profile_group_memberships")
    .select("profile_id,group_id,created_at");
  if (membershipError) throw membershipError;

  const memberships = (membershipData ?? []) as ProfileGroupMembershipRow[];
  const groupsByProfile = new Map<string, string[]>();
  for (const membership of memberships) {
    const ids = groupsByProfile.get(membership.profile_id) ?? [];
    ids.push(membership.group_id);
    groupsByProfile.set(membership.profile_id, ids);
  }

  return profiles.map((profile) => ({
    ...profile,
    group_ids: normalizeGroupIds(groupsByProfile.get(profile.id) ?? (profile.group_id ? [profile.group_id] : [])),
  }));
}

export async function createProfile(name: string): Promise<ProfileRow> {
  const clean = name.trim();
  if (!clean) throw new Error("Informe um nome para o perfil.");

  const existing = await listProfiles();

  // Se já existe um perfil com esse nome, reaproveita em vez de falhar na
  // restrição de unicidade (evita o erro ao recriar um perfil recém-apagado).
  const same = existing.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (same) return same;

  if (existing.length >= MAX_PROFILES) throw new Error(`Limite de ${MAX_PROFILES} perfis atingido.`);

  const { data, error } = await supabase.from("profiles").insert({ name: clean }).select().single();
  if (error) {
    // Corrida: alguém/algum resíduo com o mesmo nome — relê e devolve o existente.
    if (error.code === "23505") {
      const again = await listProfiles();
      const found = again.find((p) => p.name.toLowerCase() === clean.toLowerCase());
      if (found) return found;
      throw new Error("Já existe um perfil com esse nome.");
    }
    throw error;
  }
  if (!data) throw new Error("Não foi possível criar o perfil. Tente novamente.");
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
): Promise<{ startedAt: string | null }> {
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

  let startedAt: string | null = null;
  if (sets.some((set) => set.load_kg !== null)) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("workout_sessions")
      .update({ started_at: now })
      .eq("id", workoutSessionId)
      .is("started_at", null)
      .select("started_at")
      .maybeSingle();
    if (error) throw error;
    startedAt = data?.started_at ?? null;
  }
  return { startedAt };
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


// ── Grupos de perfis ────────────────────────────────────────────────────────
export async function listGroups(): Promise<ProfileGroupRow[]> {
  const { data, error } = await supabase.from("profile_groups").select("*").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(name: string): Promise<ProfileGroupRow> {
  const clean = name.trim();
  if (!clean) throw new Error("Informe um nome para o grupo.");
  const { data, error } = await supabase.from("profile_groups").insert({ name: clean }).select().single();
  if (error) {
    if (error.code === "23505") {
      const all = await listGroups();
      const found = all.find((g) => g.name.toLowerCase() === clean.toLowerCase());
      if (found) return found;
    }
    throw error;
  }
  return data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  // Os vínculos são removidos em cascata; os perfis e outros grupos permanecem.
  const { error } = await supabase.from("profile_groups").delete().eq("id", groupId);
  if (error) throw error;
}

export async function setProfileGroups(profileId: string, groupIds: string[]): Promise<void> {
  const desired = normalizeGroupIds(groupIds);
  const { data, error: readError } = await supabase
    .from("profile_group_memberships")
    .select("group_id")
    .eq("profile_id", profileId);
  if (readError) throw readError;

  const existing = new Set((data ?? []).map((row: { group_id: string }) => row.group_id));
  const toAdd = desired.filter((groupId) => !existing.has(groupId));
  const toRemove = [...existing].filter((groupId) => !desired.includes(groupId));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("profile_group_memberships")
      .insert(toAdd.map((groupId) => ({ profile_id: profileId, group_id: groupId })));
    if (error) throw error;
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("profile_group_memberships")
      .delete()
      .eq("profile_id", profileId)
      .in("group_id", toRemove);
    if (error) throw error;
  }

  // Mantém a primeira seleção na coluna antiga para compatibilidade com versões anteriores.
  const { error } = await supabase
    .from("profiles")
    .update({ group_id: desired[0] ?? null, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw error;
}

// ── PIN opcional do perfil ──────────────────────────────────────────────────
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`rtrainning:${pin.trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function setProfilePin(profileId: string, pin: string | null): Promise<void> {
  const pin_hash = pin && pin.trim() ? await hashPin(pin) : null;
  const { error } = await supabase
    .from("profiles")
    .update({ pin_hash, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw error;
}

// ── Conclusão de treino (check-in válido) ───────────────────────────────────
/** Marca a sessão como concluída (check-in). Chamado ao "Concluir treino" com >= 40% dos exercícios registrados. */
/** Inicia o cronometro geral do treino (botao play). Grava started_at apenas se ainda estiver nulo. */
export async function startWorkoutTimer(workoutSessionId: string): Promise<string> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("workout_sessions")
    .update({ started_at: now })
    .eq("id", workoutSessionId)
    .is("started_at", null);
  if (error) throw error;
  const { data, error: e2 } = await supabase
    .from("workout_sessions")
    .select("started_at")
    .eq("id", workoutSessionId)
    .single();
  if (e2) throw e2;
  return data.started_at ?? now;
}

/** Salva o cardio da sessão assim que o usuário registra (antes de concluir). */
export async function saveCardio(workoutSessionId: string, cardio: CardioInput | null): Promise<void> {
  const { error } = await supabase
    .from("workout_sessions")
    .update({
      cardio_type: cardio?.type ?? null,
      cardio_minutes: cardio ? Math.max(1, Math.round(cardio.minutes)) : null,
      cardio_km: cardio?.km ?? null,
    })
    .eq("id", workoutSessionId);
  if (error) throw error;
}

export async function markSessionCompleted(
  workoutSessionId: string,
  cardio: CardioInput | null = null
): Promise<WorkoutSessionRow> {
  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", workoutSessionId)
    .single();
  if (sessionError) throw sessionError;

  const completedAt = new Date().toISOString();
  const durationSeconds = session.started_at
    ? Math.max(0, Math.floor((Date.parse(completedAt) - Date.parse(session.started_at)) / 1000))
    : null;

  let { data: metric, error: metricError } = await supabase
    .from("body_metrics")
    .select("weight_kg")
    .eq("profile_id", session.profile_id)
    .lte("date", session.workout_date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (metricError) throw metricError;
  if (!metric) {
    const fallback = await supabase
      .from("body_metrics")
      .select("weight_kg")
      .eq("profile_id", session.profile_id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    metric = fallback.data;
  }

  const logs = await listExerciseLogsForSessions([workoutSessionId]);
  const sets = await listSetLogsForExerciseLogs(logs.map((log) => log.id));
  const loadedLogIds = new Set(sets.filter((set) => set.load_kg !== null).map((set) => set.exercise_log_id));
  const rirValues = sets.filter((set) => set.rir_done !== null).map((set) => Number(set.rir_done));
  const caloriesEstimate = estimateCalories({
    weightKg: metric ? Number(metric.weight_kg) : null,
    durationSeconds,
    exerciseCount: logs.length,
    loadedExerciseCount: loadedLogIds.size,
    totalSets: sets.length,
    totalVolumeKg: sets.reduce((sum, set) => sum + (Number(set.load_kg) || 0) * (Number(set.reps_done) || 0), 0),
    averageRir: rirValues.length ? rirValues.reduce((sum, rir) => sum + rir, 0) / rirValues.length : null,
    cardio,
  });

  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      completed_at: completedAt,
      duration_seconds: durationSeconds,
      calories_estimate: caloriesEstimate,
      cardio_type: cardio?.type ?? null,
      cardio_minutes: cardio ? Math.round(cardio.minutes) : null,
      cardio_km: cardio?.km ?? null,
    })
    .eq("id", workoutSessionId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
