import { cn } from "@/lib/cn";
import { Icone } from "@/components/ui/icons";
import { Numero } from "@/components/ui/numero";
import { resumoJaPedido, type PedidoAnterior } from "@/domain/ja-pedido";

/**
 * Só informa: este projeto/peça já foi pedido neste evento — quanto, por qual área, por quem e em
 * que situação. Não impede de pedir de novo.
 */
export function AvisoJaPedido({ pedidos, className }: { pedidos: readonly PedidoAnterior[] | undefined; className?: string }) {
  const r = resumoJaPedido(pedidos);
  if (!r) return null;
  return (
    <div role="note" className={cn("flex items-start gap-1.5 rounded-controle bg-warning-bg px-2 py-1.5 text-pequeno text-ink-2", className)}>
      <Icone nome="info" className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <div className="min-w-0">
        <span className="font-medium text-ink">
          Já pedido neste evento: <Numero valor={r.total} /> {r.total === 1 ? "unidade" : "unidades"}
        </span>
        <ul className="m-0 list-none p-0">
          {r.linhas.map((l, i) => (
            <li key={i} className="break-words">
              {l}
            </li>
          ))}
          {r.outros > 0 && <li className="text-muted">e mais {r.outros} {r.outros === 1 ? "pedido" : "pedidos"}</li>}
        </ul>
      </div>
    </div>
  );
}
