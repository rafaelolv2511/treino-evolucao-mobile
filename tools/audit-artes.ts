import { DayAggregate, MonthAggregate, WeekAggregate, fmtCompact, formatDuration } from "../src/lib/calc";
export interface ShareStats { appName:string; profileName:string; sessionName:string; planName:string; dateLabel:string; exercisesDone:number; exercisesTotal:number; improved:number; prs:number; avgIncreasePct:number|null; weeklyDone:number; weeklyTarget:number; durationSeconds:number|null; caloriesEstimate:number|null; loads:{name:string;load:number}[]; day?:DayAggregate; week?:WeekAggregate; month?:MonthAggregate; bodyWeight?:{serie:(number|null)[];atual:number|null;inicial:number|null;delta:number|null}; }
import { createCanvas, loadImage, registerFont } from "canvas";
import * as path from "path";
// ── Identidade Carbon ──────────────────────────────────────────────────────
const W = 1080;
const H = 1920;
const RACK = "#0A0A09";
const GIZ = "#FAFAFA";
const MUTED = "#8A8A88";
const FADED = "#6E6E6E";
const AQUA = "#44E2D9";
const LINE = "#2A2B28";
const PAD = 56; // respiro de borda definido na identidade

const STAT = (px: number) => `400 ${px}px Anton, 'Space Grotesk', sans-serif`;
const TEXT = (px: number, weight = 500) => `${weight} ${px}px 'Space Grotesk', system-ui, sans-serif`;
const BRAND_F = (px: number) => `900 ${px}px Archivo, system-ui, sans-serif`;

type Period = "dia" | "semana" | "mes";
type Kind = "overlay" | "card";

interface Art {
  key: string;
  label: string;
  period: Period;
  kind: Kind;
  draw: (ctx: CanvasRenderingContext2D, s: ShareStats, logo: HTMLImageElement | null) => void;
}

// ── Primitivas ─────────────────────────────────────────────────────────────
function shadowOn(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 2;
}
function shadowOff(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Rótulo curto, caixa alta, tracking largo. Devolve a largura ocupada. */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 20, color = FADED) {
  ctx.font = TEXT(size, 700);
  const t = text.toUpperCase();
  const tracking = size * 0.16;
  // Mede a linha inteira ANTES de desenhar: o tracking é feito letra a letra,
  // então o alinhamento precisa ser resolvido aqui (textAlign sozinho
  // reposicionaria cada letra e elas se sobreporiam).
  let largura = 0;
  for (const ch of t) largura += ctx.measureText(ch).width + tracking;
  largura = Math.max(0, largura - tracking);
  const align = ctx.textAlign;
  const inicio = align === "right" ? x - largura : align === "center" ? x - largura / 2 : x;
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  let cursor = inicio;
  for (const ch of t) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = align;
  return largura;
}

/** Marca sempre DENTRO do bloco de infos (regra da identidade). */
function brandInline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  logo: HTMLImageElement | null,
  size = 26,
  medirApenas = false
) {
  const markW = size * 1.55;
  const markH = Math.round((markW * 500) / 691);
  const gap = size * 0.42;
  ctx.font = BRAND_F(size);
  const rtW = ctx.measureText("RT").width;
  ctx.font = BRAND_F(Math.round(size * 0.72));
  const restoW = ctx.measureText("rainning").width;
  const total = markW + gap + rtW + restoW;
  if (medirApenas) return total;

  const align = ctx.textAlign;
  const inicio = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
  ctx.textAlign = "left";
  if (logo) ctx.drawImage(logo, inicio, y - markH / 2, markW, markH);
  ctx.textBaseline = "middle";
  ctx.fillStyle = GIZ;
  ctx.font = BRAND_F(size);
  ctx.fillText("RT", inicio + markW + gap, y);
  ctx.font = BRAND_F(Math.round(size * 0.72));
  ctx.fillText("rainning", inicio + markW + gap + rtW, y + 1);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = align;
  return total;
}

/** Número grande + rótulo embaixo. Mede o texto para nunca invadir a coluna vizinha. */
function stat(
  ctx: CanvasRenderingContext2D,
  value: string,
  lbl: string,
  x: number,
  y: number,
  size: number,
  accent = false,
  maxW?: number
) {
  let s = size;
  ctx.font = STAT(s);
  if (maxW) while (s > 22 && ctx.measureText(value).width > maxW) { s -= 3; ctx.font = STAT(s); }
  ctx.fillStyle = accent ? AQUA : GIZ;
  ctx.fillText(value, x, y);
  if (lbl) label(ctx, lbl, x, y + Math.max(20, size * 0.26), Math.max(15, Math.round(size * 0.2)));
}

/** Caixa de estatística (usada nos cards, como no documento). */
function statBox(
  ctx: CanvasRenderingContext2D,
  value: string,
  lbl: string,
  x: number,
  y: number,
  w: number,
  h: number,
  accent = false
) {
  ctx.fillStyle = "#131313";
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.strokeStyle = accent ? AQUA : LINE;
  ctx.lineWidth = accent ? 3 : 2;
  ctx.stroke();
  let size = Math.round(h * 0.42);
  ctx.font = STAT(size);
  while (size > 20 && ctx.measureText(value).width > w - 36) { size -= 3; ctx.font = STAT(size); }
  ctx.fillStyle = accent ? AQUA : GIZ;
  ctx.fillText(value, x + 20, y + h * 0.58);
  label(ctx, lbl, x + 20, y + h * 0.82, 16);
}

/** Barra de divisão de volume — assinatura visual (substitui o percurso). */
function splitBar(ctx: CanvasRenderingContext2D, split: { grupo: string; pct: number }[], x: number, y: number, w: number, h = 14) {
  if (!split.length) return;
  const shades = [GIZ, "#8A8A88", AQUA, "#4A4A48"];
  const total = split.reduce((a, b) => a + b.pct, 0) || 100;
  let cursor = x;
  split.forEach((p, i) => {
    const pw = (p.pct / total) * w;
    ctx.fillStyle = shades[Math.min(i, shades.length - 1)];
    roundRect(ctx, cursor, y, Math.max(6, pw - 5), h, h / 2);
    ctx.fill();
    cursor += pw;
  });
}

