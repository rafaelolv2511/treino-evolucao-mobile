import { TrainingPlanJson } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  plan?: TrainingPlanJson;
}

const SESSION_KEYS = ["A", "B", "C", "D", "E"];

/** Valida o JSON do treino. Retorna erros claros dizendo qual campo está faltando. */
export function validatePlanJson(raw: string): ValidationResult {
  const errors: string[] = [];
  let data: any;

  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ["O arquivo não é um JSON válido. Verifique vírgulas e chaves."] };
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, errors: ["O JSON precisa ser um objeto com profileName, planName e sessions."] };
  }

  if (!data.profileName || typeof data.profileName !== "string")
    errors.push('Campo obrigatório faltando: "profileName" (texto).');
  if (!data.planName || typeof data.planName !== "string")
    errors.push('Campo obrigatório faltando: "planName" (texto).');
  if (!Array.isArray(data.sessions) || data.sessions.length === 0) {
    errors.push('Campo obrigatório faltando: "sessions" (lista com pelo menos 1 sessão).');
    return { ok: false, errors };
  }

  const seenSessionKeys = new Set<string>();
  const seenExerciseIds = new Set<string>();

  data.sessions.forEach((s: any, i: number) => {
    const where = `sessions[${i}]`;
    if (!s.sessionKey || typeof s.sessionKey !== "string")
      errors.push(`Campo obrigatório faltando em ${where}: "sessionKey".`);
    else {
      if (!SESSION_KEYS.includes(s.sessionKey))
        errors.push(`${where}.sessionKey deve ser uma letra de A até E (recebido: "${s.sessionKey}").`);
      if (seenSessionKeys.has(s.sessionKey))
        errors.push(`sessionKey duplicada: "${s.sessionKey}". Cada sessão deve ter uma letra única.`);
      seenSessionKeys.add(s.sessionKey);
    }
    if (!s.sessionName || typeof s.sessionName !== "string")
      errors.push(`Campo obrigatório faltando em ${where}: "sessionName".`);
    if (!Array.isArray(s.exercises))
      errors.push(`Campo obrigatório faltando em ${where}: "exercises" (lista).`);
    if (!Array.isArray(s.mobility))
      errors.push(`Campo obrigatório faltando em ${where}: "mobility" (lista — pode ser vazia []).`);

    (Array.isArray(s.exercises) ? s.exercises : []).forEach((e: any, j: number) => {
      const w = `${where}.exercises[${j}]`;
      if (!e.exerciseId || typeof e.exerciseId !== "string")
        errors.push(`Campo obrigatório faltando em ${w}: "exerciseId".`);
      else {
        if (seenExerciseIds.has(e.exerciseId))
          errors.push(`exerciseId duplicado no treino: "${e.exerciseId}". Deve ser único em todo o plano.`);
        seenExerciseIds.add(e.exerciseId);
      }
      if (!e.name || typeof e.name !== "string") errors.push(`Campo obrigatório faltando em ${w}: "name".`);
      if (!e.primaryMuscleGroup || typeof e.primaryMuscleGroup !== "string")
        errors.push(`Campo obrigatório faltando em ${w}: "primaryMuscleGroup".`);
      if (typeof e.sets !== "number" || e.sets < 1)
        errors.push(`Campo obrigatório faltando ou inválido em ${w}: "sets" (número >= 1).`);
      if (e.reps === undefined || e.reps === null || `${e.reps}`.length === 0)
        errors.push(`Campo obrigatório faltando em ${w}: "reps".`);
      if (typeof e.targetRIR !== "number")
        errors.push(`Campo obrigatório faltando em ${w}: "targetRIR" (número).`);
      if (typeof e.suggestedRestSeconds !== "number")
        errors.push(`Campo obrigatório faltando em ${w}: "suggestedRestSeconds" (número, em segundos).`);
    });

    const seenMobilityIds = new Set<string>();
    (Array.isArray(s.mobility) ? s.mobility : []).forEach((m: any, j: number) => {
      const w = `${where}.mobility[${j}]`;
      if (!m.mobilityId || typeof m.mobilityId !== "string")
        errors.push(`Campo obrigatório faltando em ${w}: "mobilityId".`);
      else {
        if (seenMobilityIds.has(m.mobilityId))
          errors.push(`mobilityId duplicado na sessão ${s.sessionKey ?? i}: "${m.mobilityId}".`);
        seenMobilityIds.add(m.mobilityId);
      }
      if (!m.name || typeof m.name !== "string") errors.push(`Campo obrigatório faltando em ${w}: "name".`);
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  // Normaliza reps para string
  const plan: TrainingPlanJson = {
    ...data,
    sessions: data.sessions.map((s: any) => ({
      ...s,
      exercises: s.exercises.map((e: any) => ({ ...e, reps: String(e.reps) })),
    })),
  };
  return { ok: true, errors: [], plan };
}
