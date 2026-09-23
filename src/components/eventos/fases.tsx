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

/**
 * Fases do evento sob o cabeçalho: um trilho segmentado (feita · atual · futura) com o nome e a data
 * de cada fase. Só a fase atual mostra o detalhe; nas outras ele fica no `title`.
 * No celular sobra o trilho e uma linha com a fase atual (quatro colunas de texto não cabem em 375 px).
 */
export function LinhaTempo({ status, passos }: { status: EventoStatus; passos: PassoLinhaTempo[] }) {
  const idx = indiceFase(status);
  const cancelado = status === "CANCELADO";
  const atual = idx >= 0 ? passos[idx] : null;
  return (
    <section aria-label="Fases do evento" className="mb-4">
      <ol className="m-0 grid list-none grid-cols-4 gap-1.5 p-0 sm:gap-3">
        {passos.map((p, i) => {
          const feito = !cancelado && i < idx;
          const agora = !cancelado && i === idx;
          return (
            <li key={p.titulo} className="min-w-0" aria-current={agora ? "step" : undefined} title={agora ? undefined : `${p.titulo} · ${p.quando} · ${p.detalhe}`}>
              <span aria-hidden className={cn("block h-1 rounded-full", feito ? "bg-ink-3" : agora ? "bg-accent" : "bg-line-strong")} />
              <span className="sr-only">{feito ? "Fase concluída: " : agora ? "Fase atual: " : "Próxima fase: "}</span>
              <span className="mt-2 hidden sm:block">
                <span className={cn("block truncate text-pequeno", agora ? "font-semibold text-ink" : feito ? "font-medium text-ink-2" : "text-muted")}>{p.titulo}</span>
                <span className="numero block truncate text-rotulo text-muted">{p.quando}</span>
                {agora && <span className="mt-0.5 block truncate text-rotulo text-ink-2">{p.detalhe}</span>}
              </span>
              <span className="sr-only sm:hidden">
                {p.titulo}, {p.quando}, {p.detalhe}
              </span>
            </li>
          );
        })}
      </ol>
      {atual && (
        <p aria-hidden className="mb-0 mt-2 flex min-w-0 items-baseline gap-1.5 text-pequeno sm:hidden">
          <span className="font-semibold text-ink">{atual.titulo}</span>
          <span className="numero truncate text-muted">
            · {atual.quando} · {atual.detalhe}
          </span>
        </p>
      )}
    </section>
  );
}
