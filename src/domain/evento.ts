import type { EventoStatus, Perfil } from "@/server/db/schema";

/**
 * Máquina de estados do Evento (§6.1 da especificação).
 *
 * Estado atual → Ação → Novo estado → Perfil responsável.
 */
export const ACOES_EVENTO = [
  "INICIAR_REUNIAO",
  "VOLTAR_PREPARACAO",
  "FECHAR_ATA",
  "ENCERRAR",
  "REABRIR",
  "CANCELAR",
] as const;

export type AcaoEvento = (typeof ACOES_EVENTO)[number];

type Transicao = {
  de: readonly EventoStatus[];
  para: EventoStatus;
  perfis: readonly Perfil[];
  exigeJustificativa: boolean;
  label: string;
  descricao: string;
};

export const TRANSICOES_EVENTO: Record<AcaoEvento, Transicao> = {
  INICIAR_REUNIAO: {
    de: ["PREPARACAO"],
    para: "EM_REUNIAO",
    perfis: ["LOGISTICA", "ADMIN"],
    exigeJustificativa: false,
    label: "Iniciar reunião",
    descricao: "Bloqueia novos envios de necessidades e abre a consolidação da ata.",
  },
  VOLTAR_PREPARACAO: {
    de: ["EM_REUNIAO"],
    para: "PREPARACAO",
    perfis: ["LOGISTICA", "ADMIN"],
    exigeJustificativa: true,
    label: "Voltar para preparação",
    descricao: "Reunião adiada: as áreas voltam a poder enviar necessidades.",
  },
  FECHAR_ATA: {
    de: ["EM_REUNIAO"],
    para: "ABERTO",
    perfis: ["LOGISTICA", "ADMIN"],
    exigeJustificativa: false,
    label: "Fechar ata",
    descricao: "Congela a ata, gera a OS v1 e abre o evento para solicitações de alteração.",
  },
  ENCERRAR: {
    de: ["ABERTO"],
    para: "ENCERRADO",
    perfis: ["LOGISTICA", "ADMIN"],
    exigeJustificativa: false,
    label: "Encerrar evento",
    descricao: "Nenhuma solicitação nova entra. A OS final é gerada.",
  },
  REABRIR: {
    de: ["ENCERRADO"],
    para: "ABERTO",
    perfis: ["GESTAO", "ADMIN"],
    exigeJustificativa: true,
    label: "Reabrir em exceção",
    descricao: "Exceção aprovada pela gestão: o evento volta a aceitar alterações.",
  },
  CANCELAR: {
    de: ["PREPARACAO", "EM_REUNIAO", "ABERTO"],
    para: "CANCELADO",
    perfis: ["LOGISTICA", "ADMIN"],
    exigeJustificativa: true,
    label: "Cancelar evento",
    descricao: "Cancela o evento e todas as solicitações em aberto.",
  },
};

export function transicaoPermitida(status: EventoStatus, acao: AcaoEvento): boolean {
  return TRANSICOES_EVENTO[acao].de.includes(status);
}

export function acoesDisponiveis(status: EventoStatus, perfil: Perfil): AcaoEvento[] {
  return ACOES_EVENTO.filter((a) => {
    const t = TRANSICOES_EVENTO[a];
    return t.de.includes(status) && t.perfis.includes(perfil);
  });
}

/**
 * Por que o evento não pode ser encerrado agora, ou `null`. Com a configuração
 * "bloquear encerramento com pendentes" ligada, solicitações sem resposta impedem o encerramento;
 * desligada, o encerramento resolve as pendentes (sem resposta: canceladas; parciais: resto não atendido).
 * Mesma mensagem no botão e no servidor.
 */
export function motivoBloqueioEncerramento(abertas: readonly string[], bloquear: boolean): string | null {
  if (!bloquear || abertas.length === 0) return null;
  if (abertas.length === 1) return `${abertas[0]} está sem resposta. Responda antes de encerrar.`;
  return `Existem ${abertas.length} solicitações sem resposta (${abertas.join(", ")}). Responda todas antes de encerrar.`;
}

/** Em qual estado do evento cada tipo de solicitação pode ser criada/enviada. */
export function aceitaSolicitacao(status: EventoStatus, tipo: "PRE_REUNIAO" | "ALTERACAO"): boolean {
  if (tipo === "PRE_REUNIAO") return status === "PREPARACAO";
  return status === "ABERTO";
}

export function tipoSolicitacaoParaStatus(status: EventoStatus): "PRE_REUNIAO" | "ALTERACAO" | null {
  if (status === "PREPARACAO") return "PRE_REUNIAO";
  if (status === "ABERTO") return "ALTERACAO";
  return null;
}

export const EVENTO_STATUS_LABEL: Record<EventoStatus, string> = {
  PREPARACAO: "Em preparação",
  EM_REUNIAO: "Em reunião",
  ABERTO: "Aberto a alterações",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
};

/** Estado derivado para listagens: um evento encerrado com data final passada foi "realizado". */
export function statusExibicao(status: EventoStatus, dataFim: string, hoje: string): EventoStatus | "REALIZADO" {
  if (status === "ENCERRADO" && dataFim < hoje) return "REALIZADO";
  return status;
}

/** As 4 fases em ordem, para linha do tempo e barras de fase. Cancelado fica fora (-1). */
export const FASES_EVENTO = ["PREPARACAO", "EM_REUNIAO", "ABERTO", "ENCERRADO"] as const;

export function indiceFase(status: EventoStatus): number {
  return (FASES_EVENTO as readonly string[]).indexOf(status);
}

/**
 * Janela de envio de necessidades pré-reunião. Antecedência 0 = aberta até a logística iniciar a reunião;
 * maior que 0 = fecha N horas antes do horário marcado.
 */
export function janelaPreReuniaoAberta(dataReuniao: Date, antecedenciaHoras: number, agora = new Date()): boolean {
  if (!antecedenciaHoras || antecedenciaHoras <= 0) return true;
  return agora.getTime() < dataReuniao.getTime() - antecedenciaHoras * 3_600_000;
}
