"use client";

import type { Dispatch, SetStateAction } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toastSucesso } from "@/components/ui/toast";
import { locaisDosItens } from "@/domain/tendas";
import { QuadroTendas, type ItemTenda } from "../quadro-tendas";
import { kitDe, novaChave } from "./utilidades";
import type { ItemNovo, Referencia } from "./tipos";

/** Linhas da tenda já na solicitação (as que o quadro cria e edita). */
export const itensDaTenda = (itens: readonly ItemNovo[], projetoId: string) => itens.filter((i) => i.operacao === "ADICIONAR" && i.projetoId === projetoId);

/**
 * Projeto de tenda: em vez do "Adicionar" simples, o quadro por local (Local | Tendas | Fechamentos | Calhas).
 * A tenda é um item só na solicitação: se já está na lista, o quadro abre com ela e salvar substitui.
 */
export function DialogoTendas({
  tendaAberta,
  setTendaAberta,
  projetos,
  itens,
  setItens,
}: {
  tendaAberta: string | null;
  setTendaAberta: (id: string | null) => void;
  projetos: Referencia[];
  itens: ItemNovo[];
  setItens: Dispatch<SetStateAction<ItemNovo[]>>;
}) {
  const salvarTendas = (r: Referencia, novos: ItemTenda[]) => {
    setTendaAberta(null);
    const total = novos.reduce((a, x) => a + x.quantidade, 0);
    const nLocais = new Set(novos.map((x) => x.destino.trim().toLocaleLowerCase("pt-BR"))).size;
    const editando = itensDaTenda(itens, r.id).length > 0;
    toastSucesso(`${r.nome} × ${total} ${editando ? "atualizada" : "adicionada"} (${nLocais} ${nLocais === 1 ? "local" : "locais"})`);
    const linhas: ItemNovo[] = novos.map((x) => ({
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
      // O local já diz onde cada tenda vai: sem descrição por unidade.
      descricoes: [],
      semDescricao: true,
      locais: [x.destino],
      ajustes: x.ajustes,
      rotulo: r.nome,
      meta: `${r.codigo} · projeto padrão`,
    }));
    setItens((l) => {
      const antigas = new Set(itensDaTenda(l, r.id).map((i) => i.chave));
      if (antigas.size === 0) return [...l, ...linhas];
      // Substitui no mesmo lugar da lista.
      const pos = l.findIndex((i) => antigas.has(i.chave));
      const resto = l.filter((i) => !antigas.has(i.chave));
      return [...resto.slice(0, pos), ...linhas, ...resto.slice(pos)];
    });
  };
  const tendaAtual = tendaAberta ? (projetos.find((p) => p.id === tendaAberta) ?? null) : null;
  const kitAtual = tendaAtual ? kitDe(tendaAtual) : null;
  const iniciais = (() => {
    if (!tendaAtual || !kitAtual) return undefined;
    const existentes = itensDaTenda(itens, tendaAtual.id);
    if (!existentes.length) return undefined;
    const codigoDe = new Map([...(tendaAtual.bom ?? []), ...(tendaAtual.extras ?? [])].map((b) => [b.pecaId, b.codigo]));
    const porCodigo = (a: Record<string, number>) => Object.fromEntries(Object.entries(a).flatMap(([pecaId, d]) => (codigoDe.has(pecaId) ? [[codigoDe.get(pecaId)!, d]] : [])));
    return locaisDosItens(kitAtual, tendaAtual.bom ?? [], existentes.map((i) => ({ destino: i.destino, quantidade: i.quantidade, ajustes: porCodigo(i.ajustes) })));
  })();

  return (
    <Dialog open={tendaAtual !== null && kitAtual !== null} onOpenChange={(o) => !o && setTendaAberta(null)}>
      {tendaAtual && kitAtual && (
        <DialogContent
          title={`${tendaAtual.nome} por local`}
          description={
            iniciais
              ? "As tendas que já estão nesta solicitação. Mude quantidades, fechamentos e calhas, zere o local que não vai ou acrescente outro."
              : "Os locais e quantidades mais comuns das OS já vêm preenchidos: ajuste tendas e peças de cada local, zere o que não vai e acrescente outros. Tudo fica num item só."
          }
          width={900}
        >
          <QuadroTendas kit={kitAtual} bom={tendaAtual.bom ?? []} extras={tendaAtual.extras ?? []} iniciais={iniciais} onConfirmar={(novos) => salvarTendas(tendaAtual, novos)} onCancelar={() => setTendaAberta(null)} />
        </DialogContent>
      )}
    </Dialog>
  );
}
