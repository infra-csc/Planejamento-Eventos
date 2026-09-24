import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { anexos, pecas, projetoItens, projetoVersoes, projetos } from "@/server/db/schema";
import { cacheDados, TAGS_DADOS } from "@/server/cache-dados";

/* ------------------------------------------------------------------ */
/* Consultas auxiliares para formulários                                */
/* ------------------------------------------------------------------ */

/*
 * Projetos e peças para os formulários mudam só pelas telas de catálogo e projetos: ficam em cache
 * (cache-dados.ts) e as actions dessas telas invalidam as tags.
 */
const REFERENCIAS_TAGS = [TAGS_DADOS.catalogo, TAGS_DADOS.projetos];
const referenciasResumidasEmCache = cacheDados(consultarOpcoesReferenciasResumidas, "eventos:referencias-resumidas", REFERENCIAS_TAGS);
const referenciasEmCache = cacheDados(consultarOpcoesReferencias, "eventos:referencias:v2", REFERENCIAS_TAGS);

/** Só o que o formulário "Incluir linha na ata" usa: nome/código de projetos e peças, sem listas de peças nem imagens. */
export async function opcoesReferenciasResumidas() {
  return referenciasResumidasEmCache();
}

/** Projetos com a lista de peças da versão atual, peças ativas e capas (formulário de solicitação). */
export async function opcoesReferencias() {
  return referenciasEmCache();
}

async function consultarOpcoesReferenciasResumidas() {
  const db = await getDb();
  const [proj, pcs] = await Promise.all([
    db.select({ id: projetos.id, codigo: projetos.codigo, nome: projetos.nome, categoria: projetos.categoria, versaoAtual: projetos.versaoAtual }).from(projetos).where(and(eq(projetos.ativo, true), eq(projetos.disponivelEmSolicitacoes, true))).orderBy(asc(projetos.nome)),
    db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome, setor: pecas.setor, unidade: pecas.unidade }).from(pecas).where(and(eq(pecas.ativo, true), eq(pecas.disponivelEmSolicitacoes, true))).orderBy(asc(pecas.codigo)),
  ]);
  return { projetos: proj, pecas: pcs };
}

async function consultarOpcoesReferencias() {
  const db = await getDb();
  // Só a versão atual de cada projeto ativo e disponível para solicitação (os únicos que aparecem na resposta), filtrada no banco.
  const versaoAtualAtiva = and(eq(projetos.id, projetoVersoes.projetoId), eq(projetos.versaoAtual, projetoVersoes.numero), eq(projetos.ativo, true), eq(projetos.disponivelEmSolicitacoes, true));
  const [proj, pcs, totais, linhasBom, capas] = await Promise.all([
    db
      .select({ id: projetos.id, codigo: projetos.codigo, nome: projetos.nome, categoria: projetos.categoria, descricao: projetos.descricao, versaoAtual: projetos.versaoAtual })
      .from(projetos)
      .where(and(eq(projetos.ativo, true), eq(projetos.disponivelEmSolicitacoes, true)))
      .orderBy(asc(projetos.nome)),
    db
      .select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome, setor: pecas.setor, unidade: pecas.unidade, familia: pecas.familia, estoqueProprio: pecas.estoqueProprio })
      .from(pecas)
      .where(and(eq(pecas.ativo, true), eq(pecas.disponivelEmSolicitacoes, true)))
      .orderBy(asc(pecas.codigo)),
    db
      .select({ projetoId: projetoVersoes.projetoId, total: sql<number>`coalesce(sum(${projetoItens.quantidade}), 0)` })
      .from(projetoVersoes)
      .innerJoin(projetos, versaoAtualAtiva)
      .leftJoin(projetoItens, eq(projetoItens.versaoId, projetoVersoes.id))
      .groupBy(projetoVersoes.projetoId),
    // Lista de peças da versão atual de cada projeto: o solicitante pode ajustar unidades por peça.
    db
      .select({ projetoId: projetoVersoes.projetoId, pecaId: pecas.id, codigo: pecas.codigo, nome: pecas.nome, unidade: pecas.unidade, quantidade: projetoItens.quantidade })
      .from(projetoItens)
      .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
      .innerJoin(projetos, versaoAtualAtiva)
      .innerJoin(pecas, eq(projetoItens.pecaId, pecas.id))
      .orderBy(asc(pecas.codigo)),
    // Primeira imagem de cada projeto (miniatura na escolha do requisitante).
    db
      .select({ projetoId: anexos.projetoId, id: anexos.id })
      .from(anexos)
      .innerJoin(projetos, and(eq(projetos.id, anexos.projetoId), eq(projetos.ativo, true), eq(projetos.disponivelEmSolicitacoes, true)))
      .where(eq(anexos.tipo, "IMAGEM"))
      .orderBy(asc(anexos.criadoEm)),
  ]);
  const capaDe = new Map<string, string>();
  for (const c of capas) if (!capaDe.has(c.projetoId)) capaDe.set(c.projetoId, c.id);
  const totalDe = new Map(totais.map((t) => [t.projetoId, Number(t.total)]));
  const bomDe = new Map<string, Array<{ pecaId: string; codigo: string; nome: string; unidade: string; quantidade: number }>>();
  for (const { projetoId, pecaId, codigo, nome, unidade, quantidade } of linhasBom) {
    const lista = bomDe.get(projetoId) ?? [];
    lista.push({ pecaId, codigo, nome, unidade, quantidade });
    bomDe.set(projetoId, lista);
  }
  return {
    projetos: proj.map((p) => ({
      ...p,
      capaId: capaDe.get(p.id) ?? null,
      totalPecas: totalDe.get(p.id) ?? 0,
      bom: bomDe.get(p.id) ?? [],
    })),
    pecas: pcs,
  };
}

export type OpcoesReferencias = Awaited<ReturnType<typeof opcoesReferencias>>;
