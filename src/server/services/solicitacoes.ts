import { and, asc, desc, eq, inArray, lt, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, eventos, historico, pecas, projetos, solicitacaoItens, solicitacoes, usuarios, type AjusteBom, type ItemStatus, type SolicitacaoStatus } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { aceitaSolicitacao, janelaPreReuniaoAberta, tipoSolicitacaoParaStatus } from "@/domain/evento";
import { pode, podeEditarSolicitacao, podeVerSolicitacao } from "@/domain/permissions";
import {
  calcularEfeitoLinha,
  ITEM_STATUS_LABEL,
  podeCancelar,
  podeCorrigirResposta,
  podeDevolver,
  podeEnviar,
  podeResponder,
  podeResponderNaFase,
  statusAposResposta,
  validarItem,
  validarResposta,
  type ItemRascunho,
} from "@/domain/solicitacao";
import { diaMesISO, formatarDataHora, hojeISO } from "@/lib/format";
import { gerarOsVersao } from "./os";
import { snapshotBom } from "./eventos";
import { aplicarAjustesBom } from "@/domain/os";
import { bloquearEvento, notificar, obterConfiguracoes, proximoCodigo, registrarHistorico, usuariosDaArea, usuariosLogistica, type Executor } from "./support";

/** Uma resposta a item pode ser desfeita pelo próprio autor por este tempo (toast "Desfazer"). */
export const JANELA_DESFAZER_MS = 10 * 60_000;

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
  }
  if (filtro.eventoId) conds.push(eq(solicitacoes.eventoId, filtro.eventoId));
  if (filtro.areaId) conds.push(eq(solicitacoes.areaId, filtro.areaId));
  if (filtro.status === "ABERTAS") conds.push(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), eq(solicitacoes.tipo, "ALTERACAO"));
  else if (filtro.status && filtro.status !== "TODAS") conds.push(eq(solicitacoes.status, filtro.status));
  if (filtro.atrasadas) {
    conds.push(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), eq(solicitacoes.tipo, "ALTERACAO"));
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

export const FILTROS_LISTA = ["ABERTAS", "ATRASADAS", "RASCUNHO", "RESPONDIDA", "TODAS"] as const;
export type FiltroLista = (typeof FILTROS_LISTA)[number];

/**
 * Página da lista de solicitações com filtro, ordenação e paginação no banco, e a contagem de cada
 * filtro numa consulta só. Substitui carregar todas as solicitações com itens e fatiar em memória.
 */
export async function paginarSolicitacoes(usuario: UsuarioAtual, opcoes: { filtro: FiltroLista; ordem?: string; dir?: string; pagina?: string; porPagina: number }) {
  const db = await getDb();
  const agora = sql`${new Date().toISOString()}::timestamptz`;
  const vazio = { itens: [] as SolicitacaoLista[], pagina: 1, paginas: 1, total: 0, de: 0, porPagina: opcoes.porPagina, contagens: { ABERTAS: 0, ATRASADAS: 0, RASCUNHO: 0, RESPONDIDA: 0, TODAS: 0 } };
  const base = [eq(solicitacoes.excluida, false)];
  if (!pode(usuario, "solicitacao.ver_todas")) {
    if (!usuario.areaId) return vazio;
    base.push(eq(solicitacoes.areaId, usuario.areaId));
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
  const ordem = (opcoes.ordem && Object.hasOwn(ordens, opcoes.ordem) && ordens[opcoes.ordem]) || [sql`${solicitacoes.prazoRespostaEm} asc nulls last`];
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
    .where(and(eq(solicitacoes.excluida, false), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), eq(solicitacoes.tipo, "ALTERACAO")))
    .orderBy(sql`${solicitacoes.prazoRespostaEm} asc nulls last`)
    .limit(1);
  return r?.id ?? null;
}

/** Fila de resposta da logística: abertas, ordenadas por prazo (sem prazo por último). */
export async function listarFila(usuario: UsuarioAtual) {
  const lista = await listarSolicitacoes(usuario, { status: "ABERTAS" });
  return lista.sort((a, b) => (a.prazoRespostaEm?.getTime() ?? Infinity) - (b.prazoRespostaEm?.getTime() ?? Infinity));
}

