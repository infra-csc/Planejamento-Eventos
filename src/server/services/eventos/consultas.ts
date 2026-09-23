import { and, asc, count, desc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, historico, osVersoes, solicitacaoItens, solicitacoes, type EventoStatus } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError } from "@/domain/errors";
import { pode } from "@/domain/permissions";
import { numeroOsAtual } from "../os";
import { buscaSemAcento, type Executor } from "../support";
import { nomeLinha } from "./comum";
import { STATUS_ABERTOS } from "@/domain/solicitacao";

/* ------------------------------------------------------------------ */
/* Consultas                                                            */
/* ------------------------------------------------------------------ */

export type FiltroEventos = { status?: EventoStatus | "TODOS"; busca?: string; deData?: string; ateData?: string };

export async function listarEventos(usuario: UsuarioAtual, filtro: FiltroEventos = {}) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const conds = [];
  if (filtro.status && filtro.status !== "TODOS") conds.push(eq(eventos.status, filtro.status));
  if (filtro.busca) {
    const cond = buscaSemAcento([eventos.nome, eventos.codigo, eventos.cliente, eventos.local], filtro.busca);
    if (cond) conds.push(cond);
  }
  // Datas fora do calendário são ignoradas em vez de derrubar a consulta.
  const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  if (filtro.deData && dataValida(filtro.deData)) conds.push(sql`${eventos.dataFim} >= ${filtro.deData}`);
  if (filtro.ateData && dataValida(filtro.ateData)) conds.push(sql`${eventos.dataInicio} <= ${filtro.ateData}`);

  const [rows, abertas, versoes] = await Promise.all([
    db.query.eventos.findMany({
      where: conds.length ? and(...conds) : undefined,
      with: { responsavel: { columns: { id: true, nome: true } } },
      orderBy: [asc(eventos.dataInicio)],
    }),
    db
      .select({ eventoId: solicitacoes.eventoId, n: count() })
      .from(solicitacoes)
      // Quem não vê todas as áreas conta só o que é da própria área: a fila das outras não é assunto dele.
      .where(and(inArray(solicitacoes.status, STATUS_ABERTOS), eq(solicitacoes.excluida, false), pode(usuario, "solicitacao.ver_todas") ? undefined : eq(solicitacoes.areaId, usuario.areaId ?? "")))
      .groupBy(solicitacoes.eventoId),
    db
      .select({ eventoId: osVersoes.eventoId, v: sql<number>`max(${osVersoes.numero})` })
      .from(osVersoes)
      .groupBy(osVersoes.eventoId),
  ]);
  const mapaAbertas = new Map(abertas.map((a) => [a.eventoId, Number(a.n)]));
  const mapaVersoes = new Map(versoes.map((v) => [v.eventoId, Number(v.v)]));
  return rows.map((r) => ({ ...r, solicitacoesAbertas: mapaAbertas.get(r.id) ?? 0, versaoOs: mapaVersoes.get(r.id) ?? 0 }));
}

export type EventoLista = Awaited<ReturnType<typeof listarEventos>>[number];

/**
 * Eventos que aceitam pedido (preparação ou aberto), mais o do rascunho em edição, para o formulário
 * de nova solicitação. Filtra no banco e traz só as colunas do formulário, sem as contagens da lista.
 */
export async function listarEventosAceitando(usuario: UsuarioAtual, incluirEventoId?: string | null) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const aceitando = inArray(eventos.status, ["PREPARACAO", "ABERTO"]);
  return db
    .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, cliente: eventos.cliente, status: eventos.status, dataInicio: eventos.dataInicio, dataFim: eventos.dataFim, dataReuniao: eventos.dataReuniao, ataFechadaEm: eventos.ataFechadaEm })
    .from(eventos)
    .where(incluirEventoId ? or(aceitando, eq(eventos.id, incluirEventoId)) : aceitando)
    .orderBy(asc(eventos.dataInicio));
}

export async function obterEvento(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const ev = await db.query.eventos.findFirst({
    where: eq(eventos.id, id),
    with: { responsavel: { columns: { id: true, nome: true, email: true } } },
  });
  if (!ev) throw new NaoEncontradoError("Evento");
  return ev;
}

/**
 * Histórico do evento. Quem não tem `historico.ver_tudo` (requisitante, cenografia) vê o que é do evento
 * e da ata, mais o que diz respeito às solicitações da própria área — não motivos e observações de outras áreas.
 */
/** Ações cujo texto carrega o motivo/observação da logística — visíveis só para a própria área. */
export const ACOES_COM_MOTIVO = ["CONFERENCIA_AJUSTE", "ATA_QUANTIDADE", "ATA_REMOCAO", "AJUSTE_INCLUSAO", "PECA_PROJETO_AJUSTADA"];

