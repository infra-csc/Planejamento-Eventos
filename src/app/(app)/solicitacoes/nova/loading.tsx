import { Skeleton } from "@/components/ui/layout";

/** Esqueleto do formulário de solicitação: cabeçalho, itens à esquerda e dados do envio à direita. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando formulário">
      <div className="mb-[18px]">
        <Skeleton className="h-6 w-full max-w-52" />
        <Skeleton className="mt-2.5 h-4 w-full max-w-[520px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="rounded-cartao border border-line bg-surface px-cartao py-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-[34px] w-full rounded-controle" />
          </div>
          <div className="overflow-hidden rounded-cartao border border-line bg-surface">
            <div className="border-b border-line-soft px-cartao py-3.5">
              <Skeleton className="h-4 w-36" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-line-row px-cartao py-3.5 last:border-b-0">
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-3/5" />
                  <Skeleton className="mt-2 h-3 w-2/5" />
                </div>
                <Skeleton className="h-[30px] w-24 rounded-controle" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-cartao border border-line bg-surface px-cartao py-4">
          {[0, 1].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className={i === 1 ? "mt-2 h-[76px] w-full rounded-controle" : "mt-2 h-[34px] w-full rounded-controle"} />
            </div>
          ))}
          <Skeleton className="h-[42px] w-full rounded-controle" />
        </div>
      </div>
    </div>
  );
}
