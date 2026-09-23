/**
 * Conjunto único de ícones do app (docs/design-system.md § Ícones).
 *
 * - Grade 24×24, traço único de 1.75 (em unidades da grade), pontas e junções arredondadas.
 * - Dois tamanhos de uso: 16 (dentro de botões, campos, linhas) e 20 (menu lateral, cabeçalho).
 * - Decorativo por padrão (`aria-hidden`); com `title`, vira imagem com nome (role="img").
 *   Em botão só com ícone, o nome vai no botão (IconButton `label`), não no ícone.
 *
 * Os componentes antigos ainda em uso (IconeLapis, IconeFechar, IconeMais, IconeMenos) continuam
 * exportados e desenham a partir deste mesmo conjunto.
 */

const TRACO = 1.75;

/* Desenhos (filhos do <svg>) — um por nome. Formas simples, legíveis a 16 px. */
const DESENHOS = {
  busca: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  "seta-esquerda": <path d="M19 12H5M11 6l-6 6 6 6" />,
  "seta-cima": <path d="M12 19V5M6 11l6-6 6 6" />,
  "seta-baixo": <path d="M12 5v14M18 13l-6 6-6-6" />,
  "chevron-direita": <path d="m9 6 6 6-6 6" />,
  "chevron-esquerda": <path d="m15 6-6 6 6 6" />,
  "chevron-baixo": <path d="m6 9 6 6 6-6" />,
  "chevron-cima": <path d="m6 15 6-6 6 6" />,
  fechar: <path d="M6 6l12 12M18 6 6 18" />,
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  lapis: (
    <>
      <path d="M16.3 3.7a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
      <path d="m14.5 5.5 4 4" />
    </>
  ),
  lixeira: (
    <>
      <path d="M4 7h16M9 7V4.5h6V7" />
      <path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6" />
    </>
  ),
  sino: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  casa: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5M10 20v-5h4v5" />
    </>
  ),
  eventos: (
    <>
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="7" height="6" rx="1.5" />
      <rect x="15" y="14" width="5" height="6" rx="1.5" />
    </>
  ),
  solicitacoes: (
    <>
      <path d="M6 3h8.5L19 7.5V21H6z" />
      <path d="M14 3v5h5M9.5 13h6M9.5 17h6" />
    </>
  ),
  arena: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </>
  ),
  grafico: <path d="M3 20h18M6.5 16.5V11M11.5 16.5V5.5M16.5 16.5V9" />,
  livro: (
    <>
      <path d="M4 5h5.5A2.5 2.5 0 0 1 12 7.5V20a2 2 0 0 0-2-2H4z" />
      <path d="M20 5h-5.5A2.5 2.5 0 0 0 12 7.5V20a2 2 0 0 1 2-2h6z" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 3 19 6v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  sair: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  imprimir: (
    <>
      <path d="M7 9V3.5h10V9" />
      <rect x="3.5" y="9" width="17" height="8" rx="2" />
      <path d="M7 14h10v6.5H7z" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  "check-circulo": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.3 2.4 2.4 4.6-4.8" />
    </>
  ),
  alerta: (
    <>
      <path d="M10.3 4.5a2 2 0 0 1 3.4 0l7.3 12.6a2 2 0 0 1-1.7 3H4.7a2 2 0 0 1-1.7-3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  erro: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V13M12 16.2h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  local: (
    <>
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  caixa: (
    <>
      <rect x="3" y="4" width="18" height="4.5" rx="1" />
      <path d="M4.5 8.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V8.5M10 12.5h4" />
    </>
  ),
  camadas: (
    <>
      <path d="m12 4 9 5-9 5-9-5z" />
      <path d="m3 14 9 5 9-5" />
    </>
  ),
  "link-externo": <path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  recolher: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15M15.5 10l-2 2 2 2" />
    </>
  ),
  expandir: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15M13.5 10l2 2-2 2" />
    </>
  ),
  reticencias: (
    <>
      <circle cx="6" cy="12" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      <circle cx="18" cy="12" r="0.9" fill="currentColor" />
    </>
  ),
  /* Controles do mapa da arena (antes em components/arena/icones.tsx). */
  enquadrar: (
    <>
      <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  norte: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 6.5l2.6 7h-5.2z" fill="currentColor" stroke="none" />
      <path d="M12 17.5v-4" />
    </>
  ),
  "tela-cheia": <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />,
  "sair-tela-cheia": <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />,
  perspectiva: <path d="M3 17l9 4 9-4-9-4zM12 13V3" />,
  lista: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  teclado: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </>
  ),
  "vista-superior": (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  regua: <path d="M3 16.5 16.5 3 21 7.5 7.5 21zM7 12.5l1.8 1.8M10 9.5l1.8 1.8M13 6.5l1.8 1.8" />,
} as const;

export type NomeIcone = keyof typeof DESENHOS;
type PropsIcone = {
  nome: NomeIcone;
  /** 16 (padrão) dentro de botões, campos e linhas; 20 no menu lateral e no cabeçalho. */
  tamanho?: 16 | 20;
  className?: string;
  /** Nome acessível. Sem ele o ícone é decorativo (aria-hidden). */
  title?: string;
};

/** Desenho cru, com tamanho livre — só para os componentes de compatibilidade abaixo. */
function Svg({ nome, px, className, title, traco = TRACO }: { nome: NomeIcone; px: number; className?: string; title?: string; traco?: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true, focusable: false })}
    >
      {title && <title>{title}</title>}
      {DESENHOS[nome]}
    </svg>
  );
}

export function Icone({ nome, tamanho = 16, className, title }: PropsIcone) {
  return <Svg nome={nome} px={tamanho} className={className ? `shrink-0 ${className}` : "shrink-0"} title={title} />;
}

/** Indicador de carregamento (anel girando). Herda a cor do texto; 14 px por padrão. */
export function Spinner({ tamanho = 14, className, rotulo }: { tamanho?: 12 | 14 | 16 | 20; className?: string; /** Nome para leitor de tela; sem ele é decorativo. */ rotulo?: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      className={className ? `shrink-0 animate-spin motion-reduce:animate-none ${className}` : "shrink-0 animate-spin motion-reduce:animate-none"}
      {...(rotulo ? { role: "img", "aria-label": rotulo } : { "aria-hidden": true })}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Compatibilidade: nomes já importados pelo app.                       */
/* `strokeWidth` antigo era na grade 16; convertido para a grade 24.    */
/* ------------------------------------------------------------------ */

type P = { size?: number; className?: string; strokeWidth?: number };
const traco16 = (s?: number) => (s == null ? TRACO : s * 1.5);

export function IconeLapis({ size = 14, className, strokeWidth }: P) {
  return <Svg nome="lapis" px={size} className={className} traco={traco16(strokeWidth)} />;
}

export function IconeFechar({ size = 14, className, strokeWidth }: P) {
  return <Svg nome="fechar" px={size} className={className} traco={traco16(strokeWidth)} />;
}

export function IconeMais({ size = 14, className, strokeWidth }: P) {
  return <Svg nome="mais" px={size} className={className} traco={traco16(strokeWidth)} />;
}

export function IconeMenos({ size = 14, className, strokeWidth }: P) {
  return <Svg nome="menos" px={size} className={className} traco={traco16(strokeWidth)} />;
}
