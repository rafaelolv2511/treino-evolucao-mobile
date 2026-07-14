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
import TreinosView from "@/components/TreinosView";
import EvolucaoView from "@/components/EvolucaoView";

export default function ProfileClient({ profileId }: { profileId: string }) {
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

      const allSessions = await listWorkoutSessions(profileId);
      const allLogs = await listExerciseLogsForSessions(allSessions.map((s) => s.id));
      const allSets = await listSetLogsForExerciseLogs(allLogs.map((l) => l.id));
      setFullHistory({ sessions: allSessions, logs: allLogs, sets: allSets });

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
        <Link href="/" className="btn btn-ghost mt-4">
          ← Voltar aos perfis
        </Link>
      </div>
    );

  return (
    <div className="fade-in">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-white/50">
            ← Perfis
          </Link>
          <h1 className="font-display text-2xl font-bold">{profile.name}</h1>
        </div>
        {plan && (
          <span className="glass max-w-[45%] truncate px-3 py-1.5 text-xs text-white/70">{plan.plan_name}</span>
        )}
      </header>

      {error && <p className="glass mb-4 p-3 text-sm text-red-300">{error}</p>}

      {tab === "treinos" ? (
        <TreinosView profile={profile} plan={plan} history={history} fullHistory={fullHistory} onChanged={refresh} />
      ) : (
        <EvolucaoView profile={profile} plan={plan} history={history} fullHistory={fullHistory} onChanged={refresh} />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-4">
        <div className="glass glass-strong flex gap-1 p-1.5">
          <button
            onClick={() => setTab("treinos")}
            className={`flex-1 rounded-2xl py-3 text-sm font-bold transition ${
              tab === "treinos" ? "bg-white/12 text-glow" : "text-white/55"
            }`}
          >
            🏋️ Treinos
          </button>
          <button
            onClick={() => setTab("evolucao")}
            className={`flex-1 rounded-2xl py-3 text-sm font-bold transition ${
              tab === "evolucao" ? "bg-white/12 text-glow" : "text-white/55"
            }`}
          >
            📈 Evolução
          </button>
        </div>
      </nav>
    </div>
  );
}
