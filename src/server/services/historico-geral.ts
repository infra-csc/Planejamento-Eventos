import { and, count, countDistinct, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, historico, solicitacaoItens, usuarios, type Perfil } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { CATEGORIAS, CATEGORIAS_HISTORICO, PERIODOS_HISTORICO, categoriaDe, type CategoriaHistorico, type PeriodoHistorico } from "@/domain/historico-geral";
import { addDiasISO, hojeISO } from "@/lib/format";

export type FiltrosHistorico = {
  categoria?: CategoriaHistorico | null;
  periodo?: PeriodoHistorico;
  eventoId?: string | null;
  usuarioId?: string | null;
  busca?: string | null;
  pagina?: number;
  porPagina?: number;
};

export type RegistroHistorico = {
  id: string;
  em: Date;
  entidade: string;
  entidadeId: string;
  categoria: CategoriaHistorico | null;
  acao: string;
  descricao: string;
  dadosAntes: unknown;
  dadosDepois: unknown;
  verComo: string | null;
  eventoId: string | null;
  evento: { codigo: string; nome: string } | null;
  autor: { id: string; nome: string; perfil: Perfil } | null;
  /** Só para `solicitacao_item`: a solicitação dona do item (para o link). */
  solicitacaoId: string | null;
};

/** Início do dia em São Paulo, como condição SQL sobre `criado_em`. */
const desdeODia = (dia: string) => sql`(${historico.criadoEm} at time zone 'America/Sao_Paulo')::date >= ${dia}::date`;

function condicoes(f: FiltrosHistorico, ignorar: "categoria" | "evento" | "usuario" | null = null): SQL[] {
  const c: SQL[] = [];
  const periodo = PERIODOS_HISTORICO[f.periodo ?? "30"];
  if (periodo.dias !== null) c.push(desdeODia(addDiasISO(hojeISO(), -periodo.dias)));
  if (f.categoria && ignorar !== "categoria") c.push(inArray(historico.entidade, [...CATEGORIAS_HISTORICO[f.categoria].entidades]));
  if (f.eventoId && ignorar !== "evento") c.push(eq(historico.eventoId, f.eventoId));
  if (f.usuarioId && ignorar !== "usuario") c.push(eq(historico.usuarioId, f.usuarioId));
  const q = f.busca?.trim();
  if (q) c.push(sql`(${historico.descricao} ilike ${`%${q}%`} or ${historico.acao} ilike ${`%${q}%`})`);
  return c;
}
const juntar = (c: SQL[]) => (c.length ? and(...c) : undefined);

/**
 * Log geral do sistema, para logística, gestão e administração: tudo que o app registrou, com
 * autor, hora, evento e o "antes/depois" de quem gravou. Filtros por categoria, período, evento,
 * pessoa e texto; paginação no banco (o histórico cresce sem limite).
 */
