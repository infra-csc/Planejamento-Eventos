import { Skeleton, SkeletonLista } from "@/components/ui/layout";

/**
 * Esqueleto com a forma da lista de eventos: título, barra de filtros e cartão com as abas de fase. O genérico não tinha
 * filtros nem abas e a página "pulava" quando chegava (auditoria 28/10, nº 129). Fica no grupo `(lista)` para valer só
 * para `/eventos`: em `eventos/` ele apareceria também ao abrir um evento, enquanto o cabeçalho do evento carrega.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando eventos…</span>
      <div className="mb-5 flex items-center justify-between gap-5 border-b border-line pb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-32 rounded-controle" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-row">
        <Skeleton className="col-span-2 h-[34px] w-full rounded-controle sm:max-w-[300px]" />
        <Skeleton className="h-[34px] w-full rounded-controle sm:max-w-[190px]" />
        <Skeleton className="h-[34px] w-full rounded-controle sm:max-w-[190px]" />
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="flex gap-5 overflow-hidden border-b border-line-soft px-cartao py-3">
          {["w-14", "w-24", "w-20", "w-32", "w-20", "w-20", "w-20"].map((w, i) => (
            <Skeleton key={i} className={`h-3.5 shrink-0 ${w}`} />
          ))}
        </div>
        <SkeletonLista linhas={8} />
      </div>
    </div>
  );
}
