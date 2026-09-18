import { Skeleton } from "@/components/ui/layout";

/** Esqueleto genérico (handoff §6): cabeçalho e um bloco de conteúdo — serve a qualquer tela sem esqueleto próprio. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-[18px]">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-2.5 h-6 w-full max-w-64" />
        <Skeleton className="mt-2.5 h-4 w-full max-w-[420px]" />
      </div>
      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <div className="border-b border-line-soft px-cartao py-3.5">
          <Skeleton className="h-4 w-44" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-row px-cartao py-3.5 last:border-b-0">
            <div className="flex-1">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="mt-2 h-3 w-2/5" />
            </div>
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
