import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { pecas, projetoGrupos, projetos, projetoItens, projetoVersoes } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { LIMITES } from "@/domain/constantes";
import { normalizarGrupoProjeto } from "@/domain/grupos-projeto";
import { registrarHistorico } from "./support";
import { resolverGrupoProjeto } from "./projetos";

function idsSelecionados(selecao: unknown) {
  if (!Array.isArray(selecao) || !selecao.length || selecao.length > 100 ||
      selecao.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)) {
    throw new ValidacaoError("Selecione de 1 a 100 itens da biblioteca.");
  }
  return [...new Set((selecao as string[]).map((id) => id.trim()))].sort();
}

/** A seleção não junta cadastros: cada item continua com o próprio histórico. */
export async function desabilitarBibliotecaEmLote(usuario: UsuarioAtual, tipo: unknown, selecao: unknown) {
  if (tipo !== "projetos" && tipo !== "pecas") throw new ValidacaoError("Escolha projetos ou peças da biblioteca.");
  exigir(usuario, tipo === "projetos" ? "projeto.gerenciar" : "catalogo.gerenciar");
  const ids = idsSelecionados(selecao);
  const db = await getDb();
  return db.transaction(async (tx) => {
    if (tipo === "projetos") {
      const rows = await tx.select().from(projetos).where(inArray(projetos.id, ids)).for("update");
      if (rows.length !== ids.length) throw new NaoEncontradoError("Um dos projetos selecionados");
      const ativos = rows.filter((p) => p.ativo);
      if (ativos.length) await tx.update(projetos).set({ ativo: false }).where(inArray(projetos.id, ativos.map((p) => p.id)));
      for (const p of ativos) {
        await registrarHistorico(tx, {
          entidade: "projeto", entidadeId: p.id, acao: "INATIVADO",
          descricao: `Projeto ${p.nome} inativado em lote.`, usuarioId: usuario.id,
          dadosAntes: { ativo: true }, dadosDepois: { ativo: false },
        });
      }
      return { alterados: ativos.length, jaInativos: rows.length - ativos.length };
    }

    const rows = await tx.select().from(pecas).where(inArray(pecas.id, ids)).for("update");
    if (rows.length !== ids.length) throw new NaoEncontradoError("Uma das peças selecionadas");
    const ativos = rows.filter((p) => p.ativo);
    if (ativos.length) {
      // Mesma regra da inativação individual: peças no BOM atual de projetos ativos não podem sair.
      const usos = await tx.selectDistinct({ pecaId: projetoItens.pecaId, nomeProjeto: projetos.nome })
        .from(projetoItens)
        .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
        .innerJoin(projetos, and(eq(projetoVersoes.projetoId, projetos.id), eq(projetoVersoes.numero, projetos.versaoAtual)))
        .where(and(inArray(projetoItens.pecaId, ativos.map((p) => p.id)), eq(projetos.ativo, true)));
      if (usos.length) {
        const nomes = ativos.filter((p) => usos.some((u) => u.pecaId === p.id)).map((p) => `${p.codigo} · ${p.nome}`);
        const projetosUsando = [...new Set(usos.map((u) => u.nomeProjeto))];
        throw new DomainError(`Nenhum item foi desabilitado. Peças usadas em projetos ativos: ${nomes.slice(0, 8).join("; ")}${nomes.length > 8 ? "; …" : ""}. Projetos: ${projetosUsando.slice(0, 8).join("; ")}${projetosUsando.length > 8 ? "; …" : ""}. Remova as peças desses projetos ou desabilite os projetos primeiro.`);
      }
      await tx.update(pecas).set({ ativo: false }).where(inArray(pecas.id, ativos.map((p) => p.id)));
      for (const p of ativos) {
        await registrarHistorico(tx, {
          entidade: "peca", entidadeId: p.id, acao: "INATIVADA",
          descricao: `Peça ${p.codigo} inativada em lote.`, usuarioId: usuario.id,
          dadosAntes: { ativo: true }, dadosDepois: { ativo: false },
        });
      }
    }
    return { alterados: ativos.length, jaInativos: rows.length - ativos.length };
  });
}

/** grupo: undefined = manter, null = Padrão, texto = nome (existente ou novo). categoria: undefined = manter, "" = sem categoria. */
export type OrganizacaoProjetos = { grupo?: string | null; categoria?: string };

function normalizarCategoria(valor: unknown) {
  if (typeof valor !== "string") throw new ValidacaoError("Informe uma categoria válida.", { categoria: "Informe uma categoria válida." });
  const categoria = valor.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (categoria.length > LIMITES.categoria) throw new ValidacaoError(`A categoria deve ter até ${LIMITES.categoria} caracteres.`, { categoria: `Use até ${LIMITES.categoria} caracteres.` });
  return categoria;
}

/** Muda só a organização (grupo/categoria): não cria versão da lista de peças nem mexe em pedidos. */
export async function organizarProjetosEmLote(usuario: UsuarioAtual, selecao: unknown, organizacao: OrganizacaoProjetos) {
  exigir(usuario, "projeto.gerenciar");
  const ids = idsSelecionados(selecao);
  const mudaGrupo = organizacao.grupo !== undefined;
  const mudaCategoria = organizacao.categoria !== undefined;
  if (!mudaGrupo && !mudaCategoria) throw new ValidacaoError("Escolha um grupo ou uma categoria para aplicar.");
  if (mudaGrupo) normalizarGrupoProjeto(organizacao.grupo);
  const categoria = mudaCategoria ? normalizarCategoria(organizacao.categoria) : undefined;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(projetos).where(inArray(projetos.id, ids)).for("update");
    if (rows.length !== ids.length) throw new NaoEncontradoError("Um dos projetos selecionados");
    const grupoId = mudaGrupo ? await resolverGrupoProjeto(tx, usuario, organizacao.grupo) : undefined;
    const grupoNome = grupoId ? (await tx.query.projetoGrupos.findFirst({ where: eq(projetoGrupos.id, grupoId) }))?.nome ?? null : null;
    const alterar = rows.filter((p) => (mudaGrupo && p.grupoId !== grupoId) || (mudaCategoria && p.categoria !== categoria));
    if (alterar.length) {
      await tx.update(projetos)
        .set({ ...(mudaGrupo ? { grupoId } : {}), ...(mudaCategoria ? { categoria } : {}) })
        .where(inArray(projetos.id, alterar.map((p) => p.id)));
    }
    for (const p of alterar) {
      const partes = [
        mudaGrupo && p.grupoId !== grupoId ? `grupo ${grupoNome ? `“${grupoNome}”` : "Padrão"}` : null,
        mudaCategoria && p.categoria !== categoria ? `categoria ${categoria ? `“${categoria}”` : "removida"}` : null,
      ].filter(Boolean);
      await registrarHistorico(tx, {
        entidade: "projeto", entidadeId: p.id, acao: "EDITADO",
        descricao: `${p.nome}: ${partes.join(" e ")} em lote (sem mudança no BOM).`, usuarioId: usuario.id,
        dadosAntes: { ...(mudaGrupo ? { grupoId: p.grupoId } : {}), ...(mudaCategoria ? { categoria: p.categoria } : {}) },
        dadosDepois: { ...(mudaGrupo ? { grupoId } : {}), ...(mudaCategoria ? { categoria } : {}) },
      });
    }
    return { alterados: alterar.length, semMudanca: rows.length - alterar.length };
  });
}
