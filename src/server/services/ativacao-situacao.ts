import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { estoqueAnexos, estoqueItens, estoqueReformas, estoqueRetornos, eventoItens, eventos, type BomSnapshotLinha } from "@/server/db/schema";
import { INICIO_RETORNOS, STATUS_COM_OS } from "@/domain/estoque";
import { diaBrasilia, type Executor } from "./support";

/*
 * Situação do estoque da Ativação (saída pela OS, em evento, reservado, em reforma, capa). Separado do resto do
 * módulo para não levar a biblioteca de imagens (sharp) a quem só precisa dos números: o estoque é importado na
 * subida do servidor (instrumentation), e o sharp ali quebra a compilação.
 */

type EventoComOs = { id: string; codigo: string; nome: string; dataMontagem: string; dataDesmontagem: string; status: string };
export type SaidaItem = { itemId: string; nome: string; levou: number };

/**
 * O que cada evento com OS leva de cada item do estoque ligado a uma peça (peça solta ou dentro de projeto), só
 * dos eventos que desmontam a partir de `INICIO_RETORNOS`. Item ligado à mesma peça que outro: o primeiro pelo nome.
 */
export async function saidasPelaOs(ex: Executor, filtro: { eventoId?: string; itemId?: string; status?: readonly string[] } = {}) {
  const ligados = await ex
    .select({ id: estoqueItens.id, nome: estoqueItens.nome, pecaId: estoqueItens.pecaId })
    .from(estoqueItens)
    .where(and(eq(estoqueItens.ativo, true), sql`${estoqueItens.pecaId} is not null`, ...(filtro.itemId ? [eq(estoqueItens.id, filtro.itemId)] : [])))
    .orderBy(asc(estoqueItens.nome));
  const itemDaPeca = new Map<string, { id: string; nome: string }>();
  for (const l of ligados) if (l.pecaId && !itemDaPeca.has(l.pecaId)) itemDaPeca.set(l.pecaId, { id: l.id, nome: l.nome });
  if (!itemDaPeca.size) return [] as Array<{ evento: EventoComOs; itens: SaidaItem[] }>;

  const evs: EventoComOs[] = await ex
    .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, dataMontagem: eventos.dataMontagem, dataDesmontagem: eventos.dataDesmontagem, status: eventos.status })
    .from(eventos)
    .where(and(inArray(eventos.status, [...(filtro.status ?? STATUS_COM_OS)] as Array<(typeof STATUS_COM_OS)[number]>), gte(eventos.dataDesmontagem, INICIO_RETORNOS), ...(filtro.eventoId ? [eq(eventos.id, filtro.eventoId)] : [])));
  if (!evs.length) return [];
  const linhas = await ex
    .select({ eventoId: eventoItens.eventoId, tipo: eventoItens.tipo, pecaId: eventoItens.pecaId, quantidade: eventoItens.quantidade, bom: eventoItens.bomSnapshot })
    .from(eventoItens)
    .where(and(eq(eventoItens.ativo, true), inArray(eventoItens.eventoId, evs.map((e) => e.id))));
  const porEvento = new Map<string, Map<string, SaidaItem>>();
  const somar = (eventoId: string, pecaId: string | null, q: number) => {
    const item = pecaId ? itemDaPeca.get(pecaId) : undefined;
    if (!item || q <= 0) return;
    const m = porEvento.get(eventoId) ?? new Map<string, SaidaItem>();
    const s = m.get(item.id) ?? { itemId: item.id, nome: item.nome, levou: 0 };
    s.levou += q;
    m.set(item.id, s);
    porEvento.set(eventoId, m);
  };
  for (const l of linhas) {
    if (l.tipo === "PECA") somar(l.eventoId, l.pecaId, l.quantidade);
    if (l.tipo === "PROJETO") for (const b of (l.bom as BomSnapshotLinha[] | null) ?? []) somar(l.eventoId, b.pecaId, b.quantidade * l.quantidade);
  }
  return evs
    .filter((e) => porEvento.has(e.id))
    .map((e) => ({ evento: e, itens: [...porEvento.get(e.id)!.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) }))
    .sort((a, b) => a.evento.dataMontagem.localeCompare(b.evento.dataMontagem) || a.evento.codigo.localeCompare(b.evento.codigo));
}