/** Detalhe completo (evento, área, autor, itens com referências) de uma ou várias solicitações. */
async function consultarDetalhes(ids: string[]) {
  const db = await getDb();
  return db.query.solicitacoes.findMany({
    where: and(inArray(solicitacoes.id, ids), eq(solicitacoes.excluida, false)),
    with: {
      evento: true,
      area: true,
      criadoPor: { columns: { id: true, nome: true } },
      itens: {
        with: { projeto: true, peca: true, projetoVersao: true, eventoItem: { with: { projeto: true, peca: true } }, respondidoPor: { columns: { id: true, nome: true } } },
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

/** Várias solicitações com itens em uma consulta (tela Consolidar ata), respeitando a área do usuário. */
export async function obterSolicitacoes(usuario: UsuarioAtual, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await consultarDetalhes(ids);
  return rows.filter((s) => podeVerSolicitacao(usuario, s)).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

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

/* ------------------------------------------------------------------ */
/* Rascunho                                                             */
/* ------------------------------------------------------------------ */

async function verificarJanelaPreReuniao(ex: Executor, ev: { dataReuniao: Date }) {
  const cfg = await obterConfiguracoes(ex);
  const horas = Number(cfg.antecedencia_reuniao_horas) || 0;
  if (!janelaPreReuniaoAberta(ev.dataReuniao, horas)) {
    throw new DomainError(`Envios de necessidades encerraram ${horas}h antes da reunião de OS (${formatarDataHora(ev.dataReuniao)}).`);
  }
}

async function criarRascunhoTx(tx: Executor, usuario: UsuarioAtual, eventoId: string, areaEscolhida?: string | null) {
  exigir(usuario, "solicitacao.criar");
  const admin = usuario.perfil === "ADMIN";
  // O Administrador pede em nome de uma área que ele escolhe; os demais perfis, pela própria área.
  const areaId = admin ? (areaEscolhida ?? usuario.areaId) : usuario.areaId;
  if (!areaId) throw new ValidacaoError(admin ? "Escolha a área que está pedindo." : "Seu usuário não está vinculado a uma área. Peça ao administrador.", admin ? { areaId: "Escolha a área." } : undefined);
  if (admin) {
    const area = await tx.query.areas.findFirst({ where: and(eq(areas.id, areaId), eq(areas.ativo, true)) });
    if (!area) throw new ValidacaoError("Área inativa ou inexistente.", { areaId: "Escolha outra área." });
  }
  const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
  if (!ev) throw new NaoEncontradoError("Evento");
  const tipo = tipoSolicitacaoParaStatus(ev.status);
  if (!tipo) throw new DomainError("Este evento não está aceitando solicitações no momento.");
  if (tipo === "PRE_REUNIAO") await verificarJanelaPreReuniao(tx, ev);
  const codigo = await proximoCodigo(tx, "solicitacao");
  const [s] = await tx.insert(solicitacoes).values({ codigo, eventoId, areaId, tipo, status: "RASCUNHO", criadoPorId: usuario.id, atualizadoPorId: usuario.id }).returning();
  await registrarHistorico(tx, {
    eventoId,
    entidade: "solicitacao",
    entidadeId: s.id,
    acao: "RASCUNHO_CRIADO",
    descricao: `Rascunho ${s.codigo} criado — ${tipo === "PRE_REUNIAO" ? "necessidade pré-reunião" : "alteração pós-ata"}`,
    usuarioId: usuario.id,
  });
  return s;
}

export async function criarRascunho(usuario: UsuarioAtual, eventoId: string, areaId?: string | null) {
  const db = await getDb();
  return db.transaction((tx) => criarRascunhoTx(tx, usuario, eventoId, areaId));
}

/**
 * Rascunho que o usuário pode editar. Evento encerrado ou cancelado não aceita edição (o rascunho
 * fica preservado para consulta); excluir continua permitido.
 */
async function carregarEditavel(ex: Executor, usuario: UsuarioAtual, id: string, opcoes: { permitirEventoFechado?: boolean } = {}) {
  const s = await ex.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, id), eq(solicitacoes.excluida, false)), with: { evento: true, itens: true, area: true } });
  if (!s) throw new NaoEncontradoError("Solicitação");
  if (!podeEditarSolicitacao(usuario, s)) throw new SemPermissaoError("Só usuários da área da solicitação podem editá-la.");
  if (!podeEnviar(s.status)) throw new DomainError("Esta solicitação não está mais em rascunho.");
  if (!opcoes.permitirEventoFechado && (s.evento.status === "ENCERRADO" || s.evento.status === "CANCELADO")) {
    throw new DomainError(`O evento está ${s.evento.status === "CANCELADO" ? "cancelado" : "encerrado"} e não aceita mais alterações neste rascunho.`);
  }
  return s;
}

export async function atualizarCabecalho(usuario: UsuarioAtual, id: string, dados: { titulo: string | null; observacao: string | null }) {
  const db = await getDb();
  await carregarEditavel(db, usuario, id);
  await db.update(solicitacoes).set({ ...dados, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, id));
}

type DadosItem = ItemRascunho & { justificativa?: string | null };

/** Valida e resolve as referências de um item (projeto/peça/avulso/linha da ata). */
async function prepararItem(tx: Executor, s: { eventoId: string; tipo: "PRE_REUNIAO" | "ALTERACAO" }, dados: DadosItem) {
  validarItem(dados);
  if (s.tipo === "PRE_REUNIAO" && dados.operacao !== "ADICIONAR") throw new DomainError("Necessidades pré-reunião só podem adicionar itens.");
  const valores: Partial<typeof solicitacaoItens.$inferInsert> = {
    operacao: dados.operacao,
    quantidadeSolicitada: dados.operacao === "REMOVER" ? 0 : dados.quantidadeSolicitada,
    destino: dados.destino ?? null,
    justificativa: dados.justificativa ?? null,
    projetoId: null,
    projetoVersaoId: null,
    pecaId: null,
    descricaoLivre: null,
    eventoItemId: null,
    ajustesBom: null,
  };
  if (dados.operacao === "ADICIONAR") {
    if (dados.projetoId) {
      const p = await tx.query.projetos.findFirst({ where: eq(projetos.id, dados.projetoId) });
      if (!p || !p.ativo) throw new DomainError("Projeto padrão inativo ou inexistente.");
      const snap = await snapshotBom(tx, p.id);
      valores.projetoId = p.id;
      valores.projetoVersaoId = snap.versaoId;
      // Ajustes só sobre peças que fazem parte do projeto; o resultado nunca fica negativo.
      const ajustes: AjusteBom[] = [];
      for (const a of dados.ajustesBom ?? []) {
        if (!a.quantidade) continue;
        const linha = snap.bom.find((l) => l.pecaId === a.pecaId);
        if (!linha) throw new ValidacaoError("Só dá para ajustar peças que fazem parte do projeto.");
        if (linha.quantidade + a.quantidade < 0) throw new ValidacaoError(`${linha.nome}: o projeto tem ${linha.quantidade}; não dá para tirar ${Math.abs(a.quantidade)}.`);
        ajustes.push({ pecaId: linha.pecaId, codigo: linha.codigo, nome: linha.nome, quantidade: a.quantidade });
      }
      valores.ajustesBom = ajustes.length ? ajustes : null;
    } else if (dados.pecaId) {
      const pc = await tx.query.pecas.findFirst({ where: eq(pecas.id, dados.pecaId) });
      if (!pc || !pc.ativo) throw new DomainError("Peça inativa ou inexistente.");
      valores.pecaId = pc.id;
    } else {
      valores.descricaoLivre = (dados.descricaoLivre ?? "").trim();
    }
  } else {
    const linha = await tx.query.eventoItens.findFirst({
      where: and(eq(eventoItens.id, dados.eventoItemId ?? ""), eq(eventoItens.eventoId, s.eventoId), eq(eventoItens.ativo, true)),
    });
    if (!linha) throw new DomainError("A linha da ata escolhida não existe mais.");
    valores.eventoItemId = linha.id;
    if (dados.operacao === "ALTERAR_QUANTIDADE" && dados.quantidadeSolicitada === linha.quantidade) {
      throw new ValidacaoError("A nova quantidade é igual à atual.", { quantidadeSolicitada: "Informe uma quantidade diferente." });
    }
  }
  return valores as typeof solicitacaoItens.$inferInsert;
}

export async function salvarItem(usuario: UsuarioAtual, solicitacaoId: string, itemId: string | null, dados: DadosItem) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await carregarEditavel(tx, usuario, solicitacaoId);
    const valores = await prepararItem(tx, s, dados);
    if (itemId) {
      if (!s.itens.some((i) => i.id === itemId)) throw new NaoEncontradoError("Item");
      await tx.update(solicitacaoItens).set(valores).where(eq(solicitacaoItens.id, itemId));
    }
    const id = itemId ?? (await tx.insert(solicitacaoItens).values({ ...valores, solicitacaoId, ordem: s.itens.length }).returning())[0].id;
    await tx.update(solicitacoes).set({ atualizadoPorId: usuario.id, atualizadoEm: new Date() }).where(eq(solicitacoes.id, solicitacaoId));
    return id;
  });
}

