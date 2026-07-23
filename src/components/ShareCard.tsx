"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayAggregate, MonthAggregate, WeekAggregate, fmtCompact, formatDuration } from "@/lib/calc";
import Icon from "./Icons";

export interface ShareStats {
  appName: string;
  profileName: string;
  sessionName: string;
  planName: string;
  dateLabel: string;
  exercisesDone: number;
  exercisesTotal: number;
  improved: number;
  prs: number;
  avgIncreasePct: number | null;
  weeklyDone: number;
  weeklyTarget: number;
  durationSeconds: number | null;
  caloriesEstimate: number | null;
  loads: { name: string; load: number }[];
  day?: DayAggregate;
  week?: WeekAggregate;
  month?: MonthAggregate;
}

// ── Identidade Carbon ──────────────────────────────────────────────────────
const W = 1080;
const H = 1920;
const RACK = "#0A0A09";
const GIZ = "#FAFAFA";
const MUTED = "#8A8A88";
const FADED = "#6E6E6E";
const AQUA = "#44E2D9";
const LINE = "#1F1F1F";
const PAD = 56; // respiro de borda definido na identidade

const BRAND = "900 34px Archivo, system-ui, sans-serif";
const STAT = (px: number) => `400 ${px}px Anton, 'Space Grotesk', sans-serif`;
const TEXT = (px: number, weight = 500) => `${weight} ${px}px 'Space Grotesk', system-ui, sans-serif`;

type Period = "dia" | "semana" | "mes";
type Kind = "overlay" | "card";

interface Art {
  key: string;
  label: string;
  period: Period;
  kind: Kind;
  draw: (ctx: CanvasRenderingContext2D, s: ShareStats, logo: HTMLImageElement | null) => void;
}

// ── Helpers de desenho ─────────────────────────────────────────────────────
function shadowOn(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 2;
}
function shadowOff(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fundo do card (só nas artes "card" — overlay fica transparente). */
function drawCardBg(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = RACK;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  roundRect(ctx, PAD / 2, PAD / 2, W - PAD, H - PAD, 40);
  ctx.stroke();
}

/** Marca discreta, colada nas infos (padrão Strava/Carbon). */
function drawBrand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  logo: HTMLImageElement | null,
  align: CanvasTextAlign = "left",
  scale = 1
) {
  const markW = 44 * scale;
  const markH = Math.round((markW * 500) / 691);
  const label = "RTrainning";
  ctx.font = `900 ${Math.round(30 * scale)}px Archivo, system-ui, sans-serif`;
  const textW = ctx.measureText(label).width;
  const gap = 14 * scale;
  const totalW = markW + gap + textW;
  const startX = align === "center" ? x - totalW / 2 : align === "right" ? x - totalW : x;

  shadowOn(ctx);
  if (logo) ctx.drawImage(logo, startX, y - markH / 2 - 2, markW, markH);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = GIZ;
  // "RT" cheio + "rainning" em 0.72em, cor única (assinatura A da identidade)
  const rtText = "RT";
  ctx.font = `900 ${Math.round(30 * scale)}px Archivo, system-ui, sans-serif`;
  ctx.fillText(rtText, startX + markW + gap, y);
  const rtW = ctx.measureText(rtText).width;
  ctx.font = `900 ${Math.round(30 * 0.72 * scale)}px Archivo, system-ui, sans-serif`;
  ctx.fillText("rainning", startX + markW + gap + rtW, y + 1 * scale);
  shadowOff(ctx);
}

/** Rótulo curto em caixa alta com tracking — padrão Carbon. */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 22, color = FADED) {
  ctx.font = TEXT(size, 700);
  ctx.fillStyle = color;
  const spaced = text.toUpperCase().split("").join("\u2009");
  ctx.fillText(spaced, x, y);
}

/** Bloco número grande + rótulo curto (a gramática visual da marca). */
function statBlock(
  ctx: CanvasRenderingContext2D,
  value: string,
  lbl: string,
  x: number,
  y: number,
  size = 96,
  accent = false,
  align: CanvasTextAlign = "left"
) {
  ctx.textAlign = align;
  shadowOn(ctx);
  ctx.font = STAT(size);
  ctx.fillStyle = accent ? AQUA : GIZ;
  ctx.fillText(value, x, y);
  shadowOff(ctx);
  ctx.font = TEXT(Math.max(18, size * 0.22), 700);
  ctx.fillStyle = FADED;
  ctx.fillText(lbl.toUpperCase().split("").join("\u2009"), x, y + size * 0.34);
  ctx.textAlign = "left";
}

