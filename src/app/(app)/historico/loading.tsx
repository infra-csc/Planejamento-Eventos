import { Skeleton, SkeletonLista } from "@/components/ui/layout";

/** Esqueleto com a forma do histórico: título, números do topo, barra de filtros e tabela. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando histórico">
      <div className="mb-5 flex items-center justify-between gap-5 border-b border-line pb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-36 rounded-controle" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-cartao border border-line bg-line lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface px-cartao py-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <Skeleton className="h-[34px] w-full rounded-controle sm:max-w-[280px]" />
        <Skeleton className="h-[34px] w-full rounded-controle sm:max-w-[260px]" />
        <Skeleton className="h-[34px] w-full rounded-controle sm:max-w-[300px]" />
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="flex gap-5 border-b border-line-soft px-cartao py-3">
          {["w-12", "w-24", "w-24", "w-20", "w-24"].map((w, i) => (
            <Skeleton key={i} className={`h-3.5 ${w}`} />
          ))}
        </div>
        <SkeletonLista linhas={10} />
      </div>
    </div>
  );
}