export async function excluirRascunho(usuario: UsuarioAtual, id: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const s = await carregarEditavel(tx, usuario, id, { permitirEventoFechado: true });
    if (s.status !== "RASCUNHO") throw new DomainError("Só rascunhos podem ser excluídos. Use cancelar.");
    await tx.update(solicitacoes).set({ excluida: true }).where(eq(solicitacoes.id, id));
  });
}

export type DadosSolicitacaoCompleta = {
  id?: string | null;
  eventoId: string;
  /** Usado só quando quem cria é o Administrador. */
  areaId?: string | null;
  titulo: string | null;
  observacao: string | null;
  enviar: boolean;
  itens: DadosItem[];
};

export const MSG_TITULO_OBRIGATORIO = "Dê um título para a logística identificar a solicitação na fila.";

/**
 * Formulário único de solicitação (handoff §5.11): cria ou atualiza o rascunho com todos os
 * itens de uma vez (uma transação só: ou grava tudo, ou nada) e, se pedido, envia. Se o envio
 * falhar por regra do evento, o rascunho fica salvo e o erro volta em `erroEnvio`.
 */
export async function salvarSolicitacaoCompleta(usuario: UsuarioAtual, dados: DadosSolicitacaoCompleta): Promise<{ id: string; codigo: string; enviada: boolean; erroEnvio: string | null }> {
  exigir(usuario, "solicitacao.criar");
  if (dados.enviar) {
    const campos: Record<string, string> = {};
    if (!dados.titulo) campos.titulo = MSG_TITULO_OBRIGATORIO;
    if (dados.itens.length === 0) campos.itens = "Adicione ao menos um item.";
    if (Object.keys(campos).length) throw new ValidacaoError("Falta preencher antes de enviar.", campos);
  }
  dados.itens.forEach((i) => validarItem(i));

  const db = await getDb();
  const { id, codigo } = await db.transaction(async (tx) => {
    let s;
    if (dados.id) {
      s = await carregarEditavel(tx, usuario, dados.id);
      if (s.eventoId !== dados.eventoId) throw new DomainError("Para trocar de evento, exclua este rascunho e crie outro.");
    } else {
      const novo = await criarRascunhoTx(tx, usuario, dados.eventoId, dados.areaId);
      s = await carregarEditavel(tx, usuario, novo.id);
    }
    await tx
      .update(solicitacoes)
      .set({ titulo: dados.titulo, observacao: dados.observacao, atualizadoPorId: usuario.id, atualizadoEm: new Date() })
      .where(eq(solicitacoes.id, s.id));
    await tx.delete(solicitacaoItens).where(eq(solicitacaoItens.solicitacaoId, s.id));
    let ordem = 0;
    for (const item of dados.itens) {
      const valores = await prepararItem(tx, s, item);
      await tx.insert(solicitacaoItens).values({ ...valores, solicitacaoId: s.id, ordem: ordem++ });
    }
    return { id: s.id, codigo: s.codigo };
  });

  if (!dados.enviar) return { id, codigo, enviada: false, erroEnvio: null };
  try {
    await enviarSolicitacao(usuario, id);
    return { id, codigo, enviada: true, erroEnvio: null };
  } catch (e) {
    if (e instanceof DomainError) return { id, codigo, enviada: false, erroEnvio: e.message };
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Enviar / cancelar / devolver                                         */
/* ------------------------------------------------------------------ */

/**
 * Necessidade pré-reunião não passa por avaliação: cada item ainda em análise entra na ata como pedido,
 * e a logística confere e ajusta na reunião de OS. Usado no envio e na correção de dados antigos.
 * Retorna quantos itens entraram.
 */
export async function registrarPreReuniaoNaAta(tx: Executor, usuario: UsuarioAtual, solicitacaoId: string) {
  const pendentes = await tx
    .select({ id: solicitacaoItens.id })
    .from(solicitacaoItens)
    .where(and(eq(solicitacaoItens.solicitacaoId, solicitacaoId), eq(solicitacaoItens.status, "EM_ANALISE")))
    .orderBy(asc(solicitacaoItens.ordem));
  for (const item of pendentes) {
    await responderNaTransacao(tx, usuario, item.id, { status: "ATENDIDO" }, null, { gerarOs: false, notificar: false });
  }
  if (pendentes.length) {
    await tx
      .update(solicitacaoItens)
      .set({ respondidoPorId: null, observacaoLogistica: "Registrado na ata automaticamente; conferido pela logística na reunião de OS." })
      .where(inArray(solicitacaoItens.id, pendentes.map((p) => p.id)));
  }
  return pendentes.length;
}

/**
 * Correção de dados de antes da regra atual: pré-reuniões ainda "aguardando resposta" em eventos com a
 * ata aberta entram na ata do mesmo jeito que um envio novo. Idempotente (só pega itens em análise).
 */
export async function registrarPreReunioesPendentes() {
  const db = await getDb();
  const pendentes = await db
    .select({ id: solicitacoes.id, eventoId: solicitacoes.eventoId, responsavelId: eventos.responsavelId })
    .from(solicitacoes)
    .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
    .where(
      and(
        eq(solicitacoes.excluida, false),
        eq(solicitacoes.tipo, "PRE_REUNIAO"),
        inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]),
        inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO"]),
      ),
    );
  let itens = 0;
  for (const p of pendentes) {
    const resp = await db.query.usuarios.findFirst({ where: eq(usuarios.id, p.responsavelId), with: { area: true } });
    if (!resp) continue;
    const usuario: UsuarioAtual = { id: resp.id, nome: resp.nome, email: resp.email, perfil: resp.perfil, areaId: resp.areaId, areaNome: resp.area?.nome ?? null };
    itens += await db.transaction(async (tx) => {
      await bloquearEvento(tx, p.eventoId);
      return registrarPreReuniaoNaAta(tx, usuario, p.id);
    });
  }
  return { solicitacoes: pendentes.length, itens };
}