/** Barra de divisão de volume — a assinatura visual (substitui o percurso). */
function splitBar(ctx: CanvasRenderingContext2D, split: { grupo: string; pct: number }[], x: number, y: number, w: number, h = 16) {
  if (split.length === 0) return;
  const shades = [GIZ, "#B8B8B6", "#6E6E6E", "#3A3A38"];
  let cursor = x;
  const total = split.reduce((a, b) => a + b.pct, 0) || 100;
  split.forEach((part, i) => {
    const partW = (part.pct / total) * w;
    ctx.fillStyle = i === 0 ? AQUA : shades[Math.min(i, shades.length - 1)];
    roundRect(ctx, cursor, y, Math.max(4, partW - 4), h, h / 2);
    ctx.fill();
    cursor += partW;
  });
}

function splitLegend(ctx: CanvasRenderingContext2D, split: { grupo: string; pct: number }[], x: number, y: number, gapY = 44) {
  const shades = [AQUA, GIZ, "#8A8A88", "#4A4A48"];
  split.forEach((part, i) => {
    ctx.fillStyle = shades[Math.min(i, shades.length - 1)];
    ctx.fillRect(x, y + i * gapY - 14, 16, 16);
    ctx.font = TEXT(26, 500);
    ctx.fillStyle = GIZ;
    ctx.fillText(part.grupo, x + 30, y + i * gapY);
    ctx.textAlign = "right";
    ctx.font = TEXT(26, 700);
    ctx.fillStyle = MUTED;
    ctx.fillText(`${part.pct}%`, x + 420, y + i * gapY);
    ctx.textAlign = "left";
  });
}

