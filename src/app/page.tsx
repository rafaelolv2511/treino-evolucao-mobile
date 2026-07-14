"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createGroup,
  createProfile,
  deleteGroup,
  deleteProfile,
  hashPin,
  listGroups,
  listProfiles,
  MAX_PROFILES,
  setProfileGroup,
  setProfilePin,
  updateProfileAvatar,
} from "@/lib/db";
import { ProfileGroupRow, ProfileRow } from "@/lib/types";
import { Modal, Spinner } from "@/components/ui";
import Icon from "@/components/Icons";
import Brand from "@/components/Brand";

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
  const [groups, setGroups] = useState<ProfileGroupRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState<string>("");
  const [newPin, setNewPin] = useState("");

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  const [removing, setRemoving] = useState<ProfileRow | null>(null);
  const [configFor, setConfigFor] = useState<ProfileRow | null>(null);
  const [cfgGroupId, setCfgGroupId] = useState<string>("");
  const [cfgPin, setCfgPin] = useState("");

  const [pinFor, setPinFor] = useState<ProfileRow | null>(null);
  const [pinTry, setPinTry] = useState("");
  const [pinError, setPinError] = useState(false);

  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [p, g] = await Promise.all([listProfiles(), listGroups()]);
      setProfiles(p);
      setGroups(g);
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
      if (newGroupId) await setProfileGroup(p.id, newGroupId);
      if (newPin.trim()) await setProfilePin(p.id, newPin);
      setCreating(false);
      setNewName("");
      setNewPin("");
      setNewGroupId("");
      router.push(`/p/${p.id}`);
    } catch (e: any) {
      setError(e.message ?? "Não foi possível criar o perfil.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) return;
    setBusy(true);
    try {
      await createGroup(groupName);
      setGroupName("");
      setCreatingGroup(false);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Não foi possível criar o grupo.");
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

  async function saveConfig() {
    if (!configFor) return;
    setBusy(true);
    try {
      await setProfileGroup(configFor.id, cfgGroupId || null);
      if (cfgPin.trim()) await setProfilePin(configFor.id, cfgPin);
      setConfigFor(null);
      setCfgPin("");
      await load();
    } catch (e: any) {
      setError(e.message ?? "Não foi possível salvar as configurações.");
    } finally {
      setBusy(false);
    }
  }

  async function removePin() {
    if (!configFor) return;
    setBusy(true);
    try {
      await setProfilePin(configFor.id, null);
      setConfigFor(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function openProfile(p: ProfileRow) {
    if (p.pin_hash) {
      setPinFor(p);
      setPinTry("");
      setPinError(false);
      return;
    }
    router.push(`/p/${p.id}`);
  }

  async function confirmPin() {
    if (!pinFor) return;
    const h = await hashPin(pinTry);
    if (h === pinFor.pin_hash) {
      const id = pinFor.id;
      setPinFor(null);
      router.push(`/p/${id}`);
    } else {
      setPinError(true);
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

  function ProfileCard({ p, i }: { p: ProfileRow; i: number }) {
    return (
      <div className="relative">
        <button
          onClick={() => openProfile(p)}
          className={`glass w-full bg-gradient-to-br p-4 text-left transition active:scale-[0.97] ${PALETTE[i % PALETTE.length]}`}
        >
          {p.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar} alt="" className="h-12 w-12 rounded-2xl border border-white/20 object-cover" />
          ) : (
            <span className="font-display flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold">
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="mt-3 flex items-center gap-1.5 truncate text-sm font-semibold">
            {p.name}
            {p.pin_hash && <Icon name="lock" size={12} className="shrink-0 text-white/45" />}
          </span>
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
            onClick={() => {
              setConfigFor(p);
              setCfgGroupId(p.group_id ?? "");
              setCfgPin("");
            }}
            aria-label={`Configurar perfil ${p.name}`}
            className="rounded-full bg-black/35 p-1.5 text-white/60"
          >
            <Icon name="pencil" size={13} />
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
    );
  }

  const ungrouped = (profiles ?? []).filter((p) => !p.group_id);
  const groupOf = (gid: string) => (profiles ?? []).filter((p) => p.group_id === gid);

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
        <Brand size={30} textClass="text-2xl" />
        <h1 className="font-display mt-4 text-3xl font-bold leading-tight">
          Quem vai treinar
          <br />
          hoje?
        </h1>
      </header>

      {error && <p className="glass mb-4 border-red-400/30 p-3 text-sm text-red-300">{error}</p>}

      {profiles === null ? (
        <Spinner label="Carregando perfis…" />
      ) : (
        <>
          {groups.map((g) => {
            const members = groupOf(g.id);
            return (
              <section key={g.id} className="mb-5">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Icon name="users" size={14} className="text-viol" />
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-viol">{g.name}</h2>
                  {members.length === 0 && (
                    <button
                      onClick={() => deleteGroup(g.id).then(load)}
                      className="ml-auto text-[10px] text-white/35 underline"
                    >
                      remover grupo
                    </button>
                  )}
                </div>
                {members.length === 0 ? (
                  <p className="glass p-3 text-xs text-white/45">Nenhum perfil neste grupo ainda.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {members.map((p, i) => (
                      <ProfileCard key={p.id} p={p} i={i} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          <section className="mb-4">
            {groups.length > 0 && ungrouped.length > 0 && (
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.2em] text-white/40">Sem grupo</h2>
            )}
            <div className="grid grid-cols-2 gap-3">
              {ungrouped.map((p, i) => (
                <ProfileCard key={p.id} p={p} i={i} />
              ))}
              {profiles.length < MAX_PROFILES && (
                <button
                  onClick={() => setCreating(true)}
                  className="glass flex min-h-[132px] flex-col items-center justify-center gap-1.5 border-dashed p-4 text-white/60 transition active:scale-[0.97]"
                >
                  <Icon name="plus" size={26} className="text-glow" />
                  <span className="text-sm font-semibold">Novo perfil</span>
                  <span className="text-[11px]">
                    {profiles.length}/{MAX_PROFILES}
                  </span>
                </button>
              )}
            </div>
          </section>

          <button
            onClick={() => setCreatingGroup(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-2.5 text-xs font-semibold text-white/55 transition active:scale-[0.98]"
          >
            <Icon name="users" size={14} /> Criar grupo (trabalho, amigos…)
          </button>

          <Link href="/ranking" className="glass mt-4 flex w-full items-center gap-3 p-4 transition active:scale-[0.98]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-rose-500/25 text-amber-300">
              <Icon name="trophy" size={20} />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Ranking</span>
              <span className="block text-xs text-white/55">Geral ou por grupo — check-ins e evolução</span>
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
        {groups.length > 0 && (
          <>
            <label className="mb-1 mt-3 block text-sm text-white/70">Grupo (opcional)</label>
            <select className="field" value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)}>
              <option value="" className="bg-ink">
                Sem grupo
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-ink">
                  {g.name}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="mb-1 mt-3 block text-sm text-white/70">Senha (opcional, 4-6 dígitos)</label>
        <input
          className="field num"
          inputMode="numeric"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Deixe vazio para não usar"
        />
        <button onClick={handleCreate} disabled={busy || !newName.trim()} className="btn btn-primary mt-4 w-full">
          {busy ? "Criando…" : "Criar perfil"}
        </button>
      </Modal>

      <Modal open={creatingGroup} onClose={() => setCreatingGroup(false)} title="Novo grupo">
        <label className="mb-1 block text-sm text-white/70">Nome do grupo</label>
        <input
          className="field"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Ex.: Amigos da academia"
          maxLength={40}
          autoFocus
        />
        <button onClick={handleCreateGroup} disabled={busy || !groupName.trim()} className="btn btn-primary mt-4 w-full">
          {busy ? "Criando…" : "Criar grupo"}
        </button>
      </Modal>

      <Modal open={!!configFor} onClose={() => setConfigFor(null)} title={`Configurar — ${configFor?.name ?? ""}`}>
        <label className="mb-1 block text-sm text-white/70">Grupo</label>
        <select className="field" value={cfgGroupId} onChange={(e) => setCfgGroupId(e.target.value)}>
          <option value="" className="bg-ink">
            Sem grupo
          </option>
          {groups.map((g) => (
            <option key={g.id} value={g.id} className="bg-ink">
              {g.name}
            </option>
          ))}
        </select>
        <label className="mb-1 mt-3 block text-sm text-white/70">
          {configFor?.pin_hash ? "Nova senha (deixe vazio para manter a atual)" : "Senha (opcional, 4-6 dígitos)"}
        </label>
        <input
          className="field num"
          inputMode="numeric"
          value={cfgPin}
          onChange={(e) => setCfgPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="4-6 dígitos"
        />
        {configFor?.pin_hash && (
          <button onClick={removePin} disabled={busy} className="mt-2 text-xs text-red-300 underline">
            Remover senha deste perfil
          </button>
        )}
        <button onClick={saveConfig} disabled={busy} className="btn btn-primary mt-4 w-full">
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </Modal>

      <Modal open={!!pinFor} onClose={() => setPinFor(null)} title={`${pinFor?.name ?? ""} está protegido`}>
        <div className="mb-3 flex items-center justify-center text-white/50">
          <Icon name="lock" size={28} />
        </div>
        <input
          className="field num text-center text-2xl tracking-[0.4em]"
          inputMode="numeric"
          value={pinTry}
          onChange={(e) => {
            setPinTry(e.target.value.replace(/\D/g, "").slice(0, 6));
            setPinError(false);
          }}
          placeholder="••••"
          autoFocus
        />
        {pinError && <p className="mt-2 text-center text-xs text-red-300">Senha incorreta. Tente novamente.</p>}
        <button onClick={confirmPin} disabled={!pinTry} className="btn btn-primary mt-4 w-full">
          Entrar
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
