import { Skeleton } from "@/components/ui/layout";

/** Esqueleto do cadastro: lista de eventos e o painel do evento. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando o cadastro" className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <Skeleton className="h-[420px] w-full rounded-cartao" />
      <Skeleton className="h-60 w-full rounded-cartao" />
    </div>
  );
}
