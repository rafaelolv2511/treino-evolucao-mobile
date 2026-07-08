"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProfile, deleteProfile, listProfiles, MAX_PROFILES, updateProfileAvatar } from "@/lib/db";
import { ProfileRow } from "@/lib/types";
import { Modal, Spinner } from "@/components/ui";
import Icon from "@/components/Icons";

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

/** Redimensiona a imagem escolhida para um quadrado pequeno em data URL. */
async function fileToAvatar(file: File, size = 160): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const min = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - min) / 2;
  const sy = (bitmap.height - min) / 2;
  ctx.drawImage(bitmap, sx, sy, min, min, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function HomePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ProfileRow | null>(null);
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  function pickPhoto(profileId: string) {
    setPhotoFor(profileId);
    fileRef.current?.click();
  }

  async function handlePhoto(file: File) {
    if (!photoFor) return;
    setBusy(true);
    try {
      const avatar = await fileToAvatar(file);
      await updateProfileAvatar(photoFor, avatar);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Não foi possível salvar a foto.");
    } finally {
      setBusy(false);
      setPhotoFor(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="fade-in">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
      />

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
        <>
          <div className="grid grid-cols-2 gap-3">
            {profiles.map((p, i) => (
              <div key={p.id} className="relative">
                <button
                  onClick={() => router.push(`/p/${p.id}`)}
                  className={`glass w-full bg-gradient-to-br p-4 text-left transition active:scale-[0.97] ${PALETTE[i % PALETTE.length]}`}
                >
                  {p.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatar}
                      alt=""
                      className="h-12 w-12 rounded-2xl border border-white/20 object-cover"
                    />
                  ) : (
                    <span className="font-display flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold">
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="mt-3 block truncate text-sm font-semibold">{p.name}</span>
                  <span className="mt-0.5 block text-[11px] text-white/50">Abrir treino</span>
                </button>
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    onClick={() => pickPhoto(p.id)}
                    aria-label={`Foto do perfil ${p.name}`}
                    className="rounded-full bg-black/35 p-1.5 text-white/60"
                  >
                    <Icon name="camera" size={13} />
                  </button>
                  <button
                    onClick={() => setRemoving(p)}
                    aria-label={`Remover perfil ${p.name}`}
                    className="rounded-full bg-black/35 p-1.5 text-white/60"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              </div>
            ))}

            {profiles.length < MAX_PROFILES && (
              <button
                onClick={() => setCreating(true)}
                className="glass flex min-h-[132px] flex-col items-center justify-center gap-1.5 border-dashed p-4 text-white/60 transition active:scale-[0.97]"
              >
                <Icon name="plus" size={26} className="text-glow" />
                <span className="text-sm font-semibold">Novo perfil</span>
                <span className="text-[11px]">{profiles.length}/{MAX_PROFILES}</span>
              </button>
            )}
          </div>

          <Link
            href="/ranking"
            className="glass mt-4 flex w-full items-center gap-3 p-4 transition active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-rose-500/25 text-amber-300">
              <Icon name="trophy" size={20} />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Ranking de check-ins</span>
              <span className="block text-xs text-white/55">Quem mais treinou na semana, no mês e no ano</span>
            </span>
            <Icon name="chevronDown" size={16} className="-rotate-90 text-white/40" />
          </Link>

          <Link
            href="/demo"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-white/70 transition active:scale-[0.98]"
          >
            <Icon name="chart" size={15} className="text-glow" />
            Ver demonstração (2 meses de exemplo)
          </Link>
        </>
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
