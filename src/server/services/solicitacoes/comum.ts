import { and, eq, sql } from "drizzle-orm";
import { eventos, solicitacaoItens, solicitacoes } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError } from "@/domain/errors";
import { janelaPreReuniaoAberta } from "@/domain/evento";
import { podeEditarSolicitacao } from "@/domain/permissions";
import { podeEnviar, podeResponderNaFase } from "@/domain/solicitacao";
import { formatarDataHora } from "@/lib/format";
import { obterConfiguracoes, type Executor } from "../support";

/* Regras e mensagens compartilhadas pelos módulos de solicitações. */

export const MSG_DESCRICOES = (n: number) => (n === 1 ? "Falta a descrição de 1 item: descreva cada unidade antes de enviar." : `Faltam descrições em ${n} itens: descreva cada unidade antes de enviar.`);

export const MSG_TITULO_OBRIGATORIO = "Dê um título para a logística identificar a solicitação na fila.";

export async function verificarJanelaPreReuniao(ex: Executor, ev: { dataReuniao: Date }) {
  const cfg = await obterConfiguracoes(ex);
  const horas = Number(cfg.antecedencia_reuniao_horas) || 0;
  if (!janelaPreReuniaoAberta(ev.dataReuniao, horas)) {
    throw new DomainError(`Envios de necessidades encerraram ${horas}h antes da reunião de OS (${formatarDataHora(ev.dataReuniao)}).`);
  }
}

/**
 * Rascunho que o usuário pode editar. Evento encerrado ou cancelado não aceita edição (o rascunho
 * fica preservado para consulta); excluir continua permitido.
 */
export async function carregarEditavel(ex: Executor, usuario: UsuarioAtual, id: string, opcoes: { permitirEventoFechado?: boolean; travar?: boolean } = {}) {
  if (opcoes.travar) {
    // Trava só a linha da solicitação (o evento fica livre: o autosave de várias áreas não pode segurar a
    // conferência ao vivo). O envio trava evento e depois esta mesma linha; como aqui só esta é travada,
    // não há ciclo. Quem chega depois espera o outro terminar e relê o status abaixo.
    await ex.execute(sql`select id from solicitacoes where id = ${id} for update`);
  }
  const s = await ex.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, id), eq(solicitacoes.excluida, false)), with: { evento: true, itens: true, area: true } });
  if (!s) throw new NaoEncontradoError("Solicitação");
  if (!podeEditarSolicitacao(usuario, s)) throw new SemPermissaoError("Só usuários da área da solicitação podem editá-la.");
  // Antes do status: o encerramento cancela rascunhos e devolvidas, e o motivo real é o evento fechado.
  if (!opcoes.permitirEventoFechado && (s.evento.status === "ENCERRADO" || s.evento.status === "CANCELADO")) {
    throw new DomainError(`O evento está ${s.evento.status === "CANCELADO" ? "cancelado" : "encerrado"} e não aceita mais alterações neste rascunho.`);
  }
  if (!podeEnviar(s.status)) throw new DomainError("Esta solicitação não está mais em rascunho.");
  return s;
}

export function verificarFaseResposta(s: { tipo: "PRE_REUNIAO" | "ALTERACAO"; evento: { status: (typeof eventos.$inferSelect)["status"] } }) {
  if (podeResponderNaFase(s.tipo, s.evento.status)) return;
  throw new DomainError(s.tipo === "PRE_REUNIAO" ? "Necessidades pré-reunião só podem ser respondidas antes de fechar a ata." : "O evento não está aberto a alterações.");
}

/** Evento de um item, lido antes da trava. */
export async function eventoDoItem(tx: Executor, itemId: string) {
  const [r] = await tx
    .select({ eventoId: solicitacoes.eventoId })
    .from(solicitacaoItens)
    .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
    .where(eq(solicitacaoItens.id, itemId))
    .limit(1);
  if (!r) throw new NaoEncontradoError("Item");
  return r.eventoId;
}