export async function enviarSolicitacao(usuario: UsuarioAtual, id: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const previa = await carregarEditavel(tx, usuario, id);
    // Trava o evento: um envio pré-reunião não pode entrar no meio do "Iniciar reunião"/"Fechar ata".
    await bloquearEvento(tx, previa.eventoId);
    const s = await carregarEditavel(tx, usuario, id);
    if (s.itens.length === 0) throw new DomainError("Adicione ao menos um item antes de enviar.");
    if (!s.titulo?.trim()) throw new ValidacaoError(MSG_TITULO_OBRIGATORIO, { titulo: MSG_TITULO_OBRIGATORIO });
    if (!aceitaSolicitacao(s.evento.status, s.tipo)) {
      const motivo =
        s.evento.status === "ENCERRADO"
          ? `O evento foi encerrado para alterações${s.evento.encerradoEm ? ` em ${formatarDataHora(s.evento.encerradoEm)}` : ""}. O rascunho foi preservado.`
          : "O evento não está aceitando este tipo de solicitação no momento. O rascunho foi preservado.";
      throw new DomainError(motivo);
    }
    if (s.tipo === "PRE_REUNIAO") await verificarJanelaPreReuniao(tx, s.evento);
    const cfg = await obterConfiguracoes(tx);
    const agora = new Date();
    // Pré-reunião é respondida na reunião de OS: o prazo é a própria reunião.
    // Alteração pós-ata tem o prazo padrão (48h) a partir do envio.
    const prazo =
      s.tipo === "PRE_REUNIAO" && s.evento.dataReuniao.getTime() > agora.getTime()
        ? s.evento.dataReuniao
        : new Date(agora.getTime() + Number(cfg.sla_resposta_horas) * 3_600_000);
    // Idempotente: só RASCUNHO/DEVOLVIDA → ENVIADA
    const res = await tx
      .update(solicitacoes)
      .set({ status: "ENVIADA", enviadaEm: agora, prazoRespostaEm: prazo, devolvidaMotivo: null, atualizadoPorId: usuario.id })
      .where(and(eq(solicitacoes.id, id), inArray(solicitacoes.status, ["RASCUNHO", "DEVOLVIDA"])))
      .returning({ id: solicitacoes.id });
    if (res.length === 0) throw new DomainError("A solicitação já foi enviada.");
    await tx.update(solicitacaoItens).set({ status: "EM_ANALISE" }).where(eq(solicitacaoItens.solicitacaoId, id));
    // Alteração enviada depois da janela que a logística definiu: entra, mas marcada para decisão.
    const foraDaJanela = s.tipo === "ALTERACAO" && Boolean(s.evento.janelaAlteracoesAte) && hojeISO() > String(s.evento.janelaAlteracoesAte);
    if (foraDaJanela) await tx.update(solicitacoes).set({ foraDaJanela: true }).where(eq(solicitacoes.id, id));
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao",
      entidadeId: id,
      acao: "ENVIADA",
      descricao: `${s.codigo} enviada pela ${s.area.nome}${usuario.perfil === "ADMIN" ? " (pelo administrador)" : ""} — ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}${foraDaJanela ? " · FORA DA JANELA de alterações" : ` · prazo ${formatarDataHora(prazo)}`}`,
      usuarioId: usuario.id,
    });

    // Antes da reunião não há avaliação: tudo entra na ata e a logística confere (e corrige) na reunião de OS.
    if (s.tipo === "PRE_REUNIAO") {
      await registrarPreReuniaoNaAta(tx, usuario, id);
      await notificar(tx, {
        usuarioIds: await usuariosLogistica(tx),
        tipo: "SOLICITACAO_ENVIADA",
        titulo: `Registrado na ata: ${s.codigo} · ${s.area.nome}`,
        mensagem: `${s.evento.nome} · ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}. Confira e ajuste na reunião de OS.`,
        link: `/solicitacoes/${id}`,
      });
      return { codigo: s.codigo, prazo, registradaNaAta: true, foraDaJanela: false };
    }

    await notificar(tx, {
      usuarioIds: await usuariosLogistica(tx),
      tipo: foraDaJanela ? "SOLICITACAO_FORA_JANELA" : "SOLICITACAO_ENVIADA",
      titulo: foraDaJanela ? `FORA DA JANELA: ${s.codigo} · ${s.area.nome}` : "Nova solicitação de alteração",
      mensagem: foraDaJanela
        ? `${s.evento.nome} · ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}. A janela de alterações terminou em ${diaMesISO(String(s.evento.janelaAlteracoesAte))}; a logística decide se atende.`
        : `${s.codigo} · ${s.area.nome} · ${s.evento.nome} · ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}`,
      link: `/solicitacoes/${id}`,
    });
    return { codigo: s.codigo, prazo, registradaNaAta: false, foraDaJanela };
  });
}

