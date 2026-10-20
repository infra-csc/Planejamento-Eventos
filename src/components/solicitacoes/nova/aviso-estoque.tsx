import { cn } from "@/lib/cn";
import { saldoEstoque } from "@/domain/estoque";
import { Numero } from "@/components/ui/numero";

/** Estoque de uma peça ligada ao inventário da Ativação, já com o que outros eventos do período levam. */
export type EstoquePeca = { nome: string; quantidade: number; emOutros: number };
export type EstoqueDoEvento = Record<string, EstoquePeca>;

/**
 * "Estoque 170" (ou "Estoque 170 · 40 em outro evento no período · restam 130"); em amarelo quando o pedido passa do que
 * resta ("pede 150 · faltam 20"). Só informa: o pedido segue igual para a logística.
 */
export function AvisoEstoque({ info, pedido = 0, className }: { info: EstoquePeca | undefined; pedido?: number; className?: string }) {
  if (!info) return null;
  const { restam, falta } = saldoEstoque(info.quantidade, info.emOutros, pedido);
  return (
    <span className={cn("mt-0.5 block text-rotulo font-normal", falta > 0 ? "font-medium text-warning" : "text-ink-3", className)} title={`Estoque da Ativação: ${info.nome}`}>
      Estoque <Numero valor={info.quantidade} />
      {info.emOutros > 0 && (
        <>
          {" · "}
          <Numero valor={info.emOutros} /> em outro evento no período · restam <Numero valor={restam} />
        </>
      )}
      {falta > 0 && (
        <>
          {" · "}faltam <Numero valor={falta} />
        </>
      )}
    </span>
  );
}
