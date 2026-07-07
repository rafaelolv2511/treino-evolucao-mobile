"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createProfile, deleteProfile, listProfiles, MAX_PROFILES } from "@/lib/db";
import { ProfileRow } from "@/lib/types";
import { Modal, Spinner } from "@/components/ui";

const PALETTE = [
  "from-cyan-400/25 to-violet-500/25",
  "from-violet-400/25 to-fuchsia-500/25",
  "from-emerald-400/25 to-cyan-500/25",
  "from-amber-400/25 to-rose-500/25",
  "from-sky-400/25 to-indigo-500/25",
  "from-rose-400/25 to-violet-500/25",
  "from-teal-400/25 to-sky-500/25",
  "from-indigo-400/25 to-cyan-500/25",
];

export default function HomePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ProfileRow | null>(null);

  async function load() {
    try {
      setProfiles(await listProfiles());
    } catch (e: any) {
      setError(e.message ?? "Falha ao carregar perfis.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const p = await createProfile(newName);
      setCreating(false);
      setNewName("");
      router.push(`/p/${p.id}`);
    } catch (e: any) {
      setError(e.message ?? "Não foi possível criar o perfil.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteProfile(removing.id);
      setRemoving(null);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Não foi possível remover o perfil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <header className="mb-8 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-glow/80">Treino Evolução</p>
        <h1 className="font-display mt-2 text-3xl font-bold leading-tight">
          Quem vai treinar<br />hoje?
        </h1>
      </header>

      {error && <p className="glass mb-4 border-red-400/30 p-3 text-sm text-red-300">{error}</p>}

      {profiles === null ? (
        <Spinner label="Carregando perfis…" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {profiles.map((p, i) => (
            <div key={p.id} className="relative">
              <button
                onClick={() => router.push(`/p/${p.id}`)}
                className={`glass w-full bg-gradient-to-br p-4 text-left transition active:scale-[0.97] ${PALETTE[i % PALETTE.length]}`}
              >
                <span className="font-display block text-2xl font-bold">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="mt-4 block truncate text-sm font-semibold">{p.name}</span>
                <span className="mt-1 block text-[11px] text-white/50">Abrir treino →</span>
              </button>
              <button
                onClick={() => setRemoving(p)}
                aria-label={`Remover perfil ${p.name}`}
                className="absolute right-2 top-2 rounded-full bg-black/30 px-2 py-0.5 text-xs text-white/60"
              >
                ✕
              </button>
            </div>
          ))}

          {profiles.length < MAX_PROFILES && (
            <button
              onClick={() => setCreating(true)}
              className="glass flex min-h-[128px] flex-col items-center justify-center gap-1 border-dashed p-4 text-white/60 transition active:scale-[0.97]"
            >
              <span className="text-3xl leading-none text-glow">＋</span>
              <span className="text-sm font-semibold">Novo perfil</span>
              <span className="text-[11px]">{profiles.length}/{MAX_PROFILES}</span>
            </button>
          )}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Novo perfil">
        <label className="mb-1 block text-sm text-white/70">Nome do perfil</label>
        <input
          className="field"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ex.: Rafael"
          maxLength={40}
          autoFocus
        />
        <button onClick={handleCreate} disabled={busy || !newName.trim()} className="btn btn-primary mt-4 w-full">
          {busy ? "Criando…" : "Criar perfil"}
        </button>
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remover perfil">
        <p className="text-sm text-white/80">
          Remover <strong>{removing?.name}</strong> apaga o treino, os registros de carga, o peso corporal e as
          observações desse perfil. Essa ação não pode ser desfeita.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setRemoving(null)} className="btn btn-ghost flex-1">
            Cancelar
          </button>
          <button onClick={handleRemove} disabled={busy} className="btn btn-danger flex-1">
            {busy ? "Removendo…" : "Remover"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
