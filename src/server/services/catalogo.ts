import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, pecas, projetoItens, projetoVersoes, projetos, solicitacaoItens, solicitacoes, type Setor } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { registrarHistorico, buscaSemAcento, type Executor } from "./support";
import { cacheDados, TAGS_DADOS } from "@/server/cache-dados";
import { STATUS_ABERTOS, STATUS_EDITAVEIS } from "@/domain/solicitacao";

export type DadosPeca = {
  codigo: string;
  nome: string;
  setor: Setor;
  familia: string;
  unidade: string;
  descricao: string | null;
  estoqueProprio: number;
  permiteEmProjeto: boolean;
};

type FiltroPecas = { busca?: string; setor?: Setor | "TODOS"; incluirInativas?: boolean };

async function consultarPecas(filtro: FiltroPecas) {
  const db = await getDb();
  const conds = [];
  if (!filtro.incluirInativas) conds.push(eq(pecas.ativo, true));
  if (filtro.setor && filtro.setor !== "TODOS") conds.push(eq(pecas.setor, filtro.setor));
  if (filtro.busca) {
    const cond = buscaSemAcento([pecas.codigo, pecas.nome, pecas.familia], filtro.busca);
    if (cond) conds.push(cond);
  }
  return db.query.pecas.findMany({ where: conds.length ? and(...conds) : undefined, orderBy: [asc(pecas.setor), asc(pecas.codigo)] });
}

/** Catálogo sem busca (a lista que quase toda tela pede): em cache até uma action mexer nas peças. */
const pecasEmCache = cacheDados(
  (setor: Setor | "TODOS" | null, incluirInativas: boolean) => consultarPecas({ setor: setor ?? undefined, incluirInativas }),
  "catalogo:pecas",
  [TAGS_DADOS.catalogo],
);

export async function listarPecas(usuario: UsuarioAtual, filtro: FiltroPecas = {}) {
  exigir(usuario, "catalogo.ver");
  // Busca livre vai sempre ao banco (cada termo viraria uma entrada de cache).
  if (filtro.busca) return consultarPecas(filtro);
  return pecasEmCache(filtro.setor ?? null, Boolean(filtro.incluirInativas));
}

export async function obterPeca(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "catalogo.ver");
  const db = await getDb();
  const p = await db.query.pecas.findFirst({ where: eq(pecas.id, id) });
  if (!p) throw new NaoEncontradoError("Peça");
  // projetos ativos que usam a peça (na versão atual)
  const usos = await db
    .select({ id: projetos.id, nome: projetos.nome, codigo: projetos.codigo, quantidade: projetoItens.quantidade })
    .from(projetoItens)
    .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
    .innerJoin(projetos, and(eq(projetoVersoes.projetoId, projetos.id), eq(projetoVersoes.numero, projetos.versaoAtual)))
    .where(and(eq(projetoItens.pecaId, id), eq(projetos.ativo, true)));
  return { ...p, usos };
}

async function validarCodigoUnico(id: string | null, codigo: string, ex?: Executor) {
  const db = ex ?? (await getDb());
  const [dup] = await db
    .select({ id: pecas.id })
    .from(pecas)
    .where(sql`upper(${pecas.codigo}) = ${codigo.toUpperCase()}`)
    .limit(1);
  if (dup && dup.id !== id) throw new ValidacaoError("Já existe uma peça com este código.", { codigo: "Código em uso." });
}

export async function criarPeca(usuario: UsuarioAtual, dados: DadosPeca) {
  const db = await getDb();
  return db.transaction((tx) => criarPecaNaTransacao(tx, usuario, dados));
}

/** Cadastra a peça dentro de uma transação já aberta (ex.: vincular item fora do catálogo a uma peça nova). */
export async function criarPecaNaTransacao(ex: Executor, usuario: UsuarioAtual, dados: DadosPeca) {
  exigir(usuario, "catalogo.gerenciar");
  await validarCodigoUnico(null, dados.codigo, ex);
  const [p] = await ex.insert(pecas).values({ ...dados, criadoPorId: usuario.id }).returning();
  await registrarHistorico(ex, { entidade: "peca", entidadeId: p.id, acao: "CRIADA", descricao: `Peça ${p.codigo} · ${p.nome} criada.`, usuarioId: usuario.id, dadosDepois: dados });
  return p;
}

