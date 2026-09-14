import type { ItemOperacao, ItemStatus, SolicitacaoStatus, SolicitacaoTipo } from "@/server/db/schema";
import { ValidacaoError } from "./errors";

/**
 * Máquina de estados da Solicitação e regras de resposta por item (§6.2 e §6.3).
 */

export const SOLICITACAO_STATUS_LABEL: Record<SolicitacaoStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  EM_ANALISE: "Em análise",
  RESPONDIDA: "Respondida",
  DEVOLVIDA: "Devolvida",
  CANCELADA: "Cancelada",
};

export const SOLICITACAO_TIPO_LABEL: Record<SolicitacaoTipo, string> = {
  PRE_REUNIAO: "Necessidade pré-reunião",
  ALTERACAO: "Alteração pós-ata",
};

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  EM_ANALISE: "Em análise",
  ATENDIDO: "Atendido",
  PARCIAL: "Atendido parcialmente",
  NAO_ATENDIDO: "Não atendido",
};

export const ITEM_OPERACAO_LABEL: Record<ItemOperacao, string> = {
  ADICIONAR: "Adicionar",
  ALTERAR_QUANTIDADE: "Alterar quantidade",
  REMOVER: "Remover",
};

export const STATUS_ABERTOS: SolicitacaoStatus[] = ["ENVIADA", "EM_ANALISE"];
export const STATUS_EDITAVEIS: SolicitacaoStatus[] = ["RASCUNHO", "DEVOLVIDA"];

export function podeEnviar(status: SolicitacaoStatus) {
  return STATUS_EDITAVEIS.includes(status);
}

export function podeCancelar(status: SolicitacaoStatus, algumItemRespondido: boolean) {
  if (status === "RASCUNHO" || status === "DEVOLVIDA") return true;
  return status === "ENVIADA" && !algumItemRespondido;
}

export function podeDevolver(status: SolicitacaoStatus, algumItemRespondido: boolean) {
  return status === "ENVIADA" && !algumItemRespondido;
}

export function podeResponder(status: SolicitacaoStatus) {
  return status === "ENVIADA" || status === "EM_ANALISE";
}

export function podeCorrigirResposta(status: SolicitacaoStatus) {
  return status === "RESPONDIDA";
}

export function estaAtrasada(status: SolicitacaoStatus, prazoRespostaEm: Date | null, agora: Date) {
  return STATUS_ABERTOS.includes(status) && prazoRespostaEm !== null && agora > prazoRespostaEm;
}

/** Status da solicitação derivado dos itens após uma resposta. */
export function statusAposResposta(itens: Array<{ status: ItemStatus }>): SolicitacaoStatus {
  const respondidos = itens.filter((i) => i.status !== "EM_ANALISE").length;
  if (respondidos === 0) return "ENVIADA";
  if (respondidos === itens.length) return "RESPONDIDA";
  return "EM_ANALISE";
}

export type RespostaItem = {
  status: Exclude<ItemStatus, "EM_ANALISE">;
  quantidadeAtendida: number;
  observacaoLogistica: string | null;
  pendenciaCompra: boolean;
};

/**
 * RN-04/RN-07: valida uma resposta de item.
 * - ATENDIDO ⇒ quantidade atendida = solicitada
 * - PARCIAL ⇒ 0 < atendida < solicitada e observação obrigatória
 * - NAO_ATENDIDO ⇒ atendida = 0 e observação obrigatória
 * - REMOVER não admite PARCIAL
 */
export function validarResposta(
  item: { operacao: ItemOperacao; quantidadeSolicitada: number },
  resposta: { status: ItemStatus; quantidadeAtendida?: number | null; observacaoLogistica?: string | null; pendenciaCompra?: boolean },
): RespostaItem {
  const obs = resposta.observacaoLogistica?.trim() || null;
  const status = resposta.status;
  if (status === "EM_ANALISE") throw new ValidacaoError("Escolha uma resposta para o item.");
  if (item.operacao === "REMOVER" && status === "PARCIAL") {
    throw new ValidacaoError("Uma remoção só pode ser atendida ou não atendida.");
  }
  if (status !== "ATENDIDO" && !obs) {
    throw new ValidacaoError("Parcial e não atendido exigem uma observação da logística.", {
      observacaoLogistica: "Obrigatória para parcial ou não atendido.",
    });
  }
  let quantidadeAtendida: number;
  if (status === "ATENDIDO") quantidadeAtendida = item.quantidadeSolicitada;
  else if (status === "NAO_ATENDIDO") quantidadeAtendida = 0;
  else {
    const q = Number(resposta.quantidadeAtendida);
    if (!Number.isInteger(q) || q <= 0 || q >= item.quantidadeSolicitada) {
      throw new ValidacaoError("Quantidade parcial deve ser maior que zero e menor que a solicitada.", {
        quantidadeAtendida: `Informe um valor entre 1 e ${item.quantidadeSolicitada - 1}.`,
      });
    }
    quantidadeAtendida = q;
  }
  return {
    status,
    quantidadeAtendida,
    observacaoLogistica: obs,
    pendenciaCompra: status === "ATENDIDO" ? false : Boolean(resposta.pendenciaCompra),
  };
}

export type ItemRascunho = {
  operacao: ItemOperacao;
  projetoId?: string | null;
  pecaId?: string | null;
  descricaoLivre?: string | null;
  eventoItemId?: string | null;
  quantidadeSolicitada: number;
  destino?: string | null;
};

/** Valida a consistência estrutural de um item de solicitação (exatamente uma referência). */
export function validarItem(item: ItemRascunho) {
  const refs = [item.projetoId, item.pecaId, item.descricaoLivre?.trim()].filter(Boolean).length;
  if (item.operacao === "ADICIONAR") {
    if (refs !== 1) throw new ValidacaoError("Escolha um projeto padrão, uma peça do catálogo ou descreva um item avulso.");
  } else if (!item.eventoItemId) {
    throw new ValidacaoError("Selecione a linha da ata que deseja alterar ou remover.");
  }
  if (item.operacao !== "REMOVER" && (!Number.isInteger(item.quantidadeSolicitada) || item.quantidadeSolicitada <= 0)) {
    throw new ValidacaoError("Quantidade deve ser um inteiro maior que zero.", { quantidadeSolicitada: "Informe um valor maior que zero." });
  }
}
