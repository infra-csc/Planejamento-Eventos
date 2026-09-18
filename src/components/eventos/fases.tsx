import type { EventoStatus } from "@/server/db/schema";
import { cn } from "@/lib/cn";
import { EVENTO_STATUS_LABEL, FASES_EVENTO, indiceFase } from "@/domain/evento";

const NOMES = ["Preparação", "Reunião de OS", "Aberto a alterações", "Encerrado"];

/** 4 barras de fase (handoff §5.3): concluída accent, atual dark, futura line. */
export function BarrasFase({ status, rotuloStatus }: { status: EventoStatus; rotuloStatus?: string }) {
  const idx = indiceFase(status);
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`Fase: ${rotuloStatus ?? EVENTO_STATUS_LABEL[status]}`}>
      {FASES_EVENTO.map((f, i) => (
        <span
          key={f}
          title={NOMES[i]}
          className={cn("block h-1 flex-1 rounded-sm", status === "CANCELADO" ? "bg-line" : i < idx ? "bg-accent" : i === idx ? "bg-dark" : "bg-line")}
        />
      ))}
    </span>
  );
}

export type PassoLinhaTempo = { titulo: string; quando: string; detalhe: string };

/** Linha do tempo de 4 fases no topo do evento (handoff §5.4). */
export function LinhaTempo({ status, passos }: { status: EventoStatus; passos: PassoLinhaTempo[] }) {
  const idx = indiceFase(status);
  return (
    <section aria-label="Fases do evento" className="mb-cartao rounded-cartao border border-line bg-surface px-cartao py-4">
      <ol className="m-0 grid list-none grid-cols-2 gap-y-4 p-0 sm:flex sm:items-stretch">
        {passos.map((p, i) => {
          const feito = i < idx;
          const atual = i === idx;
          return (
            <li key={p.titulo} className="min-w-0 pr-4 sm:flex-1" aria-current={atual ? "step" : undefined}>
              <div className="mb-2 flex items-center gap-2">
                <span aria-hidden className={cn("block shrink-0 rounded-full", atual ? "size-[11px] bg-dark ring-4 ring-accent-bg" : "size-[9px]", feito && "bg-accent", !feito && !atual && "bg-line-strong")} />
                <span aria-hidden className={cn("block h-0.5 flex-1", feito ? "bg-accent" : "bg-line-soft")} />
              </div>
              <p className={cn("m-0 text-corpo", atual ? "font-semibold" : "font-medium", atual || feito ? "text-dark" : "text-muted")}>{p.titulo}</p>
              <p className="mt-0.5 font-mono text-pequeno text-muted">{p.quando}</p>
              <p className={cn("mt-[5px] text-pequeno leading-[1.45]", atual ? "text-ink-2" : "text-ink-3")}>{p.detalhe}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
