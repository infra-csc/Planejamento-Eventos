/** Ícones de traço simples, desenhados para os controles do mapa (o app não usa biblioteca de ícones). */
type P = { className?: string };
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconeMais = (p: P) => (
  <svg {...base} className={p.className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconeMenos = (p: P) => (
  <svg {...base} className={p.className}>
    <path d="M5 12h14" />
  </svg>
);
export const IconeEnquadrar = (p: P) => (
  <svg {...base} className={p.className}>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
    <circle cx="12" cy="12" r="2.2" />
  </svg>
);
export const IconeNorte = (p: P) => (
  <svg {...base} className={p.className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 6.5l2.6 7h-5.2z" fill="currentColor" stroke="none" />
    <path d="M12 17.5v-4" />
  </svg>
);
export const IconeCamadas = (p: P) => (
  <svg {...base} className={p.className}>
    <path d="M12 4l8.5 4.5L12 13 3.5 8.5z" />
    <path d="M3.5 12.5L12 17l8.5-4.5" />
    <path d="M3.5 16.5L12 21l8.5-4.5" />
  </svg>
);
export const IconeTelaCheia = (p: P) => (
  <svg {...base} className={p.className}>
    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
  </svg>
);
export const IconeSairTelaCheia = (p: P) => (
  <svg {...base} className={p.className}>
    <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
  </svg>
);
export const IconeBusca = (p: P) => (
  <svg {...base} className={p.className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);
export const IconeFechar = (p: P) => (
  <svg {...base} className={p.className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconePerspectiva = (p: P) => (
  <svg {...base} className={p.className}>
    <path d="M3 17l9 4 9-4-9-4z" />
    <path d="M12 13V3" />
  </svg>
);
export const IconeSuperior = (p: P) => (
  <svg {...base} className={p.className}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 12h16M12 4v16" />
  </svg>
);
