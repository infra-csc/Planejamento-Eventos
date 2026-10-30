import { cache } from "react";
import { and, asc, desc, eq, inArray, isNull, lt, ne, notInArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, eventos, pecas, projetoItens, solicitacaoItens, solicitacoes, usuarios, type SolicitacaoStatus } from "@/server/db/schema";
import type { PedidoAnterior, PedidosPorEvento, SituacaoPedido } from "@/domain/ja-pedido";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError, SemPermissaoError } from "@/domain/errors";
import { areasDoUsuario, pode, podeVerSolicitacao } from "@/domain/permissions";
import { STATUS_ABERTOS } from "@/domain/solicitacao";
import { contarItensPedido } from "@/domain/agrupamento-pedido";
import { kitDaTenda } from "@/domain/tendas";
import { escopoRascunhos } from "./escopo";

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
    const minhas = areasDoUsuario(usuario);
    if (!minhas.length) return [];
    conds.push(inArray(solicitacoes.areaId, minhas));
  } else if (usuario.perfil !== "ADMIN") {
    // Rascunho ainda não enviado é da área (mesma regra de paginarSolicitacoes e da busca).
    conds.push(escopoRascunhos(usuario));
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
      itens: { columns: { id: true, status: true, operacao: true, projetoId: true, pecaId: true, eventoItemId: true, descricaoLivre: true } },
    },
    orderBy: [desc(solicitacoes.atualizadoEm)],
  });
  return rows.map((r) => ({
    ...r,
    // Contados como a solicitação mostra (a tenda em 3 locais é 1 item); auditoria 30/10, A N15.
    totalItens: contarItensPedido(r.itens).total,
    itensRespondidos: contarItensPedido(r.itens).respondidos,
  }));
}

export type SolicitacaoLista = Awaited<ReturnType<typeof listarSolicitacoes>>[number];
/** Linha da lista paginada: com a data da reunião do evento (coluna Prazo / reunião). */
export type SolicitacaoListaPagina = SolicitacaoLista & { evento: SolicitacaoLista["evento"] & { dataReuniao: Date } };

export const FILTROS_LISTA = ["TODAS", "NA_ATA", "ABERTAS", "ATRASADAS", "RASCUNHO", "RESPONDIDA"] as const;
export type FiltroLista = (typeof FILTROS_LISTA)[number];

/** Recorte pela data da reunião de OS do evento (dias de Brasília). */
export const REUNIOES_LISTA = ["hoje", "amanha", "7dias"] as const;
export type ReuniaoLista = (typeof REUNIOES_LISTA)[number];

/** [início, fim) em horário de Brasília (UTC−3, sem horário de verão desde 2019). */
function janelaReuniao(r: ReuniaoLista, agora = new Date()): [Date, Date] {
  const dia = 24 * 60 * 60 * 1000;
  const brt = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const hoje = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + 3 * 60 * 60 * 1000;
  if (r === "hoje") return [new Date(hoje), new Date(hoje + dia)];
  if (r === "amanha") return [new Date(hoje + dia), new Date(hoje + 2 * dia)];
  return [new Date(hoje), new Date(hoje + 8 * dia)];
}

/**
 * Página da lista de solicitações com filtro, ordenação e paginação no banco, e a contagem de cada
 * filtro numa consulta só. Substitui carregar todas as solicitações com itens e fatiar em memória.
 */
/** Eventos que têm solicitação visível para este usuário (para o filtro da lista). */
export async function eventosComSolicitacoes(usuario: UsuarioAtual) {
  const db = await getDb();
  const escopo = [eq(solicitacoes.excluida, false)];
  if (!pode(usuario, "solicitacao.ver_todas")) {
    const minhas = areasDoUsuario(usuario);
    if (!minhas.length) return [];
    escopo.push(inArray(solicitacoes.areaId, minhas));
  } else if (usuario.perfil !== "ADMIN") escopo.push(escopoRascunhos(usuario));
  const rows = await db
    .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, dataInicio: eventos.dataInicio, n: sql<number>`count(*)` })
    .from(solicitacoes)
    .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
    .where(and(...escopo))
    .groupBy(eventos.id, eventos.codigo, eventos.nome, eventos.dataInicio)
    .orderBy(asc(eventos.dataInicio));
  return rows.map((r) => ({ ...r, n: Number(r.n) }));
}

