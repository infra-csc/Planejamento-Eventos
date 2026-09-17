import { Skeleton } from "@/components/ui/layout";

/** Esqueleto com a forma da conferência: cabeçalho, banner escuro e lista de linhas + painel. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando conferência" className="-mt-2 flex flex-col gap-4">
      <div>
        <Skeleton className="h-3.5 w-64" />
        <Skeleton className="mt-2.5 h-7 w-[420px]" />
      </div>
      <div className="rounded-[10px] bg-dark px-[22px] py-[18px]">
        <Skeleton className="h-4 w-72 bg-dark-3" />
        <Skeleton className="mt-2.5 h-3.5 w-[460px] bg-dark-3" />
        <Skeleton className="mt-4 h-1.5 w-[360px] bg-dark-3" />
      </div>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start">
        <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="border-b border-line-soft px-[18px] py-3.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-2 h-3 w-80" />
          </div>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line-row px-[18px] py-2.5 last:border-b-0">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-3.5 flex-[2.4]" />
              <Skeleton className="h-3 flex-[1.5]" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
        </div>
        <div className="rounded-[10px] border border-line bg-surface px-[18px] py-3.5">
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
