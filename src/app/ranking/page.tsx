"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listProfiles, listSessionsAllProfiles } from "@/lib/db";
import { ProfileRow } from "@/lib/types";
import { Spinner, TabBar } from "@/components/ui";
import Icon from "@/components/Icons";

type Period = "semana" | "mes" | "ano";

/** Início da semana atual (segunda-feira), em ISO local. */
function startOfWeekISO(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RankingPage() {
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [sessions, setSessions] = useState<{ profile_id: string; workout_date: string }[]>([]);
  const [period, setPeriod] = useState<Period>("semana");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([listProfiles(), listSessionsAllProfiles()]);
        setProfiles(p);
        setSessions(s);
      } catch (e: any) {
        setError(e.message ?? "Falha ao carregar o ranking.");
      }
    })();
  }, []);

  const ranking = useMemo(() => {
    if (!profiles) return [];
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const yearPrefix = `${now.getFullYear()}`;
    const weekStart = startOfWeekISO();

    const inPeriod = (date: string) => {
      if (period === "semana") return date >= weekStart;
      if (period === "mes") return date.startsWith(monthPrefix);
      return date.startsWith(yearPrefix);
    };

    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (inPeriod(s.workout_date)) counts.set(s.profile_id, (counts.get(s.profile_id) ?? 0) + 1);
    }

    return profiles
      .map((p) => ({ profile: p, checkins: counts.get(p.id) ?? 0 }))
      .sort((a, b) => b.checkins - a.checkins || a.profile.name.localeCompare(b.profile.name));
  }, [profiles, sessions, period]);

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
        <p className="mt-1 text-xs text-white/55">Check-in = um dia de treino registrado no app.</p>
      </header>

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
          {ranking.map(({ profile, checkins }, i) => (
            <div
              key={profile.id}
              className={`glass flex items-center gap-3 p-3.5 ${i === 0 && checkins > 0 ? "border-amber-300/40 glass-strong" : ""}`}
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
                  {checkins === 0 ? `sem treinos ${label}` : `${checkins} check-in${checkins > 1 ? "s" : ""} ${label}`}
                </span>
              </span>
              <span className="num font-display text-2xl font-bold text-glow">{checkins}</span>
            </div>
          ))}
          {ranking.length === 0 && <p className="glass p-4 text-sm text-white/60">Nenhum perfil criado ainda.</p>}
        </div>
      )}
    </div>
  );
}