export async function cancelarSolicitacao(usuario: UsuarioAtual, id: string, motivo: string | null) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, id), eq(solicitacoes.excluida, false)), with: { itens: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    if (!podeEditarSolicitacao(usuario, s)) throw new SemPermissaoError();
    await bloquearEvento(tx, s.eventoId);
    const atual = await tx.query.solicitacaoItens.findMany({ where: eq(solicitacaoItens.solicitacaoId, id), columns: { status: true } });
    const algumRespondido = atual.some((i) => i.status !== "EM_ANALISE");
    if (!podeCancelar(s.status, algumRespondido)) throw new DomainError("A solicitação já começou a ser respondida e não pode mais ser cancelada.");
    await tx.update(solicitacoes).set({ status: "CANCELADA", canceladaEm: new Date(), canceladaMotivo: motivo, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, id));
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao",
      entidadeId: id,
      acao: "CANCELADA",
      descricao: `${s.codigo} cancelada pelo solicitante${motivo ? ` — ${motivo}` : ""}`,
      usuarioId: usuario.id,
    });
  });
}

export async function devolverSolicitacao(usuario: UsuarioAtual, id: string, motivo: string) {
  exigir(usuario, "solicitacao.responder");
  if (!motivo.trim()) throw new ValidacaoError("Informe o motivo da devolução.", { justificativa: "Obrigatório." });
  const db = await getDb();
  return db.transaction(async (tx) => {
    const previa = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, id), eq(solicitacoes.excluida, false)), columns: { eventoId: true } });
    if (!previa) throw new NaoEncontradoError("Solicitação");
    await bloquearEvento(tx, previa.eventoId);
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, id), with: { itens: true, evento: true, area: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    verificarFaseResposta(s);
    if (!podeDevolver(s.status, s.itens.some((i) => i.status !== "EM_ANALISE"))) throw new DomainError("Só solicitações enviadas e ainda sem resposta podem ser devolvidas.");
    await tx.update(solicitacoes).set({ status: "DEVOLVIDA", devolvidaMotivo: motivo, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, id));
    await registrarHistorico(tx, { eventoId: s.eventoId, entidade: "solicitacao", entidadeId: id, acao: "DEVOLVIDA", descricao: `${s.codigo} devolvida para ajuste — ${motivo}`, usuarioId: usuario.id });
    await notificar(tx, {
      usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
      tipo: "SOLICITACAO_DEVOLVIDA",
      titulo: `${s.codigo} devolvida para ajuste`,
      mensagem: `${s.area.nome} · ${motivo}`,
      link: `/solicitacoes/${id}`,
    });
  });
}

