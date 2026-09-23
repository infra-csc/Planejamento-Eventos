import { cache } from "react";
import { and, asc, desc, eq, inArray, lt, ne, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, solicitacaoItens, solicitacoes, type SolicitacaoStatus } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError, SemPermissaoError } from "@/domain/errors";
import { pode, podeVerSolicitacao } from "@/domain/permissions";
import { STATUS_ABERTOS } from "@/domain/solicitacao";

/* ------------------------------------------------------------------ */
/* Consultas                                                            */
/* ------------------------------------------------------------------ */

export type FiltroSolicitacoes = {
  eventoId?: string;
  status?: SolicitacaoStatus | "ABERTAS" | "TODAS";
  areaId?: string;
  atrasadas?: boolean;
  somenteMinhaArea?: boolean;
};

export async function listarSolicitacoes(usuario: UsuarioAtual, filtro: FiltroSolicitacoes = {}) {
  const db = await getDb();
  const conds = [eq(solicitacoes.excluida, false)];
  if (!pode(usuario, "solicitacao.ver_todas") || filtro.somenteMinhaArea) {
    if (!usuario.areaId) return [];
    conds.push(eq(solicitacoes.areaId, usuario.areaId));
  } else if (usuario.perfil !== "ADMIN") {
    // Rascunho ainda não enviado é da área (mesma regra de paginarSolicitacoes e da busca).
    conds.push(ne(solicitacoes.status, "RASCUNHO"));
  }
  if (filtro.eventoId) conds.push(eq(solicitacoes.eventoId, filtro.eventoId));
  if (filtro.areaId) conds.push(eq(solicitacoes.areaId, filtro.areaId));
  if (filtro.status === "ABERTAS") conds.push(inArray(solicitacoes.status, STATUS_ABERTOS), eq(solicitacoes.tipo, "ALTERACAO"));
  else if (filtro.status && filtro.status !== "TODAS") conds.push(eq(solicitacoes.status, filtro.status));
  if (filtro.atrasadas) {
    conds.push(inArray(solicitacoes.status, STATUS_ABERTOS), eq(solicitacoes.tipo, "ALTERACAO"));
    conds.push(lt(solicitacoes.prazoRespostaEm, new Date()));
  }
  const rows = await db.query.solicitacoes.findMany({
    where: and(...conds),
    with: {
      evento: { columns: { id: true, codigo: true, nome: true, status: true } },
      area: true,
      criadoPor: { columns: { id: true, nome: true } },
      itens: { columns: { id: true, status: true } },
    },
    orderBy: [desc(solicitacoes.atualizadoEm)],
  });
  return rows.map((r) => ({
    ...r,
    totalItens: r.itens.length,
    itensRespondidos: r.itens.filter((i) => i.status !== "EM_ANALISE").length,
  }));
}

export type SolicitacaoLista = Awaited<ReturnType<typeof listarSolicitacoes>>[number];

export const FILTROS_LISTA = ["TODAS", "ABERTAS", "ATRASADAS", "RASCUNHO", "RESPONDIDA"] as const;
export type FiltroLista = (typeof FILTROS_LISTA)[number];

/**
 * Página da lista de solicitações com filtro, ordenação e paginação no banco, e a contagem de cada
 * filtro numa consulta só. Substitui carregar todas as solicitações com itens e fatiar em memória.
 */
/** Eventos que têm solicitação visível para este usuário (para o filtro da lista). */
export async function eventosComSolicitacoes(usuario: UsuarioAtual) {
  const db = await getDb();
  const escopo = [eq(solicitacoes.excluida, false)];
  if (!pode(usuario, "solicitacao.ver_todas")) {
    if (!usuario.areaId) return [];
    escopo.push(eq(solicitacoes.areaId, usuario.areaId));
  } else if (usuario.perfil !== "ADMIN") escopo.push(ne(solicitacoes.status, "RASCUNHO"));
  const rows = await db
    .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, dataInicio: eventos.dataInicio, n: sql<number>`count(*)` })
    .from(solicitacoes)
    .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
    .where(and(...escopo))
    .groupBy(eventos.id, eventos.codigo, eventos.nome, eventos.dataInicio)
    .orderBy(asc(eventos.dataInicio));
  return rows.map((r) => ({ ...r, n: Number(r.n) }));
}

