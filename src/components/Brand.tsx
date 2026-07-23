"use client";

/**
 * Marca RTrainning — identidade Carbon.
 * Símbolo aprovado (anilha → zigue-zague → seta de compartilhar): PNGs oficiais
 * em /assets, nunca redesenhados. Wordmark em Archivo 900, caixa mista, cor
 * única: "RT" no tamanho cheio e "rainning" em 0.72em.
 */
export function BrandMark({ size = 28, variant = "white" }: { size?: number; variant?: "white" | "aqua" | "dark" }) {
  const src = variant === "aqua" ? "/assets/logo-volt.png" : variant === "dark" ? "/assets/logo-dark.png" : "/assets/logo-white.png";
  // PNGs oficiais são 691×500 — mantém a proporção da geometria aprovada.
  const height = Math.round((size * 500) / 691);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={height} className="shrink-0" aria-hidden="true" />;
}

export function Wordmark({ className = "text-xl" }: { className?: string }) {
  return (
    <span className={`font-brand font-black tracking-tight text-giz ${className}`}>
      RT<span style={{ fontSize: "0.72em" }}>rainning</span>
    </span>
  );
}

export default function Brand({ size = 30, textClass = "text-xl" }: { size?: number; textClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={size} variant="aqua" />
      <Wordmark className={textClass} />
    </span>
  );
}
