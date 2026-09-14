"use client";

import { useState } from "react";
import { cancelarSolicitacaoAction, devolverSolicitacaoAction } from "@/app/(app)/solicitacoes/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ItemStatusBadge, Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/layout";
import { ResponderItemForm } from "./responder-item-form";
import { ITEM_OPERACAO_LABEL } from "@/domain/solicitacao";
import { formatarDataHora } from "@/lib/format";
import type { SolicitacaoStatus, SolicitacaoTipo } from "@/server/db/schema";
import type { ItemView } from "./types";

export function SolicitacaoDetalhe({
  solicitacao,
  itens,
  podeResponder,
  podeCorrigir,
  podeDevolver,
  podeCancelar,
}: {
  solicitacao: { id: string; eventoId: string; status: SolicitacaoStatus; tipo: SolicitacaoTipo; observacao: string | null; titulo: string | null };
  itens: ItemView[];
  podeResponder: boolean;
  podeCorrigir: boolean;
  podeDevolver: boolean;
  podeCancelar: boolean;
}) {
  const [corrigindo, setCorrigindo] = useState<string | null>(null);
  const [devolver, setDevolver] = useState(false);
  const [cancelar, setCancelar] = useState(false);

  return (
    <>
      {solicitacao.observacao && (
        <Panel title="Observação do solicitante">
          <p className="whitespace-pre-wrap text-sm text-ink">{solicitacao.observacao}</p>
        </Panel>
      )}
      <Panel
        title={`Itens (${itens.length})`}
        description={podeResponder ? "Responda cada item. Parcial e não atendido exigem observação; o solicitante é notificado item a item." : undefined}
        actions={
          <>
            {podeDevolver && (
              <Button size="sm" onClick={() => setDevolver(true)}>
                Devolver para ajuste
              </Button>
            )}
            {podeCancelar && (
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelar(true)}>
                Cancelar solicitação
              </Button>
            )}
          </>
        }
        padded={false}
      >
        <ul className="divide-y divide-line">
          {itens.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {i.operacao !== "ADICIONAR" && <Badge className="mr-1.5">{ITEM_OPERACAO_LABEL[i.operacao]}</Badge>}
                    {i.descricao}{" "}
                    <span className="text-ink-muted font-normal">
                      {i.operacao === "REMOVER" ? "" : i.operacao === "ALTERAR_QUANTIDADE" ? `${i.quantidadeAtual ?? "?"} → ${i.quantidadeSolicitada}` : `× ${i.quantidadeSolicitada}`}
                    </span>
                  </p>
                  {(i.destino || i.justificativa) && (
                    <p className="text-xs text-ink-muted">
                      {i.destino ? `Destino: ${i.destino}` : ""}
                      {i.destino && i.justificativa ? " · " : ""}
                      {i.justificativa ?? ""}
                    </p>
                  )}
                </div>
                <ItemStatusBadge status={i.status} />
              </div>

              {i.status !== "EM_ANALISE" && corrigindo !== i.id && (
                <div className="mt-2 rounded-md bg-surface-muted px-3 py-2 text-[13px]">
                  <p className="text-ink">
                    <span className="font-medium">
                      {i.operacao === "REMOVER" ? (i.status === "ATENDIDO" ? "Removido da ata" : "Mantido na ata") : `${i.quantidadeAtendida ?? 0} de ${i.quantidadeSolicitada}`}
                    </span>
                    {i.observacaoLogistica ? ` — ${i.observacaoLogistica}` : ""}
                    {i.pendenciaCompra && <Badge tone="warning" className="ml-2">pendência de compra/locação</Badge>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <span>
                      {i.respondidoPor} · {formatarDataHora(i.respondidoEm)}
                    </span>
                    {podeCorrigir && (
                      <button type="button" className="text-info hover:underline" onClick={() => setCorrigindo(i.id)}>
                        Corrigir resposta
                      </button>
                    )}
                  </p>
                </div>
              )}

              {((i.status === "EM_ANALISE" && podeResponder) || corrigindo === i.id) && (
                <div className="mt-2">
                  <ResponderItemForm item={i} modo={corrigindo === i.id ? "corrigir" : "responder"} onDone={corrigindo === i.id ? () => setCorrigindo(null) : undefined} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {devolver && (
        <ConfirmDialog
          open
          onOpenChange={setDevolver}
          title="Devolver para ajuste"
          description="A solicitação volta para a área como rascunho, com o motivo abaixo. Nenhum item é respondido."
          confirmLabel="Devolver"
          reasonLabel="Motivo da devolução"
          action={devolverSolicitacaoAction}
          hidden={{ solicitacaoId: solicitacao.id, eventoId: solicitacao.eventoId }}
        />
      )}
      {cancelar && (
        <ConfirmDialog
          open
          onOpenChange={setCancelar}
          title="Cancelar solicitação"
          description="A solicitação deixa de aguardar resposta. Se precisar, abra outra."
          confirmLabel="Cancelar solicitação"
          danger
          reasonLabel="Motivo"
          reasonRequired={false}
          action={cancelarSolicitacaoAction}
          hidden={{ solicitacaoId: solicitacao.id, eventoId: solicitacao.eventoId }}
        />
      )}
    </>
  );
}
