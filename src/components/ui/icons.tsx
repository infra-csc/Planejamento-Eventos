/**
 * Ícones de traço do app (16×16, stroke 1.7). Um lugar só: lápis, check, seta, fechar, lupa.
 * Todos `aria-hidden`; quem usa dá o rótulo no botão ou no link.
 */
type P = { size?: number; className?: string; strokeWidth?: number };

const base = (size: number, className?: string) => ({ width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true as const, className });

export function IconeLapis({ size = 14, className, strokeWidth = 1.5 }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M11.3 2.3a1.5 1.5 0 0 1 2.1 2.1L5.5 12.3 2.5 13l.7-3L11.3 2.3z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M10 3.6l2.4 2.4" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function IconeCheck({ size = 15, className, strokeWidth = 2.2 }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeChevron({ size = 14, className, strokeWidth = 1.7, direcao = "direita" }: P & { direcao?: "direita" | "esquerda" | "baixo" | "cima" }) {
  const d = { direita: "M6 3l5 5-5 5", esquerda: "M10 3L5 8l5 5", baixo: "M3 6l5 5 5-5", cima: "M3 10l5-5 5 5" }[direcao];
  return (
    <svg {...base(size, className)}>
      <path d={d} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeFechar({ size = 14, className, strokeWidth = 1.7 }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function IconeLupa({ size = 14, className, strokeWidth = 1.7 }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M10.2 10.2L13.5 13.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function IconeMais({ size = 14, className, strokeWidth = 1.7 }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function IconeMenos({ size = 14, className, strokeWidth = 1.7 }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 8h10" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}