/* ------------------------------------------------------------------ */
/* Resposta por item (RN-03..RN-07)                                     */
/* ------------------------------------------------------------------ */

type Resposta = { status: ItemStatus; quantidadeAtendida?: number | null; observacaoLogistica?: string | null; pendenciaCompra?: boolean };
type ItemComStatus = typeof solicitacaoItens.$inferSelect;

/**
 * Aplica na linha da ata a mudança de estado de um item (resposta, correção ou desfazer = EM_ANALISE).
 * A regra está em `calcularEfeitoLinha` (domínio): só a diferença é aplicada, e linha removida por
 * outra ação não volta.
 */
async function aplicarEfeito(tx: Executor, usuario: UsuarioAtual, s: { eventoId: string; areaId: string }, item: ItemComStatus, novo: { status: ItemStatus; quantidadeAtendida: number | null }) {
  const idLinha = item.operacao === "ADICIONAR" ? item.eventoItemGeradoId : item.eventoItemId;
  const linha = idLinha ? await tx.query.eventoItens.findFirst({ where: eq(eventoItens.id, idLinha) }) : null;
  const efeito = calcularEfeitoLinha(item, novo, linha ? { ativo: linha.ativo, quantidade: linha.quantidade } : null);

  if (efeito.acao === "criar") {
    const base = { eventoId: s.eventoId, quantidade: efeito.quantidade, destino: item.destino, areaId: s.areaId, origem: "SOLICITACAO" as const, solicitacaoItemId: item.id, criadoPorId: usuario.id };
    let valores: typeof eventoItens.$inferInsert;
    if (item.projetoId) {
      const snap = await snapshotBom(tx, item.projetoId);
      valores = { ...base, tipo: "PROJETO", projetoId: item.projetoId, projetoVersaoId: snap.versaoId, bomSnapshot: aplicarAjustesBom(snap.bom, item.ajustesBom) };
    } else if (item.pecaId) {
      valores = { ...base, tipo: "PECA", pecaId: item.pecaId };
    } else {
      valores = { ...base, tipo: "AVULSO", descricaoLivre: item.descricaoLivre };
    }
    const [nova] = await tx.insert(eventoItens).values(valores).returning({ id: eventoItens.id });
    return { eventoItemGeradoId: nova.id, quantidadeAnterior: null };
  }
  if (efeito.acao === "atualizar" && linha) {
    await tx
      .update(eventoItens)
      .set(efeito.ativo ? { ativo: true, quantidade: efeito.quantidade, removidoEm: null, removidoPorId: null } : { ativo: false, removidoEm: new Date(), removidoPorId: usuario.id })
      .where(eq(eventoItens.id, linha.id));
  }
  return { eventoItemGeradoId: item.operacao === "ADICIONAR" ? item.eventoItemGeradoId : (item.eventoItemId ?? null), quantidadeAnterior: efeito.quantidadeAnterior };
}

function verificarFaseResposta(s: { tipo: "PRE_REUNIAO" | "ALTERACAO"; evento: { status: (typeof eventos.$inferSelect)["status"] } }) {
  if (podeResponderNaFase(s.tipo, s.evento.status)) return;
  throw new DomainError(s.tipo === "PRE_REUNIAO" ? "Necessidades pré-reunião só podem ser respondidas antes de fechar a ata." : "O evento não está aberto a alterações.");
}

/** Evento de um item, lido antes da trava. */
async function eventoDoItem(tx: Executor, itemId: string) {
  const [r] = await tx
    .select({ eventoId: solicitacoes.eventoId })
    .from(solicitacaoItens)
    .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
    .where(eq(solicitacaoItens.id, itemId))
    .limit(1);
  if (!r) throw new NaoEncontradoError("Item");
  return r.eventoId;
}

