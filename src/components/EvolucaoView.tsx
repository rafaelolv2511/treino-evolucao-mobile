"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
} from "recharts";
import { bestLoadOfLog, evolutionForPlan, fmtKg, fmtPct, HistoryBundle } from "@/lib/calc";
import {
  clearProfileTrainingData,
  deleteBodyMetric,
  getNotes,
  listBodyMetrics,
  saveExportedReport,
  saveNote,
  upsertBodyMetric,
} from "@/lib/db";
import { buildFullReport, downloadFile } from "@/lib/report";
import { BodyMetricRow, ProfileRow, TrainingPlanRow } from "@/lib/types";
import { Modal, Section, Spinner, TabBar } from "./ui";
import Icon from "./Icons";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CHART_TOOLTIP = {
  contentStyle: {
    background: "rgba(10,14,22,0.95)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12,
    fontSize: 12,
  },
} as const;

export default function EvolucaoView({
  profile,
  plan,
  history,
  onChanged,
}: {
  profile: ProfileRow;
  plan: TrainingPlanRow | null;
  history: HistoryBundle;
  onChanged: () => void;
}) {
  const [metrics, setMetrics] = useState<BodyMetricRow[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({ geral: "", evolucao: "" });
  const [wDate, setWDate] = useState(todayISO());
  const [wKg, setWKg] = useState("");
  const [savingW, setSavingW] = useState(false);
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<"mes" | "ano">("mes");
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, n] = await Promise.all([listBodyMetrics(profile.id), getNotes(profile.id)]);
      setMetrics(m);
      setNotes(n);
    })();
  }, [profile.id]);

  const evo = useMemo(
    () => (plan ? evolutionForPlan(plan.source_json, history) : null),
    [plan, history]
  );

  const allExercises = useMemo(
    () => (plan ? plan.source_json.sessions.flatMap((s) => s.exercises) : []),
    [plan]
  );

  // Série por período (mês/ano): melhor carga do exercício em cada período
  const periodOf = (date: string) => (granularity === "mes" ? date.slice(0, 7) : date.slice(0, 4));

  const loadByPeriod = useMemo(() => {
    // exerciseId -> period -> melhor carga
    const map = new Map<string, Map<string, number>>();
    const sessionById = new Map(history.sessions.map((s) => [s.id, s]));
    for (const log of history.logs) {
      const session = sessionById.get(log.workout_session_id);
      if (!session) continue;
      const { load } = bestLoadOfLog(log.id, history.sets);
      if (load === null) continue;
      const p = periodOf(session.workout_date);
      const inner = map.get(log.exercise_id) ?? new Map();
      inner.set(p, Math.max(inner.get(p) ?? 0, load));
      map.set(log.exercise_id, inner);
    }
    return map;
  }, [history, granularity]); // eslint-disable-line react-hooks/exhaustive-deps

  const periods = useMemo(() => {
    const set = new Set<string>();
    loadByPeriod.forEach((inner) => inner.forEach((_, p) => set.add(p)));
    return [...set].sort();
  }, [loadByPeriod]);

  const exerciseChart = useMemo(() => {
    if (!selectedExercise) return [];
    const inner = loadByPeriod.get(selectedExercise);
    if (!inner) return [];
    return periods.map((p) => ({ periodo: p, carga: inner.get(p) ?? null }));
  }, [selectedExercise, loadByPeriod, periods]);

  const groupChart = useMemo(() => {
    if (!plan) return [];
    const groupOf = new Map(allExercises.map((e) => [e.exerciseId, e.primaryMuscleGroup]));
    const groups = [...new Set(allExercises.map((e) => e.primaryMuscleGroup))];
    return periods.map((p) => {
      const row: Record<string, string | number | null> = { periodo: p };
      for (const g of groups) {
        const vals: number[] = [];
        loadByPeriod.forEach((inner, exId) => {
          if (groupOf.get(exId) === g && inner.has(p)) vals.push(inner.get(p)!);
        });
        row[g] = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
      }
      return row;
    });
  }, [plan, allExercises, loadByPeriod, periods]);

  const overallChart = useMemo(() => {
    return periods.map((p) => {
      const vals: number[] = [];
      loadByPeriod.forEach((inner) => inner.has(p) && vals.push(inner.get(p)!));
      return { periodo: p, media: vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null };
    });
  }, [loadByPeriod, periods]);

  const groupNames = useMemo(() => [...new Set(allExercises.map((e) => e.primaryMuscleGroup))], [allExercises]);
  const GROUP_COLORS = ["#22D3EE", "#8B7CF8", "#34D399", "#FBBF24", "#F472B6", "#60A5FA", "#F87171", "#A3E635"];

  async function saveWeight() {
    if (!wKg.trim() || !wDate) return;
    setSavingW(true);
    try {
      await upsertBodyMetric(profile.id, wDate, Number(wKg.replace(",", ".")));
      setMetrics(await listBodyMetrics(profile.id));
      setWKg("");
    } finally {
      setSavingW(false);
    }
  }

  async function removeWeight(id: string) {
    setSavingW(true);
    try {
      await deleteBodyMetric(id);
      setMetrics(await listBodyMetrics(profile.id));
    } finally {
      setSavingW(false);
    }
  }

  async function clearData() {
    setClearing(true);
    try {
      await clearProfileTrainingData(profile.id);
      setMetrics(await listBodyMetrics(profile.id));
      setSelectedExercise("");
      setConfirmClear(false);
      onChanged();
    } finally {
      setClearing(false);
    }
  }

  async function persistNote(type: "geral" | "evolucao") {
    setSavingNote(type);
    try {
      await saveNote(profile.id, type, notes[type] ?? "");
    } finally {
      setSavingNote(null);
    }
  }

  async function handleExport() {
    if (!plan || !metrics) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const report = buildFullReport(profile.name, plan, history, metrics, notes);
      await saveExportedReport(profile.id, plan.id, report.json, report.markdown);
      const base = `evolucao-${profile.name.toLowerCase().replace(/\s+/g, "-")}-${todayISO()}`;
      downloadFile(`${base}.json`, JSON.stringify(report.json, null, 2), "application/json");
      downloadFile(`${base}.md`, report.markdown, "text/markdown");
      setExportMsg("Relatório exportado em JSON e Markdown. O resumo final está pronto para colar no ChatGPT.");
    } catch (e: any) {
      setExportMsg(e.message ?? "Falha ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  if (metrics === null) return <Spinner label="Carregando evolução…" />;

  return (
    <div className="space-y-4">
      {/* 1. Peso corporal */}
      <Section title="Peso corporal">
        <div className="flex gap-2">
          <input type="date" className="field flex-1" value={wDate} onChange={(e) => setWDate(e.target.value)} />
          <input
            className="field num w-24"
            inputMode="decimal"
            placeholder="kg"
            value={wKg}
            onChange={(e) => setWKg(e.target.value)}
          />
          <button onClick={saveWeight} disabled={savingW || !wKg.trim()} className="btn btn-primary" aria-label="Salvar peso">
            {savingW ? "…" : <Icon name="plus" size={18} />}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          Salvar na mesma data substitui o valor. Toque na lixeira para apagar um registro.
        </p>
        {metrics.length > 0 ? (
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.map((m) => ({ data: m.date.slice(5), kg: Number(m.weight_kg) }))}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="data" tick={{ fill: "#8a93a6", fontSize: 10 }} />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
                <Tooltip {...CHART_TOOLTIP} />
                <Line type="monotone" dataKey="kg" stroke="#22D3EE" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/45">Registre seu primeiro peso para ver o gráfico.</p>
        )}
        {metrics.length > 0 && (
          <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
            {[...metrics].reverse().map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="text-white/70">{m.date.split("-").reverse().join("/")}</span>
                <span className="num flex items-center gap-3">
                  <span className="font-semibold">{fmtKg(Number(m.weight_kg))}</span>
                  <button
                    onClick={() => removeWeight(m.id)}
                    disabled={savingW}
                    aria-label={`Apagar peso de ${m.date}`}
                    className="text-white/40 transition hover:text-red-300"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 2. Gráficos de evolução do treino */}
      <Section
        title="Evolução do treino"
        right={
          <TabBar
            tabs={[
              { key: "mes" as const, label: "Mês" },
              { key: "ano" as const, label: "Ano" },
            ]}
            value={granularity}
            onChange={setGranularity}
          />
        }
      >
        {!plan || periods.length === 0 ? (
          <p className="text-xs text-white/45">Registre cargas nas sessões de treino para liberar os gráficos.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Por exercício</p>
              <select
                className="field !min-h-[44px] text-sm"
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
              >
                <option value="">Escolha um exercício…</option>
                {allExercises.map((e) => (
                  <option key={e.exerciseId} value={e.exerciseId}>
                    {e.name}
                  </option>
                ))}
              </select>
              {selectedExercise && (
                <div className="mt-2 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exerciseChart}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="periodo" tick={{ fill: "#8a93a6", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
                      <Tooltip {...CHART_TOOLTIP} />
                      <Line type="monotone" dataKey="carga" name="carga (kg)" stroke="#8B7CF8" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Por grupo muscular (carga média)</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={groupChart}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="periodo" tick={{ fill: "#8a93a6", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
                    <Tooltip {...CHART_TOOLTIP} />
                    {groupNames.map((g, i) => (
                      <Line
                        key={g}
                        type="monotone"
                        dataKey={g}
                        stroke={GROUP_COLORS[i % GROUP_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {groupNames.map((g, i) => (
                  <span key={g} className="flex items-center gap-1 text-[10px] text-white/60">
                    <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Geral (carga média do treino)</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overallChart}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="periodo" tick={{ fill: "#8a93a6", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Line type="monotone" dataKey="media" name="média (kg)" stroke="#22D3EE" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* 3. Força */}
      <Section title="Força — evolução por grupo">
        {!evo || evo.groups.every((g) => g.evolutionPct === null) ? (
          <p className="text-xs text-white/45">
            A evolução de força compara a primeira carga registrada com a mais recente. Registre pelo menos duas
            semanas de treino.
          </p>
        ) : (
          <div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evo.groups.filter((g) => g.evolutionPct !== null).map((g) => ({ grupo: g.muscleGroup, pct: Number(g.evolutionPct!.toFixed(1)) }))}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="grupo" tick={{ fill: "#8a93a6", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="pct" name="evolução %" fill="#34D399" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1.5">
              {evo.groups.map((g) => (
                <div key={g.muscleGroup} className="flex items-center justify-between text-sm">
                  <span className="text-white/75">{g.muscleGroup}</span>
                  <span className={`num font-bold ${(g.evolutionPct ?? 0) > 0 ? "text-ok" : "text-white/50"}`}>
                    {fmtPct(g.evolutionPct)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-white/10 pt-2 text-sm">
                <span className="font-semibold">Evolução geral</span>
                <span className="num font-bold text-glow">{fmtPct(evo.overallPct)}</span>
              </div>
            </div>
            {evo.exercises.some((e) => e.carriedWeeks.length > 0) && (
              <p className="mt-3 text-[11px] text-white/40">
                Semanas sem preenchimento usam a carga anterior apenas para análise (marcadas como “mantida”), sem
                contar como novo recorde.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* 4. Observações */}
      <Section title="Observações">
        <label className="mb-1 block text-xs font-semibold text-white/60">Observações gerais do perfil</label>
        <textarea
          className="field h-20 text-sm"
          value={notes.geral}
          onChange={(e) => setNotes({ ...notes, geral: e.target.value })}
          onBlur={() => persistNote("geral")}
          placeholder="Anotações livres…"
        />
        <label className="mb-1 mt-3 block text-xs font-semibold text-white/60">
          Evolução, dores, limitações e percepção do treino
        </label>
        <textarea
          className="field h-20 text-sm"
          value={notes.evolucao}
          onChange={(e) => setNotes({ ...notes, evolucao: e.target.value })}
          onBlur={() => persistNote("evolucao")}
          placeholder="Ex.: ombro direito incomodou no desenvolvimento…"
        />
        <p className="mt-1 text-[10px] text-white/35">
          {savingNote ? "Salvando…" : "Salvo automaticamente ao sair do campo."}
        </p>
      </Section>

      {/* 5. Exportar */}
      <Section title="Relatório do ciclo">
        <p className="mb-3 text-xs text-white/55">
          Gera o relatório completo (período, pesos, cargas iniciais e recentes, evolução por exercício e grupo,
          estagnados, anotações) em JSON e Markdown — com resumo final pronto para colar no ChatGPT e pedir um novo
          treino.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting || !plan}
          className="btn btn-primary flex w-full items-center justify-center gap-2"
        >
          <Icon name="download" size={17} />
          {exporting ? "Gerando…" : "Exportar evolução"}
        </button>
        {!plan && <p className="mt-2 text-xs text-white/45">Importe um treino primeiro.</p>}
        {exportMsg && <p className="mt-2 text-xs text-emerald-300">{exportMsg}</p>}
      </Section>

      {/* 6. Limpar dados de teste */}
      <Section title="Limpar dados">
        <p className="mb-3 text-xs text-white/55">
          Apaga todos os check-ins, cargas e pesos deste perfil, mas mantém o treino importado. Bom para zerar dados
          de teste sem precisar reimportar o JSON.
        </p>
        <button
          onClick={() => setConfirmClear(true)}
          className="btn btn-danger flex w-full items-center justify-center gap-2"
        >
          <Icon name="trash" size={16} />
          Limpar cargas e pesos
        </button>
      </Section>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Limpar dados do perfil">
        <p className="text-sm text-white/80">
          Isso apaga <strong>todos os treinos registrados, cargas e pesos</strong> de{" "}
          <strong>{profile.name}</strong>. O treino importado (Treinos A–E) é mantido. Não dá para desfazer.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmClear(false)} className="btn btn-ghost flex-1">
            Cancelar
          </button>
          <button onClick={clearData} disabled={clearing} className="btn btn-danger flex-1">
            {clearing ? "Limpando…" : "Limpar tudo"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