/** Sparkline de volume (7 pontos da semana). */
function sparkline(ctx: CanvasRenderingContext2D, values: number[], x: number, y: number, w: number, h: number) {
  const max = Math.max(...values, 1);
  const step = w / Math.max(1, values.length - 1);
  ctx.strokeStyle = AQUA;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  shadowOn(ctx);
  ctx.beginPath();
  values.forEach((v, i) => {
    const px = x + i * step;
    const py = y + h - (v / max) * h * 0.9 - h * 0.05;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  shadowOff(ctx);
  values.forEach((v, i) => {
    if (v <= 0) return;
    const px = x + i * step;
    const py = y + h - (v / max) * h * 0.9 - h * 0.05;
    ctx.fillStyle = GIZ;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Check dos 7 dias: cinza=descanso, branco=treino, aqua=hoje. */
function weekChecks(ctx: CanvasRenderingContext2D, dias: ("descanso" | "treino" | "hoje")[], x: number, y: number, gap = 116) {
  const letters = ["S", "T", "Q", "Q", "S", "S", "D"];
  dias.forEach((state, i) => {
    const cx = x + i * gap;
    const color = state === "hoje" ? AQUA : state === "treino" ? GIZ : "#3A3A38";
    ctx.textAlign = "center";
    ctx.font = TEXT(26, 700);
    ctx.fillStyle = state === "descanso" ? FADED : color;
    ctx.fillText(letters[i], cx, y);
    if (state !== "descanso") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 14, y + 34);
      ctx.lineTo(cx - 4, y + 44);
      ctx.lineTo(cx + 15, y + 22);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#2A2A28";
      ctx.beginPath();
      ctx.arc(cx, y + 34, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.textAlign = "left";
}

function footer(ctx: CanvasRenderingContext2D, cta: string) {
  ctx.textAlign = "center";
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(cta, W / 2, H - 150);
  ctx.font = TEXT(24, 500);
  ctx.fillStyle = FADED;
  ctx.fillText("rtrainning.app", W / 2, H - 100);
  ctx.textAlign = "left";
}

function bracket(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = TEXT(26, 700);
  ctx.fillStyle = AQUA;
  ctx.fillText(`[ ${text.toUpperCase().split("").join("\u2009")} ]`, x, y);
}

// ── Dados derivados ────────────────────────────────────────────────────────
const dur = (s: ShareStats) => (s.durationSeconds != null ? formatDuration(s.durationSeconds) : "—");
const kcal = (s: ShareStats) => (s.caloriesEstimate != null ? String(Math.round(s.caloriesEstimate)) : "—");
const vol = (s: ShareStats) => (s.day ? fmtCompact(s.day.volumeKg) : "—");
/** 4.9 horas decimais → "4h54" (e não "4h9"). */
const fmtHoras = (h: number) => {
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  return horas > 0 ? `${horas}h${String(min).padStart(2, "0")}` : `${min}min`;
};

// ── ARTES · DIA ────────────────────────────────────────────────────────────
const dayGrid: Art["draw"] = (ctx, s, logo) => {
  const top = H - 720;
  drawBrand(ctx, PAD, top, logo);
  label(ctx, "Treino", PAD, top + 90);
  shadowOn(ctx);
  ctx.font = STAT(84);
  ctx.fillStyle = GIZ;
  ctx.fillText(s.sessionName, PAD, top + 170);
  shadowOff(ctx);

  const col = (W - PAD * 2) / 2;
  statBlock(ctx, dur(s), "Duração", PAD, top + 320, 88);
  statBlock(ctx, kcal(s), "Calorias", PAD + col, top + 320, 88);
  statBlock(ctx, vol(s), "Volume", PAD, top + 470, 88, true);
  statBlock(ctx, String(s.day?.series ?? 0), "Séries", PAD + col, top + 470, 88);

  if (s.day?.splitMuscular.length) {
    splitBar(ctx, s.day.splitMuscular, PAD, top + 540, W - PAD * 2, 18);
    ctx.font = TEXT(24, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText(s.day.splitMuscular.map((p) => `${p.grupo} ${p.pct}%`).join("   ·   "), PAD, top + 600);
  }
  if (s.prs > 0) {
    ctx.font = TEXT(28, 700);
    ctx.fillStyle = AQUA;
    ctx.fillText(`${s.prs} PR ${s.prs > 1 ? "batidos" : "batido"}`, PAD, top + 660);
  }
};

const dayCircuit: Art["draw"] = (ctx, s, logo) => {
  const top = H - 760;
  drawBrand(ctx, PAD, top, logo);
  label(ctx, "Treino de hoje", PAD, top + 86);
  shadowOn(ctx);
  ctx.font = STAT(96);
  ctx.fillStyle = GIZ;
  ctx.fillText(s.sessionName.toUpperCase(), PAD, top + 180);
  shadowOff(ctx);
  ctx.font = TEXT(28, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(`${s.exercisesDone} exercícios · ${s.day?.series ?? 0} séries`, PAD, top + 232);

  if (s.day?.splitMuscular.length) {
    label(ctx, "Volume por grupo", PAD, top + 320);
    splitBar(ctx, s.day.splitMuscular, PAD, top + 344, W - PAD * 2, 20);
    splitLegend(ctx, s.day.splitMuscular, PAD, top + 430);
  }

  ctx.font = TEXT(32, 700);
  ctx.fillStyle = GIZ;
  const linhaFinal = [dur(s), `${kcal(s)} kcal`, s.prs > 0 ? `${s.prs} PR` : null].filter(Boolean).join("  ·  ");
  shadowOn(ctx);
  ctx.fillText(linhaFinal, PAD, top + 660);
  shadowOff(ctx);
};

const dayClean: Art["draw"] = (ctx, s, logo) => {
  const top = H - 640;
  label(ctx, "Treino", PAD, top);
  shadowOn(ctx);
  ctx.font = STAT(72);
  ctx.fillStyle = GIZ;
  ctx.fillText(s.sessionName, PAD, top + 76);
  shadowOff(ctx);
  statBlock(ctx, dur(s), "Duração", PAD, top + 230, 104);
  statBlock(ctx, kcal(s), "Calorias", PAD, top + 380, 104);
  if (s.prs > 0) statBlock(ctx, String(s.prs), "PRs batidos", PAD, top + 530, 104, true);
  drawBrand(ctx, PAD, H - 150, logo);
};

const dayCard: Art["draw"] = (ctx, s, logo) => {
  drawCardBg(ctx);
  drawBrand(ctx, PAD + 40, 190, logo);
  ctx.textAlign = "right";
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = FADED;
  ctx.fillText(s.dateLabel, W - PAD - 40, 198);
  ctx.textAlign = "left";

  bracket(ctx, "Treino concluído", PAD + 40, 380);
  ctx.font = STAT(120);
  ctx.fillStyle = GIZ;
  ctx.fillText(s.sessionName.toUpperCase(), PAD + 40, 500);

  const col = (W - PAD * 2 - 80) / 3;
  statBlock(ctx, dur(s), "Duração", PAD + 40, 700, 88);
  statBlock(ctx, kcal(s), "Kcal", PAD + 40 + col, 700, 88);
  statBlock(ctx, String(s.prs), "Novos PRs", PAD + 40 + col * 2, 700, 88, s.prs > 0);

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD + 40, 830);
  ctx.lineTo(W - PAD - 40, 830);
  ctx.stroke();

  const list = s.day?.exerciseNames ?? [];
  list.slice(0, 6).forEach((ex, i) => {
    const y = 910 + i * 62;
    ctx.font = TEXT(30, 500);
    ctx.fillStyle = GIZ;
    ctx.fillText(ex.name.length > 26 ? `${ex.name.slice(0, 25)}…` : ex.name, PAD + 40, y);
    ctx.textAlign = "right";
    ctx.font = TEXT(28, 700);
    ctx.fillStyle = MUTED;
    ctx.fillText(`${ex.sets}×${ex.reps}`, W - PAD - 40, y);
    ctx.textAlign = "left";
  });

  footer(ctx, "↻ reposte o treino");
};

const dayNumbers: Art["draw"] = (ctx, s, logo) => {
  drawCardBg(ctx);
  drawBrand(ctx, PAD + 40, 190, logo);
  ctx.textAlign = "right";
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = FADED;
  ctx.fillText(s.dateLabel, W - PAD - 40, 198);
  ctx.textAlign = "left";

  bracket(ctx, "O dia em números", PAD + 40, 380);
  ctx.font = STAT(190);
  ctx.fillStyle = AQUA;
  ctx.fillText(vol(s), PAD + 40, 560);
  ctx.font = TEXT(28, 700);
  ctx.fillStyle = FADED;
  ctx.fillText("KG DE VOLUME", PAD + 40, 610);

  const col = (W - PAD * 2 - 80) / 3;
  statBlock(ctx, kcal(s), "Kcal", PAD + 40, 780, 84);
  statBlock(ctx, String(s.day?.series ?? 0), "Séries", PAD + 40 + col, 780, 84);
  statBlock(ctx, String(s.prs), "Novos PRs", PAD + 40 + col * 2, 780, 84, s.prs > 0);

  if (s.day?.splitMuscular.length) {
    label(ctx, "Divisão do volume", PAD + 40, 960);
    splitBar(ctx, s.day.splitMuscular, PAD + 40, 990, W - PAD * 2 - 80, 22);
    splitLegend(ctx, s.day.splitMuscular, PAD + 40, 1080);
  }

  ctx.font = TEXT(32, 700);
  ctx.fillStyle = GIZ;
  ctx.fillText("Dia fechado. Respeito.", PAD + 40, 1400);
  footer(ctx, "↻ reposte o treino");
};

// ── ARTES · SEMANA ─────────────────────────────────────────────────────────
const weekFull: Art["draw"] = (ctx, s, logo) => {
  const w = s.week;
  const top = H - 780;
  drawBrand(ctx, PAD, top, logo);
  label(ctx, `Semana ${w?.semanaNum ?? ""}`, PAD, top + 86);
  shadowOn(ctx);
  ctx.font = STAT(110);
  ctx.fillStyle = GIZ;
  ctx.fillText(`${w ? fmtCompact(w.volumeKg) : "—"}`, PAD, top + 200);
  shadowOff(ctx);
  ctx.font = TEXT(28, 700);
  ctx.fillStyle = FADED;
  ctx.fillText("KG DE VOLUME", PAD, top + 250);

  if (w) {
    sparkline(ctx, w.volumePorDia, PAD, top + 300, W - PAD * 2, 150);
    weekChecks(ctx, w.diasCheck, PAD + 40, top + 540);
    if (w.letrasTreino.length) {
      ctx.font = TEXT(28, 700);
      ctx.fillStyle = MUTED;
      ctx.fillText(w.letrasTreino.join("   "), PAD, top + 650);
    }
    shadowOn(ctx);
    ctx.font = TEXT(32, 700);
    ctx.fillStyle = GIZ;
    ctx.fillText(
      [fmtHoras(w.horas), `${w.kcal} kcal`, w.prs > 0 ? `${w.prs} PR` : null]
        .filter(Boolean)
        .join("  ·  "),
      PAD,
      top + 720
    );
    shadowOff(ctx);
  }
};

const weekChip: Art["draw"] = (ctx, s, logo) => {
  const w = s.week;
  const treinos = w ? w.diasCheck.filter((d) => d !== "descanso").length : 0;
  const top = H - 620;
  drawBrand(ctx, PAD, top, logo);
  ctx.font = TEXT(30, 700);
  ctx.fillStyle = MUTED;
  ctx.fillText(`${treinos} treinos · SEM ${w?.semanaNum ?? ""}`, PAD, top + 84);
  shadowOn(ctx);
  ctx.font = STAT(150);
  ctx.fillStyle = AQUA;
  ctx.fillText(w ? fmtCompact(w.volumeKg) : "—", PAD, top + 240);
  shadowOff(ctx);
  ctx.font = TEXT(28, 700);
  ctx.fillStyle = FADED;
  ctx.fillText("KG DE VOLUME", PAD, top + 290);
  const col = (W - PAD * 2) / 2;
  statBlock(ctx, `${treinos}/7`, "Dias", PAD, top + 440, 84);
  statBlock(ctx, String(w?.prs ?? 0), "PRs", PAD + col, top + 440, 84);
};

const weekPanel: Art["draw"] = (ctx, s, logo) => {
  drawCardBg(ctx);
  const w = s.week;
  const treinos = w ? w.diasCheck.filter((d) => d !== "descanso").length : 0;
  drawBrand(ctx, PAD + 40, 190, logo);
  ctx.textAlign = "right";
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = FADED;
  ctx.fillText(`SEM ${w?.semanaNum ?? ""}`, W - PAD - 40, 198);
  ctx.textAlign = "left";

  bracket(ctx, "Sua semana", PAD + 40, 380);
  ctx.font = STAT(130);
  ctx.fillStyle = GIZ;
  ctx.fillText(`${treinos} TREINOS`, PAD + 40, 510);

  if (w) {
    weekChecks(ctx, w.diasCheck, PAD + 80, 650);
    sparkline(ctx, w.volumePorDia, PAD + 40, 760, W - PAD * 2 - 80, 170);
    const col = (W - PAD * 2 - 80) / 2;
    statBlock(ctx, fmtCompact(w.volumeKg), "Kg volume", PAD + 40, 1080, 92, true);
    statBlock(ctx, fmtHoras(w.horas), "Horas", PAD + 40 + col, 1080, 92);
    statBlock(ctx, String(w.kcal), "Kcal", PAD + 40, 1240, 92);
    statBlock(ctx, String(w.prs), "Novos PRs", PAD + 40 + col, 1240, 92, w.prs > 0);
  }
  footer(ctx, "↻ reposte a semana");
};

const weekStreak: Art["draw"] = (ctx, s, logo) => {
  drawCardBg(ctx);
  const w = s.week;
  const treinos = w ? w.diasCheck.filter((d) => d !== "descanso").length : 0;
  drawBrand(ctx, PAD + 40, 190, logo);
  bracket(ctx, "Sequência", PAD + 40, 420);
  ctx.font = STAT(320);
  ctx.fillStyle = AQUA;
  ctx.fillText(String(w?.streakSemanas ?? 0), PAD + 40, 720);
  ctx.font = STAT(76);
  ctx.fillStyle = GIZ;
  ctx.fillText("SEMANAS SEGUIDAS", PAD + 40, 830);
  ctx.font = TEXT(34, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText("Ninguém te segura.", PAD + 40, 960);
  ctx.fillText(
    `${treinos} treino${treinos === 1 ? "" : "s"} essa semana${w && w.prs > 0 ? `, ${w.prs} PR no bolso` : ""}.`,
    PAD + 40,
    1010
  );
  ctx.font = TEXT(32, 700);
  ctx.fillStyle = GIZ;
  ctx.fillText("Semana fechada. Respeito.", PAD + 40, 1180);
  footer(ctx, "↻ reposte a semana");
};

// ── ARTES · MÊS ────────────────────────────────────────────────────────────
const pctLabel = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Math.round(v)}%`);

const monthChip: Art["draw"] = (ctx, s, logo) => {
  const m = s.month;
  const top = H - 680;
  drawBrand(ctx, PAD, top, logo);
  ctx.font = TEXT(30, 700);
  ctx.fillStyle = MUTED;
  ctx.fillText(m?.mes ?? "", PAD, top + 84);
  shadowOn(ctx);
  ctx.font = STAT(170);
  ctx.fillStyle = AQUA;
  ctx.fillText(pctLabel(m?.evolucaoCargaPct ?? null), PAD, top + 250);
  shadowOff(ctx);
  ctx.font = TEXT(28, 700);
  ctx.fillStyle = FADED;
  ctx.fillText("DE CARGA NO MÊS", PAD, top + 300);
  const col = (W - PAD * 2) / 3;
  statBlock(ctx, m ? fmtCompact(m.volumeKg) : "—", "Kg", PAD, top + 460, 80);
  statBlock(ctx, String(m?.treinos ?? 0), "Treinos", PAD + col, top + 460, 80);
  statBlock(ctx, `${m?.consistenciaPct ?? 0}%`, "Presença", PAD + col * 2, top + 460, 80);
};

const monthEvolution: Art["draw"] = (ctx, s, logo) => {
  const m = s.month;
  const top = H - 560;
  drawBrand(ctx, PAD, top, logo);
  label(ctx, `Carga total · ${m?.mes ?? ""}`, PAD, top + 86);
  shadowOn(ctx);
  ctx.font = STAT(240);
  ctx.fillStyle = AQUA;
  ctx.fillText(pctLabel(m?.evolucaoCargaPct ?? null), PAD, top + 300);
  shadowOff(ctx);
  ctx.font = TEXT(34, 500);
  ctx.fillStyle = GIZ;
  shadowOn(ctx);
  ctx.fillText(
    m?.evolucaoCargaPct != null
      ? `A carga subiu ${Math.round(m.evolucaoCargaPct)}% no mês. Segue.`
      : "Registre mais treinos para medir a evolução.",
    PAD,
    top + 380
  );
  shadowOff(ctx);
};

const monthLifts: Art["draw"] = (ctx, s, logo) => {
  drawCardBg(ctx);
  const m = s.month;
  drawBrand(ctx, PAD + 40, 190, logo);
  ctx.textAlign = "right";
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = FADED;
  ctx.fillText((m?.mes ?? "").toUpperCase(), W - PAD - 40, 198);
  ctx.textAlign = "left";

  bracket(ctx, "Evolução de carga", PAD + 40, 380);
  ctx.font = STAT(180);
  ctx.fillStyle = AQUA;
  ctx.fillText(pctLabel(m?.evolucaoCargaPct ?? null), PAD + 40, 550);
  ctx.font = TEXT(30, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText("na média dos movimentos", PAD + 40, 610);

  (m?.evolucaoPorLift ?? []).slice(0, 5).forEach((lift, i) => {
    const y = 760 + i * 90;
    ctx.font = TEXT(32, 500);
    ctx.fillStyle = GIZ;
    ctx.fillText(lift.nome.length > 24 ? `${lift.nome.slice(0, 23)}…` : lift.nome, PAD + 40, y);
    ctx.textAlign = "right";
    ctx.font = STAT(46);
    ctx.fillStyle = lift.pct >= 0 ? AQUA : MUTED;
    ctx.fillText(pctLabel(lift.pct), W - PAD - 40, y + 6);
    ctx.textAlign = "left";
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD + 40, y + 34);
    ctx.lineTo(W - PAD - 40, y + 34);
    ctx.stroke();
  });

  footer(ctx, "↻ reposte a evolução");
};

const monthConsistency: Art["draw"] = (ctx, s, logo) => {
  drawCardBg(ctx);
  const m = s.month;
  drawBrand(ctx, PAD + 40, 190, logo);
  ctx.textAlign = "right";
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = FADED;
  ctx.fillText(`${(m?.mes ?? "").toUpperCase()} · ${m?.diasNoMes ?? 0} DIAS`, W - PAD - 40, 198);
  ctx.textAlign = "left";

  bracket(ctx, "Consistência", PAD + 40, 380);
  ctx.font = STAT(230);
  ctx.fillStyle = AQUA;
  ctx.fillText(`${m?.consistenciaPct ?? 0}%`, PAD + 40, 600);
  ctx.font = TEXT(32, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(`${m?.treinos ?? 0} dias treinados no mês`, PAD + 40, 670);

  // Calendário real do mês (28–31 dias), 7 colunas
  const cal = m?.calendario ?? [];
  const cols = 7;
  const cell = 108;
  const gap = 14;
  const startX = PAD + 40;
  const startY = 790;
  cal.forEach((done, i) => {
    const cx = startX + (i % cols) * (cell + gap);
    const cy = startY + Math.floor(i / cols) * (cell + gap);
    ctx.fillStyle = done ? AQUA : "#161616";
    roundRect(ctx, cx, cy, cell, cell, 20);
    ctx.fill();
    if (!done) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.font = TEXT(28, 700);
    ctx.fillStyle = done ? "#06120F" : FADED;
    ctx.fillText(String(i + 1), cx + cell / 2, cy + cell / 2 + 10);
    ctx.textAlign = "left";
  });

  ctx.font = TEXT(34, 700);
  ctx.fillStyle = GIZ;
  ctx.fillText("Presença é PR também.", PAD + 40, startY + Math.ceil(cal.length / cols) * (cell + gap) + 90);
  footer(ctx, "↻ reposte o mês");
};

const monthVolume: Art["draw"] = (ctx, s, logo) => {
  drawCardBg(ctx);
  const m = s.month;
  drawBrand(ctx, PAD + 40, 190, logo);
  ctx.textAlign = "right";
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = FADED;
  ctx.fillText((m?.mes ?? "").toUpperCase(), W - PAD - 40, 198);
  ctx.textAlign = "left";

  bracket(ctx, "Volume do mês", PAD + 40, 380);
  ctx.font = STAT(200);
  ctx.fillStyle = AQUA;
  ctx.fillText(m ? fmtCompact(m.volumeKg) : "—", PAD + 40, 570);
  ctx.font = TEXT(28, 700);
  ctx.fillStyle = FADED;
  ctx.fillText("KG MOVIMENTADOS", PAD + 40, 620);

  const series = m?.volumePorSemana ?? [];
  const max = Math.max(...series, 1);
  const chartX = PAD + 40;
  const chartY = 800;
  const chartW = W - PAD * 2 - 80;
  const chartH = 460;
  const barW = chartW / Math.max(1, series.length) - 24;
  series.forEach((v, i) => {
    const h = Math.max(8, (v / max) * chartH);
    const x = chartX + i * (barW + 24);
    ctx.fillStyle = i === series.length - 1 ? AQUA : "#2A2A28";
    roundRect(ctx, x, chartY + chartH - h, barW, h, 16);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = TEXT(24, 700);
    ctx.fillStyle = FADED;
    ctx.fillText(`S${i + 1}`, x + barW / 2, chartY + chartH + 44);
    ctx.textAlign = "left";
  });

  ctx.font = TEXT(32, 700);
  ctx.fillStyle = GIZ;
  ctx.fillText(`${m?.treinos ?? 0} treinos no mês.`, PAD + 40, chartY + chartH + 140);
  footer(ctx, "↻ reposte o mês");
};

const monthRecap: Art["draw"] = (ctx, s, logo) => {
  drawCardBg(ctx);
  const m = s.month;
  drawBrand(ctx, PAD + 40, 190, logo);
  ctx.textAlign = "right";
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = FADED;
  ctx.fillText(String(new Date().getFullYear()), W - PAD - 40, 198);
  ctx.textAlign = "left";

  bracket(ctx, "Retrospectiva", PAD + 40, 420);
  ctx.font = STAT(150);
  ctx.fillStyle = GIZ;
  ctx.fillText((m?.mes ?? "").toUpperCase(), PAD + 40, 570);

  ctx.font = STAT(200);
  ctx.fillStyle = AQUA;
  ctx.fillText(String(m?.treinos ?? 0), PAD + 40, 830);
  ctx.font = TEXT(30, 700);
  ctx.fillStyle = FADED;
  ctx.fillText("TREINOS", PAD + 40, 890);

  ctx.font = STAT(200);
  ctx.fillStyle = GIZ;
  ctx.fillText(m ? fmtCompact(m.volumeKg) : "—", PAD + 40, 1120);
  ctx.font = TEXT(30, 700);
  ctx.fillStyle = FADED;
  ctx.fillText("KG MOVIMENTADOS", PAD + 40, 1180);

  ctx.font = TEXT(36, 700);
  ctx.fillStyle = GIZ;
  ctx.fillText(
    `${pctLabel(m?.evolucaoCargaPct ?? null)} de carga · ${m?.streakSemanas ?? 0} sem de streak`,
    PAD + 40,
    1340
  );
  footer(ctx, "↻ compartilhe seu mês");
};

const ARTS: Art[] = [
  { key: "dia-grid", label: "Grid + volume", period: "dia", kind: "overlay", draw: dayGrid },
  { key: "dia-circuito", label: "Circuito", period: "dia", kind: "overlay", draw: dayCircuit },
  { key: "dia-limpo", label: "Stats limpos", period: "dia", kind: "overlay", draw: dayClean },
  { key: "dia-card", label: "Treino concluído", period: "dia", kind: "card", draw: dayCard },
  { key: "dia-numeros", label: "O dia em números", period: "dia", kind: "card", draw: dayNumbers },
  { key: "sem-completa", label: "Semana completa", period: "semana", kind: "overlay", draw: weekFull },
  { key: "sem-chip", label: "Chip da semana", period: "semana", kind: "overlay", draw: weekChip },
  { key: "sem-painel", label: "Painel da semana", period: "semana", kind: "card", draw: weekPanel },
  { key: "sem-streak", label: "Sequência", period: "semana", kind: "card", draw: weekStreak },
  { key: "mes-chip", label: "Chip do mês", period: "mes", kind: "overlay", draw: monthChip },
  { key: "mes-evolucao", label: "Evolução %", period: "mes", kind: "overlay", draw: monthEvolution },
  { key: "mes-lifts", label: "Carga por movimento", period: "mes", kind: "card", draw: monthLifts },
  { key: "mes-volume", label: "Volume por semana", period: "mes", kind: "card", draw: monthVolume },
  { key: "mes-consistencia", label: "Consistência", period: "mes", kind: "card", draw: monthConsistency },
  { key: "mes-recap", label: "Retrospectiva", period: "mes", kind: "card", draw: monthRecap },
];

const PERIODS: { key: Period; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
];

function renderArt(canvas: HTMLCanvasElement, art: Art, stats: ShareStats, logo: HTMLImageElement | null, scale: number) {
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";
  art.draw(ctx, stats, logo);
  ctx.restore();
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas vazio"))), "image/png")
  );
}

export default function ShareCard({ stats, onClose }: { stats: ShareStats; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("dia");
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const previewRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);

  const arts = useMemo(() => ARTS.filter((a) => a.period === period), [period]);

  // Fontes e logo precisam estar carregados antes do primeiro traço no canvas.
  useEffect(() => {
    let alive = true;
    (async () => {
      const img = new window.Image();
      const logoPromise = new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = "/assets/logo-white.png";
        if (img.complete) resolve();
      });
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      await Promise.all([
        logoPromise,
        fonts?.load("900 30px Archivo").catch(() => null),
        fonts?.load("400 96px Anton").catch(() => null),
        fonts?.load("700 30px 'Space Grotesk'").catch(() => null),
        fonts?.ready,
      ]);
      if (!alive) return;
      logoRef.current = img;
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    arts.forEach((art, i) => {
      const canvas = previewRefs.current[i];
      if (canvas) renderArt(canvas, art, stats, logoRef.current, 0.32);
    });
  }, [ready, arts, stats]);

  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [period]);

  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / (el.clientWidth * 0.78));
    setActive(Math.min(arts.length - 1, Math.max(0, idx)));
  }

  function fullCanvas(): HTMLCanvasElement | null {
    const art = arts[active];
    if (!art) return null;
    const canvas = document.createElement("canvas");
    renderArt(canvas, art, stats, logoRef.current, 1);
    return canvas;
  }

  function fileName() {
    const art = arts[active];
    return `rtrainning-${art?.key ?? "arte"}-${stats.dateLabel.replace(/\//g, "-")}.png`;
  }

  async function save() {
    const canvas = fullCanvas();
    if (!canvas) return;
    const blob = await canvasBlob(canvas);
    const file = new File([blob], fileName(), { type: "image/png" });
    // iOS/Android: a folha nativa oferece "Salvar imagem", que grava na galeria.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        setMessage('Toque em "Salvar imagem" para gravar na galeria.');
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        setMessage(null);
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("PNG salvo em 1080×1920.");
  }

  async function share() {
    const canvas = fullCanvas();
    if (!canvas) return;
    const blob = await canvasBlob(canvas);
    const file = new File([blob], fileName(), { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "RTrainning" });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    await save();
  }

  async function copy() {
    try {
      const ClipboardItemCtor = window.ClipboardItem;
      if (!navigator.clipboard?.write || !ClipboardItemCtor) throw new Error("sem clipboard");
      // Safari exige o ClipboardItem criado com Promise dentro do gesto do usuário.
      const blobPromise = (async () => {
        const canvas = fullCanvas();
        if (!canvas) throw new Error("sem canvas");
        return canvasBlob(canvas);
      })();
      await navigator.clipboard.write([new ClipboardItemCtor({ "image/png": blobPromise })]);
      setMessage("Copiado — cole na Story.");
    } catch {
      setMessage("Copiar indisponível aqui. Use Salvar.");
    }
  }

  const current = arts[active];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <div>
          <p className="font-brand text-lg font-black text-giz">
            RT<span style={{ fontSize: "0.72em" }}>rainning</span>
          </p>
          <p className="label mt-0.5">Compartilhar</p>
        </div>
        <button onClick={onClose} className="btn btn-ghost !min-h-0 !rounded-xl !px-3 !py-2" aria-label="Fechar">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="flex gap-1 px-5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
              period === p.key ? "bg-aqua text-[#06120F]" : "border border-iron bg-[#141414] text-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="mt-4 flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-5 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {arts.map((art, i) => (
          <div key={art.key} className="flex min-h-0 w-[78%] shrink-0 snap-center flex-col">
            <div
              className={`relative min-h-0 flex-1 overflow-hidden rounded-3xl border ${
                art.kind === "overlay" ? "share-checker border-iron" : "border-line bg-deep"
              }`}
            >
              <canvas
                ref={(el) => {
                  previewRefs.current[i] = el;
                }}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
            <p className="mt-2 truncate text-center text-xs text-muted">
              {art.label}
              <span className="text-faded"> · {art.kind === "overlay" ? "PNG transparente" : "card"}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-1.5 py-2">
        {arts.map((art, i) => (
          <span
            key={art.key}
            className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-aqua" : "w-1.5 bg-iron"}`}
          />
        ))}
      </div>

      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {message && <p className="mb-2 text-center text-xs text-muted">{message}</p>}
        <div className="flex gap-2">
          {current?.kind === "overlay" ? (
            <button onClick={() => void copy()} className="btn btn-primary flex-[1.3] gap-2">
              <Icon name="copy" size={16} /> Copiar
            </button>
          ) : (
            <button onClick={() => void share()} className="btn btn-primary flex-[1.3] gap-2">
              <Icon name="share" size={16} /> Compartilhar
            </button>
          )}
          <button onClick={() => void save()} className="btn btn-ghost flex-1 gap-2">
            <Icon name="download" size={16} /> Salvar
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-faded">
          {current?.kind === "overlay"
            ? "Fundo transparente — cole sobre sua foto na Story."
            : "Imagem completa 1080×1920 para a Story."}
        </p>
      </div>
    </div>,
    document.body
  );
}
