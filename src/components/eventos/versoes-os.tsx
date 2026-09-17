import Link from "next/link";
import { cn } from "@/lib/cn";
import { Tag } from "@/components/ui/badge";

export type VersaoOsView = {
  numero: number;
  gatilho: string;
  quando: string;
  autor: string;
  descricao: string | null;
  resumo: string;
  exibida: boolean;
  base: boolean;
  atual: boolean;
  hrefVer: string;
  hrefComparar: string;
  hrefLimpar: string;
};

/**
 * Lista de versões da OS (handoff §5.8). O bloco inteiro é um link real (abre em nova aba,
 * aparece no leitor de tela como link) e "comparar/limpar" é outro link, fora dele — sem
 * controle interativo dentro de outro.
 */
export function VersoesOs({ versoes }: { versoes: VersaoOsView[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {versoes.map((v) => (
        <li
          key={v.numero}
          className={cn(
            "relative border-b border-l-[3px] border-line-row border-l-transparent px-4 py-3 last:border-b-0 hover:bg-subtle",
            v.exibida && "border-l-accent bg-selected",
            !v.exibida && v.base && "border-l-accent-muted",
          )}
        >
          <Link
            href={v.hrefVer}
            scroll={false}
            aria-current={v.exibida ? "true" : undefined}
            aria-label={`OS v${v.numero}${v.atual ? ", atual" : ""} — ${v.gatilho}, ${v.quando}, ${v.autor}. ${v.resumo}`}
            className="absolute inset-0 z-0 rounded-none focus-visible:outline-offset-[-2px]"
          />
          <div className="pointer-events-none relative flex items-center gap-2">
            <span className="font-mono text-corpo font-semibold text-ink">v{v.numero}</span>
            <Tag tom="rascunho" className="font-medium">{v.gatilho}</Tag>
            <span className="flex-1" />
            {v.atual && <span className="text-rotulo font-medium text-accent">atual</span>}
            {v.base && <span className="text-rotulo font-medium text-accent">base da comparação</span>}
          </div>
          <p aria-hidden className="pointer-events-none relative mb-0 mt-1 font-mono text-rotulo text-muted">
            {v.quando} · <span className="font-sans">{v.autor}</span>
          </p>
          {v.descricao && (
            <p aria-hidden className="pointer-events-none relative mb-0 mt-1 text-pequeno leading-[1.45] text-ink-2">
              {v.descricao}
            </p>
          )}
          <div className="relative mt-1.5 flex items-baseline gap-2">
            <p aria-hidden className="pointer-events-none m-0 min-w-0 flex-1 text-rotulo text-ink-3">
              {v.resumo}
            </p>
            {!v.exibida && (
              <Link href={v.base ? v.hrefLimpar : v.hrefComparar} scroll={false} className="relative z-10 shrink-0 text-pequeno text-accent no-underline hover:underline" aria-label={v.base ? "Limpar comparação" : `Comparar com a v${v.numero}`}>
                {v.base ? "limpar" : "comparar"}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
