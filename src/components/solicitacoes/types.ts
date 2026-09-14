import type { ItemOperacao, ItemStatus } from "@/server/db/schema";

export type ItemView = {
  id: string;
  descricao: string;
  operacao: ItemOperacao;
  referenciaTipo: "PROJETO" | "PECA" | "AVULSO";
  projetoId: string | null;
  pecaId: string | null;
  descricaoLivre: string | null;
  eventoItemId: string | null;
  quantidadeSolicitada: number;
  quantidadeAtual: number | null;
  destino: string | null;
  justificativa: string | null;
  status: ItemStatus;
  quantidadeAtendida: number | null;
  observacaoLogistica: string | null;
  pendenciaCompra: boolean;
  respondidoPor: string | null;
  respondidoEm: Date | null;
};

export type LinhaAtaOpcao = { id: string; descricao: string; quantidade: number; destino: string | null };
