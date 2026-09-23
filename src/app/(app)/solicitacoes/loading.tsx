import { Skeleton, SkeletonLista } from "@/components/ui/layout";

/** Esqueleto com a forma da lista de solicitações: título, barra de filtros e cartão com abas e linhas. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando solicitações">
      <div className="mb-5 flex items-center justify-between gap-5 border-b border-line pb-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-9 w-36 rounded-controle" />
      </div>
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <Skeleton className="h-[34px] w-full rounded-controle sm:max-w-[320px]" />
        <Skeleton className="h-[34px] w-full rounded-controle sm:max-w-[220px]" />
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="flex gap-5 border-b border-line-soft px-cartao py-3">
          {["w-24", "w-20", "w-28", "w-24", "w-12"].map((w, i) => (
            <Skeleton key={i} className={`h-3.5 ${w}`} />
          ))}
        </div>
        <SkeletonLista linhas={8} />
      </div>
    </div>
  );
}
