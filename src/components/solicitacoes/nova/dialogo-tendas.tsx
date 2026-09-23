"use client";

import type { Dispatch, SetStateAction } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toastSucesso } from "@/components/ui/toast";
import { QuadroTendas, type ItemTenda } from "../quadro-tendas";
import { extraDoKit, kitDe, novaChave } from "./utilidades";
import type { ItemNovo, Referencia } from "./tipos";

/** Projeto de tenda: em vez do "Adicionar" simples, o quadro por local (Local | Tendas | Fechamentos | Calhas). */
export function DialogoTendas({
  tendaAberta,
  setTendaAberta,
  projetos,
  setItens,
}: {
  tendaAberta: string | null;
  setTendaAberta: (id: string | null) => void;
  projetos: Referencia[];
  setItens: Dispatch<SetStateAction<ItemNovo[]>>;
}) {
  const adicionarTendas = (r: Referencia, novos: ItemTenda[]) => {
    setTendaAberta(null);
    const total = novos.reduce((a, x) => a + x.quantidade, 0);
    const nLocais = new Set(novos.map((x) => x.destino)).size;
    toastSucesso(`${r.nome} × ${total} adicionado (${nLocais} ${nLocais === 1 ? "local" : "locais"})`);
    setItens((l) => [
      ...l,
      ...novos.map((x) => ({
        chave: novaChave(),
        operacao: "ADICIONAR" as const,
        projetoId: r.id,
        pecaId: null,
        eventoItemId: null,
        descricaoLivre: null,
        quantidade: x.quantidade,
        quantidadeAtual: null,
        destino: x.destino,
        justificativa: "",
        descricoes: x.descricoes,
        ajustes: x.ajustes,
        rotulo: r.nome,
        meta: `${r.codigo} · projeto padrão`,
      })),
    ]);
  };
  const tendaAtual = tendaAberta ? (projetos.find((p) => p.id === tendaAberta) ?? null) : null;
  const kitAtual = tendaAtual ? kitDe(tendaAtual) : null;

  return (
    <Dialog open={tendaAtual !== null && kitAtual !== null} onOpenChange={(o) => !o && setTendaAberta(null)}>
      {tendaAtual && kitAtual && (
        <DialogContent title={`${tendaAtual.nome} por local`} description={`Quantas tendas ${kitAtual.tamanho} em cada local e os fechamentos e calhas do local. Cada local vira um item.`} size="lg">
          <QuadroTendas
            kit={kitAtual}
            bom={tendaAtual.bom ?? []}
            pecaFechamentoId={extraDoKit(tendaAtual, "fechamento")}
            pecaCalhaId={extraDoKit(tendaAtual, "calha")}
            onConfirmar={(novos) => adicionarTendas(tendaAtual, novos)}
            onCancelar={() => setTendaAberta(null)}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
