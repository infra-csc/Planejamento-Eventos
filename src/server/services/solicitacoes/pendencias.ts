import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventos, historico, solicitacaoItens, solicitacoes, usuarios } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { bloquearEvento, notificar, registrarHistorico, usuariosDaArea } from "../support";
import { eventoDoItem } from "./comum";
import { descricaoItem } from "./consultas";

/* ------------------------------------------------------------------ */
/* Pendências de compra/locação (RV-11)                                 */
/* ------------------------------------------------------------------ */

/**
 * Itens com pendência de compra/locação em aberto (resposta parcial ou não atendida marcada pela
 * logística), de eventos não cancelados. `eventoId` filtra no banco.
 */
export async function listarPendenciasCompra(usuario: UsuarioAtual, filtro: { eventoId?: string | null } = {}) {
  exigir(usuario, "pendencias.ver");
  const db = await getDb();
  const rows = await db.query.solicitacaoItens.findMany({
    // Solicitação excluída e evento cancelado saem já no banco (antes: filtro em memória).
    where: and(
      eq(solicitacaoItens.pendenciaCompra, true),
      filtro.eventoId
        ? sql`${solicitacaoItens.solicitacaoId} in (select s.id from solicitacoes s join eventos e on e.id = s.evento_id where not s.excluida and e.status <> 'CANCELADO' and e.id = ${filtro.eventoId})`
        : sql`${solicitacaoItens.solicitacaoId} in (select s.id from solicitacoes s join eventos e on e.id = s.evento_id where not s.excluida and e.status <> 'CANCELADO')`,
    ),
    with: {
      solicitacao: { with: { evento: { columns: { id: true, codigo: true, nome: true, status: true, dataMontagem: true } }, area: true } },
      projeto: true,
      peca: true,
      eventoItem: { with: { projeto: true, peca: true } },
      respondidoPor: { columns: { id: true, nome: true } },
    },
    orderBy: [desc(solicitacaoItens.respondidoEm)],
  });
  return rows.map((r) => ({ ...r, descricao: descricaoItem(r), faltante: r.quantidadeSolicitada - (r.quantidadeAtendida ?? 0) }));
}

export type PendenciaCompra = Awaited<ReturnType<typeof listarPendenciasCompra>>[number];

/** Pendências já resolvidas (registro no histórico), mais recentes primeiro. */
export async function listarPendenciasResolvidas(usuario: UsuarioAtual, filtro: { eventoId?: string | null; limite?: number } = {}) {
  exigir(usuario, "pendencias.ver");
  const db = await getDb();
  const rows = await db
    .select({
      id: historico.id,
      itemId: historico.entidadeId,
      criadoEm: historico.criadoEm,
      dados: historico.dadosDepois,
      por: usuarios.nome,
      solicitacaoId: solicitacoes.id,
      codigo: solicitacoes.codigo,
      eventoId: eventos.id,
      eventoCodigo: eventos.codigo,
      eventoNome: eventos.nome,
      area: areas.nome,
    })
    .from(historico)
    .innerJoin(solicitacaoItens, eq(solicitacaoItens.id, historico.entidadeId))
    .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
    .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
    .innerJoin(areas, eq(solicitacoes.areaId, areas.id))
    .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
    .where(and(eq(historico.entidade, "solicitacao_item"), eq(historico.acao, "PENDENCIA_RESOLVIDA"), filtro.eventoId ? eq(eventos.id, filtro.eventoId) : undefined))
    .orderBy(desc(historico.criadoEm))
    .limit(filtro.limite ?? 500);
  return rows.map((r) => {
    const d = (r.dados ?? {}) as { descricao?: string; faltante?: number; resolucao?: string };
    return { ...r, descricao: d.descricao ?? "Item", faltante: d.faltante ?? null, resolucao: d.resolucao ?? "" };
  });
}

/**
 * "Marcar como resolvida": a compra/locação foi providenciada. Sem coluna própria: a pendência sai
 * (`pendenciaCompra = false`), a observação da logística ganha "Compra resolvida: …" e o registro
 * fica no histórico do item (que alimenta a aba "Resolvidas"). A área que pediu é avisada.
 */
export async function resolverPendenciaCompra(usuario: UsuarioAtual, itemId: string, observacao: string) {
  exigir(usuario, "pendencias.resolver");
  const obs = observacao?.trim() ?? "";
  if (!obs) throw new ValidacaoError("Conte como a compra ou locação foi resolvida.", { justificativa: "Obrigatória: fica no histórico do item." });
  if (obs.length > 500) throw new ValidacaoError("A observação deve ter no máximo 500 caracteres.", { justificativa: "Máximo de 500 caracteres." });
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Mesma trava das respostas: uma correção ao mesmo tempo não desfaz a resolução (nem o contrário).
    await bloquearEvento(tx, await eventoDoItem(tx, itemId));
    const item = await tx.query.solicitacaoItens.findFirst({
      where: eq(solicitacaoItens.id, itemId),
      with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } }, solicitacao: { columns: { id: true, codigo: true, eventoId: true, areaId: true, criadoPorId: true, excluida: true } } },
    });
    if (!item || item.solicitacao.excluida) throw new NaoEncontradoError("Item");
    if (!item.pendenciaCompra) throw new DomainError("Esta pendência já foi resolvida (ou a resposta do item mudou). Atualize a lista.");
    const desc = descricaoItem(item);
    const faltante = item.quantidadeSolicitada - (item.quantidadeAtendida ?? 0);
    const observacaoLogistica = [item.observacaoLogistica, `Compra resolvida: ${obs}`].filter(Boolean).join(" · ");
    await tx.update(solicitacaoItens).set({ pendenciaCompra: false, observacaoLogistica }).where(eq(solicitacaoItens.id, itemId));
    await registrarHistorico(tx, {
      eventoId: item.solicitacao.eventoId,
      entidade: "solicitacao_item",
      entidadeId: itemId,
      acao: "PENDENCIA_RESOLVIDA",
      descricao: `${item.solicitacao.codigo} · ${desc}: pendência de compra resolvida — ${obs}`,
      usuarioId: usuario.id,
      dadosAntes: { pendenciaCompra: true, observacaoLogistica: item.observacaoLogistica },
      dadosDepois: { pendenciaCompra: false, observacaoLogistica, resolucao: obs, descricao: desc, faltante },
    });
    await notificar(tx, {
      usuarioIds: [item.solicitacao.criadoPorId, ...(await usuariosDaArea(tx, item.solicitacao.areaId))],
      tipo: "PENDENCIA_RESOLVIDA",
      titulo: `${item.solicitacao.codigo}: compra resolvida`,
      mensagem: `${desc} — ${obs}`,
      link: `/solicitacoes/${item.solicitacao.id}`,
      excetoUsuarioId: usuario.id,
    });
    return { codigo: item.solicitacao.codigo, descricao: desc, solicitacaoId: item.solicitacao.id };
  });
}
