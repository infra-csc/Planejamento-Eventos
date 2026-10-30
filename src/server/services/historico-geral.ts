import { and, count, countDistinct, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { pode } from "@/domain/permissions";
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
  /** Esconde os registros de carga e descarga (quem não tem acesso à tela). */
  semCarga?: boolean;
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

/**
 * Início do dia em São Paulo, como condição SQL sobre `criado_em`. A conversão fica do lado do valor
 * (meia-noite de SP vira um instante), não da coluna: o banco compara direto com `criado_em` em vez de
 * converter a tabela inteira a cada leitura (auditoria 28/10, nº 71 / D-P2-6).
 */
const desdeODia = (dia: string) => sql`${historico.criadoEm} >= (${dia}::date::timestamp at time zone 'America/Sao_Paulo')`;

/** `%`, `_` e `\` digitados na busca valem como texto, não como curinga do ilike (auditoria 30/10, parte D N15). */
const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

function condicoes(f: FiltrosHistorico, ignorar: "categoria" | "evento" | "usuario" | null = null): SQL[] {
  const c: SQL[] = [];
  const periodo = PERIODOS_HISTORICO[f.periodo ?? "30"];
  if (periodo.dias !== null) c.push(desdeODia(addDiasISO(hojeISO(), -periodo.dias)));
  if (f.categoria && ignorar !== "categoria") c.push(inArray(historico.entidade, [...CATEGORIAS_HISTORICO[f.categoria].entidades]));
  if (f.eventoId && ignorar !== "evento") c.push(eq(historico.eventoId, f.eventoId));
  if (f.usuarioId && ignorar !== "usuario") c.push(eq(historico.usuarioId, f.usuarioId));
  // Carga e descarga é tela da logística: quem não tem acesso a ela não vê os registros dela.
  if (f.semCarga) c.push(ne(historico.entidade, "veiculo_carga"));
  const q = f.busca?.trim();
  if (q) {
    const padrao = `%${escaparLike(q)}%`;
    c.push(sql`(${historico.descricao} ilike ${padrao} or ${historico.acao} ilike ${padrao})`);
  }
  return c;
}
const juntar = (c: SQL[]) => (c.length ? and(...c) : undefined);

type Db = Awaited<ReturnType<typeof getDb>>;

/** Registros de uma página (ou do CSV), com autor, evento e a solicitação dona do item de solicitação. */
async function lerRegistros(db: Db, where: SQL | undefined, limite: number, desde: number): Promise<RegistroHistorico[]> {
  const rows = await db
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
    .limit(limite)
    .offset(desde);

  // Link do item de solicitação precisa da solicitação dona.
  const itemIds = rows.filter((r) => r.entidade === "solicitacao_item").map((r) => r.entidadeId);
  const donos = itemIds.length ? await db.select({ id: solicitacaoItens.id, solicitacaoId: solicitacaoItens.solicitacaoId }).from(solicitacaoItens).where(inArray(solicitacaoItens.id, itemIds)) : [];
  const donoDe = new Map(donos.map((d) => [d.id, d.solicitacaoId]));

  return rows.map((r) => ({
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
}

/**
 * Log geral do sistema, para logística, gestão e administração: tudo que o app registrou, com
 * autor, hora, evento e o "antes/depois" de quem gravou. Filtros por categoria, período, evento,
 * pessoa e texto; paginação no banco (o histórico cresce sem limite).
 */
export async function listarHistoricoGeral(usuario: UsuarioAtual, f: FiltrosHistorico = {}) {
  exigir(usuario, "historico.ver_tudo");
  f = { ...f, semCarga: !pode(usuario, "carga.ver") };
  const db = await getDb();
  const porPagina = Math.min(200, Math.max(10, f.porPagina ?? 50));
  const pedida = Math.max(1, f.pagina ?? 1);
  const where = juntar(condicoes(f));

  const [[{ total }], primeira, porEntidade, pessoas, eventosLista] = await Promise.all([
    db.select({ total: count() }).from(historico).where(where),
    lerRegistros(db, where, porPagina, (pedida - 1) * porPagina),
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

  const totalN = Number(total);
  const paginas = Math.max(1, Math.ceil(totalN / porPagina));
  // Página além da última (?pagina=999, link antigo depois de filtrar): mostra a última em vez de
  // "Mostrando 49901 a 741" com a tabela vazia (auditoria 30/10, parte D N16). Só aqui lê de novo.
  const pagina = Math.min(pedida, paginas);
  const itens = pagina === pedida ? primeira : await lerRegistros(db, where, porPagina, (pagina - 1) * porPagina);

  const porCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<CategoriaHistorico, number>;
  for (const r of porEntidade) {
    const c = categoriaDe(r.entidade);
    if (c) porCategoria[c] += Number(r.n);
  }

  return {
    itens,
    total: totalN,
    pagina,
    porPagina,
    paginas,
    porCategoria,
    pessoas: pessoas.map((p) => ({ ...p, n: Number(p.n) })),
    eventos: eventosLista.map((e) => ({ ...e, n: Number(e.n) })),
  };
}

/** Números do topo da tela: atividade de hoje, 7 e 30 dias, e quantas pessoas agiram em 30 dias. */
export async function resumoHistorico(usuario: UsuarioAtual) {
  exigir(usuario, "historico.ver_tudo");
  // Mesmo recorte da lista: sem a carga, a Gestão via "Hoje 41" e a lista mostrava 26 (auditoria 30/10, parte D N5).
  const semCarga = !pode(usuario, "carga.ver");
  const db = await getDb();
  const hoje = hojeISO();
  const d7 = addDiasISO(hoje, -6);
  const d30 = addDiasISO(hoje, -29);
  const [r] = await db
    .select({
      hoje: count(sql`case when ${desdeODia(hoje)} then 1 end`),
      dias7: count(sql`case when ${desdeODia(d7)} then 1 end`),
      dias30: count(),
      pessoas30: countDistinct(historico.usuarioId),
    })
    .from(historico)
    // Todos os números cabem nos últimos 30 dias: lê só esse trecho, não a tabela inteira (nº 71).
    .where(and(desdeODia(d30), semCarga ? ne(historico.entidade, "veiculo_carga") : undefined));
  return { hoje: Number(r.hoje), dias7: Number(r.dias7), dias30: Number(r.dias30), pessoas30: Number(r.pessoas30) };
}

/**
 * Mesma lista, sem paginação (até `limite` registros), para exportar: uma contagem e uma leitura
 * com limite, em vez de chamar a listagem página a página (até 151 consultas; auditoria 28/10, nº 71).
 */
export async function exportarHistoricoGeral(usuario: UsuarioAtual, f: FiltrosHistorico, limite = 5000) {
  exigir(usuario, "historico.ver_tudo");
  const where = juntar(condicoes({ ...f, semCarga: !pode(usuario, "carga.ver") }));
  const db = await getDb();
  const [[{ total }], itens] = await Promise.all([db.select({ total: count() }).from(historico).where(where), lerRegistros(db, where, limite, 0)]);
  return { itens, total: Number(total) };
}
