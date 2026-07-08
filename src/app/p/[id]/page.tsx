"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getActivePlan,
  getProfile,
  listExerciseLogsForSessions,
  listSetLogsForExerciseLogs,
  listWorkoutSessions,
} from "@/lib/db";
import { HistoryBundle } from "@/lib/calc";
import { ProfileRow, TrainingPlanRow } from "@/lib/types";
import { Spinner } from "@/components/ui";
import Icon from "@/components/Icons";
import TreinosView from "@/components/TreinosView";
import EvolucaoView from "@/components/EvolucaoView";

export default function ProfilePage({ params }: { params: { id: string } }) {
  const profileId = params.id;
  const [tab, setTab] = useState<"treinos" | "evolucao">("treinos");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [plan, setPlan] = useState<TrainingPlanRow | null>(null);
  const [history, setHistory] = useState<HistoryBundle>({ sessions: [], logs: [], sets: [] });
  const [fullHistory, setFullHistory] = useState<HistoryBundle>({ sessions: [], logs: [], sets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, pl] = await Promise.all([getProfile(profileId), getActivePlan(profileId)]);
      setProfile(p);
      setPlan(pl);

      // Histórico COMPLETO do perfil (todos os planos) — alimenta os gráficos de
      // evolução, que devem persistir mesmo depois de trocar de treino.
      const allSessions = await listWorkoutSessions(profileId);
      const allLogs = await listExerciseLogsForSessions(allSessions.map((s) => s.id));
      const allSets = await listSetLogsForExerciseLogs(allLogs.map((l) => l.id));
      setFullHistory({ sessions: allSessions, logs: allLogs, sets: allSets });

      // Histórico do plano ATIVO — usado na aba Treinos, onde as semanas S1..Sn
      // e as pílulas semanais são relativas ao ciclo atual.
      if (pl) {
        const sessions = allSessions.filter((s) => s.training_plan_id === pl.id);
        const sessionIds = new Set(sessions.map((s) => s.id));
        const logs = allLogs.filter((l) => sessionIds.has(l.workout_session_id));
        const logIds = new Set(logs.map((l) => l.id));
        const sets = allSets.filter((s) => logIds.has(s.exercise_log_id));
        setHistory({ sessions, logs, sets });
      } else {
        setHistory({ sessions: [], logs: [], sets: [] });
      }
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Falha ao carregar dados do perfil.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) return <Spinner label="Abrindo perfil…" />;
  if (!profile)
    return (
      <div className="glass fade-in p-6 text-center">
        <p className="text-white/70">Perfil não encontrado.</p>
        <Link href="/" className="btn btn-ghost mt-4 inline-flex items-center gap-2">
          <Icon name="arrowLeft" size={15} /> Voltar aos perfis
        </Link>
      </div>
    );

  return (
    <div className="fade-in">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-white/50">
            <Icon name="arrowLeft" size={14} /> Perfis
          </Link>
          <h1 className="font-display text-2xl font-bold">{profile.name}</h1>
        </div>
        {plan && (
          <span className="glass max-w-[45%] truncate px-3 py-1.5 text-xs text-white/70">{plan.plan_name}</span>
        )}
      </header>

      <div className="glass mb-4 flex gap-1 p-1.5">
        <button
          onClick={() => setTab("treinos")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition ${
            tab === "treinos" ? "bg-white/12 text-glow" : "text-white/55"
          }`}
        >
          <Icon name="dumbbell" size={17} /> Treinos
        </button>
        <button
          onClick={() => setTab("evolucao")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition ${
            tab === "evolucao" ? "bg-white/12 text-glow" : "text-white/55"
          }`}
        >
          <Icon name="chart" size={17} /> Evolução
        </button>
      </div>

      {error && <p className="glass mb-4 p-3 text-sm text-red-300">{error}</p>}

      {tab === "treinos" ? (
        <TreinosView profile={profile} plan={plan} history={history} onChanged={refresh} />
      ) : (
        <EvolucaoView profile={profile} plan={plan} history={history} fullHistory={fullHistory} onChanged={refresh} />
      )}
    </div>
  );
}