/** Em que pé está o item num evento: pedido (ata ainda aberta), na OS (vai sair na montagem) ou fora (saiu e não voltou). */
export type SituacaoNoEvento = "pedido" | "na OS" | "fora";
export type EventoDoItem = { eventoId: string; codigo: string; nome: string; quantidade: number; situacao: SituacaoNoEvento; dataMontagem: string };

/**
 * Por item do estoque ligado a uma peça: os eventos que o levam e ainda não devolveram (para a lista mostrar onde ele
 * está pedido ou em uso). Pedido de evento que já desmontou sem a ata fechar não entra (evento parado).
 */
export async function eventosDosItens(ex?: Executor): Promise<Map<string, EventoDoItem[]>> {
  const db = ex ?? (await getDb());
  const hoje = diaBrasilia();
  const [saidas, retornos] = await Promise.all([
    saidasPelaOs(db, { status: ["PREPARACAO", "EM_REUNIAO", ...STATUS_COM_OS] }),
    db.select({ itemId: estoqueRetornos.itemId, eventoId: estoqueRetornos.eventoId }).from(estoqueRetornos),
  ]);
  const voltou = new Set(retornos.map((r) => `${r.itemId}|${r.eventoId}`));
  const out = new Map<string, EventoDoItem[]>();
  for (const s of saidas) {
    const ataAberta = s.evento.status === "PREPARACAO" || s.evento.status === "EM_REUNIAO";
    if (ataAberta && s.evento.dataDesmontagem < hoje) continue;
    for (const i of s.itens) {
      if (voltou.has(`${i.itemId}|${s.evento.id}`)) continue;
      const situacao: SituacaoNoEvento = ataAberta ? "pedido" : s.evento.dataMontagem > hoje ? "na OS" : "fora";
      out.set(i.itemId, [...(out.get(i.itemId) ?? []), { eventoId: s.evento.id, codigo: s.evento.codigo, nome: s.evento.nome, quantidade: i.levou, situacao, dataMontagem: s.evento.dataMontagem }]);
    }
  }
  return out;
}

/** Por item: quanto está fora agora (saiu na montagem e não voltou) e quanto está em reforma. */
export async function situacaoDoEstoque(ex?: Executor) {
  const db = ex ?? (await getDb());
  const hoje = diaBrasilia();
  const [saidas, retornos, reformas] = await Promise.all([
    saidasPelaOs(db),
    db.select({ itemId: estoqueRetornos.itemId, eventoId: estoqueRetornos.eventoId }).from(estoqueRetornos),
    db
      .select({ itemId: estoqueReformas.itemId, n: sql<number>`sum(${estoqueReformas.quantidade})::int` })
      .from(estoqueReformas)
      .where(eq(estoqueReformas.status, "ABERTA"))
      .groupBy(estoqueReformas.itemId),
  ]);
  const voltou = new Set(retornos.map((r) => `${r.itemId}|${r.eventoId}`));
  const emEvento = new Map<string, number>();
  const reservado = new Map<string, number>();
  for (const s of saidas)
    for (const i of s.itens) {
      if (voltou.has(`${i.itemId}|${s.evento.id}`)) continue;
      const alvo = s.evento.dataMontagem <= hoje ? emEvento : reservado;
      alvo.set(i.itemId, (alvo.get(i.itemId) ?? 0) + i.levou);
    }
  return { emEvento, reservado, emReforma: new Map(reformas.map((r) => [r.itemId, Number(r.n)])) };
}


/** Primeira foto de cada item (capa da lista), sem ler os arquivos. */
export async function capasDosItens(itemIds: string[]) {
  if (!itemIds.length) return new Map<string, string>();
  const db = await getDb();
  const rows = await db
    .select({ itemId: estoqueAnexos.itemId, id: estoqueAnexos.id })
    .from(estoqueAnexos)
    .where(and(inArray(estoqueAnexos.itemId, itemIds), eq(estoqueAnexos.tipo, "IMAGEM"), sql`${estoqueAnexos.reformaId} is null`))
    .orderBy(asc(estoqueAnexos.criadoEm));
  const m = new Map<string, string>();
  for (const r of rows) if (!m.has(r.itemId)) m.set(r.itemId, r.id);
  return m;
}
