"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { Tag } from "@/components/ui/badge";
import { resumoJaPedido, type PedidoAnterior, type SituacaoPedido } from "@/domain/ja-pedido";

const TOM: Record<SituacaoPedido, "success" | "info" | "warning" | "muted"> = {
  "na ata": "success",
  atendido: "success",
  "atendido em parte": "warning",
  "aguardando resposta": "info",
  "incluído pela logística": "muted",
};

/**
 * Só informa: este projeto/peça já foi pedido neste evento. No cartão, uma linha curta com o total e
 * de quem; "Ver" abre o detalhe de cada pedido (local e descrição de cada unidade). Não impede nada.
 */
export function AvisoJaPedido({ nome, pedidos, className }: { nome: string; pedidos: readonly PedidoAnterior[] | undefined; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const r = resumoJaPedido(pedidos);
  if (!r) return null;
  return (
    <>
      <div role="note" className={cn("flex items-center gap-2 rounded-controle bg-warning-bg px-2 py-1.5 text-pequeno text-ink-2", className)}>
        <Icone nome="info" className="size-3.5 shrink-0 text-warning" />
        <span className="min-w-0 flex-1">
          Já pedido: <Numero valor={r.total} className="font-medium text-ink" /> {r.total === 1 ? "unidade" : "unidades"} · {r.quem}
        </span>
        <Button variant="link" size="xs" onClick={() => setAberto(true)} aria-label={`Ver o que já foi pedido de ${nome}`}>
          Ver
        </Button>
      </div>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto && (
          <DialogContent title={`Já pedido: ${nome}`} description={`${r.total} ${r.total === 1 ? "unidade" : "unidades"} neste evento. É só informação — você pode pedir mais se precisar.`} size="md">
            <ul className="-mx-5 -my-4 m-0 list-none divide-y divide-line-row p-0">
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
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
