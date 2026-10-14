import { and, eq, inArray, isNull, like, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, historico, pecas } from "@/server/db/schema";
import { CODIGOS_CONFERENCIA_OPCIONAL } from "@/domain/itens-padrao";
import { registrarHistoricos, type Executor } from "../support";

/** Texto com que a criação do evento registrava cada item padrão no histórico (é como achamos essas linhas). */
const PREFIXO_ITEM_PADRAO = "Item padrão da ata:";
const MOTIVO = "Deixou de ser item padrão da ata";

/**
 * Correção de dados (idempotente): os itens padrão da ata acabaram. As linhas que a criação do evento
 * colocou sozinha saem das atas ainda abertas (preparação ou em reunião), mesmo se já conferidas.
 * Atas fechadas, eventos cancelados e OS já geradas ficam como estão. Linha que a logística incluiu à
 * mão (mesma peça) não é tocada: só conta a linha com o registro de inclusão automática.
 * Várias instâncias ao mesmo tempo não duplicam: o update só pega linha ainda ativa.
 */
export async function retirarItensPadraoDasAtasAbertas(): Promise<number> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const automaticas = tx
      .select({ id: historico.entidadeId })
      .from(historico)
      .where(and(eq(historico.entidade, "evento_item"), eq(historico.acao, "ATA_INCLUSAO"), like(historico.descricao, `${PREFIXO_ITEM_PADRAO}%`)));
    const atasAbertas = tx
      .select({ id: eventos.id })
      .from(eventos)
      .where(and(isNull(eventos.ataFechadaEm), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO"])));
    const agora = new Date();
    const retiradas = await tx
      .update(eventoItens)
      .set({ ativo: false, removidoEm: agora, removidoPorId: null, justificativaAjuste: MOTIVO, conferidoEm: null, conferidoPorId: null, atualizadoEm: agora })
      .where(and(eq(eventoItens.ativo, true), inArray(eventoItens.id, automaticas), inArray(eventoItens.eventoId, atasAbertas)))
      .returning({ id: eventoItens.id, eventoId: eventoItens.eventoId, pecaId: eventoItens.pecaId, quantidade: eventoItens.quantidade });
    if (!retiradas.length) return 0;
    const pecaIds = [...new Set(retiradas.map((r) => r.pecaId).filter((id): id is string => Boolean(id)))];
    const nomes = new Map((pecaIds.length ? await tx.select({ id: pecas.id, nome: pecas.nome }).from(pecas).where(inArray(pecas.id, pecaIds)) : []).map((p) => [p.id, p.nome]));
    await registrarHistoricos(
      tx,
      retiradas.map((r) => ({
        eventoId: r.eventoId,
        entidade: "evento_item",
        entidadeId: r.id,
        acao: "ATA_REMOCAO",
        descricao: `${nomes.get(r.pecaId ?? "") ?? "Item"}: removido da ata (era ${r.quantidade || "a definir"}) · ${MOTIVO.toLowerCase()}`,
        usuarioId: null,
        dadosAntes: { quantidade: r.quantidade, ativo: true },
        dadosDepois: { quantidade: r.quantidade, ativo: false, motivo: MOTIVO },
      })),
    );
    return retiradas.length;
  });
}

/**
 * Condição SQL das linhas que precisam estar conferidas para fechar a ata (fora "a definir" e estaiamento,
 * ver `conferenciaOpcional`).
 */
export async function condicaoConferenciaObrigatoria(tx: Executor): Promise<SQL> {
  const opcionais = await tx.select({ id: pecas.id }).from(pecas).where(inArray(pecas.codigo, [...CODIGOS_CONFERENCIA_OPCIONAL]));
  const base = sql`${eventoItens.quantidade} > 0`;
  if (opcionais.length === 0) return base;
  return and(base, or(ne(eventoItens.tipo, "PECA"), isNull(eventoItens.pecaId), notInArray(eventoItens.pecaId, opcionais.map((p) => p.id))))!;
}
