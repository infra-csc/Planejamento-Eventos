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

/** Projeto que impede o lote, com link na tela (antes a lista vinha num parágrafo corrido; parte C N12). */
export type ProjetoBloqueio = { id: string; codigo: string; nome: string };

/**
 * O lote não foi feito porque alguns itens prendem os outros (peça em projeto ativo; projeto com peça inativa): a
 * mensagem resume e `projetos` traz os projetos para a tela listar com link.
 */
export class LoteBloqueadoError extends DomainError {
  constructor(
    message: string,
    readonly projetos: ProjetoBloqueio[],
  ) {
    super(message, "REGRA");
  }
}

const listaCurta = (nomes: string[]) => `${nomes.slice(0, 8).join("; ")}${nomes.length > 8 ? "; …" : ""}`;

/** Inativa em lote ("Inativar", como no resto do app; auditoria 28/10, nº 76). Cada item continua com o próprio histórico. */
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
      const usos = await tx.selectDistinct({ pecaId: projetoItens.pecaId, projetoId: projetos.id, codigoProjeto: projetos.codigo, nomeProjeto: projetos.nome })
        .from(projetoItens)
        .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
        .innerJoin(projetos, and(eq(projetoVersoes.projetoId, projetos.id), eq(projetoVersoes.numero, projetos.versaoAtual)))
        .where(and(inArray(projetoItens.pecaId, ativos.map((p) => p.id)), eq(projetos.ativo, true)));
      if (usos.length) {
        const nomes = ativos.filter((p) => usos.some((u) => u.pecaId === p.id)).map((p) => `${p.codigo} · ${p.nome}`);
        const projetosUsando = [...new Map(usos.map((u) => [u.projetoId, { id: u.projetoId, codigo: u.codigoProjeto, nome: u.nomeProjeto }])).values()];
        throw new LoteBloqueadoError(`Nenhum item foi inativado. ${nomes.length === 1 ? "Esta peça está" : "Estas peças estão"} em projetos ativos: ${listaCurta(nomes)}. Tire as peças desses projetos (nova versão) ou inative os projetos primeiro.`, projetosUsando);
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

/**
 * Reativa em lote (filtro "Só inativos"): antes eram 20 diálogos para 20 itens (auditoria 30/10, parte C N27). Mesmas
 * regras do reativar de um em um: projeto só volta se todas as peças da versão atual estiverem ativas; se algum não
 * puder, nada muda e a tela lista quais.
 */
export async function reativarBibliotecaEmLote(usuario: UsuarioAtual, tipo: unknown, selecao: unknown) {
  if (tipo !== "projetos" && tipo !== "pecas") throw new ValidacaoError("Escolha projetos ou peças da biblioteca.");
  exigir(usuario, tipo === "projetos" ? "projeto.gerenciar" : "catalogo.gerenciar");
  const ids = idsSelecionados(selecao);
  const db = await getDb();
  return db.transaction(async (tx) => {
    if (tipo === "projetos") {
      const rows = await tx.select().from(projetos).where(inArray(projetos.id, ids)).for("update");
      if (rows.length !== ids.length) throw new NaoEncontradoError("Um dos projetos selecionados");
      const inativos = rows.filter((p) => !p.ativo);
      if (inativos.length) {
        const comPecaInativa = await tx
          .selectDistinct({ projetoId: projetos.id, codigo: projetos.codigo, nome: projetos.nome })
          .from(projetoItens)
          .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
          .innerJoin(projetos, and(eq(projetoVersoes.projetoId, projetos.id), eq(projetoVersoes.numero, projetos.versaoAtual)))
          .innerJoin(pecas, eq(projetoItens.pecaId, pecas.id))
          .where(and(inArray(projetos.id, inativos.map((p) => p.id)), eq(pecas.ativo, false)));
        if (comPecaInativa.length) {
          const bloqueio = comPecaInativa.map((p) => ({ id: p.projetoId, codigo: p.codigo, nome: p.nome }));
          throw new LoteBloqueadoError(`Nenhum item foi reativado. ${bloqueio.length === 1 ? "Este projeto tem" : "Estes projetos têm"} peça inativa no catálogo: ${listaCurta(bloqueio.map((p) => `${p.codigo} · ${p.nome}`))}. Reative as peças ou tire-as do projeto antes.`, bloqueio);
        }
        await tx.update(projetos).set({ ativo: true }).where(inArray(projetos.id, inativos.map((p) => p.id)));
        for (const p of inativos) {
          await registrarHistorico(tx, { entidade: "projeto", entidadeId: p.id, acao: "REATIVADO", descricao: `Projeto ${p.nome} reativado em lote.`, usuarioId: usuario.id, dadosAntes: { ativo: false }, dadosDepois: { ativo: true } });
        }
      }
      return { alterados: inativos.length, jaAtivos: rows.length - inativos.length };
    }
    const rows = await tx.select().from(pecas).where(inArray(pecas.id, ids)).for("update");
    if (rows.length !== ids.length) throw new NaoEncontradoError("Uma das peças selecionadas");
    const inativas = rows.filter((p) => !p.ativo);
    if (inativas.length) {
      await tx.update(pecas).set({ ativo: true }).where(inArray(pecas.id, inativas.map((p) => p.id)));
      for (const p of inativas) {
        await registrarHistorico(tx, { entidade: "peca", entidadeId: p.id, acao: "REATIVADA", descricao: `Peça ${p.codigo} reativada em lote.`, usuarioId: usuario.id, dadosAntes: { ativo: false }, dadosDepois: { ativo: true } });
      }
    }
    return { alterados: inativas.length, jaAtivos: rows.length - inativas.length };
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
        descricao: `${p.nome}: ${partes.join(" e ")} em lote (sem mudança na lista de peças).`, usuarioId: usuario.id,
        dadosAntes: { ...(mudaGrupo ? { grupoId: p.grupoId } : {}), ...(mudaCategoria ? { categoria: p.categoria } : {}) },
        dadosDepois: { ...(mudaGrupo ? { grupoId } : {}), ...(mudaCategoria ? { categoria } : {}) },
      });
    }
    return { alterados: alterar.length, semMudanca: rows.length - alterar.length };
  });
}

