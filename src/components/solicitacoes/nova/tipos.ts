import type { ItemOperacao } from "@/server/db/schema";

export type EventoOpcao = { id: string; codigo: string; nome: string; cliente: string; periodo: string; marco: string; tipo: "PRE_REUNIAO" | "ALTERACAO"; aceita: boolean };
export type ItemNovo = {
  chave: string;
  operacao: ItemOperacao;
  projetoId: string | null;
  pecaId: string | null;
  eventoItemId: string | null;
  descricaoLivre: string | null;
  quantidade: number;
  quantidadeAtual: number | null;
  destino: string;
  justificativa: string;
  /** Uma descrição por unidade adicionada (10 pedidas, 10 descrições); acima do limite, uma só. */
  descricoes: string[];
  /** Onde cada unidade vai ficar (mesmo tamanho de `descricoes`); ao gravar, unidades no mesmo local viram um item. */
  locais: string[];
  /** Projeto: delta por peça (pecaId → unidades a mais ou a menos). */
  ajustes: Record<string, number>;
  rotulo: string;
  meta: string;
};
export type LinhaBom = { pecaId: string; codigo: string; nome: string; unidade: string; quantidade: number };
/** `extras`: peças fora do padrão que o projeto aceita como ajuste (fechamento e calha de tenda, quantidade 0). */
export type Referencia = { id: string; codigo: string; nome: string; meta: string; descricao?: string | null; bom?: LinhaBom[]; extras?: LinhaBom[]; capaId?: string | null };
export type LinhaAta = { id: string; nome: string; quantidade: number; destino: string | null; areaNome: string | null };
export type Modo = "projeto" | "peca" | "avulso" | "ata";
/** Rascunho já existente (edição) ou `null` numa solicitação nova. */
export type RascunhoSolicitacao = { id: string; codigo: string; titulo: string; observacao: string; eventoId: string; devolvidaMotivo: string | null };
/** Item do resumo "Para enviar, falta:" — cada linha leva ao campo `alvo`. */
export type Pendencia = { alvo: string; texto: string };
