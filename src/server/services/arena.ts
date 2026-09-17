import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { arenaPosicoes, usuarios } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { CATEGORIAS } from "@/domain/arena/categorias";
import type { PosicaoEditada } from "@/domain/arena/posicoes";
import { registrarHistorico } from "./support";

export async function listarPosicoesArena(slug: string): Promise<PosicaoEditada[]> {
  const db = await getDb();
  const rows = await db
    .select({
      chave: arenaPosicoes.chave,
      tipo: arenaPosicoes.tipo,
      nome: arenaPosicoes.nome,
      categoria: arenaPosicoes.categoria,
      rotuloTipo: arenaPosicoes.rotuloTipo,
      itemAta: arenaPosicoes.itemAta,
      x: arenaPosicoes.x,
      z: arenaPosicoes.z,
      atualizadoPor: usuarios.nome,
      atualizadoEm: arenaPosicoes.atualizadoEm,
    })
    .from(arenaPosicoes)
    .leftJoin(usuarios, eq(arenaPosicoes.atualizadoPorId, usuarios.id))
    .where(eq(arenaPosicoes.arenaSlug, slug));
  return rows.map((r) => ({ ...r, atualizadoEm: r.atualizadoEm.toISOString() }));
}

export type DadosPosicao = {
  chave: string;
  tipo: "MOVER" | "NOVO";
  x: number;
  z: number;
  nome?: string | null;
  categoria?: string | null;
  itemAta?: string | null;
};

const LIMITE = 5000; // metros a partir do marco: bem além de qualquer planta

/** Salva (cria ou substitui) a posição de um ponto da arena. Logística e administrador. */
export async function salvarPosicaoArena(usuario: UsuarioAtual, slug: string, dados: DadosPosicao) {
  exigir(usuario, "ata.consolidar");
  if (!dados.chave?.trim() || (dados.tipo !== "MOVER" && dados.tipo !== "NOVO")) throw new ValidacaoError("Ponto inválido.");
  if (![dados.x, dados.z].every((n) => Number.isFinite(n) && Math.abs(n) <= LIMITE)) throw new ValidacaoError("Posição fora da área do mapa.");
  if (dados.tipo === "NOVO" && !dados.nome?.trim()) throw new ValidacaoError("Informe o nome do item.");
  if (dados.categoria && !(dados.categoria in CATEGORIAS)) throw new ValidacaoError("Categoria inválida.");
  const db = await getDb();
  const valores = {
    arenaSlug: slug,
    chave: dados.chave,
    tipo: dados.tipo,
    nome: dados.nome?.trim() || null,
    categoria: dados.categoria ?? null,
    rotuloTipo: null,
    itemAta: dados.itemAta ?? null,
    x: Math.round(dados.x * 10) / 10,
    z: Math.round(dados.z * 10) / 10,
    atualizadoPorId: usuario.id,
    atualizadoEm: new Date(),
  };
  await db
    .insert(arenaPosicoes)
    .values(valores)
    .onConflictDoUpdate({
      target: [arenaPosicoes.arenaSlug, arenaPosicoes.chave],
      set: { x: valores.x, z: valores.z, atualizadoPorId: usuario.id, atualizadoEm: valores.atualizadoEm, ...(dados.categoria ? { categoria: dados.categoria } : {}), ...(valores.nome ? { nome: valores.nome } : {}) },
    });
  await registrarHistorico(db, {
    entidade: "arena",
    entidadeId: `${slug}:${dados.chave}`,
    acao: dados.tipo === "NOVO" ? "ARENA_POSICIONADO" : "ARENA_MOVIDO",
    descricao: `${dados.tipo === "NOVO" ? `“${dados.nome}” posicionado` : `“${dados.nome ?? dados.chave}” ajustado`} na Arena 3D (${valores.x}, ${valores.z})${dados.categoria ? ` · categoria ${dados.categoria}` : ""}`,
    usuarioId: usuario.id,
    dadosDepois: valores,
  });
}

/** Desfaz a edição: ponto movido volta ao lugar da planta; ponto novo volta para "sem posição". */
export async function removerPosicaoArena(usuario: UsuarioAtual, slug: string, chave: string) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  const [r] = await db.delete(arenaPosicoes).where(and(eq(arenaPosicoes.arenaSlug, slug), eq(arenaPosicoes.chave, chave))).returning({ tipo: arenaPosicoes.tipo, nome: arenaPosicoes.nome });
  if (!r) throw new NaoEncontradoError("Posição editada");
  await registrarHistorico(db, {
    entidade: "arena",
    entidadeId: `${slug}:${chave}`,
    acao: "ARENA_POSICAO_DESFEITA",
    descricao: r.tipo === "NOVO" ? `“${r.nome}” voltou para sem posição na Arena 3D` : `Ponto ${chave} voltou à posição da planta`,
    usuarioId: usuario.id,
  });
}
