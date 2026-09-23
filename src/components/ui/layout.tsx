import Link from "next/link";
import { cn } from "@/lib/cn";
import { DefinirTrilha, type ItemTrilha } from "@/components/shell/trilha";
import { Icone, type NomeIcone } from "./icons";

/* ------------------------------------------------------------------ */
/* Cabeçalho de página                                                  */
/* ------------------------------------------------------------------ */

/** Um par rótulo/valor da linha de metadados do cabeçalho. `mono` só para códigos (EVT-0002). */
export function Meta({ rotulo, valor, mono }: { rotulo: string; valor: React.ReactNode; mono?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-pequeno text-muted">{rotulo}</span>
      <span className={cn("text-corpo text-ink", mono ? "font-mono" : "numero")}>{valor}</span>
    </span>
  );
}

/**
 * Cabeçalho de página: o único h1 do app. `eyebrow` (código + badges) fica acima do título,
 * `meta` (pares rótulo/valor) abaixo da descrição. `tamanho="sm"` para telas de detalhe de item.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  meta,
  eyebrow,
  tamanho = "md",
  divisor = false,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Vai para a trilha do cabeçalho da aplicação. */
  breadcrumbs?: ItemTrilha[];
  meta?: React.ReactNode;
  eyebrow?: React.ReactNode;
  tamanho?: "md" | "sm";
  /** Linha fina sob o cabeçalho, separando título/ações do conteúdo. */
  divisor?: boolean;
  className?: string;
}) {
  return (
    <>
      {breadcrumbs && <DefinirTrilha itens={breadcrumbs} />}
      <div className={cn("mb-[18px] flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5", divisor && "mb-5 border-b border-line pb-4 sm:items-center", className)}>
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 flex flex-wrap items-center gap-2 text-pequeno text-muted">{eyebrow}</div>}
          <h1 className={cn("m-0 font-semibold", tamanho === "sm" ? "text-titulo tracking-[-0.01em]" : "text-pagina tracking-[-0.02em]")}>{title}</h1>
          {description && <p className="mt-1 max-w-[680px] text-corpo text-ink-2">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1 text-corpo text-ink-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Card / seção                                                         */
/* ------------------------------------------------------------------ */

export function Section({
  titulo,
  sub,
  acoes,
  children,
  className,
  padded = false,
  as: Tag = "section",
  tom = "claro",
}: {
  titulo?: React.ReactNode;
  sub?: React.ReactNode;
  acoes?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  padded?: boolean;
  as?: "section" | "div";
  /** `dark`: cartão escuro (painel "como funciona", destaques). */
  tom?: "claro" | "dark";
}) {
  const escuro = tom === "dark";
  return (
    <Tag className={cn("overflow-hidden rounded-cartao border", escuro ? "border-dark bg-dark text-white" : "border-line bg-surface", className)}>
      {(titulo || acoes) && (
        <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-cartao py-3.5", escuro ? "border-dark-3" : "border-line-soft")}>
          <div className="min-w-0">
            {titulo && <h2 className={cn("m-0 text-secao font-semibold tracking-[-0.01em]", escuro && "text-white")}>{titulo}</h2>}
            {sub && <p className={cn("mt-0.5 text-pequeno", escuro ? "text-on-dark-3" : "text-muted")}>{sub}</p>}
          </div>
          {acoes && <div className="flex shrink-0 items-center gap-2.5">{acoes}</div>}
        </div>
      )}
      {padded ? <div className="px-cartao py-3.5">{children}</div> : children}
    </Tag>
  );
}

/** Compatibilidade com formulários existentes. */
export function Panel({ title, description, actions, children, className, padded = true }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <Section titulo={title} sub={description} acoes={actions} className={className} padded={padded}>
      {children}
    </Section>
  );
}

export function RotuloGrupo({ children, contagem, className }: { children: React.ReactNode; contagem?: React.ReactNode; className?: string }) {
  return (
    <div className={cn(!/\bmb-/.test(className ?? "") && "mb-[9px]", "flex items-baseline gap-[9px]", className)}>
      <h2 className="m-0 text-pequeno font-semibold uppercase tracking-[0.1em] text-muted">{children}</h2>
      {contagem != null && <span className="numero text-rotulo text-meta">{contagem}</span>}
    </div>
  );
}

/**
 * Estado vazio: título (o que não há) + UMA frase (por que / o que fazer) + ação quando há o que fazer.
 * `compact`: dentro de cartão/lista curta ou painel lateral — menos respiro, sem ícone.
 * `icone`: opcional no tamanho normal (ex.: "busca" para busca sem resultado, "caixa" para lista vazia).
 */
export function EmptyState({ title, description, action, compact, icone, className }: { title: string; description?: React.ReactNode; action?: React.ReactNode; compact?: boolean; icone?: NomeIcone; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-cartao py-6" : "px-6 py-12 sm:px-14", className)}>
      {icone && !compact && (
        <span aria-hidden className="mb-3 grid size-10 place-items-center rounded-full bg-neutral-bg text-ink-3">
          <Icone nome={icone} tamanho={20} />
        </span>
      )}
      <p className="m-0 text-corpo font-medium text-ink">{title}</p>
      {description && <p className={cn("mx-auto mt-1 max-w-[440px] text-pequeno text-muted", compact && "max-w-[360px]")}>{description}</p>}
      {action && <div className={compact ? "mt-3" : "mt-4"}>{action}</div>}
    </div>
  );
}

/** Rodapé de tabela/lista ("n linhas · x unidades"), mesmo padrão da paginação. */
export function RodapeTabela({ children, direita, className }: { children: React.ReactNode; direita?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t border-line-soft bg-subtle px-cartao py-[11px] text-pequeno text-ink-3", className)}>
      <span>{children}</span>
      {direita && <span>{direita}</span>}
    </div>
  );
}

/** Banner escuro de destaque (andamento da reunião, diferença de versões, modo fila). */
export function BannerEscuro({ titulo, children, acoes, className, ...rest }: { titulo?: React.ReactNode; children?: React.ReactNode; acoes?: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("flex items-center gap-6 rounded-cartao bg-dark px-cartao py-4", className)} {...rest}>
      <div className="min-w-0 flex-1">
        {titulo && <h2 className="m-0 text-secao font-semibold text-white">{titulo}</h2>}
        {children && <div className="mt-1 text-corpo text-on-dark-3">{children}</div>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </section>
  );
}

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Métricas                                                             */
/* ------------------------------------------------------------------ */

export function MetricStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-cartao border border-line bg-line lg:grid-cols-4", className)}>{children}</div>;
}

export type TomSemantico = "neutro" | "danger" | "warning" | "success" | "accent";

const COR_TOM_TEXTO: Record<TomSemantico, string> = { neutro: "text-ink", danger: "text-danger", warning: "text-warning", success: "text-success", accent: "text-accent" };
const COR_TOM_FUNDO: Record<TomSemantico, string> = { neutro: "bg-dark", danger: "bg-danger", warning: "bg-warning", success: "bg-success", accent: "bg-accent" };

/**
 * Número grande (28px, algarismos tabulares na fonte normal). Cor só por `tom` semântico.
 * O `hint` corta em 2 linhas; com `hintInteiro`, aparece inteiro (quando a frase é a instrução do cartão).
 */
export function Metric({ label, valor, hint, tom = "neutro", href, hintInteiro }: { label: string; valor: React.ReactNode; hint?: React.ReactNode; tom?: TomSemantico; href?: string; hintInteiro?: boolean }) {
  const conteudo = (
    <>
      <span className="mb-1.5 block text-pequeno text-ink-3">{label}</span>
      <span className={cn("numero block text-metrica font-semibold tracking-[-0.02em]", COR_TOM_TEXTO[tom])}>{valor}</span>
      {hint && (
        <span className={cn("mt-1 text-pequeno text-muted", hintInteiro ? "block" : "line-clamp-2")} title={!hintInteiro && typeof hint === "string" ? hint : undefined}>
          {hint}
        </span>
      )}
    </>
  );
  const cls = "block min-w-0 bg-surface px-cartao py-4 text-left no-underline";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent")}>
      {conteudo}
    </Link>
  ) : (
    <div className={cls}>{conteudo}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista rótulo/valor, avisos, esqueleto                                */
/* ------------------------------------------------------------------ */

export function ListaDados({ itens }: { itens: Array<{ label: string; valor: React.ReactNode; forte?: boolean; alerta?: boolean }> }) {
  return (
    <div className="px-cartao pb-3.5 pt-1.5">
      {itens.map((k) => (
        <div key={k.label} className="flex justify-between gap-3 border-b border-line-faint py-2 last:border-b-0">
          <span className="text-pequeno text-muted">{k.label}</span>
          <span className={cn("numero text-right text-pequeno", k.alerta ? "font-medium text-danger" : k.forte ? "font-medium text-ink" : "text-ink-2")}>{k.valor}</span>
        </div>
      ))}
    </div>
  );
}

export type TomAviso = "neutro" | "info" | "danger" | "warning" | "success";

const AVISO: Record<TomAviso, { cls: string; icone: NomeIcone }> = {
  neutro: { cls: "border-line bg-subtle text-ink-2", icone: "info" },
  info: { cls: "border-info-border bg-info-bg text-info", icone: "info" },
  danger: { cls: "border-danger-border bg-danger-bg text-danger", icone: "erro" },
  warning: { cls: "border-warning-border bg-warning-bg text-warning", icone: "alerta" },
  success: { cls: "border-success-border bg-success-bg text-success", icone: "check-circulo" },
};

/** Aviso em bloco, com ícone do tom (ou `semIcone`). `acoes` à direita (link ou botão pequeno). */
export function Aviso({ tom = "neutro", titulo, children, acoes, semIcone, className }: { tom?: TomAviso; titulo?: React.ReactNode; children?: React.ReactNode; acoes?: React.ReactNode; semIcone?: boolean; className?: string }) {
  const { cls, icone } = AVISO[tom];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-controle border px-4 py-3", cls, className)}>
      {!semIcone && <Icone nome={icone} className={titulo ? "mt-0.5" : "mt-px"} />}
      <div className="min-w-0 flex-1">
        {titulo && <p className="m-0 text-corpo font-medium">{titulo}</p>}
        {children && <div className={cn("text-pequeno", titulo ? "mt-0.5" : undefined)}>{children}</div>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2 self-center">{acoes}</div>}
    </div>
  );
}

/** Compatibilidade com telas de formulário existentes. */
export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children?: React.ReactNode; className?: string }) {
  return (
    <Aviso tom={tone} titulo={title} className={className}>
      {children}
    </Aviso>
  );
}

