import { evolutionForPlan, fmtKg, fmtPct, formatDuration, HistoryBundle } from "./calc";
import { BodyMetricRow, TrainingPlanRow } from "./types";

export interface FullReport {
  json: object;
  markdown: string;
}

/** Monta o relatório completo do ciclo (JSON estruturado + Markdown legível). */
export function buildFullReport(
  profileName: string,
  plan: TrainingPlanRow,
  history: HistoryBundle,
  bodyMetrics: BodyMetricRow[],
  notes: Record<string, string>
): FullReport {
  const evo = evolutionForPlan(plan.source_json, history);
  const dates = history.sessions.map((s) => s.workout_date).sort();
  const period = { start: dates[0] ?? plan.start_date ?? null, end: dates[dates.length - 1] ?? null };

  const withPct = evo.exercises.filter((e) => e.evolutionPct !== null);
  const top = [...withPct].sort((a, b) => (b.evolutionPct ?? 0) - (a.evolutionPct ?? 0)).slice(0, 5);
  const stagnant = withPct.filter((e) => (e.evolutionPct ?? 0) <= 0);
  const carried = evo.exercises.filter((e) => e.carriedWeeks.length > 0);

  const summaryText = buildSummaryText(profileName, plan, period, evo, stagnant, top, bodyMetrics, notes);

  const json = {
    profileName,
    period,
    currentPlan: {
      planName: plan.plan_name,
      startDate: plan.start_date,
      sourceJson: plan.source_json,
    },
    bodyWeightByDate: bodyMetrics.map((b) => ({ date: b.date, weightKg: Number(b.weight_kg) })),
    completedWorkouts: history.sessions
      .filter((session) => session.completed_at)
      .map((session) => ({
        date: session.workout_date,
        sessionKey: session.session_key,
        durationSeconds: session.duration_seconds ?? null,
        caloriesEstimate: session.calories_estimate ?? null,
      })),
    overallEvolutionPct: evo.overallPct,
    evolutionByMuscleGroup: evo.groups.map((g) => ({
      muscleGroup: g.muscleGroup,
      evolutionPct: g.evolutionPct,
    })),
    evolutionByExercise: evo.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      muscleGroup: e.muscleGroup,
      firstLoadKg: e.firstLoadKg,
      firstDate: e.firstDate,
      lastLoadKg: e.lastLoadKg,
      lastDate: e.lastDate,
      evolutionPct: e.evolutionPct,
      carriedForwardWeeks: e.carriedWeeks,
      weeklyLoads: e.weekly,
      notes: e.notes,
    })),
    topExercises: top.map((e) => ({ exerciseId: e.exerciseId, name: e.name, evolutionPct: e.evolutionPct })),
    stagnantExercises: stagnant.map((e) => ({ exerciseId: e.exerciseId, name: e.name, evolutionPct: e.evolutionPct })),
    exercisesWithCarriedLoad: carried.map((e) => ({ exerciseId: e.exerciseId, name: e.name, weeks: e.carriedWeeks })),
    profileNotes: { general: notes.geral ?? "", evolution: notes.evolucao ?? "" },
    finalSummary: summaryText,
    generatedAt: new Date().toISOString(),
  };

  const md: string[] = [];
  md.push(`# Relatório de evolução — ${profileName}`);
  md.push("");
  md.push(`**Período analisado:** ${period.start ?? "—"} a ${period.end ?? "—"}`);
  md.push(`**Treino base:** ${plan.plan_name}`);
  md.push(`**Evolução geral do treino:** ${fmtPct(evo.overallPct)}`);
  md.push("");
  md.push(`## Peso corporal por data`);
  if (bodyMetrics.length === 0) md.push("Sem registros de peso corporal.");
  else bodyMetrics.forEach((b) => md.push(`- ${b.date}: ${fmtKg(Number(b.weight_kg))}`));
  md.push("");
  md.push(`## Treinos concluídos`);
  const completed = history.sessions.filter((session) => session.completed_at);
  if (completed.length === 0) md.push("Sem treinos concluídos.");
  else
    completed.forEach((session) => {
      const calories = session.calories_estimate == null ? "estimativa indisponível" : `~${Math.round(session.calories_estimate)} kcal (estimativa)`;
      md.push(`- ${session.workout_date} · ${session.session_key}: ${formatDuration(session.duration_seconds)} · ${calories}`);
    });
  md.push("");
  md.push(`## Evolução por grupo muscular`);
  evo.groups.forEach((g) => md.push(`- **${g.muscleGroup}:** ${fmtPct(g.evolutionPct)}`));
  md.push("");
  md.push(`## Evolução por exercício`);
  evo.exercises.forEach((e) => {
    md.push(`### ${e.name} (${e.muscleGroup})`);
    md.push(`- Carga inicial: ${fmtKg(e.firstLoadKg)} (${e.firstDate ?? "—"})`);
    md.push(`- Carga mais recente: ${fmtKg(e.lastLoadKg)} (${e.lastDate ?? "—"})`);
    md.push(`- Evolução: ${fmtPct(e.evolutionPct)}`);
    if (e.carriedWeeks.length > 0)
      md.push(`- Semanas com carga mantida por falta de preenchimento: S${e.carriedWeeks.join(", S")}`);
    if (e.notes.length > 0) md.push(`- Anotações: ${e.notes.join(" | ")}`);
    md.push("");
  });
  md.push(`## Exercícios mais evoluídos`);
  if (top.length === 0) md.push("Sem dados suficientes.");
  else top.forEach((e) => md.push(`- ${e.name}: ${fmtPct(e.evolutionPct)}`));
  md.push("");
  md.push(`## Exercícios estagnados`);
  if (stagnant.length === 0) md.push("Nenhum exercício estagnado no período.");
  else stagnant.forEach((e) => md.push(`- ${e.name}: ${fmtPct(e.evolutionPct)}`));
  md.push("");
  md.push(`## Anotações gerais do perfil`);
  md.push(notes.geral?.trim() || "Sem anotações gerais.");
  md.push("");
  md.push(`## Observações sobre evolução, dores e limitações`);
  md.push(notes.evolucao?.trim() || "Sem observações.");
  md.push("");
  md.push(`## Resumo final (pronto para pedir um novo treino)`);
  md.push("");
  md.push(summaryText);

  return { json, markdown: md.join("\n") };
}

