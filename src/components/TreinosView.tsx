"use client";

import { useState } from "react";
import { HistoryBundle } from "@/lib/calc";
import { ProfileRow, TrainingPlanRow } from "@/lib/types";
import ImportPlan from "./ImportPlan";
import SessionView from "./SessionView";
import PlanEditor from "./PlanEditor";

export default function TreinosView({
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
  const [importOpen, setImportOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  if (!plan) {
    return (
      <div className="glass fade-in p-6 text-center">
        <p className="font-display text-lg font-bold">Sem treino carregado</p>
        <p className="mt-2 text-sm text-white/60">
          Importe o JSON do seu treino uma única vez. Ele fica salvo neste perfil.
        </p>
        <button onClick={() => setImportOpen(true)} className="btn btn-primary mt-5 w-full">
          Importar JSON do treino
        </button>
        <ImportPlan
          open={importOpen}
          onClose={() => setImportOpen(false)}
          profile={profile}
          currentPlan={null}
          history={history}
          onImported={onChanged}
        />
      </div>
    );
  }

  const session = sessionKey ? plan.source_json.sessions.find((s) => s.sessionKey === sessionKey) : null;

  if (session) {
    return (
      <SessionView
        key={session.sessionKey}
        profile={profile}
        plan={plan}
        session={session}
        history={history}
        onBack={() => setSessionKey(null)}
        onChanged={onChanged}
      />
    );
  }

  return (
    <div className="fade-in space-y-3">
      {plan.source_json.sessions.map((s) => {
        const done = history.sessions.filter((ws) => ws.session_key === s.sessionKey).length;
        return (
          <button
            key={s.sessionKey}
            onClick={() => setSessionKey(s.sessionKey)}
            className="glass flex w-full items-center gap-4 p-4 text-left transition active:scale-[0.98]"
          >
            <span className="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-glow/20 to-viol/20 text-xl font-bold text-glow">
              {s.sessionKey}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{s.sessionName}</span>
              <span className="block truncate text-xs text-white/55">
                {s.focus ?? `${s.exercises.length} exercícios`}
              </span>
            </span>
            <span className="text-right text-[11px] text-white/45">
              {s.exercises.length} exerc.
              <br />
              {done > 0 ? `${done} treinos` : "novo"}
            </span>
          </button>
        );
      })}

      <div className="flex gap-2 pt-2">
        <button onClick={() => setEditorOpen(true)} className="btn btn-ghost flex-1">
          ✏️ Editar treino
        </button>
        <button onClick={() => setImportOpen(true)} className="btn btn-ghost flex-1">
          📄 Novo JSON
        </button>
      </div>

      <ImportPlan
        open={importOpen}
        onClose={() => setImportOpen(false)}
        profile={profile}
        currentPlan={plan}
        history={history}
        onImported={onChanged}
      />
      <PlanEditor open={editorOpen} onClose={() => setEditorOpen(false)} plan={plan} onSaved={onChanged} />
    </div>
  );
}
