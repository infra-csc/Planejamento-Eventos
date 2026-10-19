import { and, eq, ilike, inArray, like, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventos, historico, notificacoes, solicitacoes } from "@/server/db/schema";

/**
 * Tira da produção os eventos de teste (Yan, 19/10: "tirar tudo de teste em produção"): a cópia
 * "TESTE · NIGHT RUN BH" e os dois testes cancelados do início ("TESTE", "teste 2"). Apaga de vez o
 * evento — solicitações, itens, linhas da ata e versões vão junto (cascade) — e também o histórico e as
 * notificações que apontam para eles.
 *
 * Só os códigos combinados, e só se o nome ainda tiver "teste" (um código reaproveitado não é apagado).
 * Uma vez só: a marca em `configuracoes` entra na mesma transação e guarda o que foi apagado.
 */
export const LIMPEZA_TESTES = { chave: "limpeza:eventos-teste:2026-10-19", codigos: ["EVT-0206", "EVT-0207", "EVT-0261"] } as const;

export type ResultadoLimpeza = { feito: false } | { feito: true; eventos: string[]; solicitacoes: string[] };

export async function apagarEventosDeTeste(lote: { chave: string; codigos: readonly string[] } = LIMPEZA_TESTES): Promise<ResultadoLimpeza> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [marca] = await tx
      .insert(configuracoes)
      .values({ chave: lote.chave, valor: JSON.stringify({ status: "em andamento" }) })
      .onConflictDoNothing({ target: configuracoes.chave })
      .returning({ chave: configuracoes.chave });
    if (!marca) return { feito: false };

    const alvos = await tx
      .select({ id: eventos.id, codigo: eventos.codigo })
      .from(eventos)
      .where(and(inArray(eventos.codigo, [...lote.codigos]), ilike(eventos.nome, "%teste%")));
    const ids = alvos.map((e) => e.id);
    const sols = ids.length ? await tx.select({ id: solicitacoes.id, codigo: solicitacoes.codigo }).from(solicitacoes).where(inArray(solicitacoes.eventoId, ids)) : [];

    if (ids.length) {
      // Notificações que levam ao evento, à conferência ou a uma solicitação dele (o link ficaria quebrado).
      const links = [...ids.flatMap((id) => [like(notificacoes.link, `/eventos/${id}%`), like(notificacoes.link, `/conferencia/${id}%`)]), ...sols.map((s) => like(notificacoes.link, `/solicitacoes/${s.id}%`))];
      await tx.delete(notificacoes).where(or(...links));
      // Histórico do evento e das solicitações dele (com o evento apagado, o eventoId viraria nulo e sobraria solto).
      await tx.delete(historico).where(or(inArray(historico.eventoId, ids), ...(sols.length ? [inArray(historico.entidadeId, sols.map((s) => s.id))] : [])));
      await tx.delete(eventos).where(inArray(eventos.id, ids));
    }

    const resultado = { eventos: alvos.map((e) => e.codigo).sort(), solicitacoes: sols.map((s) => s.codigo).sort() };
    await tx
      .update(configuracoes)
      .set({ valor: JSON.stringify({ status: "feito", em: new Date().toISOString(), ...resultado }) })
      .where(eq(configuracoes.chave, lote.chave));
    return { feito: true, ...resultado };
  });
}
