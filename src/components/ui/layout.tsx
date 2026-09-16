import Link from "next/link";
import { cn } from "@/lib/cn";
import { DefinirTrilha, type ItemTrilha } from "@/components/shell/trilha";

/* ------------------------------------------------------------------ */
/* Cabeçalho de página                                                  */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Vai para a trilha do cabeçalho da aplicação. */
  breadcrumbs?: ItemTrilha[];
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      {breadcrumbs && <DefinirTrilha itens={breadcrumbs} />}
      <div className={cn("mb-[18px] flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5", className)}>
        <div className="min-w-0">
          <h1 className="m-0 text-[24px] font-semibold leading-[1.2] tracking-[-0.025em]">{title}</h1>
          {description && <p className="mt-[5px] max-w-[680px] text-[14px] text-ink-2">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-ink-2">{meta}</div>}
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
}: {
  titulo?: React.ReactNode;
  sub?: React.ReactNode;
  acoes?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  padded?: boolean;
  as?: "section" | "div";
}) {
  return (
    <Tag className={cn("overflow-hidden rounded-[10px] border border-line bg-surface", className)}>
      {(titulo || acoes) && (
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-[18px] py-3.5">
          <div className="min-w-0">
            {titulo && <h2 className="m-0 text-[14px] font-semibold tracking-[-0.01em]">{titulo}</h2>}
            {sub && <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p>}
          </div>
          {acoes && <div className="flex shrink-0 items-center gap-2.5">{acoes}</div>}
        </div>
      )}
      {padded ? <div className="px-[18px] py-3.5">{children}</div> : children}
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
    <div className={cn("mb-[9px] flex items-baseline gap-[9px]", className)}>
      <h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">{children}</h2>
      {contagem != null && <span className="font-mono text-[11.5px] text-meta">{contagem}</span>}
    </div>
  );
}

export function EmptyState({ title, description, action, compact, className }: { title: string; description?: React.ReactNode; action?: React.ReactNode; compact?: boolean; className?: string }) {
  return (
    <div className={cn("text-center", compact ? "px-[18px] py-10" : "px-14 py-14", className)}>
      <p className="m-0 text-[13.5px] font-medium text-ink">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-[460px] text-[12.5px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Métricas                                                             */
/* ------------------------------------------------------------------ */

export function MetricStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line lg:grid-cols-4", className)}>{children}</div>;
}

export function Metric({ label, valor, hint, cor, href, tamanho = 26 }: { label: string; valor: React.ReactNode; hint?: React.ReactNode; cor?: string; href?: string; tamanho?: number }) {
  const conteudo = (
    <>
      <span className="mb-1.5 block text-[12.5px] text-ink-3">{label}</span>
      <span className="block font-mono font-medium leading-[1.1] tracking-[-0.02em]" style={{ fontSize: tamanho, color: cor ?? "#2a1418" }}>
        {valor}
      </span>
      {hint && <span className="mt-1 block truncate text-[12px] text-muted">{hint}</span>}
    </>
  );
  const cls = "block min-w-0 bg-surface px-[18px] py-4 text-left no-underline";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-subtle")}>
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
    <div className="px-[18px] pb-3.5 pt-1.5">
      {itens.map((k) => (
        <div key={k.label} className="flex justify-between gap-3 border-b border-line-faint py-2 last:border-b-0">
          <span className="text-[12.5px] text-muted">{k.label}</span>
          <span className={cn("text-right font-mono text-[12.5px]", k.alerta ? "font-medium text-danger" : k.forte ? "font-medium text-ink" : "text-ink-2")}>{k.valor}</span>
        </div>
      ))}
    </div>
  );
}

export function Aviso({ tom = "neutro", titulo, children, className }: { tom?: "neutro" | "danger" | "warning" | "success"; titulo?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const tons = {
    neutro: "border-line bg-subtle text-ink-2",
    danger: "border-danger-border bg-danger-bg text-danger",
    warning: "border-warning-border bg-warning-bg text-warning",
    success: "border-success-border bg-success-bg text-success",
  };
  return (
    <div className={cn("rounded-[9px] border px-4 py-3", tons[tom], className)}>
      {titulo && <p className="m-0 text-[13px] font-medium">{titulo}</p>}
      {children && <div className={cn("text-[12.5px] leading-[1.5]", titulo ? "mt-[3px]" : undefined)}>{children}</div>}
    </div>
  );
}

/** Compatibilidade com telas de formulário existentes. */
export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children?: React.ReactNode; className?: string }) {
  return (
    <Aviso tom={tone === "info" ? "neutro" : tone} titulo={title} className={className}>
      {children}
    </Aviso>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-esqueleto rounded-[4px] bg-line", className)} />;
}

export function Marcador({ cor, quadrado, pulsar, className }: { cor: string; quadrado?: boolean; pulsar?: boolean; className?: string }) {
  return <span aria-hidden className={cn("mt-1.5 block size-[7px] shrink-0", quadrado ? "rounded-[2px]" : "rounded-full", pulsar && "animate-pulse-dot", className)} style={{ background: cor }} />;
}

export function BarraProgresso({ pct, cor, altura = 6, fundo = "#f0eceb" }: { pct: number; cor: string; altura?: number; fundo?: string }) {
  return (
    <span className="block overflow-hidden rounded-[3px]" style={{ height: altura, background: fundo }}>
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }} />
    </span>
  );
}

export function Kbd({ children, escuro }: { children: React.ReactNode; escuro?: boolean }) {
  return <kbd className={cn("rounded-[4px] px-1.5 py-px font-mono text-[11px]", escuro ? "bg-dark-3 text-on-dark-2" : "bg-control text-ink-2")}>{children}</kbd>;
}
