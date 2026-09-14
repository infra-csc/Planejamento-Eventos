"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

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

/** Lista de versões da OS (handoff §5.8): bloco clicável + comparar/limpar. */
export function VersoesOs({ versoes }: { versoes: VersaoOsView[] }) {
  const router = useRouter();
  return (
    <div>
      {versoes.map((v) => (
        <div
          key={v.numero}
          role="button"
          tabIndex={0}
          aria-pressed={v.exibida}
          aria-label={`Exibir OS v${v.numero}`}
          onClick={() => router.push(v.hrefVer, { scroll: false })}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(v.hrefVer, { scroll: false });
            }
          }}
          className={cn("cursor-pointer border-b border-line-row px-4 py-3 last:border-b-0 hover:bg-subtle", v.exibida && "bg-selected")}
          style={{ boxShadow: v.exibida ? "inset 3px 0 0 #8e2740" : v.base ? "inset 3px 0 0 #c9a3ad" : undefined }}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-ink">v{v.numero}</span>
            <span className="rounded-[5px] bg-neutral-bg px-[7px] py-px text-[11px] font-medium text-ink-3">{v.gatilho}</span>
            <span className="flex-1" />
            {v.atual && <span className="text-[11px] font-medium text-accent">atual</span>}
            {v.base && <span className="text-[11px] font-medium text-accent">base da comparação</span>}
          </div>
          <p className="mb-0 mt-1 font-mono text-[11.5px] text-muted">
            {v.quando} · <span className="font-sans">{v.autor}</span>
          </p>
          {v.descricao && <p className="mb-0 mt-1 text-[12.5px] leading-[1.45] text-ink-2">{v.descricao}</p>}
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="m-0 min-w-0 flex-1 text-[11.5px] text-ink-3">{v.resumo}</p>
            {!v.exibida && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(v.base ? v.hrefLimpar : v.hrefComparar, { scroll: false });
                }}
                className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-accent hover:underline"
              >
                {v.base ? "limpar" : "comparar"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
