import type { EventoStatus } from "@/server/db/schema";
import { EVENTO_STATUS_LABEL, FASES_EVENTO, indiceFase } from "@/domain/evento";

const NOMES = ["Preparação", "Reunião de OS", "Aberto a alterações", "Encerrado"];

/** 4 barras de fase (handoff §5.3): concluída #8e2740, atual #2a1418, futura #e4dedd. */
export function BarrasFase({ status, rotuloStatus }: { status: EventoStatus; rotuloStatus?: string }) {
  const idx = indiceFase(status);
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`Fase: ${rotuloStatus ?? EVENTO_STATUS_LABEL[status]}`}>
      {FASES_EVENTO.map((f, i) => (
        <span
          key={f}
          title={NOMES[i]}
          className="block h-1 flex-1 rounded-sm"
          style={{ background: status === "CANCELADO" ? "#e4dedd" : i < idx ? "#8e2740" : i === idx ? "#2a1418" : "#e4dedd" }}
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
    <section aria-label="Fases do evento" className="mb-[18px] rounded-[10px] border border-line bg-surface px-[18px] py-4">
      <ol className="m-0 flex list-none items-stretch p-0">
        {passos.map((p, i) => {
          const feito = i < idx;
          const atual = i === idx;
          const cor = feito ? "#8e2740" : atual ? "#2a1418" : "#d7d2d2";
          return (
            <li key={p.titulo} className="min-w-0 flex-1 pr-4" aria-current={atual ? "step" : undefined}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  aria-hidden
                  className="block shrink-0 rounded-full"
                  style={{ width: atual ? 11 : 9, height: atual ? 11 : 9, background: cor, boxShadow: atual ? "0 0 0 4px #f6e6ea" : undefined }}
                />
                <span aria-hidden className="block h-0.5 flex-1" style={{ background: feito ? "#8e2740" : "#ece7e6" }} />
              </div>
              <p className="m-0 text-[13.5px]" style={{ fontWeight: atual ? 600 : 500, color: atual || feito ? "#2a1418" : "#6f6366" }}>
                {p.titulo}
              </p>
              <p className="mt-0.5 font-mono text-[12px] text-muted">{p.quando}</p>
              <p className="mt-[5px] text-[12.5px] leading-[1.45]" style={{ color: atual ? "#4f4849" : "#6b6263" }}>
                {p.detalhe}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
