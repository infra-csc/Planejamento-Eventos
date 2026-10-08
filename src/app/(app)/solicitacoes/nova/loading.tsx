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
              <Skeleton className="mt-2.5 h-3 w-32" />
              {/* Resultados em lista: miniatura, nome e código, quantidade e "Adicionar". */}
              <div className="mt-2.5 divide-y divide-line-row rounded-cartao border border-line">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="h-10 w-14 shrink-0 rounded-controle max-sm:hidden" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className={i % 2 ? "h-3.5 w-2/5" : "h-3.5 w-3/5"} />
                      <Skeleton className="mt-2 h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-[30px] w-24 shrink-0 rounded-controle max-sm:hidden" />
                    <Skeleton className="h-[30px] w-24 shrink-0 rounded-controle" />
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