export async function paginarSolicitacoes(
  usuario: UsuarioAtual,
  opcoes: { filtro: FiltroLista; ordem?: string; dir?: string; pagina?: string; porPagina: number; eventoId?: string | null; busca?: string | null; areaId?: string | null; tipo?: "PRE_REUNIAO" | "ALTERACAO" | null; reuniao?: ReuniaoLista | null },
) {
  const db = await getDb();
  const agora = sql`${new Date().toISOString()}::timestamptz`;
  const vazio = { itens: [] as SolicitacaoListaPagina[], pagina: 1, paginas: 1, total: 0, de: 0, porPagina: opcoes.porPagina, contagens: { NA_ATA: 0, ABERTAS: 0, ATRASADAS: 0, RASCUNHO: 0, RESPONDIDA: 0, TODAS: 0 } };
  const base = [eq(solicitacoes.excluida, false)];
  if (!pode(usuario, "solicitacao.ver_todas")) {
    const minhas = areasDoUsuario(usuario);
    if (!minhas.length) return vazio;
    base.push(inArray(solicitacoes.areaId, minhas));
  } else if (usuario.perfil !== "ADMIN") {
    // Rascunho ainda não enviado é da área (a tela promete que "a logística nunca chegou a vê-lo").
    base.push(escopoRascunhos(usuario));
  }
  // Filtros (evento, área, tipo, data da reunião) valem para a lista e para as contagens de cada aba.
  if (opcoes.eventoId) base.push(eq(solicitacoes.eventoId, opcoes.eventoId));
  if (opcoes.areaId) base.push(eq(solicitacoes.areaId, opcoes.areaId));
  if (opcoes.tipo) base.push(eq(solicitacoes.tipo, opcoes.tipo));
  if (opcoes.reuniao) {
    const [ini, fim] = janelaReuniao(opcoes.reuniao);
    base.push(sql`${solicitacoes.eventoId} in (select e.id from eventos e where e.data_reuniao >= ${ini.toISOString()}::timestamptz and e.data_reuniao < ${fim.toISOString()}::timestamptz)`);
  }
  // Busca por código ou título (também entra nas contagens). % e _ do termo são literais.
  const termo = opcoes.busca?.trim().slice(0, 80);
  if (termo) {
    const padrao = `%${termo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    base.push(sql`(${solicitacoes.codigo} ilike ${padrao} or coalesce(${solicitacoes.titulo}, '') ilike ${padrao})`);
  }
  // Aguardando resposta = alterações; necessidade pré-reunião não passa por avaliação (já está na ata).
  const abertas = sql`${solicitacoes.status} in ('ENVIADA', 'EM_ANALISE') and ${solicitacoes.tipo} = 'ALTERACAO'`;
  // Na ata = pedido pré-reunião enviado de evento que ainda vai ter (ou está em) reunião: espera a conferência.
  // Fica fora de "Respondidas" (antes, 45 "respondidas" eram quase todas pedidos que nem passaram pela reunião).
  const naAta = sql`${solicitacoes.tipo} = 'PRE_REUNIAO' and ${solicitacoes.status} not in ('RASCUNHO', 'DEVOLVIDA', 'CANCELADA') and ${solicitacoes.eventoId} in (select e.id from eventos e where e.status in ('PREPARACAO', 'EM_REUNIAO'))`;
  const condicoes: Record<FiltroLista, SQL> = {
    NA_ATA: naAta,
    ABERTAS: abertas,
    ATRASADAS: sql`${abertas} and ${solicitacoes.prazoRespostaEm} < ${agora}`,
    RASCUNHO: sql`${solicitacoes.status} in ('RASCUNHO', 'DEVOLVIDA')`,
    RESPONDIDA: sql`${solicitacoes.status} = 'RESPONDIDA' and not (${naAta})`,
    TODAS: sql`true`,
  };
  const [c] = await db
    .select({
      NA_ATA: sql<number>`count(*) filter (where ${condicoes.NA_ATA})`,
      ABERTAS: sql<number>`count(*) filter (where ${condicoes.ABERTAS})`,
      ATRASADAS: sql<number>`count(*) filter (where ${condicoes.ATRASADAS})`,
      RASCUNHO: sql<number>`count(*) filter (where ${condicoes.RASCUNHO})`,
      RESPONDIDA: sql<number>`count(*) filter (where ${condicoes.RESPONDIDA})`,
      TODAS: sql<number>`count(*)`,
    })
    .from(solicitacoes)
    .where(and(...base));
  const contagens = { NA_ATA: Number(c.NA_ATA), ABERTAS: Number(c.ABERTAS), ATRASADAS: Number(c.ATRASADAS), RASCUNHO: Number(c.RASCUNHO), RESPONDIDA: Number(c.RESPONDIDA), TODAS: Number(c.TODAS) };

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
    reuniao: [direcao(sql`(select e.data_reuniao from eventos e where e.id = ${solicitacoes.eventoId})`)],
  };
  // `hasOwn`: a chave também vem da URL ("__proto__" acharia Object.prototype).
  // Sem ordem escolhida: em "Todas" e "Respondidas", a enviada mais recente primeiro (a última alterada embaralhava
  // a lista a cada conferência); em "Na ata", a reunião mais próxima; nas filas, o prazo mais próximo.
  const recentes = [sql`coalesce(${solicitacoes.enviadaEm}, ${solicitacoes.criadoEm}) desc`];
  const ordemPadrao =
    opcoes.filtro === "TODAS" || opcoes.filtro === "RESPONDIDA" || opcoes.filtro === "RASCUNHO"
      ? recentes
      : opcoes.filtro === "NA_ATA"
        ? [sql`(select e.data_reuniao from eventos e where e.id = ${solicitacoes.eventoId}) asc`, ...recentes]
        : [sql`${solicitacoes.prazoRespostaEm} asc nulls last`];
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
      evento: { columns: { id: true, codigo: true, nome: true, status: true, dataReuniao: true } },
      area: true,
      criadoPor: { columns: { id: true, nome: true } },
      itens: { columns: { id: true, status: true, operacao: true, projetoId: true, pecaId: true, eventoItemId: true, descricaoLivre: true } },
    },
  });
  const posicao = new Map(ids.map((id, i) => [id, i]));
  const itens = rows
    .sort((a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0))
    .map((r) => {
      const n = contarItensPedido(r.itens);
      return { ...r, totalItens: n.total, itensRespondidos: n.respondidos };
    });
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
  const minhas = areasDoUsuario(usuario);
  if (!veTodas && !minhas.length) return [];
  const db = await getDb();
  return db
    .select({ id: solicitacoes.id, prazoRespostaEm: solicitacoes.prazoRespostaEm })
    .from(solicitacoes)
    .where(
      and(
        eq(solicitacoes.excluida, false),
        veTodas ? undefined : inArray(solicitacoes.areaId, minhas),
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
      evento: { columns: { id: true, codigo: true, nome: true, status: true, dataReuniao: true, janelaAlteracoesAte: true } },
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

/**
 * O que já foi pedido de cada projeto/peça nos eventos informados, para o aviso "já pedido" do
 * formulário: itens de solicitações enviadas (não os rascunhos, as devolvidas nem as canceladas, e
 * não os itens recusados) e linhas que a logística incluiu direto na ata. `exceto` tira a própria
 * solicitação em edição. Só informa — não restringe nada.
 */
export async function pedidosAnterioresPorEvento(eventoIds: string[], exceto?: string | null): Promise<PedidosPorEvento> {
  const saida: PedidosPorEvento = Object.fromEntries(eventoIds.map((id) => [id, {}]));
  if (eventoIds.length === 0) return saida;
  const db = await getDb();
  const [dasSolicitacoes, daLogistica] = await Promise.all([
    db
      .select({
        eventoId: solicitacoes.eventoId,
        ref: sql<string>`coalesce(${solicitacaoItens.projetoId}, ${solicitacaoItens.pecaId})`,
        pedida: solicitacaoItens.quantidadeSolicitada,
        atendida: solicitacaoItens.quantidadeAtendida,
        status: solicitacaoItens.status,
        tipo: solicitacoes.tipo,
        codigo: solicitacoes.codigo,
        area: areas.nome,
        pessoa: usuarios.nome,
        em: solicitacoes.enviadaEm,
        destino: solicitacaoItens.destino,
        descricoes: solicitacaoItens.descricoes,
      })
      .from(solicitacaoItens)
      .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
      .leftJoin(areas, eq(solicitacoes.areaId, areas.id))
      .leftJoin(usuarios, eq(solicitacoes.criadoPorId, usuarios.id))
      .where(
        and(
          inArray(solicitacoes.eventoId, eventoIds),
          eq(solicitacoes.excluida, false),
          notInArray(solicitacoes.status, ["RASCUNHO", "DEVOLVIDA", "CANCELADA"]),
          exceto ? ne(solicitacoes.id, exceto) : undefined,
          eq(solicitacaoItens.operacao, "ADICIONAR"),
          ne(solicitacaoItens.status, "NAO_ATENDIDO"),
          sql`coalesce(${solicitacaoItens.projetoId}, ${solicitacaoItens.pecaId}) is not null`,
        ),
      )
      .orderBy(desc(solicitacoes.enviadaEm), asc(solicitacaoItens.ordem)),
    db
      .select({ eventoId: eventoItens.eventoId, ref: sql<string>`coalesce(${eventoItens.projetoId}, ${eventoItens.pecaId})`, quantidade: eventoItens.quantidade, area: areas.nome, pessoa: usuarios.nome, destino: eventoItens.destino })
      .from(eventoItens)
      .leftJoin(areas, eq(eventoItens.areaId, areas.id))
      .leftJoin(usuarios, eq(eventoItens.criadoPorId, usuarios.id))
      .where(and(inArray(eventoItens.eventoId, eventoIds), eq(eventoItens.ativo, true), isNull(eventoItens.solicitacaoItemId), sql`coalesce(${eventoItens.projetoId}, ${eventoItens.pecaId}) is not null`))
      .orderBy(desc(eventoItens.criadoEm)),
  ]);
  const incluir = (eventoId: string, ref: string, p: PedidoAnterior) => {
    const ev = (saida[eventoId] ??= {});
    (ev[ref] ??= []).push(p);
  };
  for (const r of dasSolicitacoes) {
    const situacao: SituacaoPedido = r.status === "EM_ANALISE" ? (r.tipo === "PRE_REUNIAO" ? "na ata" : "aguardando resposta") : r.status === "PARCIAL" ? "atendido em parte" : r.tipo === "PRE_REUNIAO" ? "na ata" : "atendido";
    const quantidade = r.status === "PARCIAL" || r.status === "ATENDIDO" ? (r.atendida ?? r.pedida) : r.pedida;
    incluir(r.eventoId, r.ref, { quantidade, area: r.area, pessoa: r.pessoa, codigo: r.codigo, situacao, destino: r.destino, descricoes: r.descricoes });
  }
  for (const r of daLogistica) incluir(r.eventoId, r.ref, { quantidade: r.quantidade, area: r.area, pessoa: r.pessoa, codigo: null, situacao: "incluído pela logística", destino: r.destino });
  return saida;
}

export type MudancaPosAta = {
  id: string;
  quando: Date | null;
  tipo: "entrou" | "mudou" | "saiu";
  item: string;
  destino: string | null;
  /** "+4", "6 → 9", "sai". */
  quantidade: string;
  /** Entrou direto (dentro da janela) ou foi decidida pela logística (fora da janela / corrigida). */
  como: "direto" | "logistica" | "parcial";
  codigo: string;
  solicitacaoId: string;
  areaId: string;
  area: string;
  quem: string;
};

/**
 * O que mudou no evento depois da reunião por pedido das áreas: itens de alterações que entraram na OS
 * (direto, dentro da janela, ou aceitos pela logística), do mais recente ao mais antigo. Ajustes feitos
 * direto pela logística ficam no histórico do evento (quem chama junta os dois).
 */
export async function mudancasPosAta(eventoId: string): Promise<MudancaPosAta[]> {
  const db = await getDb();
  const lista = await db.query.solicitacoes.findMany({
    where: and(eq(solicitacoes.eventoId, eventoId), eq(solicitacoes.tipo, "ALTERACAO"), eq(solicitacoes.excluida, false), ne(solicitacoes.status, "CANCELADA")),
    columns: { id: true, codigo: true, areaId: true },
    with: {
      area: { columns: { nome: true } },
      criadoPor: { columns: { nome: true } },
      itens: {
        columns: { id: true, operacao: true, status: true, quantidadeSolicitada: true, quantidadeAtendida: true, quantidadeAnterior: true, destino: true, descricaoLivre: true, respondidoPorId: true, respondidoEm: true },
        with: { projeto: { columns: { nome: true } }, peca: { columns: { codigo: true, nome: true } }, eventoItem: { columns: { descricaoLivre: true, destino: true }, with: { projeto: { columns: { nome: true } }, peca: { columns: { codigo: true, nome: true } } } } },
      },
    },
  });
  const saida: MudancaPosAta[] = [];
  for (const s of lista) {
    for (const i of s.itens) {
      if (i.status !== "ATENDIDO" && i.status !== "PARCIAL") continue;
      const tipo = i.operacao === "ADICIONAR" ? "entrou" : i.operacao === "REMOVER" ? "saiu" : "mudou";
      const atendida = i.quantidadeAtendida ?? i.quantidadeSolicitada;
      saida.push({
        id: i.id,
        quando: i.respondidoEm,
        tipo,
        item: descricaoItem(i),
        destino: i.destino ?? i.eventoItem?.destino ?? null,
        quantidade: tipo === "entrou" ? `+${atendida}` : tipo === "saiu" ? "sai" : `${i.quantidadeAnterior ?? "?"} → ${atendida}`,
        como: i.status === "PARCIAL" ? "parcial" : i.respondidoPorId ? "logistica" : "direto",
        codigo: s.codigo,
        solicitacaoId: s.id,
        areaId: s.areaId,
        area: s.area.nome,
        quem: s.criadoPor.nome,
      });
    }
  }
  return saida.sort((a, b) => (b.quando?.getTime() ?? 0) - (a.quando?.getTime() ?? 0));
}

/**
 * Fechamentos e calhas que a lista padrão de cada versão de tenda já traz por tenda (a 5×5 v3 traz 1 calha):
 * o total do local é (padrão + ajuste do pedido) × tendas — "−1 calha" sozinho não dizia nada.
 */
export async function padraoTendaPorVersao(versaoIds: string[]): Promise<Map<string, { fechamentos: number; calhas: number; temCalha: boolean; ehTenda: boolean }>> {
  const mapa = new Map<string, { fechamentos: number; calhas: number; temCalha: boolean; ehTenda: boolean }>();
  if (!versaoIds.length) return mapa;
  const db = await getDb();
  const rows = await db
    .select({ versaoId: projetoItens.versaoId, codigo: pecas.codigo, quantidade: projetoItens.quantidade })
    .from(projetoItens)
    .innerJoin(pecas, eq(projetoItens.pecaId, pecas.id))
    .where(inArray(projetoItens.versaoId, versaoIds));
  for (const id of versaoIds) {
    const doProjeto = rows.filter((r) => r.versaoId === id);
    const soma = (sufixo: string) => doProjeto.filter((r) => r.codigo.endsWith(sufixo)).reduce((t, r) => t + r.quantidade, 0);
    // "É tenda" e "tem calha" pelo kit das peças, como no resto do app (antes: pelo nome do projeto e pelo prefixo TND5-).
    const kit = kitDaTenda(doProjeto.map((r) => r.codigo));
    mapa.set(id, { fechamentos: soma("-FECH"), calhas: soma("-CALHA"), temCalha: Boolean(kit?.pecas.calha), ehTenda: Boolean(kit) });
  }
  return mapa;
}
