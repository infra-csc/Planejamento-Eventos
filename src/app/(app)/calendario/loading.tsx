import { Skeleton } from "@/components/ui/layout";

/** Esqueleto com a forma do calendário: cabeçalho com o mês, filtros, grade (lista no celular) e agenda. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando calendário">
      <div className="mb-5 flex flex-col items-start gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-52 rounded-controle" />
      </div>
      <Skeleton className="mb-4 h-8 w-full max-w-md rounded-controle" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        {/* Celular: lista por dia. */}
        <div className="overflow-hidden rounded-cartao border border-line bg-surface md:hidden">
          {[0, 1, 2].map((d) => (
            <div key={d} className="border-b border-line-row last:border-b-0">
              <div className="border-b border-line-row bg-subtle px-cartao py-2">
                <Skeleton className="h-3 w-20" />
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-3 px-cartao py-2.5">
                  <Skeleton className="h-3 w-10" />
                  <div className="flex-1">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-cartao border border-line bg-surface md:block">
          <div className="border-b border-line-soft px-cartao py-3">
            <Skeleton className="h-3 w-72" />
          </div>
          <div className="grid grid-cols-7 border-b border-line-soft bg-subtle">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="px-2 py-2">
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="min-h-28 border-b border-r border-line-row p-1.5 [&:nth-child(7n)]:border-r-0">
                <Skeleton className="size-6 rounded-full" />
                {i % 3 === 0 && <Skeleton className="mt-2 h-4 w-full rounded-chip" />}
                {i % 5 === 0 && <Skeleton className="mt-1 h-3 w-4/5 rounded-chip" />}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-cartao border border-line bg-surface xl:block">
          <div className="border-b border-line-soft px-cartao py-3.5">
            <Skeleton className="h-4 w-32" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3 border-b border-line-row px-cartao py-3 last:border-b-0">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
