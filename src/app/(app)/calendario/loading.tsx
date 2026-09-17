import { Skeleton } from "@/components/ui/layout";

/** Esqueleto com a forma do calendário: cabeçalho do mês e grade de 6 semanas. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando calendário">
      <div className="mb-[18px] flex items-end justify-between gap-5">
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2.5 h-4 w-[320px]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="size-8 rounded-controle" />
          <Skeleton className="h-8 w-16 rounded-controle" />
          <Skeleton className="size-8 rounded-controle" />
        </div>
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="grid grid-cols-7 border-b border-line-soft bg-subtle">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-2 py-2">
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }, (_, i) => (
            <div key={i} className="min-h-[112px] border-b border-r border-line-row p-2 [&:nth-child(7n)]:border-r-0">
              <Skeleton className="size-6 rounded-full" />
              {i % 3 === 0 && <Skeleton className="mt-2 h-4 w-full rounded-chip" />}
              {i % 5 === 0 && <Skeleton className="mt-1 h-4 w-4/5 rounded-chip" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