/** Legenda do split em UMA linha ("Peito 50%  Ombro 30%  Tríceps 20%"). */
function splitInline(ctx: CanvasRenderingContext2D, split: { grupo: string; pct: number }[], x: number, y: number, size = 22) {
  const shades = [GIZ, MUTED, AQUA, "#4A4A48"];
  let cursor = x;
  ctx.font = TEXT(size, 500);
  split.forEach((p, i) => {
    ctx.fillStyle = shades[Math.min(i, shades.length - 1)];
    const t = `${p.grupo} ${p.pct}%`;
    ctx.fillText(t, cursor, y);
    cursor += ctx.measureText(t).width + size * 1.1;
  });
}

function divider(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

/** Linha de tendência com ponto final destacado. */
function trendLine(ctx: CanvasRenderingContext2D, values: number[], x: number, y: number, w: number, h: number, dot = true) {
  const vals = values.length ? values : [0];
  const max = Math.max(...vals, 1);
  const step = w / Math.max(1, vals.length - 1);
  ctx.strokeStyle = GIZ;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  vals.forEach((v, i) => {
    const px = x + i * step;
    const py = y + h - (v / max) * h * 0.85 - h * 0.08;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  if (dot) {
    const last = vals[vals.length - 1];
    ctx.fillStyle = AQUA;
    ctx.beginPath();
    ctx.arc(x + (vals.length - 1) * step, y + h - (last / max) * h * 0.85 - h * 0.08, 11, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Check dos 7 dias: quadrado vazio=descanso, branco=treino, aqua=hoje. */
function dayChecks(
  ctx: CanvasRenderingContext2D,
  dias: ("descanso" | "treino" | "hoje")[],
  x: number,
  y: number,
  box = 52,
  gap = 12
) {
  const letters = ["S", "T", "Q", "Q", "S", "S", "D"];
  dias.forEach((state, i) => {
    const bx = x + i * (box + gap);
    ctx.textAlign = "center";
    label(ctx, letters[i], bx + box / 2 - 5, y, 16, state === "descanso" ? FADED : MUTED);
    ctx.textAlign = "left";
    const by = y + 14;
    const on = state !== "descanso";
    ctx.fillStyle = state === "hoje" ? AQUA : on ? GIZ : "transparent";
    roundRect(ctx, bx, by, box, box, 14);
    if (on) ctx.fill();
    ctx.strokeStyle = on ? "transparent" : "#3A3A38";
    ctx.lineWidth = 2;
    if (!on) ctx.stroke();
    if (on) {
      ctx.strokeStyle = "#0A0A09";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(bx + box * 0.27, by + box * 0.52);
      ctx.lineTo(bx + box * 0.43, by + box * 0.68);
      ctx.lineTo(bx + box * 0.74, by + box * 0.33);
      ctx.stroke();
    }
  });
  return y + 14 + box;
}

/** Cabeçalho do card: marca à esquerda, contexto à direita. */
function cardHeader(ctx: CanvasRenderingContext2D, right: string, logo: HTMLImageElement | null, x: number, y: number, w: number) {
  brandInline(ctx, x, y, logo, 26);
  ctx.textAlign = "right";
  label(ctx, right, x + w, y + 8, 18);
  ctx.textAlign = "left";
}

/** Rodapé do card: CTA aqua à esquerda, domínio à direita. */
function cardFooter(ctx: CanvasRenderingContext2D, cta: string, x: number, y: number, w: number) {
  divider(ctx, x, y, w);
  ctx.font = TEXT(26, 700);
  ctx.fillStyle = AQUA;
  ctx.fillText(cta, x, y + 52);
  ctx.textAlign = "right";
  ctx.font = TEXT(24, 500);
  ctx.fillStyle = FADED;
  ctx.fillText("rtrainning.app", x + w, y + 52);
  ctx.textAlign = "left";
}

function bracket(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 22) {
  ctx.font = TEXT(size, 700);
  ctx.fillStyle = AQUA;
  const open = "[ ";
  ctx.fillText(open, x, y);
  const w = label(ctx, text, x + ctx.measureText(open).width, y, size, AQUA);
  ctx.font = TEXT(size, 700);
  ctx.fillStyle = AQUA;
  ctx.fillText(" ]", x + ctx.measureText(open).width + w + 4, y);
}

/** Moldura do card: fundo Preto Rack + borda. Devolve a caixa útil. */
function cardFrame(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = RACK;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  roundRect(ctx, 28, 28, W - 56, H - 56, 44);
  ctx.stroke();
  return { x: PAD + 22, w: W - (PAD + 22) * 2 };
}

/** Fundo local do overlay: leve véu atrás do bloco para leitura sobre foto. */
function overlayScrim(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(10,10,9,0.55)";
  roundRect(ctx, x - 26, y - 26, w + 52, h + 52, 30);
  ctx.fill();
}

const dur = (s: ShareStats) => (s.durationSeconds != null ? formatDuration(s.durationSeconds).replace(" ", "") : "—");
const kcalOf = (s: ShareStats) => (s.caloriesEstimate != null ? String(Math.round(s.caloriesEstimate)) : "—");
const volOf = (s: ShareStats) => (s.day ? fmtCompact(s.day.volumeKg) : "—");
const fmtHoras = (h: number) => {
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  return horas > 0 ? `${horas}h${String(min).padStart(2, "0")}` : `${min}min`;
};
const pctLabel = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Math.round(v)}%`);

// ── DIA ────────────────────────────────────────────────────────────────────
/** Overlay · grid + assinatura de volume — bloco compacto, 3 colunas × 2 linhas. */
const dayGrid: Art["draw"] = (ctx, s, logo) => {
  const x = PAD;
  const w = W - PAD * 2;
  const col = w / 3;
  const alturaBloco = s.day?.splitMuscular.length ? 430 : 340;
  const top = H - PAD - alturaBloco + 46;
  overlayScrim(ctx, x, top - 46, w, alturaBloco);
  shadowOn(ctx);
  brandInline(ctx, x, top - 14, logo, 26);
  const l1 = top + 78;
  label(ctx, "Treino", x, l1, 18);
  label(ctx, "Duração", x + col, l1, 18);
  label(ctx, "Calorias", x + col * 2, l1, 18);
  ctx.font = STAT(66);
  ctx.fillStyle = GIZ;
  [s.sessionName, dur(s), kcalOf(s)].forEach((v, i) => {
    let size = 66;
    ctx.font = STAT(size);
    while (size > 26 && ctx.measureText(v).width > col - 26) { size -= 3; ctx.font = STAT(size); }
    ctx.fillText(v, x + col * i, l1 + 62);
  });
  const l2 = l1 + 150;
  label(ctx, "Volume", x, l2, 18);
  label(ctx, "Séries", x + col, l2, 18);
  label(ctx, "PRs", x + col * 2, l2, 18);
  stat(ctx, volOf(s), "", x, l2 + 62, 66, false, col - 26);
  stat(ctx, String(s.day?.series ?? 0), "", x + col, l2 + 62, 66, false, col - 26);
  stat(ctx, String(s.prs), "", x + col * 2, l2 + 62, 66, true, col - 26);
  if (s.day?.splitMuscular.length) {
    splitBar(ctx, s.day.splitMuscular, x, l2 + 108, w, 12);
    splitInline(ctx, s.day.splitMuscular, x, l2 + 158, 20);
  }
  shadowOff(ctx);
};

/** Overlay · circuito do treino — bloco ancorado embaixo. */
const dayCircuit: Art["draw"] = (ctx, s, logo) => {
  const x = PAD;
  const w = W - PAD * 2;
  const h = 430;
  const top = H - h - PAD;
  overlayScrim(ctx, x, top, w, h);
  shadowOn(ctx);
  brandInline(ctx, x, top + 16, logo, 26);
  label(ctx, "Treino de hoje", x, top + 84, 18);
  let size = 92;
  ctx.font = STAT(size);
  const nome = s.sessionName.toUpperCase();
  while (size > 40 && ctx.measureText(nome).width > w) { size -= 4; ctx.font = STAT(size); }
  ctx.fillStyle = GIZ;
  ctx.fillText(nome, x, top + 168);
  ctx.font = TEXT(24, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(`${s.exercisesDone} exercícios · ${s.day?.series ?? 0} séries`, x, top + 210);
  divider(ctx, x, top + 244, w);
  if (s.day?.splitMuscular.length) {
    label(ctx, "Volume por grupo", x, top + 288, 18);
    splitBar(ctx, s.day.splitMuscular, x, top + 306, w, 14);
    splitInline(ctx, s.day.splitMuscular, x, top + 356, 21);
  }
  divider(ctx, x, top + 382, w);
  ctx.font = TEXT(28, 700);
  ctx.fillStyle = GIZ;
  const partes = [dur(s), `${kcalOf(s)} kcal`];
  let cursor = x;
  partes.forEach((t) => {
    ctx.fillText(t, cursor, top + 424);
    cursor += ctx.measureText(t).width;
    ctx.fillStyle = FADED;
    ctx.fillText("  ·  ", cursor, top + 424);
    cursor += ctx.measureText("  ·  ").width;
    ctx.fillStyle = GIZ;
  });
  if (s.prs > 0) {
    ctx.fillStyle = AQUA;
    ctx.fillText(`${s.prs} PR`, cursor, top + 424);
  }
  shadowOff(ctx);
};

/** Overlay · stats limpos — coluna alinhada à direita, marca no pé. */
const dayClean: Art["draw"] = (ctx, s, logo) => {
  const right = W - PAD;
  const linhas: [string, string, boolean][] = [
    ["Treino", s.sessionName, false],
    ["Duração", dur(s), false],
    ["Calorias", kcalOf(s), false],
  ];
  if (s.prs > 0) linhas.push(["PRs", String(s.prs), true]);
  const height = linhas.length * 152 + 70;
  const top = H - PAD - height;
  overlayScrim(ctx, PAD, top, W - PAD * 2, height);
  shadowOn(ctx);
  ctx.textAlign = "right";
  let y = top;
  linhas.forEach(([lbl, value, accent]) => {
    ctx.font = TEXT(20, 700);
    ctx.fillStyle = FADED;
    ctx.fillText(lbl.toUpperCase(), right, y);
    let size = 76;
    ctx.font = STAT(size);
    while (size > 34 && ctx.measureText(value).width > W - PAD * 2) { size -= 3; ctx.font = STAT(size); }
    ctx.fillStyle = accent ? AQUA : GIZ;
    ctx.fillText(value, right, y + 74);
    y += 152;
  });
  ctx.textAlign = "left";
  const largura = brandInline(ctx, 0, 0, null, 26, true);
  brandInline(ctx, right - largura, y + 4, logo, 26);
  shadowOff(ctx);
};

/** Card · treino concluído. */
const dayCard: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  cardHeader(ctx, s.dateLabel, logo, x, 150, w);
  bracket(ctx, "Treino concluído", x, 300);
  let size = 128;
  const nome = s.sessionName.toUpperCase();
  ctx.font = STAT(size);
  while (size > 52 && ctx.measureText(nome).width > w) { size -= 5; ctx.font = STAT(size); }
  ctx.fillStyle = GIZ;
  ctx.fillText(nome, x, 300 + size * 0.92);

  const boxY = 300 + size * 0.92 + 60;
  const gap = 18;
  const bw = (w - gap * 2) / 3;
  statBox(ctx, dur(s), "Duração", x, boxY, bw, 150);
  statBox(ctx, kcalOf(s), "Kcal", x + bw + gap, boxY, bw, 150);
  statBox(ctx, String(s.prs), "Novos PRs", x + (bw + gap) * 2, boxY, bw, 150, s.prs > 0);

  let y = boxY + 220;
  (s.day?.exerciseNames ?? []).slice(0, 7).forEach((ex) => {
    ctx.font = TEXT(30, 500);
    ctx.fillStyle = GIZ;
    let nomeEx = ex.name;
    while (ctx.measureText(nomeEx).width > w - 150) nomeEx = nomeEx.slice(0, -1);
    ctx.fillText(nomeEx === ex.name ? nomeEx : `${nomeEx}…`, x, y);
    ctx.textAlign = "right";
    ctx.font = TEXT(28, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText(`${ex.sets}×${ex.reps}`, x + w, y);
    ctx.textAlign = "left";
    y += 58;
  });
  cardFooter(ctx, "↻ reposte o treino", x, H - 260, w);
};

/** Card · o dia em números — 2×2 de caixas. */
const dayNumbers: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  cardHeader(ctx, s.dateLabel, logo, x, 150, w);
  bracket(ctx, "O dia em números", x, 300);

  const gap = 20;
  const bw = (w - gap) / 2;
  const bh = 175;
  statBox(ctx, volOf(s), "Kg volume", x, 350, bw, bh);
  statBox(ctx, kcalOf(s), "Kcal", x + bw + gap, 350, bw, bh);
  statBox(ctx, String(s.day?.series ?? 0), "Séries", x, 350 + bh + gap, bw, bh);
  statBox(ctx, String(s.prs), "Novos PRs", x + bw + gap, 350 + bh + gap, bw, bh, s.prs > 0);

  const y = 350 + (bh + gap) * 2 + 70;
  if (s.day?.splitMuscular.length) {
    label(ctx, "Divisão do volume", x, y, 18);
    splitBar(ctx, s.day.splitMuscular, x, y + 22, w, 16);
    splitInline(ctx, s.day.splitMuscular, x, y + 82, 22);
  }
  cardFooter(ctx, "Dia fechado. Respeito.", x, H - 260, w);
};

// ── SEMANA ─────────────────────────────────────────────────────────────────
/** Overlay · semana completa — volume + sparkline + checks + letras. */
const weekFull: Art["draw"] = (ctx, s, logo) => {
  const w = s.week;
  const x = PAD;
  const bw = W - PAD * 2;
  const h = 400;
  const top = H - h - PAD;
  overlayScrim(ctx, x, top, bw, h);
  shadowOn(ctx);
  brandInline(ctx, x, top + 16, logo, 26);
  label(ctx, `Semana ${w?.semanaNum ?? ""} · Volume`, x, top + 84, 18);
  ctx.font = STAT(96);
  ctx.fillStyle = GIZ;
  const vk = w ? fmtCompact(w.volumeKg) : "—";
  ctx.fillText(vk, x, top + 172);
  const vkW = ctx.measureText(vk).width;
  ctx.font = TEXT(34, 700);
  ctx.fillStyle = MUTED;
  ctx.fillText("kg", x + vkW + 14, top + 172);
  if (w) {
    trendLine(ctx, w.volumePorDia, x + bw - 300, top + 96, 300, 84, false);
    const after = dayChecks(ctx, w.diasCheck, x, top + 226, 52, 12);
    if (w.letrasTreino.length) {
      let cursor = x;
      w.letrasTreino.slice(0, 5).forEach((letra) => {
        ctx.fillStyle = "transparent";
        ctx.strokeStyle = "#3A3A38";
        ctx.lineWidth = 2;
        roundRect(ctx, cursor, after + 24, 46, 40, 12);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.font = TEXT(22, 700);
        ctx.fillStyle = GIZ;
        ctx.fillText(letra, cursor + 23, after + 51);
        ctx.textAlign = "left";
        cursor += 56;
      });
    }
    ctx.textAlign = "right";
    ctx.font = TEXT(24, 700);
    ctx.fillStyle = MUTED;
    const linha = `${fmtHoras(w.horas)} · ${w.kcal} kcal · `;
    const prTxt = `${w.prs} PR`;
    ctx.fillStyle = AQUA;
    ctx.fillText(prTxt, x + bw, after + 51);
    const prW = ctx.measureText(prTxt).width;
    ctx.fillStyle = MUTED;
    ctx.fillText(linha, x + bw - prW, after + 51);
    ctx.textAlign = "left";
  }
  shadowOff(ctx);
};

/** Overlay · semana (chip) — caixa compacta e fechada. */
const weekChip: Art["draw"] = (ctx, s, logo) => {
  const w = s.week;
  const treinos = w ? w.diasCheck.filter((d) => d !== "descanso").length : 0;
  const bw = W - PAD * 2;
  const bh = 360;
  const x = PAD;
  const top = H - bh - PAD;
  ctx.fillStyle = "rgba(16,16,16,0.94)";
  roundRect(ctx, x, top, bw, bh, 34);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  const px = x + 36;
  brandInline(ctx, px, top + 42, logo, 24);
  ctx.font = BRAND_F(34);
  ctx.fillStyle = GIZ;
  ctx.fillText(`${treinos} treinos`, px, top + 108);
  ctx.textAlign = "right";
  label(ctx, `Sem ${w?.semanaNum ?? ""}`, x + bw - 36, top + 102, 18);
  ctx.textAlign = "left";
  if (w) dayChecks(ctx, w.diasCheck, px, top + 142, 44, 10);
  const col = (bw - 72) / 3;
  stat(ctx, w ? fmtCompact(w.volumeKg) : "—", "Kg volume", px, top + 310, 58, false, col - 20);
  stat(ctx, `${treinos}/7`, "Dias", px + col, top + 310, 58, false, col - 20);
  stat(ctx, String(w?.prs ?? 0), "PRs", px + col * 2, top + 310, 58, true, col - 20);
};

/** Card · painel da semana. */
const weekPanel: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  const wk = s.week;
  const treinos = wk ? wk.diasCheck.filter((d) => d !== "descanso").length : 0;
  cardHeader(ctx, `Sem ${wk?.semanaNum ?? ""}`, logo, x, 150, w);
  bracket(ctx, "Sua semana", x, 300);
  ctx.font = STAT(120);
  ctx.fillStyle = GIZ;
  ctx.fillText(`${treinos} TREINOS`, x, 410);

  const after = wk ? dayChecks(ctx, wk.diasCheck, x, 470, 62, 16) : 530;
  const gap = 20;
  const bw = (w - gap) / 2;
  const bh = 165;
  const by = after + 60;
  if (wk) {
    statBox(ctx, fmtCompact(wk.volumeKg), "Kg volume", x, by, bw, bh);
    statBox(ctx, fmtHoras(wk.horas), "Horas", x + bw + gap, by, bw, bh);
    statBox(ctx, String(wk.kcal), "Kcal", x, by + bh + gap, bw, bh);
    statBox(ctx, String(wk.prs), "Novos PRs", x + bw + gap, by + bh + gap, bw, bh, wk.prs > 0);
  }
  cardFooter(ctx, "↻ reposte a semana", x, H - 260, w);
};

/** Card · sequência — número gigante fantasma ao fundo. */
const weekStreak: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  const wk = s.week;
  const treinos = wk ? wk.diasCheck.filter((d) => d !== "descanso").length : 0;
  const streak = wk?.streakSemanas ?? 0;

  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.font = STAT(560);
  ctx.fillStyle = GIZ;
  ctx.textAlign = "right";
  ctx.fillText(String(streak), W - 20, 470);
  ctx.textAlign = "left";
  ctx.restore();

  cardHeader(ctx, "Semana fechada", logo, x, 150, w);
  bracket(ctx, "Sequência", x, 330);
  ctx.font = STAT(230);
  ctx.fillStyle = AQUA;
  ctx.fillText(String(streak), x, 520);
  const numW = ctx.measureText(String(streak)).width;
  ctx.font = STAT(64);
  ctx.fillStyle = GIZ;
  ctx.fillText("SEMANAS", x + numW + 34, 440);
  ctx.fillText("SEGUIDAS", x + numW + 34, 512);

  ctx.font = TEXT(32, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText("Ninguém te segura.", x, 640);
  ctx.fillText(
    `${treinos} treino${treinos === 1 ? "" : "s"} essa semana${wk && wk.prs > 0 ? `, ${wk.prs} PR no bolso` : ""}.`,
    x,
    688
  );
  cardFooter(ctx, "Semana fechada. Respeito.", x, H - 260, w);
};

// ── MÊS ────────────────────────────────────────────────────────────────────
/** Overlay · o mês (chip). */
const monthChip: Art["draw"] = (ctx, s, logo) => {
  const m = s.month;
  const bw = W - PAD * 2;
  const bh = 280;
  const x = PAD;
  const top = H - bh - PAD;
  ctx.fillStyle = "rgba(16,16,16,0.94)";
  roundRect(ctx, x, top, bw, bh, 30);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  const px = x + 34;
  brandInline(ctx, px, top + 42, logo, 24);
  ctx.font = BRAND_F(34);
  ctx.fillStyle = GIZ;
  ctx.fillText(m?.mes ?? "", px, top + 108);
  ctx.textAlign = "right";
  ctx.font = TEXT(24, 700);
  ctx.fillStyle = AQUA;
  ctx.fillText(`${pctLabel(m?.evolucaoCargaPct ?? null)} CARGA`, x + bw - 34, top + 106);
  ctx.textAlign = "left";
  const col = (bw - 68) / 4;
  stat(ctx, m ? fmtCompact(m.volumeKg) : "—", "Kg", px, top + 220, 56, false, col - 16);
  stat(ctx, String(m?.treinos ?? 0), "Treinos", px + col, top + 220, 56, false, col - 16);
  stat(ctx, String(m?.prs ?? 0), "PRs", px + col * 2, top + 220, 56, true, col - 16);
  stat(ctx, `${m?.consistenciaPct ?? 0}%`, "Metas", px + col * 3, top + 220, 56, false, col - 16);
};

/** Overlay · evolução % — número gigante + linha subindo. */
const monthEvolution: Art["draw"] = (ctx, s, logo) => {
  const m = s.month;
  const x = PAD;
  const w = W - PAD * 2;
  const height = 500;
  const top = H - height - PAD;
  overlayScrim(ctx, x, top, w, height);
  shadowOn(ctx);
  brandInline(ctx, x, top + 30, logo, 26);
  label(ctx, `Carga total · ${m?.mes ?? ""}`, x, top + 100, 20);
  let size = 200;
  const txt = pctLabel(m?.evolucaoCargaPct ?? null);
  ctx.font = STAT(size);
  while (size > 90 && ctx.measureText(txt).width > w) { size -= 6; ctx.font = STAT(size); }
  ctx.fillStyle = GIZ;
  ctx.fillText(txt, x, top + 100 + size * 0.86);
  shadowOff(ctx);
  const serie = m?.volumePorSemana?.length ? m.volumePorSemana : [1, 2, 3, 4, 5];
  trendLine(ctx, serie, x, top + 100 + size * 0.86 + 40, w, 110);
  shadowOn(ctx);
  ctx.font = TEXT(30, 500);
  ctx.fillStyle = GIZ;
  ctx.fillText(
    m?.evolucaoCargaPct != null
      ? `A carga total subiu ${Math.round(m.evolucaoCargaPct)}% no mês. Segue.`
      : "Registre mais treinos para medir a evolução.",
    x,
    top + 100 + size * 0.86 + 210
  );
  shadowOff(ctx);
};

/** Card · % de aumento de carga — barras por movimento. */
const monthLifts: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  const m = s.month;
  cardHeader(ctx, m?.mes ?? "", logo, x, 150, w);
  bracket(ctx, "Evolução de carga", x, 300);
  ctx.font = STAT(150);
  ctx.fillStyle = GIZ;
  const pct = pctLabel(m?.evolucaoCargaPct ?? null);
  ctx.fillText(pct, x, 430);
  const pw = ctx.measureText(pct).width;
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText("na média", x + pw + 22, 400);
  ctx.fillText("dos movimentos", x + pw + 22, 434);

  const lifts = (m?.evolucaoPorLift ?? []).slice(0, 5);
  const maior = Math.max(...lifts.map((l) => Math.abs(l.pct)), 1);
  let y = 540;
  lifts.forEach((lift, i) => {
    ctx.font = TEXT(30, 700);
    ctx.fillStyle = GIZ;
    let nome = lift.nome;
    while (ctx.measureText(nome).width > w - 170) nome = nome.slice(0, -1);
    ctx.fillText(nome === lift.nome ? nome : `${nome}…`, x, y);
    ctx.textAlign = "right";
    ctx.font = TEXT(28, 700);
    ctx.fillStyle = i === 0 ? AQUA : MUTED;
    ctx.fillText(pctLabel(lift.pct), x + w, y);
    ctx.textAlign = "left";
    ctx.fillStyle = "#1E1E1E";
    roundRect(ctx, x, y + 20, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = i === 0 ? AQUA : "#5A5A58";
    roundRect(ctx, x, y + 20, Math.max(14, (Math.abs(lift.pct) / maior) * w), 12, 6);
    ctx.fill();
    y += 96;
  });
  if (!lifts.length) {
    ctx.font = TEXT(28, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText("Ainda sem movimentos repetidos no mês.", x, y);
  }
  cardFooter(ctx, "↻ reposte a evolução", x, H - 260, w);
};

/** Card · evolução do peso corporal. */
const monthWeight: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  const m = s.month;
  const bw = s.bodyWeight;
  cardHeader(ctx, `${m?.mes ?? ""} · ${m?.diasNoMes ?? 0} dias`, logo, x, 150, w);
  bracket(ctx, "Peso corporal", x, 300);

  const atual = bw?.atual != null ? bw.atual.toFixed(1).replace(".", ",") : "—";
  ctx.font = STAT(150);
  ctx.fillStyle = GIZ;
  ctx.fillText(atual, x, 430);
  const aw = ctx.measureText(atual).width;
  ctx.font = TEXT(38, 700);
  ctx.fillStyle = MUTED;
  ctx.fillText("kg", x + aw + 12, 430);
  if (bw?.delta != null && Math.abs(bw.delta) >= 0.1) {
    const sobe = bw.delta > 0;
    ctx.font = TEXT(28, 700);
    ctx.fillStyle = AQUA;
    ctx.fillText(`${sobe ? "↑" : "↓"} ${Math.abs(bw.delta).toFixed(1).replace(".", ",")}kg`, x + aw + 70, 430);
  }
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = FADED;
  ctx.fillText(
    bw?.inicial != null && bw?.atual != null
      ? `de ${bw.inicial.toFixed(1).replace(".", ",")} → ${bw.atual.toFixed(1).replace(".", ",")} no mês`
      : "registre o peso na aba Evolução",
    x,
    482
  );

  const serie = (bw?.serie ?? []).filter((v): v is number => v != null);
  if (serie.length > 1) {
    const chartY = 570;
    const chartH = 420;
    const min = Math.min(...serie);
    const max = Math.max(...serie);
    const span = max - min || 1;
    const step = w / (serie.length - 1);
    ctx.strokeStyle = GIZ;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    serie.forEach((v, i) => {
      const py = chartY + chartH - ((v - min) / span) * chartH * 0.8 - chartH * 0.1;
      if (i === 0) ctx.moveTo(x + i * step, py);
      else ctx.lineTo(x + i * step, py);
    });
    ctx.stroke();
    const last = serie[serie.length - 1];
    ctx.fillStyle = AQUA;
    ctx.beginPath();
    ctx.arc(x + (serie.length - 1) * step, chartY + chartH - ((last - min) / span) * chartH * 0.8 - chartH * 0.1, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = TEXT(22, 500);
    ctx.fillStyle = FADED;
    ctx.fillText("01", x, chartY + chartH + 44);
    ctx.textAlign = "right";
    ctx.fillText(String(m?.diasNoMes ?? ""), x + w, chartY + chartH + 44);
    ctx.textAlign = "left";
  }
  cardFooter(ctx, "↻ reposte o mês", x, H - 260, w);
};

/** Card · consistência (calendário real do mês). */
const monthConsistency: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  const m = s.month;
  cardHeader(ctx, m?.mes ?? "", logo, x, 150, w);
  bracket(ctx, "Consistência", x, 300);
  ctx.font = STAT(170);
  ctx.fillStyle = GIZ;
  const pc = `${m?.consistenciaPct ?? 0}`;
  ctx.fillText(pc, x, 450);
  const pcW = ctx.measureText(pc).width;
  ctx.font = STAT(80);
  ctx.fillStyle = MUTED;
  ctx.fillText("%", x + pcW + 10, 450);
  const simboloW = ctx.measureText("%").width;
  const textoX = x + pcW + 10 + simboloW + 34;
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(`${m?.treinos ?? 0} dias`, textoX, 412);
  ctx.fillText("treinados", textoX, 446);

  const cal = m?.calendario ?? [];
  const cols = 7;
  const gap = 14;
  const cell = Math.floor((w - gap * (cols - 1)) / cols);
  const startY = 540;
  cal.forEach((done, i) => {
    const cx = x + (i % cols) * (cell + gap);
    const cy = startY + Math.floor(i / cols) * (cell + gap);
    ctx.fillStyle = done ? GIZ : "transparent";
    roundRect(ctx, cx, cy, cell, cell, 18);
    if (done) ctx.fill();
    else {
      ctx.strokeStyle = "#242422";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  cardFooter(ctx, "Presença é PR também.", x, H - 260, w);
};

/** Card · PRs do mês. */
const monthPRs: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  const m = s.month;
  const names = (m?.prNomes ?? []).slice(0, 6);
  const total = m?.prs ?? 0;
  cardHeader(ctx, m?.mes ?? "", logo, x, 150, w);
  bracket(ctx, "PRs do mês", x, 300);
  ctx.font = STAT(210);
  ctx.fillStyle = AQUA;
  const n = String(total);
  ctx.fillText(n, x, 470);
  const nw = ctx.measureText(n).width;
  ctx.font = STAT(62);
  ctx.fillStyle = GIZ;
  ctx.fillText("NOVOS", x + nw + 30, 400);
  ctx.fillText("RECORDES", x + nw + 30, 468);

  let y = 600;
  names.forEach((name) => {
    ctx.font = TEXT(32, 700);
    ctx.fillStyle = GIZ;
    let nome = name;
    while (ctx.measureText(nome).width > w - 90) nome = nome.slice(0, -1);
    ctx.fillText(nome === name ? nome : `${nome}…`, x, y);
    ctx.textAlign = "right";
    ctx.font = TEXT(30, 700);
    ctx.fillStyle = AQUA;
    ctx.fillText("↑", x + w, y);
    ctx.textAlign = "left";
    divider(ctx, x, y + 26, w);
    y += 82;
  });
  if (!names.length) {
    ctx.font = TEXT(28, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText("Nenhum recorde registrado neste mês.", x, y);
  }
  ctx.font = TEXT(26, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(
    `${total} recorde${total === 1 ? "" : "s"} em ${names.length} movimento${names.length === 1 ? "" : "s"}.`,
    x,
    H - 300
  );
  cardFooter(ctx, "↻ reposte o mês", x, H - 260, w);
};

/** Card · retrospectiva (arte-âncora). */
const monthRecap: Art["draw"] = (ctx, s, logo) => {
  const { x, w } = cardFrame(ctx);
  const m = s.month;
  cardHeader(ctx, String(new Date().getFullYear()), logo, x, 150, w);
  bracket(ctx, "Retrospectiva", x, 300);
  let size = 140;
  const mes = (m?.mes ?? "").toUpperCase();
  ctx.font = STAT(size);
  while (size > 60 && ctx.measureText(mes).width > w) { size -= 5; ctx.font = STAT(size); }
  ctx.fillStyle = GIZ;
  ctx.fillText(mes, x, 300 + size);

  // marca d'água discreta
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    const mw = 620;
    ctx.drawImage(logo, x + w - mw, H - 700, mw, Math.round((mw * 500) / 691));
    ctx.restore();
  }

  const linhas: [string, string, boolean][] = [
    [String(m?.treinos ?? 0), "Treinos", false],
    [m ? fmtCompact(m.volumeKg) : "—", "Kg movimentados", true],
  ];
  let y = 300 + size + 130;
  linhas.forEach(([value, lbl, accent]) => {
    ctx.font = STAT(110);
    ctx.fillStyle = accent ? AQUA : GIZ;
    ctx.fillText(value, x, y);
    const vw = ctx.measureText(value).width;
    label(ctx, lbl, x + vw + 26, y - 12, 24, MUTED);
    divider(ctx, x, y + 40, w);
    y += 160;
  });
  ctx.font = STAT(110);
  ctx.fillStyle = GIZ;
  const prs = String(m?.prs ?? 0);
  ctx.fillText(prs, x, y);
  const pw2 = ctx.measureText(prs).width;
  label(ctx, `PRs · ${m?.streakSemanas ?? 0} sem streak`, x + pw2 + 26, y - 12, 24, MUTED);

  cardFooter(ctx, "↻ compartilhe seu mês", x, H - 260, w);
};

const ARTS: Art[] = [
  { key: "dia-grid", label: "Grid + volume", period: "dia", kind: "overlay", draw: dayGrid },
  { key: "dia-circuito", label: "Circuito do treino", period: "dia", kind: "overlay", draw: dayCircuit },
  { key: "dia-limpo", label: "Stats limpos", period: "dia", kind: "overlay", draw: dayClean },
  { key: "dia-card", label: "Treino concluído", period: "dia", kind: "card", draw: dayCard },
  { key: "dia-numeros", label: "O dia em números", period: "dia", kind: "card", draw: dayNumbers },
  { key: "sem-completa", label: "Semana completa", period: "semana", kind: "overlay", draw: weekFull },
  { key: "sem-chip", label: "Semana (chip)", period: "semana", kind: "overlay", draw: weekChip },
  { key: "sem-painel", label: "Painel da semana", period: "semana", kind: "card", draw: weekPanel },
  { key: "sem-streak", label: "Sequência", period: "semana", kind: "card", draw: weekStreak },
  { key: "mes-chip", label: "O mês (chip)", period: "mes", kind: "overlay", draw: monthChip },
  { key: "mes-evolucao", label: "Evolução %", period: "mes", kind: "overlay", draw: monthEvolution },
  { key: "mes-lifts", label: "% de carga", period: "mes", kind: "card", draw: monthLifts },
  { key: "mes-peso", label: "Evolução do peso", period: "mes", kind: "card", draw: monthWeight },
  { key: "mes-consistencia", label: "Consistência", period: "mes", kind: "card", draw: monthConsistency },
  { key: "mes-prs", label: "PRs do mês", period: "mes", kind: "card", draw: monthPRs },
  { key: "mes-recap", label: "Retrospectiva", period: "mes", kind: "card", draw: monthRecap },
];

const cheio: ShareStats = {
  appName:"RTrainning", profileName:"Rafael", sessionName:"Push A", planName:"Plano", dateLabel:"hoje · 19:42",
  exercisesDone:6, exercisesTotal:6, improved:3, prs:2, avgIncreasePct:6.4, weeklyDone:3, weeklyTarget:5,
  durationSeconds:4320, caloriesEstimate:842, loads:[],
  day:{ volumeKg:12480, series:22, splitMuscular:[{grupo:"Peito",pct:50},{grupo:"Ombro",pct:30},{grupo:"Tríceps",pct:20}],
        exerciseNames:[{name:"Supino reto",sets:4,reps:"8"},{name:"Desenvolvimento",sets:3,reps:"10"},
                       {name:"Supino inclinado",sets:3,reps:"10"},{name:"Tríceps corda",sets:4,reps:"12"}] },
  week:{ semanaNum:42, diasCheck:["treino","descanso","treino","treino","descanso","hoje","descanso"],
         volumePorDia:[9800,0,11200,10400,0,12480,0], volumeKg:41200, horas:4.966, kcal:3240, prs:3, streakSemanas:8, letrasTreino:["A","B","C","D"] },
  month:{ mes:"Outubro", diasNoMes:31, volumeKg:52400, treinos:16, prs:5,
          prNomes:["Agachamento","Supino reto","Levantamento terra","Desenvolvimento","Remada curvada"],
          consistenciaPct:80, evolucaoCargaPct:14,
          evolucaoPorLift:[{nome:"Agachamento",pct:18},{nome:"Supino reto",pct:12},{nome:"Levantamento terra",pct:9},{nome:"Desenvolvimento",pct:7},{nome:"Remada curvada",pct:5}],
          volumePorSemana:[11800,13200,12600,14800,0], calendario:Array.from({length:31},(_,i)=>[0,2,4,7,9,11,14,16,18,21,23,25,28,29,30].includes(i)), streakSemanas:8 },
  bodyWeight:{ serie:Array.from({length:31},(_,i)=>78.4-(i*0.042)), atual:77.1, inicial:78.4, delta:-1.3 },
};
const vazio: ShareStats = { ...cheio, durationSeconds:null, caloriesEstimate:null, prs:0, day:undefined, week:undefined, month:undefined, bodyWeight:undefined };
const longo: ShareStats = { ...cheio, sessionName:"Treino de Posterior Completo", durationSeconds:36000,
  day:{ ...cheio.day!, volumeKg:152400, series:120, exerciseNames:[{name:"Romanian deadlift com barra hexagonal",sets:4,reps:"8"}] },
  month:{ ...cheio.month!, evolucaoPorLift:[{nome:"Levantamento terra romeno unilateral",pct:118}] } };

const arts: [string, any, boolean][] = [
  ["dia-grid",dayGrid,false],["dia-circuito",dayCircuit,false],["dia-limpo",dayClean,false],
  ["dia-card",dayCard,true],["dia-numeros",dayNumbers,true],
  ["sem-completa",weekFull,false],["sem-chip",weekChip,false],["sem-painel",weekPanel,true],["sem-streak",weekStreak,true],
  ["mes-chip",monthChip,false],["mes-evolucao",monthEvolution,false],["mes-lifts",monthLifts,true],
  ["mes-peso",monthWeight,true],["mes-consistencia",monthConsistency,true],["mes-prs",monthPRs,true],["mes-recap",monthRecap,true],
];


// ── Detector de sobreposição e estouro ────────────────────────────────────
interface Caixa { texto: string; x: number; y: number; w: number; h: number; }

function contextoInstrumentado(base: any, caixas: Caixa[]) {
  return new Proxy(base, {
    get(t, prop: string) {
      if (prop === "fillText") {
        return (texto: string, x: number, y: number) => {
          const m = base.measureText(texto);
          const w = m.width;
          const px = parseInt(String(base.font).match(/(\d+)px/)?.[1] ?? "16", 10);
          const alt = px * 0.74; // altura de caixa aproximada (cap height)
          let x0 = x;
          if (base.textAlign === "right") x0 = x - w;
          if (base.textAlign === "center") x0 = x - w / 2;
          let y0 = y - alt;
          if (base.textBaseline === "middle") y0 = y - alt / 2;
          // Marca d'água decorativa (alpha baixo) não conta como sobreposição.
          if (String(texto).trim() && (base.globalAlpha ?? 1) > 0.2)
            caixas.push({ texto: String(texto), x: x0, y: y0, w, h: alt });
          return base.fillText(texto, x, y);
        };
      }
      const v = t[prop];
      return typeof v === "function" ? v.bind(t) : v;
    },
    set(t, prop: string, value) { t[prop] = value; return true; },
  });
}

function sobrepoe(a: Caixa, b: Caixa) {
  const folga = 2;
  return a.x < b.x + b.w - folga && a.x + a.w - folga > b.x && a.y < b.y + b.h - folga && a.y + a.h - folga > b.y;
}

async function auditar() {
  const fontDir = process.env.RTRAINNING_FONT_DIR ?? path.resolve("tmp", "fonts");
  registerFont(path.join(fontDir, "Anton-Regular.ttf"), { family: "Anton" });
  registerFont(path.join(fontDir, "Archivo-Black.ttf"), { family: "Archivo", weight: "900" });
  registerFont(path.join(fontDir, "SpaceGrotesk-Regular.ttf"), { family: "Space Grotesk", weight: "500" });
  registerFont(path.join(fontDir, "SpaceGrotesk-Bold.ttf"), { family: "Space Grotesk", weight: "700" });
  const logo = await loadImage("./public/assets/logo-white.png");

  let problemas = 0;
  const casos: [string, ShareStats][] = [["padrão", cheio], ["sem dados", vazio], ["textos longos", longo]];
  for (const [nome, draw] of arts) {
    for (const [caso, stats] of casos) {
      const canvas = createCanvas(1080, 1920);
      const raw: any = canvas.getContext("2d");
      raw.textBaseline = "alphabetic";
      const caixas: Caixa[] = [];
      const ctx = contextoInstrumentado(raw, caixas);
      draw(ctx, stats, logo);

      for (const c of caixas) {
        if (c.x < -1 || c.x + c.w > 1081) {
          problemas++;
          console.log(`ESTOURA LATERAL  ${nome} [${caso}] "${c.texto.slice(0,26)}" x=${Math.round(c.x)} fim=${Math.round(c.x+c.w)}`);
        }
        if (c.y < -1 || c.y + c.h > 1921) {
          problemas++;
          console.log(`ESTOURA VERTICAL ${nome} [${caso}] "${c.texto.slice(0,26)}" y=${Math.round(c.y)}`);
        }
      }
      for (let i = 0; i < caixas.length; i++)
        for (let j = i + 1; j < caixas.length; j++)
          if (sobrepoe(caixas[i], caixas[j])) {
            problemas++;
            console.log(`SOBREPOSIÇÃO     ${nome} [${caso}] "${caixas[i].texto.slice(0,20)}" × "${caixas[j].texto.slice(0,20)}"`);
          }
    }
  }
  console.log(problemas === 0 ? "\nnenhum texto sobreposto ou fora do quadro" : `\n${problemas} problemas`);
}
auditar();
