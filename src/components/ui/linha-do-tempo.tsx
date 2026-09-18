import { cn } from "@/lib/cn";
import { diaMesHora } from "@/lib/format";
import type { EntradaLinhaTempo, TomLinhaTempo } from "@/server/services/linha-do-tempo";

const COR: Record<TomLinhaTempo, string> = {
  neutro: "bg-line-strong",
  info: "bg-accent",
  ok: "bg-success",
  atencao: "bg-warning",
  perigo: "bg-danger",
};

/**
 * Linha do tempo de auditoria: o que aconteceu, quem fez (nome e perfil), quando e o detalhe registrado.
 * `rotuloItem` marca a que item da solicitação a entrada se refere.
 */
export function LinhaDoTempo({ entradas, rotuloItem, vazio = "Nada registrado ainda." }: { entradas: EntradaLinhaTempo[]; rotuloItem?: (itemId: string) => string | null; vazio?: string }) {
  if (entradas.length === 0) return <p className="m-0 px-cartao py-6 text-center text-pequeno text-muted">{vazio}</p>;
  return (
    <ol className="m-0 list-none px-cartao py-3">
      {entradas.map((e, i) => {
        const item = e.itemId && rotuloItem ? rotuloItem(e.itemId) : null;
        return (
          <li key={e.id} className="relative flex gap-3 pb-3.5 last:pb-0">
            {i < entradas.length - 1 && <span aria-hidden className="absolute left-[4.5px] top-3 h-full w-px bg-line" />}
            <span aria-hidden className={cn("relative mt-[5px] block size-[10px] shrink-0 rounded-full ring-2 ring-surface", COR[e.tom])} />
            <div className="min-w-0 flex-1">
              <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-corpo">
                <span className="font-medium text-ink">{e.titulo}</span>
                {item && <span className="rounded-chip bg-control px-1.5 py-px text-rotulo text-ink-3">{item}</span>}
                <span className="font-mono text-rotulo text-muted">{diaMesHora(e.em)}</span>
              </p>
              <p className="mb-0 mt-0.5 text-pequeno text-ink-3">
                {e.por ? (
                  <>
                    <span className="text-ink-2">{e.por.nome}</span>
                    {e.por.perfil ? ` · ${e.por.perfil}` : ""}
                  </>
                ) : (
                  "Sistema"
                )}
              </p>
              <p className="mb-0 mt-0.5 break-words text-pequeno leading-[1.45] text-ink-2">{e.descricao}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
