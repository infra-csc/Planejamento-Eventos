"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useRef, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { atualizarCabecalhoAction, enviarSolicitacaoAction, excluirRascunhoAction, removerItemAction } from "@/app/(app)/solicitacoes/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, Notice, Panel, TableWrap } from "@/components/ui/layout";
import { ItemForm } from "./item-form";
import { ITEM_OPERACAO_LABEL } from "@/domain/solicitacao";
import { ESTADO_INICIAL } from "@/lib/action";
import type { OpcoesReferencia } from "@/components/eventos/linha-ata-form";
import type { SolicitacaoStatus, SolicitacaoTipo } from "@/server/db/schema";
import type { ItemView, LinhaAtaOpcao } from "./types";

export function SolicitacaoEditor({
  solicitacao,
  itens,
  opcoes,
  linhasAta,
  podeEnviar,
}: {
  solicitacao: { id: string; eventoId: string; codigo: string; tipo: SolicitacaoTipo; status: SolicitacaoStatus; titulo: string | null; observacao: string | null };
  itens: ItemView[];
  opcoes: OpcoesReferencia;
  linhasAta: LinhaAtaOpcao[];
  podeEnviar: boolean;
}) {
  const [cabState, cabAction] = useActionState(atualizarCabecalhoAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [editando, setEditando] = useState<ItemView | null | "novo">(null);
  const [remover, setRemover] = useState<ItemView | null>(null);
  const [enviar, setEnviar] = useState(false);
  const [excluir, setExcluir] = useState(false);

  // Autosave do cabeçalho ao sair dos campos (RN-06)
  const salvarCabecalho = () => formRef.current?.requestSubmit();
  const salvo = cabState.ok && cabState.mensagem ? "Salvo" : !cabState.ok ? "Não foi possível salvar" : "";

  return (
    <div className="space-y-4">
      <Panel
        title="Rascunho"
        description="Tudo é salvo automaticamente. Envie quando a lista estiver completa."
        actions={<span className={`text-xs ${cabState.ok ? "text-ink-muted" : "text-danger"}`}>{salvo}</span>}
      >
        <ActionForm ref={formRef} action={cabAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="solicitacaoId" value={solicitacao.id} />
          <Field label="Título" htmlFor="titulo" optional hint="Ajuda a identificar na lista.">
            <Input id="titulo" name="titulo" defaultValue={solicitacao.titulo ?? ""} onBlur={salvarCabecalho} maxLength={120} placeholder="Ex.: Estruturas da ativação principal" />
          </Field>
          <Field label="Observação geral" htmlFor="observacao" optional>
            <Textarea id="observacao" name="observacao" defaultValue={solicitacao.observacao ?? ""} onBlur={salvarCabecalho} className="min-h-9 h-9 py-1.5" maxLength={1000} />
          </Field>
        </ActionForm>
      </Panel>

      <Panel
        title={`Itens (${itens.length})`}
        description="Cada item será respondido separadamente: atendido, parcial ou não atendido."
        actions={
          <Button size="sm" onClick={() => setEditando("novo")}>
            <Plus className="size-3.5" /> Adicionar item
          </Button>
        }
        padded={false}
      >
        {itens.length === 0 ? (
          <EmptyState title="Nenhum item ainda" description="Adicione projetos padrão, peças do catálogo ou itens avulsos (ex.: fechamento de tenda com destino)." compact action={<Button variant="primary" size="sm" onClick={() => setEditando("novo")}>Adicionar item</Button>} />
        ) : (
          <TableWrap>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Item</th>
                  {solicitacao.tipo === "ALTERACAO" && <th className="hidden sm:table-cell">Operação</th>}
                  <th className="num">Qtd.</th>
                  <th className="hidden md:table-cell">Destino</th>
                  <th className="hidden lg:table-cell">Justificativa</th>
                  <th className="w-px"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium text-ink">{i.descricao}</td>
                    {solicitacao.tipo === "ALTERACAO" && <td className="hidden sm:table-cell text-ink-secondary">{ITEM_OPERACAO_LABEL[i.operacao]}</td>}
                    <td className="num tabular">{i.operacao === "REMOVER" ? "—" : i.operacao === "ALTERAR_QUANTIDADE" ? `${i.quantidadeAtual ?? "?"} → ${i.quantidadeSolicitada}` : i.quantidadeSolicitada}</td>
                    <td className="hidden md:table-cell">{i.destino ?? <span className="text-ink-faint">—</span>}</td>
                    <td className="hidden lg:table-cell max-w-xs truncate text-ink-muted">{i.justificativa ?? ""}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditando(i)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemover(i)} aria-label={`Remover ${i.descricao}`}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {!podeEnviar && itens.length > 0 && <Notice tone="warning">O evento não aceita envio agora. O rascunho continua salvo.</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="text-danger" onClick={() => setExcluir(true)} disabled={solicitacao.status !== "RASCUNHO"}>
          Excluir rascunho
        </Button>
        <Button variant="primary" onClick={() => setEnviar(true)} disabled={itens.length === 0 || !podeEnviar}>
          <Send className="size-4" /> {solicitacao.status === "DEVOLVIDA" ? "Reenviar" : "Enviar para a logística"}
        </Button>
      </div>

      <Dialog open={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
        {editando !== null && (
          <DialogContent title={editando === "novo" ? "Adicionar item" : "Editar item"} description={solicitacao.tipo === "PRE_REUNIAO" ? "Necessidade da área para a reunião de OS." : "Alteração sobre a ata fechada."}>
            <ItemForm solicitacaoId={solicitacao.id} tipo={solicitacao.tipo} item={editando === "novo" ? null : editando} opcoes={opcoes} linhasAta={linhasAta} itensExistentes={itens} onDone={() => setEditando(null)} />
          </DialogContent>
        )}
      </Dialog>

      {remover && (
        <ConfirmDialog open onOpenChange={(o) => !o && setRemover(null)} title="Remover item" description={`${remover.descricao} sairá desta solicitação.`} confirmLabel="Remover" danger action={removerItemAction} hidden={{ solicitacaoId: solicitacao.id, itemId: remover.id }} />
      )}

      {enviar && (
        <ConfirmDialog
          open
          onOpenChange={setEnviar}
          title={`Enviar ${solicitacao.codigo}`}
          description={`${itens.length} item(ns) serão enviados à logística, que responderá cada um separadamente. Depois de enviada, a solicitação só pode ser cancelada enquanto nenhum item tiver resposta.`}
          confirmLabel="Enviar"
          action={enviarSolicitacaoAction}
          hidden={{ solicitacaoId: solicitacao.id, eventoId: solicitacao.eventoId }}
        />
      )}

      {excluir && (
        <ConfirmDialog open onOpenChange={setExcluir} title="Excluir rascunho" description="O rascunho será descartado. Esta ação não pode ser desfeita." confirmLabel="Excluir" danger action={excluirRascunhoAction} hidden={{ solicitacaoId: solicitacao.id }} />
      )}
    </div>
  );
}
