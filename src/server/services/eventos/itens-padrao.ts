import { and, eq, inArray, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { eventoItens, pecas } from "@/server/db/schema";
import { CODIGOS_CONFERENCIA_OPCIONAL, ITENS_PADRAO_ATA } from "@/domain/itens-padrao";
import { registrarHistorico, type Executor } from "../support";

/**
 * Coloca na ata do evento os itens padrão (ex.: 2 garfos de içamento), para conferir na reunião.
 * Não repete: se o evento já tem (ou já teve e tiraram) linha da peça, fica como está.
 * Peça fora do catálogo ou inativa é ignorada.
 */
export async function incluirItensPadraoAta(tx: Executor, eventoId: string, usuarioId: string | null) {
  const codigos = ITENS_PADRAO_ATA.map((i) => i.codigoPeca);
  if (!codigos.length) return [];
  const ps = await tx.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome }).from(pecas).where(and(inArray(pecas.codigo, codigos), eq(pecas.ativo, true)));
  if (!ps.length) return [];
  const jaTem = new Set(
    (await tx.select({ pecaId: eventoItens.pecaId }).from(eventoItens).where(and(eq(eventoItens.eventoId, eventoId), inArray(eventoItens.pecaId, ps.map((p) => p.id))))).map((r) => r.pecaId),
  );
  const incluidas = [];
  for (const item of ITENS_PADRAO_ATA) {
    const p = ps.find((x) => x.codigo === item.codigoPeca);
    if (!p || jaTem.has(p.id)) continue;
    const [linha] = await tx
      .insert(eventoItens)
      .values({ eventoId, tipo: "PECA", pecaId: p.id, quantidade: item.quantidade, origem: "AJUSTE_LOGISTICA", criadoPorId: usuarioId })
      .returning();
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linha.id,
      acao: "ATA_INCLUSAO",
      descricao: `Item padrão da ata: ${p.nome} × ${item.quantidade || "a definir (projetista)"}`,
      usuarioId,
      dadosDepois: { pecaId: p.id, quantidade: item.quantidade },
    });
    incluidas.push(linha);
  }
  return incluidas;
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