function buildSummaryText(
  profileName: string,
  plan: TrainingPlanRow,
  period: { start: string | null; end: string | null },
  evo: ReturnType<typeof evolutionForPlan>,
  stagnant: { name: string; evolutionPct: number | null }[],
  top: { name: string; evolutionPct: number | null }[],
  bodyMetrics: BodyMetricRow[],
  notes: Record<string, string>
): string {
  const firstW = bodyMetrics[0];
  const lastW = bodyMetrics[bodyMetrics.length - 1];
  const lines: string[] = [];
  lines.push(
    `Sou ${profileName} e acabei de completar o ciclo de treino "${plan.plan_name}" (${period.start ?? "?"} a ${period.end ?? "?"}). Quero um novo treino baseado na minha evolução real abaixo.`
  );
  if (firstW && lastW)
    lines.push(
      `Peso corporal: comecei com ${fmtKg(Number(firstW.weight_kg))} e estou com ${fmtKg(Number(lastW.weight_kg))}.`
    );
  lines.push(`Evolução geral de carga: ${fmtPct(evo.overallPct)}.`);
  lines.push(
    `Evolução por grupo muscular: ${evo.groups.map((g) => `${g.muscleGroup} ${fmtPct(g.evolutionPct)}`).join("; ")}.`
  );
  if (top.length > 0)
    lines.push(`Exercícios que mais evoluíram: ${top.map((e) => `${e.name} (${fmtPct(e.evolutionPct)})`).join(", ")}.`);
  if (stagnant.length > 0)
    lines.push(`Exercícios estagnados: ${stagnant.map((e) => e.name).join(", ")} — considerar trocar ou variar.`);
  const cargas = evo.exercises
    .filter((e) => e.lastLoadKg !== null)
    .map((e) => `${e.name}: ${fmtKg(e.lastLoadKg)}`)
    .join("; ");
  if (cargas) lines.push(`Cargas mais recentes: ${cargas}.`);
  if (notes.evolucao?.trim()) lines.push(`Observações sobre dores/limitações/percepção: ${notes.evolucao.trim()}`);
  if (notes.geral?.trim()) lines.push(`Observações gerais: ${notes.geral.trim()}`);
  lines.push(
    `Monte um novo treino de musculação progressivo a partir desses dados, mantendo o que funcionou e ajustando o que estagnou. Responda no mesmo formato JSON do meu app (profileName, planName, sessions A–E com exercises e mobility).`
  );
  return lines.join("\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