/** Bloco de carregamento. Use a altura do texto que vai substituir (h-3.5 corpo, h-3 pequeno, h-6 título). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-esqueleto rounded-chip bg-line", className)} />;
}

/** Esqueleto de lista/tabela dentro de cartão: `linhas` linhas com título, subtítulo e valor à direita. */
export function SkeletonLista({ linhas = 5, className }: { linhas?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className={className}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line-row px-cartao py-3.5 last:border-b-0">
          <div className="flex-1">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="mt-2 h-3 w-2/5" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Ponto de estado. `tom` semântico ou, para cores calculadas (histórico, prazo), `cor` com var(--color-*). */
export function Marcador({ tom, cor, quadrado, pulsar, className }: { tom?: TomSemantico; cor?: string; quadrado?: boolean; pulsar?: boolean; className?: string }) {
  return <span aria-hidden className={cn("mt-1.5 block size-[7px] shrink-0", quadrado ? "rounded-xs" : "rounded-full", pulsar && "animate-pulse-dot", tom && COR_TOM_FUNDO[tom], className)} style={cor ? { background: cor } : undefined} />;
}

export function BarraProgresso({ pct, tom = "neutro", altura = 6, marcadorPct, className }: { pct: number; tom?: TomSemantico; altura?: number; /** Traço vertical de referência (ex.: estoque). */ marcadorPct?: number; className?: string }) {
  return (
    <span className={cn("relative block overflow-visible rounded-full bg-neutral-bg", className)} style={{ height: altura }}>
      <span className={cn("block h-full rounded-full", COR_TOM_FUNDO[tom])} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      {marcadorPct != null && <span aria-hidden className="absolute -top-1 block w-0.5 bg-dark" style={{ height: altura + 8, left: `calc(${Math.max(0, Math.min(100, marcadorPct))}% - 1px)` }} />}
    </span>
  );
}

export function Kbd({ children, escuro }: { children: React.ReactNode; escuro?: boolean }) {
  return <kbd className={cn("rounded-chip px-1.5 py-px font-mono text-rotulo", escuro ? "bg-dark-3 text-on-dark-2" : "bg-control text-ink-2")}>{children}</kbd>;
}