/**
 * Mostra ou tira das solicitações vários itens de uma vez (a cenografia escolhe o que as áreas podem pedir). Só a
 * visibilidade na hora de pedir muda: o que já está em ata ou pedido continua igual. Cada item ganha histórico.
 */
export async function disponibilizarBibliotecaEmLote(usuario: UsuarioAtual, tipo: unknown, selecao: unknown, disponivel: boolean) {
  if (tipo !== "projetos" && tipo !== "pecas") throw new ValidacaoError("Escolha projetos ou peças da biblioteca.");
  exigir(usuario, tipo === "projetos" ? "projeto.gerenciar" : "catalogo.gerenciar");
  const ids = idsSelecionados(selecao);
  const tabela = tipo === "projetos" ? projetos : pecas;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: tabela.id, nome: tabela.nome, disponivel: tabela.disponivelEmSolicitacoes }).from(tabela).where(inArray(tabela.id, ids));
    if (rows.length !== ids.length) throw new NaoEncontradoError(tipo === "projetos" ? "Um dos projetos selecionados" : "Uma das peças selecionadas");
    const mudam = rows.filter((r) => r.disponivel !== disponivel);
    if (mudam.length) await tx.update(tabela).set({ disponivelEmSolicitacoes: disponivel }).where(inArray(tabela.id, mudam.map((r) => r.id)));
    for (const r of mudam) {
      await registrarHistorico(tx, {
        entidade: tipo === "projetos" ? "projeto" : "peca",
        entidadeId: r.id,
        acao: "EDITADA",
        descricao: `${r.nome}: ${disponivel ? "passa a aparecer" : "deixa de aparecer"} nas solicitações (em lote).`,
        usuarioId: usuario.id,
        dadosAntes: { disponivelEmSolicitacoes: !disponivel },
        dadosDepois: { disponivelEmSolicitacoes: disponivel },
      });
    }
    return { alterados: mudam.length, semMudanca: rows.length - mudam.length };
  });
}
