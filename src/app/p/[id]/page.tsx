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
import WorkoutTimerBar from "@/components/WorkoutTimerBar";
import { ProfileRow, TrainingPlanRow } from "@/lib/types";
import { Spinner } from "@/components/ui";
import Icon from "@/components/Icons";
import TreinosView from "@/components/TreinosView";
import EvolucaoView from "@/components/EvolucaoView";

export default function ProfilePage({ params }: { params: { id: string } }) {
  const profileId = params.id;
  const [tab, setTab] = useState<"treinos" | "evolucao">("treinos");
  // Navegação pedida pela barra do treino em andamento: abre a sessão e, opcionalmente, o passo de conclusão.
  const [sessionNav, setSessionNav] = useState<{ key: string; seq: number; conclude: boolean } | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [plan, setPlan] = useState<TrainingPlanRow | null>(null);
  const [history, setHistory] = useState<HistoryBundle>({ sessions: [], logs: [], sets: [] });
  const [fullHistory, setFullHistory] = useState<HistoryBundle>({ sessions: [], logs: [], sets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    try {
      // 1) Carrega o perfil primeiro. Só isso decide "encontrado ou não".
      //    Uma tentativa extra tolera falha momentânea de rede (sinal fraco).
      let p = await getProfile(profileId).catch(() => undefined);
      if (p === undefined) {
        await new Promise((r) => setTimeout(r, 600));
        p = await getProfile(profileId);
      }
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(p);
      setNotFound(false);
      setLoading(false); // já pode mostrar a tela do perfil

      // 2) Dados secundários: qualquer falha aqui NÃO derruba a tela do perfil.
      try {
        const pl = await getActivePlan(profileId);
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
      } catch (inner: any) {
        // Perfil abre normalmente; só avisa que os dados de treino falharam.
        setError("Não foi possível carregar os treinos agora. Puxe para atualizar.");
      }
    } catch (e: any) {
      setError(e.message ?? "Falha ao carregar o perfil.");
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runningSession =
    history.sessions
      .filter((item) => item.started_at && !item.completed_at)
      .sort((a, b) => (b.started_at! < a.started_at! ? -1 : 1))[0] ?? null;
  const runningName = runningSession
    ? plan?.source_json.sessions.find((item) => item.sessionKey === runningSession.session_key)?.sessionName ??
      `Sessão ${runningSession.session_key}`
    : null;

  if (loading) return <Spinner label="Abrindo perfil…" />;
  if (notFound || !profile)
    return (
      <div className="glass fade-in p-6 text-center">
        <p className="text-white/70">Perfil não encontrado.</p>
        <p className="mt-1 text-xs text-white/45">
          Ele pode ter sido removido, ou o link está desatualizado.
        </p>
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
            tab === "treinos" ? "bg-white/10 text-glow" : "text-white/55"
          }`}
        >
          <Icon name="dumbbell" size={17} /> Treinos
        </button>
        <button
          onClick={() => setTab("evolucao")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition ${
            tab === "evolucao" ? "bg-white/10 text-glow" : "text-white/55"
          }`}
        >
          <Icon name="chart" size={17} /> Evolução
        </button>
      </div>

      {error && <p className="glass mb-4 p-3 text-sm text-red-300">{error}</p>}

      {tab === "treinos" ? (
        <TreinosView
          profile={profile}
          plan={plan}
          history={history}
          fullHistory={fullHistory}
          onChanged={refresh}
          nav={sessionNav}
        />
      ) : (
        <EvolucaoView profile={profile} plan={plan} history={history} fullHistory={fullHistory} onChanged={refresh} />
      )}

      {runningSession && <div className="h-20" aria-hidden="true" />}

      {runningSession && runningName && (
        <WorkoutTimerBar
          session={runningSession}
          sessionName={runningName}
          onOpen={() => {
            setTab("treinos");
            setSessionNav({ key: runningSession.session_key, seq: Date.now(), conclude: false });
          }}
          onFinish={() => {
            setTab("treinos");
            setSessionNav({ key: runningSession.session_key, seq: Date.now(), conclude: true });
          }}
        />
      )}
    </div>
  );
}
