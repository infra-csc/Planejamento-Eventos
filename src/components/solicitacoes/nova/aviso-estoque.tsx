import { cn } from "@/lib/cn";
import { saldoEstoque } from "@/domain/estoque";
import { Numero } from "@/components/ui/numero";

/** Estoque de uma peça ligada ao inventário da Ativação, já com o que outros eventos do período levam. */
export type EstoquePeca = {
  nome: string;
  quantidade: number;
  emOutros: number;
  /** Quais eventos do mesmo período levam a peça (código, nome, quantidade). */
  outrosEventos?: ReadonlyArray<{ codigo: string; nome: string; quantidade: number }>;
  /** Em reforma: não está na quantidade e volta quando a reforma terminar. */
  emReforma?: number;
  capaId?: string | null;
};
export type EstoqueDoEvento = Record<string, EstoquePeca>;

/**
 * "Estoque 170" (ou "Estoque 170 · 40 em outro evento no período · restam 130"); em amarelo quando o pedido passa do que
 * resta ("pede 150 · faltam 20"). "Detalhes" abre a foto do item, os eventos do período que levam a peça e o que está
 * em reforma. Só informa: o pedido segue igual para a logística.
 */
export function AvisoEstoque({ info, pedido = 0, className }: { info: EstoquePeca | undefined; pedido?: number; className?: string }) {
  if (!info) return null;
  const { restam, falta } = saldoEstoque(info.quantidade, info.emOutros, pedido);
  const outros = info.outrosEventos ?? [];
  const temDetalhes = outros.length > 0 || (info.emReforma ?? 0) > 0 || Boolean(info.capaId);
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
      {(info.emReforma ?? 0) > 0 && (
        <>
          {" · "}
          <Numero valor={info.emReforma!} /> em reforma
        </>
      )}
      {temDetalhes && (
        <details className="group/detalhe mt-1 font-normal text-ink-3">
          <summary className="w-fit cursor-pointer list-none text-rotulo text-accent underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open/detalhe:hidden">Ver detalhes do item</span>
            <span className="hidden group-open/detalhe:inline">Esconder detalhes</span>
          </summary>
          <span className="mt-1.5 flex gap-3 rounded-controle border border-line-soft bg-subtle p-2">
            {info.capaId && (
              // eslint-disable-next-line @next/next/no-img-element -- miniatura servida pela rota de anexos (WEBP já reduzido)
              <img src={`/api/ativacao/anexos/${info.capaId}?w=160`} alt={info.nome} loading="lazy" decoding="async" className="size-16 shrink-0 rounded-controle border border-line bg-white object-cover" />
            )}
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-medium text-ink-2">{info.nome}</span>
              {outros.length > 0 ? (
                <span className="flex flex-col">
                  <span>No mesmo período:</span>
                  {outros.map((o) => (
                    <span key={o.codigo}>
                      <span className="font-mono">{o.codigo}</span> {o.nome} · <Numero valor={o.quantidade} />
                    </span>
                  ))}
                </span>
              ) : (
                <span>Nenhum outro evento do período leva este item.</span>
              )}
              {(info.emReforma ?? 0) > 0 && (
                <span>
                  <Numero valor={info.emReforma!} /> em reforma (fora da conta até voltar)
                </span>
              )}
            </span>
          </span>
        </details>
      )}
    </span>
  );
}