export async function editarPeca(usuario: UsuarioAtual, id: string, dados: DadosPeca) {
  exigir(usuario, "catalogo.gerenciar");
  await validarCodigoUnico(id, dados.codigo);
  const db = await getDb();
  const atual = await db.query.pecas.findFirst({ where: eq(pecas.id, id) });
  if (!atual) throw new NaoEncontradoError("Peça");
  const [p] = await db.update(pecas).set(dados).where(eq(pecas.id, id)).returning();
  const antes: Partial<DadosPeca> = {};
  const depois: Partial<DadosPeca> = {};
  for (const k of Object.keys(dados) as (keyof DadosPeca)[]) {
    if (atual[k] !== dados[k]) {
      (antes as Record<string, unknown>)[k] = atual[k];
      (depois as Record<string, unknown>)[k] = dados[k];
    }
  }
  if (Object.keys(depois).length) {
    await registrarHistorico(db, { entidade: "peca", entidadeId: id, acao: "EDITADA", descricao: `Peça ${p.codigo} alterada (${Object.keys(depois).join(", ")}).`, usuarioId: usuario.id, dadosAntes: antes, dadosDepois: depois });
  }
  return p;
}

export async function alterarAtivoPeca(usuario: UsuarioAtual, id: string, ativo: boolean) {
  exigir(usuario, "catalogo.gerenciar");
  const peca = await obterPeca(usuario, id);
  if (!ativo && peca.usos.length > 0) {
    throw new DomainError(`A peça está no BOM de ${peca.usos.length} projeto(s) ativo(s): ${peca.usos.map((u) => u.nome).join(", ")}. Remova-a dos projetos antes de inativar.`);
  }
  const db = await getDb();
  await db.update(pecas).set({ ativo }).where(eq(pecas.id, id));
  await registrarHistorico(db, { entidade: "peca", entidadeId: id, acao: ativo ? "REATIVADA" : "INATIVADA", descricao: `Peça ${peca.codigo} ${ativo ? "reativada" : "inativada"}.`, usuarioId: usuario.id });
}

/**
 * O que a inativação da peça atinge, para a tela confirmar antes: projetos ativos que a usam na versão
 * atual (bloqueiam — regra de `alterarAtivoPeca`) e pedidos em aberto que a citam (só aviso: solicitações
 * ainda não respondidas e atas de eventos em andamento). O que já foi pedido continua valendo; a peça só
 * deixa de aparecer nas escolhas novas.
 */
export async function impactoInativacaoPeca(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "catalogo.gerenciar");
  const peca = await obterPeca(usuario, id);
  const db = await getDb();
  const [sols, atas] = await Promise.all([
    db
      .selectDistinct({ id: solicitacoes.id, codigo: solicitacoes.codigo, status: solicitacoes.status, eventoNome: eventos.nome })
      .from(solicitacaoItens)
      .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
      .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
      .where(and(eq(solicitacaoItens.pecaId, id), eq(solicitacoes.excluida, false), inArray(solicitacoes.status, [...STATUS_EDITAVEIS, ...STATUS_ABERTOS]), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"])))
      .orderBy(asc(solicitacoes.codigo)),
    db
      .selectDistinct({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome })
      .from(eventoItens)
      .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
      .where(and(eq(eventoItens.pecaId, id), eq(eventoItens.tipo, "PECA"), eq(eventoItens.ativo, true), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"])))
      .orderBy(asc(eventos.codigo)),
  ]);
  const pedidos = [
    ...atas.map((e) => ({ href: `/eventos/${e.id}/ata`, rotulo: `${e.codigo} · ${e.nome}`, detalhe: "na ata do evento" })),
    ...sols.map((s) => ({ href: `/solicitacoes/${s.id}`, rotulo: `${s.codigo} · ${s.eventoNome}`, detalhe: s.status === "RASCUNHO" ? "rascunho" : s.status === "DEVOLVIDA" ? "devolvida para ajuste" : "aguardando resposta" })),
  ];
  return {
    peca: { id: peca.id, codigo: peca.codigo, nome: peca.nome, ativo: peca.ativo },
    projetos: peca.usos.map((u) => ({ href: `/biblioteca?p=${u.id}`, rotulo: `${u.codigo} · ${u.nome}`, detalhe: `${u.quantidade} por unidade` })),
    pedidos,
  };
}

export type ImpactoInativacaoPeca = Awaited<ReturnType<typeof impactoInativacaoPeca>>;

/** Em quantos projetos ativos (versão atual) cada peça aparece — coluna "Em BOM" do catálogo. */
const pecasEmBomEmCache = cacheDados(
  async () => {
    const db = await getDb();
    return db
      .select({ pecaId: projetoItens.pecaId })
      .from(projetoItens)
      .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
      .innerJoin(projetos, and(eq(projetoVersoes.projetoId, projetos.id), eq(projetoVersoes.numero, projetos.versaoAtual)))
      .where(eq(projetos.ativo, true));
  },
  "catalogo:pecas-em-bom",
  [TAGS_DADOS.projetos],
);

export async function contarPecasEmBom() {
  const rows = await pecasEmBomEmCache();
  const mapa = new Map<string, number>();
  for (const r of rows) mapa.set(r.pecaId, (mapa.get(r.pecaId) ?? 0) + 1);
  return mapa;
}
