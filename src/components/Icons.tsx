"use client";

// Ícones SVG em stroke, herdam currentColor. Uso: <Icon name="dumbbell" size={18} />
const PATHS: Record<string, React.ReactNode> = {
  dumbbell: (
    <>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  play: <path d="M8 5.5v13l11-6.5-11-6.5z" />,
  trash: (
    <>
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  pencil: <path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  download: <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M15 9V5a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z" />
      <path d="M7 6H4a1 1 0 00-1 1c0 2.2 1.8 4 4 4M17 6h3a1 1 0 011 1c0 2.2-1.8 4-4 4" />
    </>
  ),
  camera: (
    <>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7" />,
  check: <path d="M20 6L9 17l-5-5" />,
  rotate: (
    <>
      <path d="M1 4v6h6" />
      <path d="M3.5 15a9 9 0 102.1-9.4L1 10" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6" />
    </>
  ),
  scale: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7a5 5 0 015 5h-5V7z" />
    </>
  ),
  move: <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />,
  medal: (
    <>
      <circle cx="12" cy="15" r="6" />
      <path d="M12 12v0M9 15l1.5 1.5M15 15l-1.5 1.5" />
      <path d="M8.5 9L6 3h4l2 3M15.5 9L18 3h-4l-2 3" />
    </>
  ),
  flame: <path d="M12 2c1 3 4 4 4 8a4 4 0 01-8 0c0-1 .5-2 1-2.5C9 9 8 10 8 12a4 4 0 108 0c0-4-3-7-4-10z" />,
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <path d="M16 4.6a3.5 3.5 0 010 6.8M17.5 15.3c2.1.6 3.5 2.1 4 4.7" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />,
  alert: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z" />
    </>
  ),
};

export default function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  className = "",
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
