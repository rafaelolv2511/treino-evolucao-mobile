"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listFullHistoryAllProfiles, listGroups, listProfiles } from "@/lib/db";
import { HistoryBundle, evolutionPctInPeriod, fmtPct } from "@/lib/calc";
import { ExerciseLogRow, ProfileGroupRow, ProfileRow, SetLogRow, WorkoutSessionRow } from "@/lib/types";
import { profileIsInGroup } from "@/lib/groups";
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
  const [groups, setGroups] = useState<ProfileGroupRow[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("todos");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, f, g] = await Promise.all([listProfiles(), listFullHistoryAllProfiles(), listGroups()]);
        setProfiles(p);
        setFull(f);
        setGroups(g);
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

    // Check-ins: apenas treinos CONCLUÍDOS, no máximo 1 por dia (datas distintas)
    const scoped = groupFilter === "todos" ? profiles : profiles.filter((p) => profileIsInGroup(p, groupFilter));
    if (mode === "checkins") {
      const daysByProfile = new Map<string, Set<string>>();
      for (const s of full.sessions) {
        if (!s.completed_at) continue;
        if (!inPeriod(s.workout_date)) continue;
        const set = daysByProfile.get(s.profile_id) ?? new Set<string>();
        set.add(s.workout_date);
        daysByProfile.set(s.profile_id, set);
      }
      return scoped
        .map((p) => ({ profile: p, value: daysByProfile.get(p.id)?.size ?? 0 }))
        .sort((a, b) => b.value - a.value || a.profile.name.localeCompare(b.profile.name));
    }

    // Evolução %: compara a carga do período com a carga anterior a ele.
    return scoped
      .map((p) => {
        // Histórico COMPLETO do perfil: o baseline precisa enxergar o que veio
        // antes do período (senão a semana atual nunca tem com o que comparar).
        const sessions = full.sessions.filter((s) => s.profile_id === p.id);
        const sessionIds = new Set(sessions.map((s) => s.id));
        const logs = full.logs.filter((l) => sessionIds.has(l.workout_session_id));
        const logIds = new Set(logs.map((l) => l.id));
        const sets = full.sets.filter((s) => logIds.has(s.exercise_log_id));
        const h: HistoryBundle = { sessions, logs, sets };
        const pct = evolutionPctInPeriod(h, inPeriod);
        return { profile: p, value: pct ?? -Infinity };
      })
      .sort((a, b) => b.value - a.value || a.profile.name.localeCompare(b.profile.name));
  }, [profiles, full, mode, inPeriod, groupFilter]);

  const label = period === "semana" ? "nesta semana" : period === "mes" ? "neste mês" : "neste ano";
  const MEDAL = ["text-fire", "text-slate-300", "text-orange-400"];

  return (
    <div className="fade-in">
      <header className="mb-5">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-white/50">
          <Icon name="arrowLeft" size={14} /> Perfis
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-fire">
            <Icon name="trophy" size={24} />
          </span>
          <h1 className="font-display text-2xl font-bold">Ranking</h1>
        </div>
        <p className="mt-1 text-xs text-white/55">
          {mode === "checkins"
            ? "Check-in = um dia com treino concluído (mín. 40% dos exercícios). Vale 1 por dia."
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

      {groups.length > 0 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setGroupFilter("todos")}
            className={`shrink-0 rounded-2xl border px-3 py-1.5 text-xs font-semibold ${
              groupFilter === "todos" ? "border-glow/60 bg-glow/15 text-glow" : "border-white/10 bg-white/5 text-white/55"
            }`}
          >
            Todos
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupFilter(g.id)}
              className={`shrink-0 rounded-2xl border px-3 py-1.5 text-xs font-semibold ${
                groupFilter === g.id ? "border-glow/60 bg-glow/15 text-glow" : "border-white/10 bg-white/5 text-white/55"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

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
                className={`glass flex items-center gap-3 p-3.5 ${i === 0 && hasData ? "glass-strong border-fire/40" : ""}`}
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
                <span className={`num font-display text-2xl font-bold ${mode === "checkins" ? "text-glow" : "text-aqua"}`}>
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