export async function listarHistoricoGeral(usuario: UsuarioAtual, f: FiltrosHistorico = {}) {
  exigir(usuario, "historico.ver_tudo");
  const db = await getDb();
  const porPagina = Math.min(200, Math.max(10, f.porPagina ?? 50));
  const pagina = Math.max(1, f.pagina ?? 1);
  const where = juntar(condicoes(f));

  const [[{ total }], rows, porEntidade, pessoas, eventosLista] = await Promise.all([
    db.select({ total: count() }).from(historico).where(where),
    db
      .select({
        id: historico.id,
        em: historico.criadoEm,
        entidade: historico.entidade,
        entidadeId: historico.entidadeId,
        acao: historico.acao,
        descricao: historico.descricao,
        dadosAntes: historico.dadosAntes,
        dadosDepois: historico.dadosDepois,
        verComo: historico.verComo,
        eventoId: historico.eventoId,
        eventoCodigo: eventos.codigo,
        eventoNome: eventos.nome,
        autorId: usuarios.id,
        autorNome: usuarios.nome,
        autorPerfil: usuarios.perfil,
      })
      .from(historico)
      .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
      .leftJoin(eventos, eq(historico.eventoId, eventos.id))
      .where(where)
      .orderBy(desc(historico.criadoEm), desc(historico.id))
      .limit(porPagina)
      .offset((pagina - 1) * porPagina),
    // Facetas: cada uma ignora o próprio filtro, para as contagens mostrarem o que dá para escolher.
    db.select({ entidade: historico.entidade, n: count() }).from(historico).where(juntar(condicoes(f, "categoria"))).groupBy(historico.entidade),
    db
      .select({ id: usuarios.id, nome: usuarios.nome, perfil: usuarios.perfil, n: count() })
      .from(historico)
      .innerJoin(usuarios, eq(historico.usuarioId, usuarios.id))
      .where(juntar(condicoes(f, "usuario")))
      .groupBy(usuarios.id, usuarios.nome, usuarios.perfil)
      .orderBy(desc(count()), usuarios.nome),
    db
      .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, n: count() })
      .from(historico)
      .innerJoin(eventos, eq(historico.eventoId, eventos.id))
      .where(juntar(condicoes(f, "evento")))
      .groupBy(eventos.id, eventos.codigo, eventos.nome)
      .orderBy(desc(count()), eventos.codigo),
  ]);

  // Link do item de solicitação precisa da solicitação dona.
  const itemIds = rows.filter((r) => r.entidade === "solicitacao_item").map((r) => r.entidadeId);
  const donos = itemIds.length ? await db.select({ id: solicitacaoItens.id, solicitacaoId: solicitacaoItens.solicitacaoId }).from(solicitacaoItens).where(inArray(solicitacaoItens.id, itemIds)) : [];
  const donoDe = new Map(donos.map((d) => [d.id, d.solicitacaoId]));

  const porCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<CategoriaHistorico, number>;
  for (const r of porEntidade) {
    const c = categoriaDe(r.entidade);
    if (c) porCategoria[c] += Number(r.n);
  }

  const itens: RegistroHistorico[] = rows.map((r) => ({
    id: r.id,
    em: r.em,
    entidade: r.entidade,
    entidadeId: r.entidadeId,
    categoria: categoriaDe(r.entidade),
    acao: r.acao,
    descricao: r.descricao,
    dadosAntes: r.dadosAntes,
    dadosDepois: r.dadosDepois,
    verComo: r.verComo,
    eventoId: r.eventoId,
    evento: r.eventoCodigo && r.eventoNome ? { codigo: r.eventoCodigo, nome: r.eventoNome } : null,
    autor: r.autorId && r.autorNome && r.autorPerfil ? { id: r.autorId, nome: r.autorNome, perfil: r.autorPerfil } : null,
    solicitacaoId: r.entidade === "solicitacao_item" ? (donoDe.get(r.entidadeId) ?? null) : null,
  }));

  const totalN = Number(total);
  return {
    itens,
    total: totalN,
    pagina,
    porPagina,
    paginas: Math.max(1, Math.ceil(totalN / porPagina)),
    porCategoria,
    pessoas: pessoas.map((p) => ({ ...p, n: Number(p.n) })),
    eventos: eventosLista.map((e) => ({ ...e, n: Number(e.n) })),
  };
}

/** Números do topo da tela: atividade de hoje, 7 e 30 dias, e quantas pessoas agiram em 30 dias. */
export async function resumoHistorico(usuario: UsuarioAtual) {
  exigir(usuario, "historico.ver_tudo");
  const db = await getDb();
  const hoje = hojeISO();
  const d7 = addDiasISO(hoje, -6);
  const d30 = addDiasISO(hoje, -29);
  const [r] = await db
    .select({
      hoje: count(sql`case when ${desdeODia(hoje)} then 1 end`),
      dias7: count(sql`case when ${desdeODia(d7)} then 1 end`),
      dias30: count(sql`case when ${desdeODia(d30)} then 1 end`),
      pessoas30: countDistinct(sql`case when ${desdeODia(d30)} then ${historico.usuarioId} end`),
    })
    .from(historico);
  return { hoje: Number(r.hoje), dias7: Number(r.dias7), dias30: Number(r.dias30), pessoas30: Number(r.pessoas30) };
}

/** Mesma lista, sem paginação (até `limite` registros), para exportar. */
export async function exportarHistoricoGeral(usuario: UsuarioAtual, f: FiltrosHistorico, limite = 5000) {
  const tudo = await listarHistoricoGeral(usuario, { ...f, pagina: 1, porPagina: 200 });
  const itens = [...tudo.itens];
  for (let p = 2; p <= tudo.paginas && itens.length < limite; p++) itens.push(...(await listarHistoricoGeral(usuario, { ...f, pagina: p, porPagina: 200 })).itens);
  return { itens: itens.slice(0, limite), total: tudo.total };
}
