import { Skeleton } from "@/components/ui/layout";

/** Troca de aba do evento: o cabeçalho fica, só o conteúdo da aba mostra o esqueleto. */
export default function LoadingAbaEvento() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="border-b border-line-soft px-cartao py-3.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-72" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-row px-cartao py-3.5 last:border-b-0">
            <div className="flex-1">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="mt-2 h-3 w-1/4" />
            </div>
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-5">
        <div className="rounded-cartao border border-line bg-surface px-cartao py-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-9 w-full" />
          <Skeleton className="mt-2 h-9 w-full" />
        </div>
        <div className="rounded-cartao border border-line bg-surface px-cartao py-4">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="mt-3 h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
