import { Skeleton } from "@/components/ui/layout";

/** Skeleton com a forma real da tela (handoff §6): título, 4 métricas, 5 linhas. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-[18px]">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-2.5 h-6 w-64" />
        <Skeleton className="mt-2.5 h-4 w-[420px]" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-cartao border border-line bg-line lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface px-[18px] py-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-7 w-12" />
            <Skeleton className="mt-2.5 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="border-b border-line-soft px-[18px] py-3.5">
          <Skeleton className="h-4 w-44" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-row px-[18px] py-3.5 last:border-b-0">
            <Skeleton className="size-[7px] rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="mt-2 h-3 w-2/5" />
            </div>
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
