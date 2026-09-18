import { Skeleton } from "@/components/ui/layout";

/** Esqueleto com a forma da lista de solicitações: título, pills de filtro e tabela. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando solicitações">
      <div className="mb-[18px] flex items-end justify-between gap-5">
        <div>
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-2.5 h-4 w-full max-w-[360px]" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mb-[18px] flex gap-1 rounded-cartao bg-control p-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-controle" />
        ))}
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="flex gap-4 border-b border-line-soft bg-subtle px-cartao py-2.5">
          {["w-24", "w-40", "w-20", "w-16"].map((w) => (
            <Skeleton key={w} className={`h-3 ${w}`} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-row px-cartao py-3 last:border-b-0">
            <Skeleton className="h-3.5 w-20" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="mt-2 h-3 w-2/5" />
            </div>
            <Skeleton className="h-5 w-20 rounded-chip" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
