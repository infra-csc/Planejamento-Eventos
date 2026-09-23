import Link from "next/link";
import { cn } from "@/lib/cn";
import { Tag } from "@/components/ui/badge";
import { Codigo } from "@/components/ui/numero";

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
 * controle interativo dentro de outro. A versão exibida tem o filete da marca (seleção);
 * a base da comparação, um filete mais claro.
 */
export function VersoesOs({ versoes }: { versoes: VersaoOsView[] }) {
  return (
    <ol className="m-0 list-none p-0">
      {versoes.map((v) => (
        <li
          key={v.numero}
          className={cn(
            "relative border-b border-l-2 border-line-row border-l-transparent py-3 pl-4 pr-cartao transition-colors duration-150 last:border-b-0 hover:bg-subtle",
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
            <Codigo className="text-corpo font-semibold text-ink">v{v.numero}</Codigo>
            <Tag>{v.gatilho}</Tag>
            <span className="flex-1" />
            {v.base ? <span className="text-rotulo font-medium text-accent">base</span> : v.atual ? <span className="text-rotulo font-medium text-ink-2">atual</span> : null}
          </div>
          <p aria-hidden className="pointer-events-none relative mb-0 mt-1 text-rotulo text-muted">
            <span className="numero">{v.quando}</span> · {v.autor}
          </p>
          {v.descricao && (
            <p aria-hidden className="pointer-events-none relative mb-0 mt-1 line-clamp-2 text-pequeno text-ink-2" title={v.descricao}>
              {v.descricao}
            </p>
          )}
          <div className="relative mt-1 flex items-baseline gap-2">
            <p aria-hidden className="pointer-events-none m-0 min-w-0 flex-1 truncate text-rotulo text-ink-3" title={v.resumo}>
              {v.resumo}
            </p>
            {!v.exibida && (
              <Link href={v.base ? v.hrefLimpar : v.hrefComparar} scroll={false} className="relative z-10 shrink-0 text-pequeno text-accent no-underline hover:underline max-md:py-2" aria-label={v.base ? "Limpar comparação" : `Comparar com a v${v.numero}`}>
                {v.base ? "limpar" : "comparar"}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
