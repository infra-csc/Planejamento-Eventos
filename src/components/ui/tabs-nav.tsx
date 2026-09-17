"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type Aba = { href: string; label: string; n?: number | string | null; exact?: boolean };

const abaCls = (ativo: boolean) => cn("-mb-px flex cursor-pointer items-center gap-[7px] whitespace-nowrap border-0 border-b-2 bg-transparent px-3.5 py-[9px] text-corpo no-underline", ativo ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink");

function Contador({ n, ativo }: { n: number | string | null | undefined; ativo: boolean }) {
  if (n == null || n === 0 || n === "") return null;
  return <span className={cn("rounded-chip px-1.5 py-px font-mono text-rotulo", ativo ? "bg-accent-bg text-accent" : "bg-neutral-bg text-muted")}>{n}</span>;
}

const trilho = "flex gap-0.5 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none]";

/** Abas sublinhadas por rota (aba ativa = pathname). */
export function TabsNav({ tabs, className, rotulo = "Seções do evento" }: { tabs: Aba[]; className?: string; rotulo?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("mb-5", trilho, className)} aria-label={rotulo}>
      {tabs.map((t) => {
        const ativo = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} aria-current={ativo ? "page" : undefined} className={abaCls(ativo)}>
            {t.label}
            <Contador n={t.n} ativo={ativo} />
          </Link>
        );
      })}
    </nav>
  );
}

export type AbaControlada<K extends string> = { chave: K; label: string; n?: number | string | null; tom?: "warning" };

/**
 * As mesmas abas, controladas por estado (role=tablist), para trocar painéis sem mudar de rota:
 * biblioteca, administração, painel da reunião, vincular ao catálogo, tipo de item na solicitação.
 */
export function TabsControladas<K extends string>({ abas, valor, onChange, rotulo, className, compacta }: { abas: AbaControlada<K>[]; valor: K; onChange: (k: K) => void; rotulo: string; className?: string; compacta?: boolean }) {
  return (
    <div role="tablist" aria-label={rotulo} className={cn(trilho, compacta ? "mb-3" : "mb-4", className)}>
      {abas.map((a) => {
        const ativo = a.chave === valor;
        return (
          <button key={a.chave} type="button" role="tab" aria-selected={ativo} onClick={() => onChange(a.chave)} className={cn(abaCls(ativo), compacta && "px-3 py-2", a.tom === "warning" && !ativo && "text-warning")}>
            {a.label}
            <Contador n={a.n} ativo={ativo} />
          </button>
        );
      })}
    </div>
  );
}
