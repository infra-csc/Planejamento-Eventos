import { Skeleton } from "@/components/ui/layout";

/** Esqueleto com a forma da conferência: cabeçalho, banner escuro, barra de progresso e linhas + painel. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando conferência" className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-3.5 w-48 max-w-full" />
        <Skeleton className="mt-2.5 h-6 w-96 max-w-full" />
      </div>
      <div className="rounded-cartao bg-dark px-cartao py-4">
        <Skeleton className="h-4 w-72 max-w-full bg-dark-3" />
        <Skeleton className="mt-2.5 h-3.5 w-[460px] max-w-full bg-dark-3" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="overflow-hidden rounded-cartao border border-line bg-surface">
          <div className="border-b border-line-soft px-cartao py-3">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="mt-2.5 h-1.5 w-full" />
          </div>
          <div className="border-b border-line-soft px-cartao py-2.5">
            <Skeleton className="h-7 w-72 max-w-full" />
          </div>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line-row px-cartao py-3 last:border-b-0">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="mt-2 h-3 w-2/5" />
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
        <div className="rounded-cartao border border-line bg-surface px-cartao py-3.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="mt-3 h-[72px] w-full" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
