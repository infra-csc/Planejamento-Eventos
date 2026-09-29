"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icons";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { Codigo, Numero } from "@/components/ui/numero";
import { Tag } from "@/components/ui/badge";
import { TabsControladas } from "@/components/ui/tabs-nav";
import { resumoJaPedido, type PedidoAnterior, type SituacaoPedido } from "@/domain/ja-pedido";
import type { LinhaBom } from "./tipos";

const TOM: Record<SituacaoPedido, "success" | "info" | "warning" | "muted"> = {
  "na ata": "success",
  atendido: "success",
  "atendido em parte": "warning",
  "aguardando resposta": "info",
  "incluído pela logística": "muted",
};

type Aba = "pecas" | "pedido";

/** O que a linha de ações e a janela precisam saber do item (projeto ou peça). */
export type ReferenciaDetalhe = { nome: string; codigo?: string | null; meta?: string | null; descricao?: string | null; capaId?: string | null; bom?: readonly LinhaBom[] };

/**
 * Linha discreta de ações do item, sem poluir o cartão: "Ver peças" (projeto) e, só quando o item já
 * foi pedido neste evento, o selo "Já pedido · N un.". Os dois abrem a mesma janela, com abas.
 * Só informa — não impede de pedir.
 */
export function AcoesReferencia({ referencia, pedidos, quantidade = 1, className }: { referencia: ReferenciaDetalhe; pedidos?: readonly PedidoAnterior[]; quantidade?: number; className?: string }) {
  const [aba, setAba] = useState<Aba | null>(null);
  const r = resumoJaPedido(pedidos);
  const temPecas = Boolean(referencia.bom?.length);
  if (!temPecas && !r) return null;
  return (
    <>
      <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
        {temPecas && (
          <button type="button" onClick={() => setAba("pecas")} className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-pequeno text-accent hover:underline">
            <Icone nome="lista" className="size-3.5" />
            Ver peças
          </button>
        )}
        {r && (
          <button
            type="button"
            onClick={() => setAba("pedido")}
            title={`Já pedido neste evento: ${r.total} ${r.total === 1 ? "unidade" : "unidades"} · ${r.quem}`}
            className="inline-flex cursor-pointer items-center gap-1 rounded-chip border border-warning-border bg-warning-bg px-1.5 py-px text-rotulo font-medium text-warning hover:brightness-95"
          >
            <Icone nome="info" className="size-3" />
            Já pedido · <Numero valor={r.total} /> un.
          </button>
        )}
      </span>
      <Dialog open={aba !== null} onOpenChange={(o) => !o && setAba(null)}>
        {aba && <JanelaDetalhe referencia={referencia} pedidos={pedidos} quantidade={quantidade} aba={aba} setAba={setAba} />}
      </Dialog>
    </>
  );
}

function JanelaDetalhe({ referencia, pedidos, quantidade, aba, setAba }: { referencia: ReferenciaDetalhe; pedidos?: readonly PedidoAnterior[]; quantidade: number; aba: Aba; setAba: (a: Aba) => void }) {
  const r = resumoJaPedido(pedidos);
  const bom = referencia.bom ?? [];
  const totalPecas = bom.reduce((a, b) => a + b.quantidade, 0);
  const abas = [
    ...(bom.length ? [{ chave: "pecas" as const, label: "Peças", n: `${bom.length} tipos · ${totalPecas} un.` }] : []),
    ...(r ? [{ chave: "pedido" as const, label: "Já pedido", n: `${r.total} un.`, tom: "warning" as const }] : []),
  ];
  return (
    <DialogContent title={referencia.nome} description={[referencia.codigo, referencia.meta].filter(Boolean).join(" · ") || undefined} size="lg">
      {(referencia.capaId || referencia.descricao) && (
        <div className="-mt-1 mb-3 flex gap-3">
          {referencia.capaId && <ImagemZoom src={`/api/anexos/${referencia.capaId}`} alt={referencia.nome} className="h-20 w-28 shrink-0 overflow-hidden rounded-controle border border-line" />}
          {referencia.descricao && <p className="m-0 whitespace-pre-line text-pequeno text-ink-2">{referencia.descricao}</p>}
        </div>
      )}
      {abas.length > 1 && <TabsControladas abas={abas} valor={aba} onChange={setAba} rotulo="Detalhes do item" compacta className="-mx-5 mb-2 px-3" />}
      {aba === "pecas" && bom.length > 0 && (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full border-collapse text-pequeno">
            <caption className="sr-only">Peças de {referencia.nome}</caption>
            <thead>
              <tr className="bg-subtle text-left text-micro font-semibold uppercase tracking-[0.06em] text-muted">
                <th scope="col" className="px-5 py-2">
                  Código
                </th>
                <th scope="col" className="px-2 py-2">
                  Peça
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Por un.
                </th>
                {quantidade > 1 && (
                  <th scope="col" className="px-5 py-2 text-right">
                    × {quantidade}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {bom.map((b) => (
                <tr key={b.pecaId} className="border-b border-line-row last:border-b-0">
                  <td className="px-5 py-1.5">
                    <Codigo className="text-ink-3">{b.codigo}</Codigo>
                  </td>
                  <td className="px-2 py-1.5 text-ink">{b.nome}</td>
                  <td className="numero px-2 py-1.5 text-right text-ink-2">
                    {b.quantidade} <span className="text-meta">{b.unidade}</span>
                  </td>
                  {quantidade > 1 && <td className="numero px-5 py-1.5 text-right font-medium text-ink">{b.quantidade * quantidade}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 border-t border-line-soft px-5 pt-2 text-rotulo text-muted">
            Lista padrão por unidade. Depois de adicionar, dá para ajustar peças só neste pedido em “Ajustar peças”.
          </p>
        </div>
      )}
      {aba === "pedido" && r && (
        <>
          <p className="m-0 mb-2 text-pequeno text-muted">
            <Numero valor={r.total} className="font-medium text-ink" /> {r.total === 1 ? "unidade" : "unidades"} neste evento. É só informação — você pode pedir mais se precisar.
          </p>
          <ul className="-mx-5 m-0 list-none divide-y divide-line-row border-t border-line-row p-0">
            {r.grupos.map((g) => (
              <li key={g.chave} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {g.codigo && <Codigo className="text-ink">{g.codigo}</Codigo>}
                  <span className="font-medium text-ink">{g.area}</span>
                  {g.pessoa && <span className="text-pequeno text-muted">· {g.pessoa}</span>}
                  <Tag tom={TOM[g.situacao]} className="ml-auto">
                    {g.situacao}
                  </Tag>
                </div>
                <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                  {g.linhas.map((l, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-pequeno">
                      <span className="numero w-9 shrink-0 text-right font-medium text-ink">{l.quantidade}×</span>
                      <span className="min-w-0 text-ink-2">
                        {l.destino ? <span className="font-medium text-ink">{l.destino}</span> : <span className="text-meta">local não informado</span>}
                        {l.descricao ? <span className="block whitespace-pre-line break-words">{l.descricao}</span> : <span className="block text-meta">sem descrição</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </DialogContent>
  );
}
