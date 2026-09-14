import Link from "next/link";
import { cn } from "@/lib/cn";

export type Pill = { label: string; n?: number | string; href: string; ativo: boolean };

const pillCls = (ativo: boolean) =>
  cn(
    "flex h-7 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-[11px] text-[12.5px] no-underline",
    ativo ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(42,20,24,.08)]" : "text-ink-3 hover:text-ink",
  );

/** Grupo de filtros em pílula (trilho #e9e4e3). Cada pílula é um link que muda a URL. */
export function Pills({ itens, className, rotulo }: { itens: Pill[]; className?: string; rotulo?: string }) {
  return (
    <nav aria-label={rotulo} className={cn("flex w-fit flex-wrap gap-1 rounded-[9px] bg-control p-[3px]", className)}>
      {itens.map((p) => (
        <Link key={p.href + p.label} href={p.href} aria-current={p.ativo ? "true" : undefined} className={pillCls(p.ativo)} scroll={false}>
          {p.label}
          {p.n != null && <span className={cn("font-mono text-[10.5px]", p.ativo ? "text-accent" : "text-meta")}>{p.n}</span>}
        </Link>
      ))}
    </nav>
  );
}

export { pillCls };