/** Responde um item dentro de uma transação que já travou o evento. */
export async function responderNaTransacao(tx: Executor, usuario: UsuarioAtual, itemId: string, resposta: Resposta, justificativaCorrecao: string | null | undefined, opcoes: { gerarOs: boolean; notificar: boolean }) {
  const item = await tx.query.solicitacaoItens.findFirst({
    where: eq(solicitacaoItens.id, itemId),
    with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } } },
  });
  if (!item) throw new NaoEncontradoError("Item");
  const s = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, item.solicitacaoId), eq(solicitacoes.excluida, false)), with: { evento: true, itens: true } });
  if (!s) throw new NaoEncontradoError("Solicitação");

  const correcao = item.status !== "EM_ANALISE";
  if (correcao) {
    if (!podeCorrigirResposta(s.status) && s.status !== "EM_ANALISE") throw new DomainError("Este item não pode ser corrigido.");
    if (!justificativaCorrecao?.trim()) throw new ValidacaoError("Este item já foi respondido. Para corrigir, informe a justificativa.", { justificativa: "Obrigatória para corrigir uma resposta." });
  } else if (!podeResponder(s.status)) {
    throw new DomainError("A solicitação não está aguardando resposta.");
  }
  verificarFaseResposta(s);

  const r = validarResposta(item, resposta);
  const efeito = await aplicarEfeito(tx, usuario, s, item, r);
  await tx
    .update(solicitacaoItens)
    .set({
      status: r.status,
      quantidadeAtendida: r.quantidadeAtendida,
      observacaoLogistica: r.observacaoLogistica,
      pendenciaCompra: r.pendenciaCompra,
      respondidoPorId: usuario.id,
      respondidoEm: new Date(),
      eventoItemGeradoId: efeito.eventoItemGeradoId,
      quantidadeAnterior: efeito.quantidadeAnterior,
    })
    .where(eq(solicitacaoItens.id, itemId));

  const novoStatus = statusAposResposta(s.itens.map((i) => (i.id === itemId ? { status: r.status } : { status: i.status })));
  await tx
    .update(solicitacoes)
    .set({ status: novoStatus, respondidaEm: novoStatus === "RESPONDIDA" ? new Date() : null, atualizadoPorId: usuario.id })
    .where(eq(solicitacoes.id, s.id));

  const desc = descricaoItem(item);
  await registrarHistorico(tx, {
    eventoId: s.eventoId,
    entidade: "solicitacao_item",
    entidadeId: itemId,
    acao: correcao ? "RESPOSTA_CORRIGIDA" : "RESPONDIDO",
    descricao: `${s.codigo} · ${desc}: ${ITEM_STATUS_LABEL[r.status].toLowerCase()} (${r.quantidadeAtendida} de ${item.quantidadeSolicitada})${
      r.observacaoLogistica || correcao ? ` — ${[r.observacaoLogistica, correcao ? `correção: ${justificativaCorrecao}` : null].filter(Boolean).join(" · ")}` : ""
    }`,
    usuarioId: usuario.id,
    dadosAntes: correcao ? { status: item.status, quantidadeAtendida: item.quantidadeAtendida, observacaoLogistica: item.observacaoLogistica } : null,
    dadosDepois: r,
  });

  if (opcoes.gerarOs && s.tipo === "ALTERACAO") {
    await gerarOsVersao(tx, s.eventoId, correcao ? "CORRECAO_RESPOSTA" : "RESPOSTA_SOLICITACAO", usuario.id, `${s.codigo} · ${desc} — ${ITEM_STATUS_LABEL[r.status].toLowerCase()}`);
  }
  if (opcoes.notificar) {
    // RN-07: solicitante notificado item a item
    await notificar(tx, {
      usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
      tipo: "ITEM_RESPONDIDO",
      titulo: `${s.codigo}: ${desc} — ${ITEM_STATUS_LABEL[r.status].toLowerCase()}`,
      mensagem:
        r.status === "ATENDIDO"
          ? `Atendido integralmente (${r.quantidadeAtendida}).`
          : `${r.quantidadeAtendida} de ${item.quantidadeSolicitada}. ${r.observacaoLogistica}${correcao ? " (resposta corrigida)" : ""}`,
      link: `/solicitacoes/${s.id}`,
    });
  }
  return { status: novoStatus, codigo: s.codigo, descricao: desc, podeDesfazer: !correcao, solicitacaoId: s.id, eventoId: s.eventoId, tipo: s.tipo, criadoPorId: s.criadoPorId, areaId: s.areaId };
}

export async function responderItem(usuario: UsuarioAtual, itemId: string, resposta: Resposta, justificativaCorrecao?: string | null) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, await eventoDoItem(tx, itemId));
    const r = await responderNaTransacao(tx, usuario, itemId, resposta, justificativaCorrecao, { gerarOs: true, notificar: true });
    return { status: r.status, codigo: r.codigo, descricao: r.descricao, podeDesfazer: r.podeDesfazer, solicitacaoId: r.solicitacaoId, eventoId: r.eventoId };
  });
}

/**
 * "Atender tudo": responde como atendido todos os itens ainda em análise, numa transação só
 * (ou todos, ou nenhum), com uma única versão de OS e um único aviso para a área.
 */
