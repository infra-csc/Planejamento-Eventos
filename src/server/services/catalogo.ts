import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { pecas, projetoItens, projetoVersoes, projetos, type Setor } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { registrarHistorico, buscaSemAcento } from "./support";

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

export async function listarPecas(usuario: UsuarioAtual, filtro: { busca?: string; setor?: Setor | "TODOS"; incluirInativas?: boolean } = {}) {
  exigir(usuario, "catalogo.ver");
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

async function validarCodigoUnico(id: string | null, codigo: string) {
  const db = await getDb();
  const [dup] = await db
    .select({ id: pecas.id })
    .from(pecas)
    .where(sql`upper(${pecas.codigo}) = ${codigo.toUpperCase()}`)
    .limit(1);
  if (dup && dup.id !== id) throw new ValidacaoError("Já existe uma peça com este código.", { codigo: "Código em uso." });
}

export async function criarPeca(usuario: UsuarioAtual, dados: DadosPeca) {
  exigir(usuario, "catalogo.gerenciar");
  await validarCodigoUnico(null, dados.codigo);
  const db = await getDb();
  const [p] = await db.insert(pecas).values({ ...dados, criadoPorId: usuario.id }).returning();
  await registrarHistorico(db, { entidade: "peca", entidadeId: p.id, acao: "CRIADA", descricao: `Peça ${p.codigo} · ${p.nome} criada.`, usuarioId: usuario.id, dadosDepois: dados });
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

/** Em quantos projetos ativos (versão atual) cada peça aparece — coluna "Em BOM" do catálogo. */
export async function contarPecasEmBom() {
  const db = await getDb();
  const rows = await db
    .select({ pecaId: projetoItens.pecaId })
    .from(projetoItens)
    .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
    .innerJoin(projetos, and(eq(projetoVersoes.projetoId, projetos.id), eq(projetoVersoes.numero, projetos.versaoAtual)))
    .where(eq(projetos.ativo, true));
  const mapa = new Map<string, number>();
  for (const r of rows) mapa.set(r.pecaId, (mapa.get(r.pecaId) ?? 0) + 1);
  return mapa;
}
