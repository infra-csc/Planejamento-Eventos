import type { EventoStatus, ItemOperacao, ItemStatus, SolicitacaoStatus, SolicitacaoTipo } from "@/server/db/schema";
import { DomainError, ValidacaoError } from "./errors";

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

/** Em que fase do evento cada tipo de solicitação pode ser respondida, devolvida ou corrigida. */
export function podeResponderNaFase(tipo: SolicitacaoTipo, statusEvento: EventoStatus) {
  return tipo === "PRE_REUNIAO" ? statusEvento === "PREPARACAO" || statusEvento === "EM_REUNIAO" : statusEvento === "ABERTO";
}

/**
 * Necessidade pré-reunião com a ata ainda aberta: entrou na ata sem avaliação e só é validada
 * na reunião. Nessa fase não faz sentido dizer "atendido"/"respondida" para quem pediu.
 */
export function aguardaReuniao(tipo: SolicitacaoTipo, statusEvento: EventoStatus) {
  return tipo === "PRE_REUNIAO" && (statusEvento === "PREPARACAO" || statusEvento === "EM_REUNIAO");
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
  /** ALTERAR_QUANTIDADE: quantidade que a linha tem hoje — o parcial fica entre ela e a pedida. */
  quantidadeAtual?: number | null,
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
    if (item.operacao === "ALTERAR_QUANTIDADE" && quantidadeAtual != null) {
      const lo = Math.min(quantidadeAtual, item.quantidadeSolicitada);
      const hi = Math.max(quantidadeAtual, item.quantidadeSolicitada);
      if (!Number.isInteger(q) || q <= lo || q >= hi) {
        throw new ValidacaoError(`Parcial deve ficar entre a quantidade atual (${quantidadeAtual}) e a pedida (${item.quantidadeSolicitada}).`, {
          quantidadeAtendida: hi - lo > 1 ? `Informe um valor entre ${lo + 1} e ${hi - 1}.` : "Não há valor intermediário: atenda ou não atenda.",
        });
      }
    } else if (!Number.isInteger(q) || q <= 0 || q >= item.quantidadeSolicitada) {
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

/* ------------------------------------------------------------------ */
/* Efeito da resposta na linha da ata                                   */
/* ------------------------------------------------------------------ */

export type EstadoItemResposta = {
  operacao: ItemOperacao;
  status: ItemStatus;
  quantidadeAtendida: number | null;
  /**
   * ALTERAR_QUANTIDADE: quantidade da linha quando o item foi respondido pela primeira vez.
   * REMOVER: preenchido só quando foi esta resposta que tirou a linha da ata.
   */
  quantidadeAnterior: number | null;
};

export type LinhaAtual = { ativo: boolean; quantidade: number };

export type EfeitoLinha =
  | { acao: "nada"; quantidadeAnterior: number | null }
  | { acao: "criar"; quantidade: number; quantidadeAnterior: null }
  | { acao: "atualizar"; ativo: boolean; quantidade: number; quantidadeAnterior: number | null };

/** Quanto a resposta de um item soma hoje na linha (0 quando em análise ou não atendido). */
function contribuicao(item: EstadoItemResposta, anterior: number | null): number {
  if (item.status === "EM_ANALISE" || item.status === "NAO_ATENDIDO") return 0;
  if (item.operacao === "ADICIONAR") return item.quantidadeAtendida ?? 0;
  if (item.operacao === "ALTERAR_QUANTIDADE") return (item.quantidadeAtendida ?? 0) - (anterior ?? 0);
  return 0;
}

/**
 * Efeito de responder, corrigir ou desfazer (novo = EM_ANALISE) um item sobre a linha da ata.
 *
 * Aplica só a diferença entre o que a resposta anterior somava e o que a nova soma, para não apagar
 * mudanças feitas depois por outra solicitação ou por ajuste da logística. E nunca reativa uma linha
 * que outra ação removeu.
 */
export function calcularEfeitoLinha(antes: EstadoItemResposta, novo: { status: ItemStatus; quantidadeAtendida: number | null }, linha: LinhaAtual | null): EfeitoLinha {
  const depois: EstadoItemResposta = { ...antes, status: novo.status, quantidadeAtendida: novo.quantidadeAtendida };

  if (antes.operacao === "ADICIONAR") {
    const prev = contribuicao(antes, null);
    const next = contribuicao(depois, null);
    if (!linha) return next > 0 ? { acao: "criar", quantidade: next, quantidadeAnterior: null } : { acao: "nada", quantidadeAnterior: null };
    if (!linha.ativo && prev > 0) {
      // Desfazer deixaria o item "em análise" apontando para uma linha removida — e a próxima resposta a ressuscitaria.
      if (next === 0 && novo.status !== "EM_ANALISE") return { acao: "nada", quantidadeAnterior: null };
      throw new DomainError("A linha gerada por este item foi removida da ata depois da resposta (por ajuste ou outra solicitação). Inclua a linha de novo pela ata, se precisar.");
    }
    const nova = (linha.ativo ? linha.quantidade : 0) - prev + next;
    if (nova <= 0) return linha.ativo ? { acao: "atualizar", ativo: false, quantidade: linha.quantidade, quantidadeAnterior: null } : { acao: "nada", quantidadeAnterior: null };
    return { acao: "atualizar", ativo: true, quantidade: nova, quantidadeAnterior: null };
  }

  if (!linha) throw new DomainError("A linha da ata referenciada não existe mais.");

  if (antes.operacao === "ALTERAR_QUANTIDADE") {
    const anterior = antes.quantidadeAnterior ?? linha.quantidade;
    const prev = contribuicao(antes, anterior);
    const next = contribuicao(depois, anterior);
    if (!linha.ativo) {
      if (prev === 0 && next === 0) return { acao: "nada", quantidadeAnterior: anterior };
      throw new DomainError("A linha foi removida da ata e a alteração de quantidade não pode mais ser aplicada. Responda como não atendido.");
    }
    const nova = linha.quantidade - prev + next;
    if (nova < 0) throw new DomainError("A linha mudou depois desta resposta e o resultado ficaria negativo. Ajuste a quantidade direto na ata.");
    if (nova === linha.quantidade) return { acao: "nada", quantidadeAnterior: anterior };
    return nova === 0
      ? { acao: "atualizar", ativo: false, quantidade: linha.quantidade, quantidadeAnterior: anterior }
      : { acao: "atualizar", ativo: true, quantidade: nova, quantidadeAnterior: anterior };
  }

  // REMOVER
  const removidaPorEste = antes.status === "ATENDIDO" && antes.quantidadeAnterior != null;
  const querRemover = novo.status === "ATENDIDO";
  if (removidaPorEste && !querRemover) {
    return linha.ativo ? { acao: "nada", quantidadeAnterior: null } : { acao: "atualizar", ativo: true, quantidade: linha.quantidade, quantidadeAnterior: null };
  }
  if (!removidaPorEste && querRemover) {
    return linha.ativo ? { acao: "atualizar", ativo: false, quantidade: linha.quantidade, quantidadeAnterior: linha.quantidade } : { acao: "nada", quantidadeAnterior: null };
  }
  return { acao: "nada", quantidadeAnterior: removidaPorEste ? antes.quantidadeAnterior : null };
}

export type ItemRascunho = {
  operacao: ItemOperacao;
  projetoId?: string | null;
  pecaId?: string | null;
  descricaoLivre?: string | null;
  eventoItemId?: string | null;
  quantidadeSolicitada: number;
  destino?: string | null;
  /** Só para projeto: unidades a mais (ou a menos) por peça da lista padrão. */
  ajustesBom?: Array<{ pecaId: string; quantidade: number }> | null;
};

/** Valida a consistência estrutural de um item de solicitação (exatamente uma referência). */
export function validarItem(item: ItemRascunho) {
  // Item descrito à mão que a logística vinculou ao catálogo guarda o texto original: a referência vale.
  const refs = item.projetoId || item.pecaId ? [item.projetoId, item.pecaId].filter(Boolean).length : item.descricaoLivre?.trim() ? 1 : 0;
  if (item.operacao === "ADICIONAR") {
    if (refs !== 1) throw new ValidacaoError("Escolha um projeto padrão, uma peça do catálogo ou descreva um item avulso.");
  } else if (!item.eventoItemId) {
    throw new ValidacaoError("Selecione a linha da ata que deseja alterar ou remover.");
  }
  if (item.operacao !== "REMOVER" && (!Number.isInteger(item.quantidadeSolicitada) || item.quantidadeSolicitada <= 0)) {
    throw new ValidacaoError("Quantidade deve ser um inteiro maior que zero.", { quantidadeSolicitada: "Informe um valor maior que zero." });
  }
  if (item.quantidadeSolicitada > 1_000_000) {
    throw new ValidacaoError("Quantidade acima do limite.", { quantidadeSolicitada: "Máximo de 1.000.000." });
  }
}
