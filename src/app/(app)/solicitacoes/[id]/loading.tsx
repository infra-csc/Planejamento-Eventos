import { Skeleton } from "@/components/ui/layout";

/** Esqueleto do detalhe da solicitação: cabeçalho, coluna de itens e painel lateral de dados. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando solicitação">
      <div className="mb-[18px]">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="mt-2.5 h-6 w-full max-w-72" />
        <Skeleton className="mt-2.5 h-4 w-full max-w-[420px]" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="overflow-hidden rounded-cartao border border-line bg-surface">
          <div className="border-b border-line-soft px-cartao py-3.5">
            <Skeleton className="h-4 w-32" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-b border-line-row px-cartao py-4 last:border-b-0">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-3/5" />
                  <Skeleton className="mt-2 h-3 w-2/5" />
                </div>
                <Skeleton className="h-3.5 w-10" />
              </div>
              <div className="mt-3 flex gap-2">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-[27px] w-20 rounded-controle" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-cartao border border-line bg-surface">
            <div className="border-b border-line-soft px-cartao py-3.5">
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="px-cartao pb-3.5 pt-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-line-faint py-2 last:border-b-0">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-cartao border border-line bg-surface px-cartao py-3.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-9 w-full rounded-controle" />
          </div>
        </div>
      </div>
    </div>
  );
}
