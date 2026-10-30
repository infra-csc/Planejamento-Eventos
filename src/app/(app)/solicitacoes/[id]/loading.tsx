import { Skeleton } from "@/components/ui/layout";

/**
 * Esqueleto do detalhe da solicitação: cabeçalho, cartão de itens e cartão do histórico, numa coluna só como a página
 * (a coluna lateral de 320 px que a tela não tem mais fazia o conteúdo pular ao chegar; auditoria 30/10, A N14).
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="max-w-[1080px]">
      <span className="sr-only">Carregando a solicitação…</span>
      <div className="mb-[18px]">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="mt-2.5 h-6 w-full max-w-72" />
        <Skeleton className="mt-2.5 h-4 w-full max-w-[420px]" />
        <Skeleton className="mt-2.5 h-4 w-full max-w-[280px]" />
      </div>
      <div className="flex flex-col gap-5">
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
                <Skeleton className="h-[34px] w-28 rounded-controle" />
                <Skeleton className="h-[34px] w-20 rounded-controle" />
                <Skeleton className="h-[34px] w-24 rounded-controle" />
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-cartao border border-line bg-surface">
          <div className="border-b border-line-soft px-cartao py-3.5">
            <Skeleton className="h-4 w-28" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3 border-b border-line-row px-cartao py-3 last:border-b-0">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