export async function atenderTudo(usuario: UsuarioAtual, solicitacaoId: string) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, solicitacaoId), eq(solicitacoes.excluida, false)), columns: { eventoId: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    await bloquearEvento(tx, s.eventoId);
    const pendentes = await tx
      .select({ id: solicitacaoItens.id })
      .from(solicitacaoItens)
      .where(and(eq(solicitacaoItens.solicitacaoId, solicitacaoId), eq(solicitacaoItens.status, "EM_ANALISE")))
      .orderBy(asc(solicitacaoItens.ordem));
    if (!pendentes.length) throw new DomainError("Todos os itens já foram respondidos.");
    let ultimo: Awaited<ReturnType<typeof responderNaTransacao>> | null = null;
    for (const i of pendentes) ultimo = await responderNaTransacao(tx, usuario, i.id, { status: "ATENDIDO" }, null, { gerarOs: false, notificar: false });
    if (!ultimo) return 0;
    const n = pendentes.length;
    if (ultimo.tipo === "ALTERACAO") {
      await gerarOsVersao(tx, ultimo.eventoId, "RESPOSTA_SOLICITACAO", usuario.id, `${ultimo.codigo} · ${n} ${n === 1 ? "item atendido" : "itens atendidos"}`);
    }
    await notificar(tx, {
      usuarioIds: [ultimo.criadoPorId, ...(await usuariosDaArea(tx, ultimo.areaId))],
      tipo: "ITEM_RESPONDIDO",
      titulo: `${ultimo.codigo}: ${n} ${n === 1 ? "item atendido" : "itens atendidos"}`,
      mensagem: "A logística atendeu integralmente os itens que estavam em análise.",
      link: `/solicitacoes/${ultimo.solicitacaoId}`,
    });
    return n;
  });
}

/**
 * Desfaz a primeira resposta a um item (toast "Desfazer"): só o autor, dentro da janela,
 * e só quando a última ação sobre o item foi essa resposta. Correções não são desfeitas
 * por aqui — use "Corrigir".
 */
export async function desfazerResposta(usuario: UsuarioAtual, itemId: string) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, await eventoDoItem(tx, itemId));
    const item = await tx.query.solicitacaoItens.findFirst({
      where: eq(solicitacaoItens.id, itemId),
      with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } } },
    });
    if (!item) throw new NaoEncontradoError("Item");
    const [ultimo] = await tx
      .select({ acao: historico.acao, usuarioId: historico.usuarioId, criadoEm: historico.criadoEm })
      .from(historico)
      .where(and(eq(historico.entidade, "solicitacao_item"), eq(historico.entidadeId, itemId)))
      .orderBy(desc(historico.criadoEm))
      .limit(1);
    if (item.status === "EM_ANALISE" || !ultimo || ultimo.acao !== "RESPONDIDO" || ultimo.usuarioId !== usuario.id || Date.now() - ultimo.criadoEm.getTime() > JANELA_DESFAZER_MS) {
      throw new DomainError("Esta resposta não pode mais ser desfeita. Use “Corrigir”.");
    }
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, item.solicitacaoId), with: { evento: true, itens: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    verificarFaseResposta(s);

    const efeito = await aplicarEfeito(tx, usuario, s, item, { status: "EM_ANALISE", quantidadeAtendida: null });
    await tx
      .update(solicitacaoItens)
      .set({ status: "EM_ANALISE", quantidadeAtendida: null, observacaoLogistica: null, pendenciaCompra: false, respondidoPorId: null, respondidoEm: null, quantidadeAnterior: efeito.quantidadeAnterior })
      .where(eq(solicitacaoItens.id, itemId));
    const novoStatus = statusAposResposta(s.itens.map((i) => (i.id === itemId ? { status: "EM_ANALISE" as const } : { status: i.status })));
    await tx.update(solicitacoes).set({ status: novoStatus, respondidaEm: null, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, s.id));

    const descricao = descricaoItem(item);
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao_item",
      entidadeId: itemId,
      acao: "RESPOSTA_DESFEITA",
      descricao: `${s.codigo} · ${descricao}: resposta desfeita — voltou para análise`,
      usuarioId: usuario.id,
    });
    if (s.tipo === "ALTERACAO") await gerarOsVersao(tx, s.eventoId, "CORRECAO_RESPOSTA", usuario.id, `${s.codigo} · ${descricao} — resposta desfeita`);
    await notificar(tx, {
      usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
      tipo: "ITEM_RESPONDIDO",
      titulo: `${s.codigo}: ${descricao} voltou para análise`,
      mensagem: "A logística desfez a resposta anterior. Uma nova resposta será enviada.",
      link: `/solicitacoes/${s.id}`,
    });
    return { codigo: s.codigo, descricao };
  });
}

/* ------------------------------------------------------------------ */
/* Pendências de compra/locação (RV-11)                                 */
/* ------------------------------------------------------------------ */

export async function listarPendenciasCompra(usuario: UsuarioAtual) {
  exigir(usuario, "pendencias.ver");
  const db = await getDb();
  const rows = await db.query.solicitacaoItens.findMany({
    where: eq(solicitacaoItens.pendenciaCompra, true),
    with: {
      solicitacao: { with: { evento: { columns: { id: true, codigo: true, nome: true, status: true, dataMontagem: true } }, area: true } },
      projeto: true,
      peca: true,
      eventoItem: { with: { projeto: true, peca: true } },
    },
    orderBy: [desc(solicitacaoItens.respondidoEm)],
  });
  return rows
    .filter((r) => !r.solicitacao.excluida && r.solicitacao.evento.status !== "CANCELADO")
    .map((r) => ({ ...r, descricao: descricaoItem(r), faltante: r.quantidadeSolicitada - (r.quantidadeAtendida ?? 0) }));
}
