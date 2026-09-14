import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

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
  breadcrumbs?: Array<{ label: string; href?: string }>;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Navegação" className="mb-2 flex items-center gap-1 text-xs text-ink-muted">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" aria-hidden />}
              {b.href ? (
                <Link href={b.href} className="hover:text-ink">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink flex flex-wrap items-center gap-2">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-muted max-w-3xl">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-secondary">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ title, description, actions, children, className, padded = true }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, description, action, compact }: { title: string; description?: string; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-14")}>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "danger" | "warning" | "success" }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular tracking-tight", tone === "danger" && "text-danger", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function KeyValue({ items, columns = 2 }: { items: Array<{ label: string; value: React.ReactNode }>; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 1 && "grid-cols-1", columns === 2 && "grid-cols-1 sm:grid-cols-2", columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-ink-muted">{it.label}</dt>
          <dd className="text-sm text-ink mt-0.5 break-words">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children?: React.ReactNode; className?: string }) {
  const map = {
    info: "border-info/30 bg-info-soft text-info",
    warning: "border-warning/30 bg-warning-soft text-warning",
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
  };
  return (
    <div className={cn("rounded-md border px-3 py-2.5 text-[13px]", map[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-black/5", className)} />;
}

export function Avatar({ nome, size = "md" }: { nome: string; size?: "sm" | "md" }) {
  const ini = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand font-semibold", size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs")} aria-hidden>
      {ini}
    </span>
  );
}
