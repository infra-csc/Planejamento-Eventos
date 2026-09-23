"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { IndicadorLink } from "./indicador-link";

export type Pill = { label: string; n?: number | string; ativo: boolean; title?: string } & ({ href: string; onSelect?: never } | { href?: never; onSelect: () => void });

/* 28 px no desktop; 40 px abaixo de md (alvo de toque). Foco com anel interno (o trilho é justo). */
const pillCls = (ativo: boolean) =>
  cn(
    "relative flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-controle border-0 px-[11px] text-pequeno no-underline transition-colors duration-150 max-md:h-10 max-md:px-3",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    ativo ? "bg-surface font-medium text-ink shadow-pill" : "bg-transparent text-ink-3 hover:bg-white/50 hover:text-ink",
  );

/**
 * Grupo de filtros em pílula (trilho #e9e4e3). Cada pílula é um link (muda a URL) ou um botão
 * (`onSelect`, estado local). Um só estilo de ativo em todo o app: branco elevado.
 * No modo link, a pílula clicada mostra um spinner enquanto a página carrega.
 */
export function Pills({ itens, className, rotulo }: { itens: Pill[]; className?: string; rotulo?: string }) {
  const Wrapper = itens.some((p) => p.href) ? "nav" : "div";
  return (
    <Wrapper aria-label={rotulo} role={Wrapper === "div" ? "group" : undefined} className={cn("flex w-fit flex-wrap gap-1 rounded-controle bg-control p-[3px]", className)}>
      {itens.map((p) => {
        const conteudo = (
          <>
            {p.label}
            {p.n != null && <span className={cn("numero text-rotulo", p.ativo ? "text-accent" : "text-meta")}>{p.n}</span>}
          </>
        );
        return p.href ? (
          <Link key={p.href + p.label} href={p.href} title={p.title} aria-current={p.ativo ? "true" : undefined} className={pillCls(p.ativo)} scroll={false}>
            {conteudo}
            {!p.ativo && <IndicadorLink lugar="sobre" />}
          </Link>
        ) : (
          <button key={p.label} type="button" title={p.title} aria-pressed={p.ativo} onClick={p.onSelect} className={pillCls(p.ativo)}>
            {conteudo}
          </button>
        );
      })}
    </Wrapper>
  );
}

export { pillCls };
