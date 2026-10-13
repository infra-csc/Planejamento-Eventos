import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { historico, pecas, projetos } from "@/server/db/schema";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { criarPeca, migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { criarProjeto, listarProjetos } from "./projetos";
import { desabilitarBibliotecaEmLote } from "./biblioteca-lote";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

const projeto = async (nome: string, pecaId?: string) => criarProjeto(E.cenografia, {
  nome, categoria: "Teste", descricao: null, observacaoVersao: null,
  itens: [{ pecaId: pecaId ?? (await criarPeca()).id, quantidade: 2 }],
});

describe("desabilitar em lote", () => {
  it("inativa vários projetos, conserva cadastros e audita cada um uma única vez", async () => {
    const a = await projeto("Projeto do lote A");
    const b = await projeto("Projeto do lote B");
    expect(await desabilitarBibliotecaEmLote(E.cenografia, "projetos", [a.id, b.id, a.id])).toEqual({ alterados: 2, jaInativos: 0 });
    const db = await getDb();
    const rows = await db.select().from(projetos).where(inArray(projetos.id, [a.id, b.id]));
    expect(rows).toHaveLength(2);
    expect(rows.every((p) => !p.ativo)).toBe(true);
    const logs = await db.select().from(historico).where(inArray(historico.entidadeId, [a.id, b.id]));
    expect(logs.filter((l) => l.acao === "INATIVADO")).toHaveLength(2);
    const visiveis = await listarProjetos(E.cenografia, { incluirInativos: true, busca: "Projeto do lote" });
    expect(visiveis.map((p) => p.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(visiveis.every((p) => !p.ativo)).toBe(true);
    expect(await listarProjetos(E.cenografia, { busca: "Projeto do lote" })).toEqual([]);
    expect(await desabilitarBibliotecaEmLote(E.cenografia, "projetos", [a.id, b.id])).toEqual({ alterados: 0, jaInativos: 2 });
  });

  it("inativa peças sem uso e mantém seus cadastros", async () => {
    const a = await criarPeca();
    const b = await criarPeca();
    expect(await desabilitarBibliotecaEmLote(E.logistica, "pecas", [a.id, b.id])).toEqual({ alterados: 2, jaInativos: 0 });
    const rows = await (await getDb()).select().from(pecas).where(inArray(pecas.id, [a.id, b.id]));
    expect(rows).toHaveLength(2);
    expect(rows.every((p) => !p.ativo)).toBe(true);
  });

  it("bloqueia o lote inteiro se uma peça está em projeto ativo, sem alterar a peça livre", async () => {
    const usada = await criarPeca();
    const livre = await criarPeca();
    const p = await projeto("Projeto que bloqueia lote", usada.id);
    await expect(desabilitarBibliotecaEmLote(E.logistica, "pecas", [livre.id, usada.id])).rejects.toThrow("Nenhum item foi desabilitado");
    const db = await getDb();
    const rows = await db.select().from(pecas).where(inArray(pecas.id, [livre.id, usada.id]));
    expect(rows.every((p) => p.ativo)).toBe(true);
    expect((await db.select().from(historico).where(inArray(historico.entidadeId, [livre.id, usada.id]))).filter((l) => l.acao === "INATIVADA")).toHaveLength(0);
    await desabilitarBibliotecaEmLote(E.cenografia, "projetos", [p.id]);
    expect(await desabilitarBibliotecaEmLote(E.logistica, "pecas", [livre.id, usada.id])).toEqual({ alterados: 2, jaInativos: 0 });
  });

  it("IDs ausentes não deixam alterações parciais", async () => {
    const p = await projeto("Projeto sem alteração parcial");
    await expect(desabilitarBibliotecaEmLote(E.cenografia, "projetos", [p.id, "nao-existe"])).rejects.toBeInstanceOf(NaoEncontradoError);
    const salvo = await (await getDb()).query.projetos.findFirst({ where: eq(projetos.id, p.id) });
    expect(salvo?.ativo).toBe(true);
  });

  it("valida seleção vazia, limites e tipo inválido", async () => {
    for (const ids of [[], [""], [null], ["x".repeat(201)], Array(101).fill("x")]) {
      await expect(desabilitarBibliotecaEmLote(E.cenografia, "projetos", ids)).rejects.toBeInstanceOf(ValidacaoError);
    }
    await expect(desabilitarBibliotecaEmLote(E.admin, "fora", ["x"])).rejects.toBeInstanceOf(ValidacaoError);
  });

  it("requisitante não pode fazer lote e logística não gerencia projetos", async () => {
    const p = await projeto("Projeto protegido por perfil");
    await expect(desabilitarBibliotecaEmLote(E.requisitante, "projetos", [p.id])).rejects.toBeInstanceOf(DomainError);
    await expect(desabilitarBibliotecaEmLote(E.requisitante, "pecas", ["x"])).rejects.toBeInstanceOf(DomainError);
    await expect(desabilitarBibliotecaEmLote(E.logistica, "projetos", [p.id])).rejects.toBeInstanceOf(DomainError);
    expect((await (await getDb()).query.projetos.findFirst({ where: eq(projetos.id, p.id) }))?.ativo).toBe(true);
  });
});