export async function paginarSolicitacoes(usuario: UsuarioAtual, opcoes: { filtro: FiltroLista; ordem?: string; dir?: string; pagina?: string; porPagina: number; eventoId?: string | null; busca?: string | null }) {
  const db = await getDb();
  const agora = sql`${new Date().toISOString()}::timestamptz`;
  const vazio = { itens: [] as SolicitacaoLista[], pagina: 1, paginas: 1, total: 0, de: 0, porPagina: opcoes.porPagina, contagens: { ABERTAS: 0, ATRASADAS: 0, RASCUNHO: 0, RESPONDIDA: 0, TODAS: 0 } };
  const base = [eq(solicitacoes.excluida, false)];
  if (!pode(usuario, "solicitacao.ver_todas")) {
    if (!usuario.areaId) return vazio;
    base.push(eq(solicitacoes.areaId, usuario.areaId));
  } else if (usuario.perfil !== "ADMIN") {
    // Rascunho ainda não enviado é da área (a tela promete que "a logística nunca chegou a vê-lo").
    base.push(ne(solicitacoes.status, "RASCUNHO"));
  }
  // Filtro por evento vale para a lista e para as contagens de cada aba.
  if (opcoes.eventoId) base.push(eq(solicitacoes.eventoId, opcoes.eventoId));
  // Busca por código ou título (também entra nas contagens). % e _ do termo são literais.
  const termo = opcoes.busca?.trim().slice(0, 80);
  if (termo) {
    const padrao = `%${termo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    base.push(sql`(${solicitacoes.codigo} ilike ${padrao} or coalesce(${solicitacoes.titulo}, '') ilike ${padrao})`);
  }
  // Aguardando resposta = alterações; necessidade pré-reunião não passa por avaliação (já está na ata).
  const abertas = sql`${solicitacoes.status} in ('ENVIADA', 'EM_ANALISE') and ${solicitacoes.tipo} = 'ALTERACAO'`;
  const condicoes: Record<FiltroLista, SQL> = {
    ABERTAS: abertas,
    ATRASADAS: sql`${abertas} and ${solicitacoes.prazoRespostaEm} < ${agora}`,
    RASCUNHO: sql`${solicitacoes.status} in ('RASCUNHO', 'DEVOLVIDA')`,
    RESPONDIDA: sql`${solicitacoes.status} = 'RESPONDIDA'`,
    TODAS: sql`true`,
  };
  const [c] = await db
    .select({
      ABERTAS: sql<number>`count(*) filter (where ${condicoes.ABERTAS})`,
      ATRASADAS: sql<number>`count(*) filter (where ${condicoes.ATRASADAS})`,
      RASCUNHO: sql<number>`count(*) filter (where ${condicoes.RASCUNHO})`,
      RESPONDIDA: sql<number>`count(*) filter (where ${condicoes.RESPONDIDA})`,
      TODAS: sql<number>`count(*)`,
    })
    .from(solicitacoes)
    .where(and(...base));
  const contagens = { ABERTAS: Number(c.ABERTAS), ATRASADAS: Number(c.ATRASADAS), RASCUNHO: Number(c.RASCUNHO), RESPONDIDA: Number(c.RESPONDIDA), TODAS: Number(c.TODAS) };

  const total = contagens[opcoes.filtro];
  const paginas = Math.max(1, Math.ceil(total / opcoes.porPagina));
  // `pagina` vem da URL: pode ser fracionária ou lixo. Inteiro dentro do intervalo, sempre.
  const pagina = Math.min(Math.max(1, Math.trunc(Number(opcoes.pagina)) || 1), paginas);
  const de = (pagina - 1) * opcoes.porPagina;

  const desc_ = opcoes.dir === "desc";
  const direcao = (x: SQL | AnyColumn) => (desc_ ? desc(x) : asc(x));
  const prazo = desc_ ? sql`${solicitacoes.prazoRespostaEm} desc nulls first` : sql`${solicitacoes.prazoRespostaEm} asc nulls last`;
  const ordens: Record<string, SQL[]> = {
    codigo: [direcao(solicitacoes.codigo)],
    titulo: [direcao(sql`lower(coalesce(${solicitacoes.titulo}, ''))`)],
    itens: [direcao(sql`(select count(*) from solicitacao_itens si where si.solicitacao_id = ${solicitacoes.id})`)],
    status: [direcao(sql`case ${solicitacoes.status} when 'DEVOLVIDA' then 0 when 'RASCUNHO' then 1 when 'ENVIADA' then 2 when 'EM_ANALISE' then 3 when 'RESPONDIDA' then 4 else 5 end`)],
    prazo: [prazo],
  };
  // `hasOwn`: a chave também vem da URL ("__proto__" acharia Object.prototype).
  // Sem ordem escolhida: em "Todas", o mais recente primeiro; nas filas, o prazo mais próximo primeiro.
  const ordemPadrao = opcoes.filtro === "TODAS" || opcoes.filtro === "RESPONDIDA" ? [desc(solicitacoes.atualizadoEm)] : [sql`${solicitacoes.prazoRespostaEm} asc nulls last`];
  const ordem = (opcoes.ordem && Object.hasOwn(ordens, opcoes.ordem) && ordens[opcoes.ordem]) || ordemPadrao;
  const ids = (
    await db
      .select({ id: solicitacoes.id })
      .from(solicitacoes)
      .where(and(...base, condicoes[opcoes.filtro]))
      .orderBy(...ordem, desc(solicitacoes.atualizadoEm))
      .limit(opcoes.porPagina)
      .offset(de)
  ).map((r) => r.id);
  if (ids.length === 0) return { ...vazio, pagina, paginas, total, de, contagens };

  const rows = await db.query.solicitacoes.findMany({
    where: inArray(solicitacoes.id, ids),
    with: {
      evento: { columns: { id: true, codigo: true, nome: true, status: true } },
      area: true,
      criadoPor: { columns: { id: true, nome: true } },
      itens: { columns: { id: true, status: true } },
    },
  });
  const posicao = new Map(ids.map((id, i) => [id, i]));
  const itens = rows
    .sort((a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0))
    .map((r) => ({ ...r, totalItens: r.itens.length, itensRespondidos: r.itens.filter((i) => i.status !== "EM_ANALISE").length }));
  return { itens, pagina, paginas, total, de, porPagina: opcoes.porPagina, contagens };
}

/** Primeira solicitação da fila da logística (botão "Responder em fila"). */
export async function primeiraDaFila(usuario: UsuarioAtual) {
  if (!pode(usuario, "solicitacao.responder")) return null;
  const db = await getDb();
  const [r] = await db
    .select({ id: solicitacoes.id })
    .from(solicitacoes)
    .where(and(eq(solicitacoes.excluida, false), inArray(solicitacoes.status, STATUS_ABERTOS), eq(solicitacoes.tipo, "ALTERACAO")))
    .orderBy(sql`${solicitacoes.prazoRespostaEm} asc nulls last`)
    .limit(1);
  return r?.id ?? null;
}

/** Fila de resposta da logística: abertas, ordenadas por prazo (sem prazo por último). */
export async function listarFila(usuario: UsuarioAtual) {
  // Mesmo escopo de `listarSolicitacoes(usuario, { status: "ABERTAS" })`, sem carregar evento, área, autor e itens:
  // quem usa a fila só navega pelos ids.
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  if (!veTodas && !usuario.areaId) return [];
  const db = await getDb();
  return db
    .select({ id: solicitacoes.id, prazoRespostaEm: solicitacoes.prazoRespostaEm })
    .from(solicitacoes)
    .where(
      and(
        eq(solicitacoes.excluida, false),
        veTodas ? undefined : eq(solicitacoes.areaId, usuario.areaId!),
        inArray(solicitacoes.status, STATUS_ABERTOS),
        eq(solicitacoes.tipo, "ALTERACAO"),
      ),
    )
    // Prazo mais próximo primeiro, sem prazo por último; empate na ordem da lista (mais recente primeiro).
    .orderBy(sql`${solicitacoes.prazoRespostaEm} asc nulls last`, desc(solicitacoes.atualizadoEm));
}

/** Detalhe completo (evento, área, autor, itens com referências) de uma ou várias solicitações. */
async function consultarDetalhes(ids: string[]) {
  const db = await getDb();
  return db.query.solicitacoes.findMany({
    where: and(inArray(solicitacoes.id, ids), eq(solicitacoes.excluida, false)),
    with: {
      // Só as colunas que as telas de detalhe/edição usam (evento inteiro, referências e a lista de peças da linha ficam de fora).
      evento: { columns: { id: true, codigo: true, nome: true, status: true, dataReuniao: true } },
      area: true,
      criadoPor: { columns: { id: true, nome: true } },
      itens: {
        with: {
          projeto: { columns: { id: true, codigo: true, nome: true } },
          peca: { columns: { id: true, codigo: true, nome: true } },
          projetoVersao: { columns: { id: true, numero: true } },
          eventoItem: { columns: { bomSnapshot: false }, with: { projeto: { columns: { id: true, codigo: true, nome: true } }, peca: { columns: { id: true, codigo: true, nome: true } } } },
          respondidoPor: { columns: { id: true, nome: true } },
        },
        orderBy: [asc(solicitacaoItens.ordem), asc(solicitacaoItens.criadoEm)],
      },
    },
  });
}

export async function obterSolicitacao(usuario: UsuarioAtual, id: string) {
  const [s] = await consultarDetalhes([id]);
  if (!s) throw new NaoEncontradoError("Solicitação");
  if (!podeVerSolicitacao(usuario, s)) throw new SemPermissaoError("Esta solicitação pertence a outra área.");
  return s;
}

/**
 * `obterSolicitacao` memoizada por requisição (React `cache`): a página da solicitação e a linha do
 * tempo pedem o mesmo registro, e a consulta acontece uma vez só. Fora de uma renderização, chama direto.
 */
export const obterSolicitacaoMemo = cache(obterSolicitacao);

export type Solicitacao = Awaited<ReturnType<typeof obterSolicitacao>>;
export type SolicitacaoItem = Solicitacao["itens"][number];

export function descricaoItem(i: {
  projeto?: { nome: string } | null;
  peca?: { codigo: string; nome: string } | null;
  descricaoLivre?: string | null;
  eventoItem?: { projeto?: { nome: string } | null; peca?: { codigo: string; nome: string } | null; descricaoLivre: string | null } | null;
  operacao: string;
}) {
  if (i.operacao !== "ADICIONAR" && i.eventoItem) {
    const e = i.eventoItem;
    return e.projeto?.nome ?? (e.peca ? `${e.peca.codigo} · ${e.peca.nome}` : e.descricaoLivre ?? "Linha da ata");
  }
  if (i.projeto) return i.projeto.nome;
  if (i.peca) return `${i.peca.codigo} · ${i.peca.nome}`;
  return i.descricaoLivre ?? "Item";
}
