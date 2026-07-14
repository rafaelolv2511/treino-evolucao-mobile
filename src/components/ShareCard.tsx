"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatDuration } from "@/lib/calc";
import Icon from "./Icons";
import { TabBar } from "./ui";

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
}

const W = 1080;
const H = 1920;
type ShareTab = "instagram" | "transparent";
type Concept = "pulse" | "impact" | "flow";

const CONCEPTS: { key: Concept; label: string }[] = [
  { key: "pulse", label: "Pulso" },
  { key: "impact", label: "Impacto" },
  { key: "flow", label: "Fluxo" },
];

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function accent(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, "#22D3EE");
  gradient.addColorStop(1, "#8B7CF8");
  return gradient;
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, basePx: number, font: string): number {
  let size = basePx;
  ctx.font = `700 ${size}px ${font}`;
  while (size > 40 && ctx.measureText(text).width > maxWidth) {
    size -= 10;
    ctx.font = `700 ${size}px ${font}`;
  }
  return size;
}

function compactName(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let output = value;
  while (output.length > 2 && ctx.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
  return `${output}…`;
}

function metricTime(stats: ShareStats) {
  return stats.durationSeconds == null ? null : formatDuration(stats.durationSeconds);
}

function metricCalories(stats: ShareStats) {
  return stats.caloriesEstimate == null ? null : `~${Math.round(stats.caloriesEstimate)} kcal`;
}

function applyReadableText(ctx: CanvasRenderingContext2D, transparent: boolean, color = "#F8FBFF") {
  ctx.fillStyle = color;
  ctx.shadowColor = transparent ? "rgba(0,0,0,0.9)" : "transparent";
  ctx.shadowBlur = transparent ? 14 : 0;
  ctx.lineJoin = "round";
}

function localScrim(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, transparent: boolean) {
  if (!transparent) return;
  ctx.save();
  roundedRect(ctx, x, y, width, height, 28);
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.fill();
  ctx.restore();
}

function drawBrand(ctx: CanvasRenderingContext2D, x: number, y: number, align: CanvasTextAlign = "left") {
  ctx.textAlign = align;
  ctx.font = "700 34px 'Space Grotesk', sans-serif";
  ctx.fillStyle = accent(ctx, x - 120, y, x + 160, y);
  ctx.fillText("RTrainning", x, y);
}

function drawLineChart(
  ctx: CanvasRenderingContext2D,
  stats: ShareStats,
  x: number,
  y: number,
  width: number,
  height: number,
  transparent: boolean,
  lightBackground = false
) {
  const loads = stats.loads.length ? stats.loads : [{ name: "Treino", load: 1 }];
  const max = Math.max(...loads.map((item) => item.load), 1);
  const min = Math.min(...loads.map((item) => item.load), max);
  const spread = Math.max(1, max - min);
  ctx.save();
  ctx.beginPath();
  loads.forEach((item, index) => {
    const px = x + (index / Math.max(1, loads.length - 1)) * width;
    const normalized = loads.length === 1 ? 0.5 : (item.load - min) / spread;
    const py = y + height - (0.18 + normalized * 0.64) * height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = accent(ctx, x, y, x + width, y);
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(34,211,238,0.65)";
  ctx.shadowBlur = transparent ? 24 : 16;
  ctx.stroke();
  ctx.shadowBlur = 0;
  loads.forEach((item, index) => {
    const px = x + (index / Math.max(1, loads.length - 1)) * width;
    const normalized = loads.length === 1 ? 0.5 : (item.load - min) / spread;
    const py = y + height - (0.18 + normalized * 0.64) * height;
    ctx.fillStyle = lightBackground ? "#0A0D12" : "#F5FCFF";
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fill();
    if (lightBackground) {
      ctx.strokeStyle = "#22D3EE";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawWeekChecks(
  ctx: CanvasRenderingContext2D,
  stats: ShareStats,
  centerX: number,
  y: number,
  transparent: boolean,
  lightBackground = false
) {
  const count = Math.max(1, stats.weeklyTarget, stats.weeklyDone);
  const radius = count > 7 ? 15 : 20;
  const gap = count > 7 ? 18 : 24;
  const width = count * radius * 2 + (count - 1) * gap;
  let x = centerX - width / 2 + radius;
  for (let index = 0; index < count; index++) {
    const done = index < stats.weeklyDone;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (done) {
      ctx.fillStyle = "#34D399";
      ctx.fill();
      ctx.strokeStyle = "#062E23";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x - 1, y + 6);
      ctx.lineTo(x + 9, y - 8);
      ctx.stroke();
    } else {
      ctx.strokeStyle = transparent
        ? "rgba(255,255,255,0.88)"
        : lightBackground
          ? "rgba(17,21,28,0.28)"
          : "rgba(255,255,255,0.28)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    x += radius * 2 + gap;
  }
}

function drawCoreMetrics(ctx: CanvasRenderingContext2D, stats: ShareStats, x: number, y: number, transparent: boolean) {
  const values = [
    [metricTime(stats), "TEMPO"],
    [metricCalories(stats), "ESTIMATIVA"],
    [`${stats.exercisesDone}/${stats.exercisesTotal}`, "EXERCÍCIOS"],
  ].filter(([value]) => value !== null) as string[][];
  const width = 880 / values.length;
  localScrim(ctx, x - 25, y - 85, 930, 180, transparent);
  values.forEach(([value, label], index) => {
    const px = x + index * width;
    ctx.textAlign = "left";
    applyReadableText(ctx, transparent);
    ctx.font = "700 54px 'Space Grotesk', sans-serif";
    ctx.fillText(value, px, y);
    ctx.font = "700 22px 'Inter', sans-serif";
    ctx.fillStyle = transparent ? "#E8F8FF" : "rgba(255,255,255,0.5)";
    ctx.fillText(label, px, y + 42);
  });
  ctx.shadowBlur = 0;
}

function drawInstagramBackground(ctx: CanvasRenderingContext2D, concept: Concept) {
  if (concept === "pulse") {
    ctx.fillStyle = "#07090F";
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(880, 220, 0, 880, 220, 900);
    glow.addColorStop(0, "rgba(139,124,248,0.42)");
    glow.addColorStop(0.55, "rgba(34,211,238,0.1)");
    glow.addColorStop(1, "rgba(7,9,15,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  } else if (concept === "impact") {
    ctx.fillStyle = "#F4F7FA";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0A0D12";
    ctx.fillRect(0, 0, W, 930);
    ctx.fillStyle = "#22D3EE";
    ctx.fillRect(0, 920, W * 0.58, 18);
    ctx.fillStyle = "#8B7CF8";
    ctx.fillRect(W * 0.58, 920, W * 0.42, 18);
  } else {
    ctx.fillStyle = "#090A0E";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#151923";
    roundedRect(ctx, 52, 52, W - 104, H - 104, 48);
    ctx.fill();
    ctx.strokeStyle = "rgba(34,211,238,0.35)";
    ctx.lineWidth = 3;
    roundedRect(ctx, 52, 52, W - 104, H - 104, 48);
    ctx.stroke();
  }
}

function renderPulse(ctx: CanvasRenderingContext2D, stats: ShareStats, transparent: boolean) {
  if (!transparent) drawInstagramBackground(ctx, "pulse");
  localScrim(ctx, 65, 95, 950, 360, transparent);
  drawBrand(ctx, 90, 155);
  ctx.textAlign = "left";
  applyReadableText(ctx, transparent);
  ctx.font = "600 30px 'Inter', sans-serif";
  ctx.fillText(compactName(ctx, `${stats.profileName} · ${stats.dateLabel}`, 900), 90, 225);
  ctx.font = "700 92px 'Space Grotesk', sans-serif";
  ctx.fillText(compactName(ctx, stats.sessionName, 900), 90, 350);
  ctx.font = "700 34px 'Inter', sans-serif";
  ctx.fillStyle = "#34D399";
  ctx.fillText("TREINO CONCLUÍDO", 92, 410);
  drawCoreMetrics(ctx, stats, 90, 600, transparent);

  localScrim(ctx, 60, 760, 960, 500, transparent);
  ctx.textAlign = "left";
  applyReadableText(ctx, transparent);
  ctx.font = "700 24px 'Inter', sans-serif";
  ctx.fillText("PULSO DE CARGAS", 90, 825);
  drawLineChart(ctx, stats, 100, 865, 880, 300, transparent);

  localScrim(ctx, 150, 1370, 780, 260, transparent);
  ctx.textAlign = "center";
  applyReadableText(ctx, transparent);
  ctx.font = "700 42px 'Space Grotesk', sans-serif";
  ctx.fillText(`Semana ${stats.weeklyDone}/${stats.weeklyTarget}`, W / 2, 1460);
  drawWeekChecks(ctx, stats, W / 2, 1530, transparent);
  if (stats.prs > 0) {
    ctx.fillStyle = "#FBBF24";
    ctx.font = "700 30px 'Inter', sans-serif";
    ctx.fillText(`${stats.prs} ${stats.prs === 1 ? "PR batido" : "PRs batidos"}`, W / 2, 1600);
  }
  ctx.shadowBlur = 0;
}

function renderImpact(ctx: CanvasRenderingContext2D, stats: ShareStats, transparent: boolean) {
  if (!transparent) drawInstagramBackground(ctx, "impact");
  const darkText = !transparent;
  localScrim(ctx, 55, 75, 970, 790, transparent);
  drawBrand(ctx, W / 2, 140, "center");
  ctx.textAlign = "center";
  applyReadableText(ctx, transparent);
  const heroValue = metricTime(stats) ?? `${stats.exercisesDone}`;
  const heroSize = fitFont(ctx, heroValue, 940, 250, "'Space Grotesk', sans-serif");
  ctx.font = `700 ${heroSize}px 'Space Grotesk', sans-serif`;
  ctx.fillText(heroValue, W / 2, 470);
  ctx.font = "700 30px 'Inter', sans-serif";
  ctx.fillStyle = transparent ? "#EAF6FF" : "rgba(255,255,255,0.58)";
  ctx.fillText(metricTime(stats) ? "DE TREINO" : "EXERCÍCIOS", W / 2, 535);
  ctx.font = "700 70px 'Space Grotesk', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(compactName(ctx, stats.sessionName, 890), W / 2, 690);
  ctx.font = "600 30px 'Inter', sans-serif";
  ctx.fillStyle = "#34D399";
  ctx.fillText(compactName(ctx, `${stats.profileName} · ${stats.dateLabel}`, 900), W / 2, 755);

  if (!transparent) {
    ctx.fillStyle = "#11151C";
    ctx.shadowBlur = 0;
  }
  localScrim(ctx, 55, 960, 970, 700, transparent);
  ctx.textAlign = "left";
  applyReadableText(ctx, transparent, darkText ? "#11151C" : "#F8FBFF");
  ctx.font = "700 62px 'Space Grotesk', sans-serif";
  ctx.fillText(metricCalories(stats) ?? `${stats.exercisesDone}/${stats.exercisesTotal} exercícios`, 90, 1060);
  ctx.font = "700 24px 'Inter', sans-serif";
  ctx.fillStyle = darkText ? "rgba(17,21,28,0.55)" : "#E8F8FF";
  ctx.fillText(metricCalories(stats) ? "CALORIAS · ESTIMATIVA" : "REGISTRADOS HOJE", 92, 1110);
  drawLineChart(ctx, stats, 100, 1190, 880, 250, transparent, !transparent);
  ctx.textAlign = "center";
  applyReadableText(ctx, transparent, darkText ? "#11151C" : "#FFFFFF");
  ctx.font = "700 38px 'Space Grotesk', sans-serif";
  ctx.fillText(`Semana ${stats.weeklyDone}/${stats.weeklyTarget}`, W / 2, 1530);
  drawWeekChecks(ctx, stats, W / 2, 1600, transparent, !transparent);
  ctx.shadowBlur = 0;
}

function renderFlow(ctx: CanvasRenderingContext2D, stats: ShareStats, transparent: boolean) {
  if (!transparent) drawInstagramBackground(ctx, "flow");
  localScrim(ctx, 80, 90, 920, 300, transparent);
  drawBrand(ctx, 100, 150);
  ctx.textAlign = "left";
  applyReadableText(ctx, transparent);
  ctx.font = "700 82px 'Space Grotesk', sans-serif";
  ctx.fillText(compactName(ctx, stats.profileName, 820), 100, 275);
  ctx.font = "600 28px 'Inter', sans-serif";
  ctx.fillStyle = transparent ? "#F2FAFF" : "rgba(255,255,255,0.55)";
  ctx.fillText(`${stats.sessionName} · ${stats.dateLabel}`, 102, 330);

  const metrics = [
    [metricTime(stats), "TEMPO"],
    [metricCalories(stats), "KCAL · EST."],
    [`${stats.exercisesDone}/${stats.exercisesTotal}`, "EXERCÍCIOS"],
    [stats.prs > 0 ? String(stats.prs) : null, "PRS BATIDOS"],
  ].filter(([value]) => value !== null) as string[][];
  metrics.forEach(([value, label], index) => {
    const y = 520 + index * 185;
    localScrim(ctx, 80, y - 90, 400, 150, transparent);
    ctx.textAlign = "left";
    applyReadableText(ctx, transparent);
    ctx.font = "700 68px 'Space Grotesk', sans-serif";
    ctx.fillText(value, 110, y);
    ctx.font = "700 21px 'Inter', sans-serif";
    ctx.fillStyle = transparent ? "#EAF6FF" : "rgba(255,255,255,0.45)";
    ctx.fillText(label, 112, y + 36);
  });

  localScrim(ctx, 500, 460, 500, 760, transparent);
  ctx.textAlign = "center";
  applyReadableText(ctx, transparent);
  ctx.font = "700 26px 'Inter', sans-serif";
  ctx.fillText("EVOLUÇÃO DE CARGAS", 750, 540);
  drawLineChart(ctx, stats, 550, 650, 400, 430, transparent);

  localScrim(ctx, 100, 1380, 880, 260, transparent);
  ctx.font = "700 44px 'Space Grotesk', sans-serif";
  ctx.fillText(`Semana ${stats.weeklyDone}/${stats.weeklyTarget}`, W / 2, 1470);
  drawWeekChecks(ctx, stats, W / 2, 1550, transparent);
  ctx.shadowBlur = 0;
}

function renderCanvas(ctx: CanvasRenderingContext2D, stats: ShareStats, concept: Concept, transparent: boolean) {
  ctx.clearRect(0, 0, W, H);
  if (concept === "pulse") renderPulse(ctx, stats, transparent);
  else if (concept === "impact") renderImpact(ctx, stats, transparent);
  else renderFlow(ctx, stats, transparent);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar o PNG."))), "image/png");
  });
}

export default function ShareCard({ stats, onClose }: { stats: ShareStats; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<ShareTab>("instagram");
  const [instagramConcept, setInstagramConcept] = useState<Concept>("pulse");
  const [transparentConcept, setTransparentConcept] = useState<Concept>("pulse");
  const [message, setMessage] = useState<string | null>(null);
  const concept = tab === "instagram" ? instagramConcept : transparentConcept;

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      } catch {}
      if (cancelled || !canvasRef.current) return;
      const context = canvasRef.current.getContext("2d", { alpha: true });
      if (context) renderCanvas(context, stats, concept, tab === "transparent");
    })();
    return () => {
      cancelled = true;
    };
  }, [concept, stats, tab]);

  function fileName() {
    const kind = tab === "transparent" ? "overlay" : "story";
    const cleanSession = stats.sessionName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    return `rtrainning-${kind}-${cleanSession}-${stats.dateLabel.replace(/\//g, "-")}.png`;
  }

  async function save() {
    if (!canvasRef.current) return;
    const blob = await canvasBlob(canvasRef.current);
    const file = new File([blob], fileName(), { type: "image/png" });
    // iOS/Android: a folha nativa com um único arquivo de imagem oferece
    // "Salvar imagem", que grava direto na galeria (não existe API web que
    // escreva nas Fotos sem essa etapa). Download em aba fica só para desktop.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        setMessage('Na folha que abrir, toque em "Salvar imagem" para gravar na galeria.');
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        setMessage(null);
        if ((err as DOMException)?.name === "AbortError") return; // usuário fechou a folha
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

  async function copyTransparent() {
    if (!canvasRef.current) return;
    try {
      const ClipboardItemApi = window.ClipboardItem;
      if (!navigator.clipboard?.write || !ClipboardItemApi) throw new Error("clipboard-unavailable");
      const blobPromise = canvasBlob(canvasRef.current);
      const item = new ClipboardItemApi({ "image/png": blobPromise as unknown as Blob });
      await navigator.clipboard.write([item]);
      setMessage("Copiado! Agora é só colar sobre sua foto ou vídeo.");
    } catch {
      setMessage("Não foi possível copiar neste navegador. Use Salvar PNG.");
    }
  }

  async function share() {
    if (!canvasRef.current) return;
    const blob = await canvasBlob(canvasRef.current);
    const file = new File([blob], fileName(), { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Meu treino no RTrainning" });
      } catch {
        return;
      }
    } else {
      await save();
      setMessage("Compartilhamento direto indisponível. O PNG foi salvo.");
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[10020] flex h-dvh flex-col overflow-hidden bg-[#080A0F]">
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button onClick={onClose} className="btn btn-ghost !min-h-0 !px-3 !py-2" aria-label="Fechar compartilhamento">
          <Icon name="x" size={17} />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white/80">Compartilhar treino</p>
      </div>

      <div className="shrink-0 px-4 pb-2">
        <TabBar
          tabs={[
            { key: "instagram", label: "Instagram" },
            { key: "transparent", label: "PNG transparente" },
          ]}
          value={tab}
          onChange={(value) => {
            setMessage(null);
            setTab(value);
          }}
        />
        <div className="mt-2 flex gap-1 rounded-2xl bg-white/10 p-1">
          {CONCEPTS.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setMessage(null);
                if (tab === "instagram") setInstagramConcept(item.key);
                else setTransparentConcept(item.key);
              }}
              className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
                concept === item.key ? "bg-white/14 text-white" : "text-white/45"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 py-2 ${
          tab === "transparent" ? "share-checker" : ""
        }`}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block max-h-full max-w-full border border-white/15 shadow-2xl"
          style={{ aspectRatio: "9 / 16" }}
        />
      </div>

      {message && <p className="shrink-0 px-5 pt-2 text-center text-xs text-emerald-300">{message}</p>}
      <div className="flex shrink-0 gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <button onClick={save} className="btn btn-ghost flex flex-1 items-center justify-center gap-2">
          <Icon name="download" size={16} /> Salvar
        </button>
        {tab === "instagram" ? (
          <button onClick={share} className="btn btn-primary flex flex-[1.2] items-center justify-center gap-2">
            <Icon name="share" size={16} /> Compartilhar
          </button>
        ) : (
          <button onClick={copyTransparent} className="btn btn-primary flex flex-[1.2] items-center justify-center gap-2">
            <Icon name="copy" size={16} /> Copiar
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
