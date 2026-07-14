"use client";

/**
 * Marca RTrainning.
 * Símbolo: "pulso de evolução" — linha ascendente em degraus com nó de dado e
 * seta final, lendo ao mesmo tempo como gráfico de carga e batimento de treino.
 * Wordmark: RT em gradiente (destaque), "rainning" em peso normal.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="bm-acc" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#8B7CF8" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" />
      <path
        d="M9 33 H17 L23 24 L29 28 L37 14"
        stroke="url(#bm-acc)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M31.5 13 L38 12.2 L37.2 18.7" stroke="url(#bm-acc)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="17" cy="33" r="2.6" fill="#EAF6FF" />
    </svg>
  );
}

export function Wordmark({ className = "text-xl" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      <span className="bg-gradient-to-r from-glow to-viol bg-clip-text text-transparent">RT</span>
      <span className="text-white/80">rainning</span>
    </span>
  );
}

export default function Brand({ size = 26, textClass = "text-xl" }: { size?: number; textClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={size} />
      <Wordmark className={textClass} />
    </span>
  );
}
