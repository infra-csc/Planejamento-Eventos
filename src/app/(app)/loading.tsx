"use client";

import { usePathname } from "next/navigation";
import { Skeleton, SkeletonLista } from "@/components/ui/layout";

/** Esqueleto do Painel: cabeçalho, "precisa de você agora", fila + agenda e a faixa de métricas. */
function EsqueletoPainel() {
  return (
    <div aria-busy="true" aria-label="Carregando painel">
      <div className="mb-5 border-b border-line pb-4">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="mt-2.5 h-6 w-full max-w-56" />
      </div>

      <Skeleton className="mb-2.5 h-4 w-44" />
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={i === 2 ? "hidden items-center gap-3 rounded-cartao border border-line bg-surface px-4 py-3 xl:flex" : "flex items-center gap-3 rounded-cartao border border-line bg-surface px-4 py-3"}>
            <Skeleton className="size-9 rounded-controle" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="mt-2 h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-start">
        <div className="overflow-hidden rounded-cartao border border-line bg-surface">
          <div className="border-b border-line-soft px-cartao py-3.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
          </div>
          <SkeletonLista linhas={5} />
        </div>
        <div className="overflow-hidden rounded-cartao border border-line bg-surface">
          <div className="border-b border-line-soft px-cartao py-3.5">
            <Skeleton className="h-4 w-32" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 border-b border-line-row px-cartao py-3 last:border-b-0">
              <Skeleton className="h-3 w-10" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-cartao border border-line bg-line lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface px-cartao py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-7 w-12" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Esqueleto genérico (handoff §6): cabeçalho e um cartão de lista — telas sem esqueleto próprio. */
function EsqueletoGenerico() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-5 border-b border-line pb-4">
        <Skeleton className="h-6 w-full max-w-64" />
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="border-b border-line-soft px-cartao py-3.5">
          <Skeleton className="h-4 w-44" />
        </div>
        <SkeletonLista linhas={5} />
      </div>
    </div>
  );
}

/**
 * Este limite de carregamento cobre todas as telas do app sem `loading.tsx` próprio;
 * no Painel (`/`), mostra a forma do Painel.
 */
export default function Loading() {
  const pathname = usePathname();
  return pathname === "/" ? <EsqueletoPainel /> : <EsqueletoGenerico />;
}
