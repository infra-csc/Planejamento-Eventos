import { Skeleton } from "@/components/ui/layout";

/** Cabeçalho de um passo: círculo do número + título + linha de apoio. */
function CabecalhoPasso({ largura }: { largura: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-soft px-cartao py-3.5">
      <Skeleton className="size-6 shrink-0 rounded-full" />
      <div className="flex-1">
        <Skeleton className={`h-4 ${largura}`} />
        <Skeleton className="mt-2 h-3 w-3/5" />
      </div>
    </div>
  );
}

/** Esqueleto do formulário de solicitação: passos à esquerda e resumo/envio à direita. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando formulário">
      <div className="mb-[18px]">
        <Skeleton className="h-6 w-full max-w-52" />
        <Skeleton className="mt-2.5 h-4 w-full max-w-[520px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-cartao border border-line bg-surface">
            <CabecalhoPasso largura="w-16" />
            <div className="px-cartao py-3.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-3/5" />
            </div>
          </div>
          <div className="rounded-cartao border border-line bg-surface">
            <CabecalhoPasso largura="w-44" />
            <div className="px-cartao pb-4 pt-3">
              <div className="mb-3 flex gap-4">
                {["w-24", "w-28", "w-20"].map((w) => (
                  <Skeleton key={w} className={`h-3.5 ${w}`} />
                ))}
              </div>
              <Skeleton className="h-[34px] w-full rounded-controle" />
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-cartao border border-line p-3">
                    <div className="flex gap-3">
                      <Skeleton className="h-12 w-16 shrink-0 rounded-controle" />
                      <div className="flex-1">
                        <Skeleton className="h-3.5 w-4/5" />
                        <Skeleton className="mt-2 h-3 w-2/5" />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Skeleton className="h-[30px] w-28 rounded-controle" />
                      <Skeleton className="h-[30px] w-24 rounded-controle" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-cartao border border-line bg-surface">
          <CabecalhoPasso largura="w-32" />
          <div className="flex flex-col gap-4 px-cartao py-3.5">
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className={i === 1 ? "mt-2 h-16 w-full rounded-controle" : "mt-2 h-[34px] w-full rounded-controle"} />
              </div>
            ))}
            <Skeleton className="h-9 w-full rounded-controle" />
          </div>
        </div>
      </div>
    </div>
  );
}
