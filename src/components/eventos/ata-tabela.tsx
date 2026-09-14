"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState, TableWrap } from "@/components/ui/layout";
import { Field, Input } from "@/components/ui/field";
import { alterarQuantidadeLinhaAction, atualizarVersaoLinhaAction } from "@/app/(app)/eventos/actions";
import { LinhaAtaForm, type OpcoesReferencia } from "./linha-ata-form";
import type { EventoStatus } from "@/server/db/schema";

export type LinhaAtaView = {
  id: string;
  tipo: "PROJETO" | "PECA" | "AVULSO";
  descricao: string;
  quantidade: number;
  destino: string | null;
  areaNome: string | null;
  origem: "SOLICITACAO" | "AJUSTE_LOGISTICA";
  versaoDefasada: boolean;
  versao: number | null;
  setor: string | null;
};

const TIPO_LABEL = { PROJETO: "Projeto padrão", PECA: "Peça do catálogo", AVULSO: "Item avulso" } as const;

export function AtaTabela({
  eventoId,
  status,
  linhas,
  podeEditar,
  opcoes,
  areas,
  compacta,
}: {
  eventoId: string;
  status: EventoStatus;
  linhas: LinhaAtaView[];
  podeEditar: boolean;
  opcoes: OpcoesReferencia;
  areas: Array<{ id: string; nome: string }>;
  compacta?: boolean;
}) {
  const [incluir, setIncluir] = useState(false);
  const [alterar, setAlterar] = useState<LinhaAtaView | null>(null);
  const [remover, setRemover] = useState<LinhaAtaView | null>(null);
  const [atualizar, setAtualizar] = useState<LinhaAtaView | null>(null);
  const exigeJustificativa = status === "ABERTO";
  const editavel = podeEditar && (status === "PREPARACAO" || status === "EM_REUNIAO" || status === "ABERTO");

  return (
    <div>
      {editavel && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <p className="text-xs text-ink-muted">
            {exigeJustificativa ? "Ata fechada: ajustes diretos exigem justificativa e geram nova versão da OS." : "Inclua o que foi decidido na reunião. Itens vindos das áreas entram ao serem respondidos."}
          </p>
          <Button size="sm" onClick={() => setIncluir(true)}>
            <Plus className="size-3.5" /> Incluir linha
          </Button>
        </div>
      )}
      {linhas.length === 0 ? (
        <EmptyState title="A ata ainda não tem linhas" description={editavel ? "Responda as necessidades das áreas ou inclua linhas diretamente." : "As linhas aparecem conforme a logística consolida a reunião."} compact />
      ) : (
        <TableWrap>
          <table className="table-base">
            <thead>
              <tr>
                <th>Item</th>
                <th className="hidden sm:table-cell">Tipo</th>
                <th className="num">Qtd.</th>
                {!compacta && <th className="hidden md:table-cell">Destino</th>}
                <th className="hidden md:table-cell">Área</th>
                {!compacta && <th className="hidden lg:table-cell">Origem</th>}
                {editavel && <th className="w-px"></th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="font-medium text-ink">{l.descricao}</span>
                    {l.versaoDefasada && (
                      <Badge tone="warning" className="ml-2">
                        nova versão disponível
                      </Badge>
                    )}
                  </td>
                  <td className="hidden sm:table-cell text-ink-secondary">{TIPO_LABEL[l.tipo]}</td>
                  <td className="num tabular font-medium">{l.quantidade}</td>
                  {!compacta && <td className="hidden md:table-cell">{l.destino ?? <span className="text-ink-faint">—</span>}</td>}
                  <td className="hidden md:table-cell">{l.areaNome ?? <span className="text-ink-faint">logística</span>}</td>
                  {!compacta && <td className="hidden lg:table-cell text-ink-muted">{l.origem === "SOLICITACAO" ? "solicitação" : "logística"}</td>}
                  {editavel && (
                    <td className="whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        {l.versaoDefasada && (
                          <Button size="sm" variant="ghost" onClick={() => setAtualizar(l)}>
                            Atualizar versão
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setAlterar(l)}>
                          Quantidade
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemover(l)}>
                          Remover
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Dialog open={incluir} onOpenChange={setIncluir}>
        {incluir && (
          <DialogContent title="Incluir linha na ata" description={exigeJustificativa ? "Ajuste direto após a ata fechada: informe a justificativa." : "Projeto padrão, peça do catálogo ou item avulso."}>
            <LinhaAtaForm eventoId={eventoId} opcoes={opcoes} areas={areas} exigeJustificativa={exigeJustificativa} onDone={() => setIncluir(false)} />
          </DialogContent>
        )}
      </Dialog>

      {alterar && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAlterar(null)}
          title="Alterar quantidade"
          description={alterar.descricao}
          confirmLabel="Salvar"
          reasonLabel={exigeJustificativa ? "Justificativa" : undefined}
          action={alterarQuantidadeLinhaAction}
          hidden={{ eventoId, linhaId: alterar.id }}
        >
          <Field label="Nova quantidade" htmlFor="quantidade">
            <Input id="quantidade" name="quantidade" type="number" min={1} defaultValue={alterar.quantidade} required autoFocus />
          </Field>
        </ConfirmDialog>
      )}

      {remover && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemover(null)}
          title="Remover linha da ata"
          description={`${remover.descricao} × ${remover.quantidade} será removido. A linha fica no histórico.`}
          confirmLabel="Remover"
          danger
          reasonLabel={exigeJustificativa ? "Justificativa" : undefined}
          action={alterarQuantidadeLinhaAction}
          hidden={{ eventoId, linhaId: remover.id, quantidade: "0" }}
        />
      )}

      {atualizar && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAtualizar(null)}
          title="Atualizar para a versão atual do projeto"
          description={`${atualizar.descricao}: a lista de peças desta linha passará a usar a versão mais recente da biblioteca. ${status === "ABERTO" ? "A OS será recalculada." : ""}`}
          confirmLabel="Atualizar"
          action={atualizarVersaoLinhaAction}
          hidden={{ eventoId, linhaId: atualizar.id }}
        />
      )}
    </div>
  );
}
