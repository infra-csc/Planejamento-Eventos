import { Carregando, Skeleton } from "@/components/ui/layout";

/** Esqueleto do calendário de carga: semana, filtros, gráfico do ano e os 7 dias. */
export default function Loading() {
  return (
    <Carregando texto="Carregando carga e descarga…">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-9 w-36 rounded-controle" />
        </div>
        <Skeleton className="h-[92px] w-full rounded-cartao" />
        <Skeleton className="h-[110px] w-full rounded-cartao" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-cartao" />
          ))}
        </div>
      </div>
    </Carregando>
  );
}