export async function obterHistoricoEvento(usuario: UsuarioAtual, eventoId: string, limite = 300) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const areaId = usuario.areaId ?? "";
  const escopo = pode(usuario, "historico.ver_tudo")
    ? eq(historico.eventoId, eventoId)
    : and(
        eq(historico.eventoId, eventoId),
        or(
          eq(historico.entidade, "evento"),
          and(eq(historico.entidade, "evento_item"), or(notInArray(historico.acao, ACOES_COM_MOTIVO), sql`${historico.entidadeId} in (select id from evento_itens where area_id = ${areaId})`)),
          and(eq(historico.entidade, "solicitacao"), sql`${historico.entidadeId} in (select id from solicitacoes where area_id = ${areaId})`),
          and(
            eq(historico.entidade, "solicitacao_item"),
            sql`${historico.entidadeId} in (select si.id from solicitacao_itens si join solicitacoes s on s.id = si.solicitacao_id where s.area_id = ${areaId})`,
          ),
        ),
      );
  return db.query.historico.findMany({
    where: escopo,
    with: { usuario: { columns: { id: true, nome: true } } },
    orderBy: [desc(historico.criadoEm)],
    limit: limite,
  });
}

/**
 * Contadores das abas do evento (layout de todas as abas): só contagens, sem carregar a ata,
 * as solicitações com itens nem o JSON das OS. Respeita a área de quem não vê todas as solicitações.
 */
export async function resumoAbasEvento(usuario: UsuarioAtual, eventoId: string) {
  const db = await getDb();
  // Quem vê todas não conta rascunho de outra área (ainda não foi enviado); o admin vê tudo.
  const escopoArea = pode(usuario, "solicitacao.ver_todas") ? (usuario.perfil === "ADMIN" ? undefined : ne(solicitacoes.status, "RASCUNHO")) : eq(solicitacoes.areaId, usuario.areaId ?? "");
  const [[linhas], sols, versaoOs] = await Promise.all([
    db
      .select({ n: count() })
      .from(eventoItens)
      .where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true))),
    db
      .select({ tipo: solicitacoes.tipo, status: solicitacoes.status, n: count() })
      .from(solicitacoes)
      .where(and(eq(solicitacoes.eventoId, eventoId), eq(solicitacoes.excluida, false), escopoArea))
      .groupBy(solicitacoes.tipo, solicitacoes.status),
    numeroOsAtual(db, eventoId),
  ]);
  const soma = (xs: typeof sols) => xs.reduce((a, s) => a + Number(s.n), 0);
  return {
    linhas: Number(linhas?.n ?? 0),
    solicitacoes: soma(sols),
    preEnviadas: soma(sols.filter((s) => s.tipo === "PRE_REUNIAO" && s.status !== "RASCUNHO" && s.status !== "CANCELADA")),
    versaoOs,
  };
}

/**
 * Linhas ativas (id, nome, quantidade, destino, área) de vários eventos numa consulta só. Só as colunas
 * usadas: sem a lista de peças gravada na linha nem os cadastros inteiros de projeto, peça e área.
 */
export async function linhasAtaResumidas(eventoIds: string[]) {
  const mapa = new Map<string, Array<{ id: string; nome: string; quantidade: number; destino: string | null; areaNome: string | null; areaId: string | null }>>(eventoIds.map((id) => [id, []]));
  if (eventoIds.length === 0) return Object.fromEntries(mapa);
  const db = await getDb();
  const rows = await db.query.eventoItens.findMany({
    where: and(inArray(eventoItens.eventoId, eventoIds), eq(eventoItens.ativo, true)),
    columns: { id: true, eventoId: true, tipo: true, quantidade: true, destino: true, areaId: true, descricaoLivre: true },
    with: { projeto: { columns: { nome: true } }, peca: { columns: { codigo: true, nome: true } }, area: { columns: { nome: true } } },
    orderBy: (t, { asc }) => [asc(t.criadoEm)],
  });
  for (const r of rows) {
    // Mesmo recorte de `paraLinhaAta` (os.ts): projeto só em linha de projeto, peça só em linha de peça.
    const nome = nomeLinha({ tipo: r.tipo, projeto: r.tipo === "PROJETO" ? r.projeto : null, peca: r.tipo === "PECA" ? r.peca : null, descricaoLivre: r.descricaoLivre });
    mapa.get(r.eventoId)?.push({ id: r.id, nome, quantidade: r.quantidade, destino: r.destino, areaNome: r.area?.nome ?? null, areaId: r.areaId });
  }
  return Object.fromEntries(mapa);
}

/** Itens de necessidades pré-reunião ainda sem resposta (bloqueiam o fechamento da ata). */
export async function contarItensPendentesPreReuniao(eventoId: string) {
  const db = await getDb();
  const [r] = await db
    .select({ n: count() })
    .from(solicitacaoItens)
    .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
    .where(
      and(
        eq(solicitacoes.eventoId, eventoId),
        eq(solicitacoes.tipo, "PRE_REUNIAO"),
        inArray(solicitacoes.status, STATUS_ABERTOS),
        eq(solicitacaoItens.status, "EM_ANALISE"),
      ),
    );
  return Number(r.n);
}

export async function solicitacoesPendentes(ex: Executor, eventoId: string) {
  return ex.query.solicitacoes.findMany({
    where: and(eq(solicitacoes.eventoId, eventoId), inArray(solicitacoes.status, STATUS_ABERTOS), eq(solicitacoes.excluida, false)),
    columns: { id: true, codigo: true, tipo: true, status: true, titulo: true, areaId: true },
  });
}
