import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, pecas, projetoVersoes, solicitacaoItens, solicitacoes } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { consolidar, type EventoConsolidacao } from "@/domain/consolidacao";
import { calcularOsAtual } from "./os";

/**
 * Demanda × estoque no período (handoff §5.13). Sem checagem de permissão:
 * usada pelo painel e pela tela de consolidação (que checa antes).
 */
export async function calcularConsolidacao(periodo: { inicio: string; fim: string }) {
  const db = await getDb();
  const evs = await db.query.eventos.findMany({
    where: and(
      inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO", "ENCERRADO"]),
      sql`${eventos.dataDesmontagem} >= ${periodo.inicio}`,
      sql`${eventos.dataMontagem} <= ${periodo.fim}`,
    ),
    columns: { id: true, codigo: true, nome: true, dataMontagem: true, dataDesmontagem: true, status: true, ataFechadaEm: true },
    orderBy: [asc(eventos.dataMontagem)],
  });

  // Demanda projetada: itens ainda em análise de eventos cuja ata não foi fechada.
  const semAta = evs.filter((e) => !e.ataFechadaEm).map((e) => e.id);
  const pendentes = semAta.length
    ? await db
        .select({
          eventoId: solicitacoes.eventoId,
          projetoVersaoId: solicitacaoItens.projetoVersaoId,
          pecaId: solicitacaoItens.pecaId,
          quantidade: solicitacaoItens.quantidadeSolicitada,
        })
        .from(solicitacaoItens)
        .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
        .where(
          and(
            inArray(solicitacoes.eventoId, semAta),
            inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]),
            eq(solicitacoes.excluida, false),
            eq(solicitacaoItens.status, "EM_ANALISE"),
            eq(solicitacaoItens.operacao, "ADICIONAR"),
          ),
        )
    : [];
  const versaoIds = [...new Set(pendentes.map((p) => p.projetoVersaoId).filter((v): v is string => Boolean(v)))];
  const boms = versaoIds.length
    ? await db.query.projetoVersoes.findMany({ where: inArray(projetoVersoes.id, versaoIds), with: { itens: { columns: { pecaId: true, quantidade: true } } } })
    : [];
  const bomPorVersao = new Map(boms.map((b) => [b.id, b.itens]));

  const lista: EventoConsolidacao[] = [];
  for (const ev of evs) {
    const projetado: Record<string, number> = {};
    for (const p of pendentes) {
      if (p.eventoId !== ev.id) continue;
      if (p.projetoVersaoId) {
        for (const b of bomPorVersao.get(p.projetoVersaoId) ?? []) projetado[b.pecaId] = (projetado[b.pecaId] ?? 0) + b.quantidade * p.quantidade;
      } else if (p.pecaId) {
        projetado[p.pecaId] = (projetado[p.pecaId] ?? 0) + p.quantidade;
      }
    }
    lista.push({ id: ev.id, codigo: ev.codigo, nome: ev.nome, dataMontagem: ev.dataMontagem, dataDesmontagem: ev.dataDesmontagem, os: await calcularOsAtual(db, ev.id), projetado });
  }
  const todasPecas = await db.query.pecas.findMany({ where: eq(pecas.ativo, true) });
  return { eventos: evs, pecas: consolidar(lista, todasPecas, periodo), totalPecasCatalogo: todasPecas.length };
}

export async function consolidarPeriodo(usuario: UsuarioAtual, periodo: { inicio: string; fim: string }) {
  exigir(usuario, "consolidacao.ver");
  return calcularConsolidacao(periodo);
}
