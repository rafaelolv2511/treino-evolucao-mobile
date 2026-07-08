"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listFullHistoryAllProfiles, listProfiles } from "@/lib/db";
import { HistoryBundle, overallEvolutionPct, fmtPct } from "@/lib/calc";
import { ExerciseLogRow, ProfileRow, SetLogRow, WorkoutSessionRow } from "@/lib/types";
import { Spinner, TabBar } from "@/components/ui";
import Icon from "@/components/Icons";

type Period = "semana" | "mes" | "ano";
type Mode = "checkins" | "evolucao";

/** Início da semana atual (segunda-feira), em ISO local. */
function startOfWeekISO(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RankingPage() {
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [full, setFull] = useState<{ sessions: WorkoutSessionRow[]; logs: ExerciseLogRow[]; sets: SetLogRow[] }>({
    sessions: [],
    logs: [],
    sets: [],
  });
  const [period, setPeriod] = useState<Period>("semana");
  const [mode, setMode] = useState<Mode>("checkins");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, f] = await Promise.all([listProfiles(), listFullHistoryAllProfiles()]);
        setProfiles(p);
        setFull(f);
      } catch (e: any) {
        setError(e.message ?? "Falha ao carregar o ranking.");
      }
    })();
  }, []);

  const inPeriod = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const yearPrefix = `${now.getFullYear()}`;
    const weekStart = startOfWeekISO();
    return (date: string) => {
      if (period === "semana") return date >= weekStart;
      if (period === "mes") return date.startsWith(monthPrefix);
      return date.startsWith(yearPrefix);
    };
  }, [period]);

  const ranking = useMemo(() => {
    if (!profiles) return [];

    // Check-ins: conta sessões no período
    if (mode === "checkins") {
      const counts = new Map<string, number>();
      for (const s of full.sessions) {
        if (inPeriod(s.workout_date)) counts.set(s.profile_id, (counts.get(s.profile_id) ?? 0) + 1);
      }
      return profiles
        .map((p) => ({ profile: p, value: counts.get(p.id) ?? 0 }))
        .sort((a, b) => b.value - a.value || a.profile.name.localeCompare(b.profile.name));
    }

    // Evolução %: para cada perfil, monta o histórico do período e mede a evolução média
    const sessionsByProfile = new Map<string, WorkoutSessionRow[]>();
    for (const s of full.sessions) {
      if (!inPeriod(s.workout_date)) continue;
      const arr = sessionsByProfile.get(s.profile_id) ?? [];
      arr.push(s);
      sessionsByProfile.set(s.profile_id, arr);
    }

    return profiles
      .map((p) => {
        const sessions = sessionsByProfile.get(p.id) ?? [];
        const sessionIds = new Set(sessions.map((s) => s.id));
        const logs = full.logs.filter((l) => sessionIds.has(l.workout_session_id));
        const logIds = new Set(logs.map((l) => l.id));
        const sets = full.sets.filter((s) => logIds.has(s.exercise_log_id));
        const h: HistoryBundle = { sessions, logs, sets };
        const exIds = [...new Set(logs.map((l) => l.exercise_id))];
        const pct = overallEvolutionPct(exIds, h);
        return { profile: p, value: pct ?? -Infinity };
      })
      .sort((a, b) => b.value - a.value || a.profile.name.localeCompare(b.profile.name));
  }, [profiles, full, mode, inPeriod]);

  const label = period === "semana" ? "nesta semana" : period === "mes" ? "neste mês" : "neste ano";
  const MEDAL = ["text-amber-300", "text-slate-300", "text-orange-400"];

  return (
    <div className="fade-in">
      <header className="mb-5">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-white/50">
          <Icon name="arrowLeft" size={14} /> Perfis
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-amber-300">
            <Icon name="trophy" size={24} />
          </span>
          <h1 className="font-display text-2xl font-bold">Ranking</h1>
        </div>
        <p className="mt-1 text-xs text-white/55">
          {mode === "checkins"
            ? "Check-in = um dia de treino registrado no app."
            : "Evolução = ganho médio de carga dos exercícios no período."}
        </p>
      </header>

      <div className="mb-3">
        <TabBar
          tabs={[
            { key: "checkins" as const, label: "Check-ins" },
            { key: "evolucao" as const, label: "Evolução %" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      <TabBar
        tabs={[
          { key: "semana" as const, label: "Semana" },
          { key: "mes" as const, label: "Mês" },
          { key: "ano" as const, label: "Ano" },
        ]}
        value={period}
        onChange={setPeriod}
      />

      {error && <p className="glass mt-4 p-3 text-sm text-red-300">{error}</p>}

      {profiles === null ? (
        <Spinner label="Calculando ranking…" />
      ) : (
        <div className="mt-4 space-y-2.5">
          {ranking.map(({ profile, value }, i) => {
            const hasData = mode === "evolucao" ? value !== -Infinity : value > 0;
            return (
              <div
                key={profile.id}
                className={`glass flex items-center gap-3 p-3.5 ${i === 0 && hasData ? "glass-strong border-amber-300/40" : ""}`}
              >
                <span className={`font-display w-7 text-center text-lg font-bold ${MEDAL[i] ?? "text-white/35"}`}>
                  {i + 1}º
                </span>
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt="" className="h-11 w-11 rounded-2xl border border-white/15 object-cover" />
                ) : (
                  <span className="font-display flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold">
                    {profile.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{profile.name}</span>
                  <span className="block text-[11px] text-white/50">
                    {mode === "checkins"
                      ? value === 0
                        ? `sem treinos ${label}`
                        : `${value} check-in${value > 1 ? "s" : ""} ${label}`
                      : hasData
                        ? `ganho médio de carga ${label}`
                        : `sem dados suficientes ${label}`}
                  </span>
                </span>
                <span className={`num font-display text-2xl font-bold ${mode === "checkins" ? "text-glow" : "text-ok"}`}>
                  {mode === "checkins" ? value : hasData ? fmtPct(value) : "—"}
                </span>
              </div>
            );
          })}
          {ranking.length === 0 && <p className="glass p-4 text-sm text-white/60">Nenhum perfil criado ainda.</p>}
        </div>
      )}
    </div>
  );
}
