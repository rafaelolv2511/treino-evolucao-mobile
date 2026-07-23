"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { buildDemoHistory, DEMO_PLAN } from "@/lib/demoData";
import { bestLoadOfLog, evolutionForPlan, fmtKg, fmtPct, weeklySeriesForExercise } from "@/lib/calc";
import { Section, TabBar } from "@/components/ui";
import Icon from "@/components/Icons";
import ShareCard, { ShareStats } from "@/components/ShareCard";
import { instagramWorkoutTitle } from "@/lib/share";

const CHART_TOOLTIP = {
  contentStyle: {
    background: "rgba(10,14,22,0.95)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12,
    fontSize: 12,
  },
} as const;

const GROUP_COLORS = ["#44E2D9", "#44E2D9", "#44E2D9", "#FBBF24", "#F472B6", "#60A5FA"];

export default function DemoPage() {
  // Gera uma vez por carregamento (dados fictícios, nada é salvo)
  const { history, metrics } = useMemo(() => buildDemoHistory(8), []);
  const [granularity, setGranularity] = useState<"mes" | "ano">("mes");
  const [showShare, setShowShare] = useState(false);

  const evo = useMemo(() => evolutionForPlan(DEMO_PLAN, history), [history]);
  const allExercises = useMemo(() => DEMO_PLAN.sessions.flatMap((s) => s.exercises), []);
  const [selectedExercise, setSelectedExercise] = useState(allExercises[0].exerciseId);

  const periodOf = (date: string) => (granularity === "mes" ? date.slice(0, 7) : date.slice(0, 4));
  const loadByPeriod = useMemo(() => {
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
    const inner = loadByPeriod.get(selectedExercise);
    if (!inner) return [];
    return periods.map((p) => ({ periodo: p, carga: inner.get(p) ?? null }));
  }, [selectedExercise, loadByPeriod, periods]);

  const groupNames = useMemo(() => [...new Set(allExercises.map((e) => e.primaryMuscleGroup))], [allExercises]);
  const groupChart = useMemo(() => {
    const groupOf = new Map(allExercises.map((e) => [e.exerciseId, e.primaryMuscleGroup]));
    return periods.map((p) => {
      const row: Record<string, string | number | null> = { periodo: p };
      for (const g of groupNames) {
        const vals: number[] = [];
        loadByPeriod.forEach((inner, exId) => {
          if (groupOf.get(exId) === g && inner.has(p)) vals.push(inner.get(p)!);
        });
        row[g] = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
      }
      return row;
    });
  }, [allExercises, groupNames, loadByPeriod, periods]);

  const weekChart = useMemo(() => {
    const weekly = weeklySeriesForExercise(selectedExercise, history);
    return weekly.map((w) => ({ semana: `S${w.week}`, carga: w.loadKg, mantida: w.inherited }));
  }, [selectedExercise, history]);

  const bodyChart = metrics.map((m) => ({ data: m.date.slice(5), kg: Number(m.weight_kg) }));
  const demoShareStats: ShareStats = {
    appName: "RTrainning",
    profileName: "Rafael Demo",
    sessionName: "Peito e tríceps",
    workoutTitle: instagramWorkoutTitle({
      sessionName: "Treino A",
      focus: "Peito e tríceps",
      muscleGroups: ["Peito", "Tríceps"],
    }),
    planName: DEMO_PLAN.planName,
    dateLabel: history.sessions[history.sessions.length - 1].workout_date.split("-").reverse().join("/"),
    exercisesDone: 6,
    exercisesTotal: 7,
    improved: 3,
    prs: 2,
    avgIncreasePct: 6.4,
    weeklyDone: 3,
    weeklyTarget: 5,
    durationSeconds: 52 * 60 + 18,
    caloriesEstimate: 386,
    loads: [
      { name: "Supino reto", load: 72.5 },
      { name: "Supino inclinado", load: 28 },
      { name: "Crossover", load: 22 },
      { name: "Tríceps corda", load: 31 },
      { name: "Paralelas", load: 18 },
    ],
    // Agregados determinísticos para a vitrine (não tocam no banco real).
    day: {
      volumeKg: 12480,
      series: 22,
      splitMuscular: [
        { grupo: "Peito", pct: 50 },
        { grupo: "Ombro", pct: 30 },
        { grupo: "Tríceps", pct: 20 },
      ],
      exerciseNames: [
        { name: "Supino reto", sets: 4, reps: "8" },
        { name: "Supino inclinado", sets: 3, reps: "10" },
        { name: "Crossover", sets: 3, reps: "12" },
        { name: "Tríceps corda", sets: 4, reps: "12" },
        { name: "Paralelas", sets: 3, reps: "10" },
      ],
    },
    week: {
      semanaNum: 42,
      diasCheck: ["treino", "descanso", "treino", "treino", "descanso", "hoje", "descanso"],
      volumePorDia: [9800, 0, 11200, 10400, 0, 12480, 0],
      volumeKg: 43880,
      horas: 4.9,
      kcal: 3240,
      prs: 3,
      streakSemanas: 8,
      letrasTreino: ["A", "B", "C", "D"],
    },
    month: {
      mes: "Outubro",
      diasNoMes: 31,
      volumeKg: 52400,
      treinos: 16,
      prs: 5,
      prNomes: ["Agachamento", "Supino reto", "Levantamento terra", "Desenvolvimento", "Remada curvada"],
      consistenciaPct: 80,
      evolucaoCargaPct: 14,
      evolucaoPorLift: [
        { nome: "Agachamento", pct: 18 },
        { nome: "Supino reto", pct: 12 },
        { nome: "Levantamento terra", pct: 9 },
        { nome: "Desenvolvimento", pct: 7 },
        { nome: "Remada curvada", pct: 5 },
      ],
      volumePorSemana: [11800, 13200, 12600, 14800, 0],
      calendario: Array.from({ length: 31 }, (_, i) => [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28, 29, 30, 1].includes(i)),
      streakSemanas: 8,
    },
    bodyWeight: {
      serie: Array.from({ length: 31 }, (_, index) => 78.4 - index * 0.043),
      atual: 77.1,
      inicial: 78.4,
      delta: -1.3,
    },
  };

  return (
    <div className="fade-in space-y-4">
      <header className="mb-2">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-white/50">
          <Icon name="arrowLeft" size={14} /> Voltar
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-glow">
            <Icon name="chart" size={22} />
          </span>
          <h1 className="font-display text-2xl font-bold">Demonstração</h1>
        </div>
        <p className="mt-1 text-xs text-white/55">
          8 semanas de treino simulado para você ver tudo funcionando. Estes dados são fictícios e não afetam nenhum
          perfil.
        </p>
      </header>

      {/* Destaques */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass p-3 text-center">
          <p className="num font-display text-xl font-bold text-glow">{history.sessions.length}</p>
          <p className="text-[10px] text-white/55">treinos</p>
        </div>
        <div className="glass p-3 text-center">
          <p className="num font-display text-xl font-bold text-aqua">{fmtPct(evo.overallPct)}</p>
          <p className="text-[10px] text-white/55">carga geral</p>
        </div>
        <div className="glass p-3 text-center">
          <p className="num font-display text-xl font-bold text-viol">8</p>
          <p className="text-[10px] text-white/55">semanas</p>
        </div>
      </div>

      {/* Peso corporal */}
      <Section title="Peso corporal">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bodyChart}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="data" tick={{ fill: "#8a93a6", fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
              <Tooltip {...CHART_TOOLTIP} />
              <Line type="monotone" dataKey="kg" stroke="#44E2D9" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Evolução por exercício */}
      <Section
        title="Evolução por exercício"
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
        <select
          className="field !min-h-[44px] text-sm"
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
        >
          {allExercises.map((e) => (
            <option key={e.exerciseId} value={e.exerciseId} className="bg-ink">
              {e.name}
            </option>
          ))}
        </select>
        <div className="mt-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={exerciseChart}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="periodo" tick={{ fill: "#8a93a6", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
              <Tooltip {...CHART_TOOLTIP} />
              <Line type="monotone" dataKey="carga" name="carga (kg)" stroke="#44E2D9" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Faixa semanal (o coração do app) */}
        <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-white/50">Cargas por semana</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weekChart.map((w) => (
            <div key={w.semana} className={`week-pill ${w.mantida ? "inherited" : ""}`}>
              <p className="text-[10px] font-bold text-white/50">{w.semana}</p>
              <p className="num text-sm font-semibold">{w.carga !== null ? fmtKg(w.carga) : "—"}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Por grupo muscular */}
      <Section title="Evolução por grupo muscular">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={groupChart}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="periodo" tick={{ fill: "#8a93a6", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
              <Tooltip {...CHART_TOOLTIP} />
              {groupNames.map((g, i) => (
                <Line key={g} type="monotone" dataKey={g} stroke={GROUP_COLORS[i % GROUP_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
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
      </Section>

      {/* Força */}
      <Section title="Força — % por grupo">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evo.groups.filter((g) => g.evolutionPct !== null).map((g) => ({ grupo: g.muscleGroup, pct: Number(g.evolutionPct!.toFixed(1)) }))}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="grupo" tick={{ fill: "#8a93a6", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8a93a6", fontSize: 10 }} width={34} />
              <Tooltip {...CHART_TOOLTIP} />
              <Bar dataKey="pct" name="evolução %" fill="#44E2D9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 space-y-1.5">
          {evo.groups.map((g) => (
            <div key={g.muscleGroup} className="flex items-center justify-between text-sm">
              <span className="text-white/75">{g.muscleGroup}</span>
              <span className={`num font-bold ${(g.evolutionPct ?? 0) > 0 ? "text-aqua" : "text-white/50"}`}>
                {fmtPct(g.evolutionPct)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Compartilhamento">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Story e overlay transparente</p>
            <p className="mt-1 text-xs text-white/50">16 artes de dia, semana e mês, em card ou overlay transparente.</p>
          </div>
          <button onClick={() => setShowShare(true)} className="btn btn-primary shrink-0 !px-4">
            <Icon name="share" size={16} /> Ver
          </button>
        </div>
      </Section>

      <Link href="/" className="btn btn-primary flex w-full items-center justify-center gap-2">
        <Icon name="dumbbell" size={17} /> Criar meu perfil e começar
      </Link>
      <p className="pb-4 text-center text-[11px] text-white/40">
        Feito com dados de exemplo. No app real, tudo isso vem dos seus próprios treinos.
      </p>
      {showShare && <ShareCard stats={demoShareStats} onClose={() => setShowShare(false)} />}
    </div>
  );
}
