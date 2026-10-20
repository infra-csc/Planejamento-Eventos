/**
 * Estoque da Ativação: carga inicial uma vez só (Puff e Ombrelone ligados), só Ativação e admin mexem, e o
 * "restam" desconta o que outro evento do mesmo período já leva da peça ligada.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, estoqueItens, eventos, pecas } from "@/server/db/schema";
import { podeGerenciarEstoque, saldoEstoque } from "@/domain/estoque";
import { criarUsuario, incluirPeca, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { ajustarQuantidadeEstoque, estoqueParaSolicitacao, importarEstoqueInicial, listarEstoque, salvarItemEstoque } from "./estoque";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

describe("estoque da Ativação", { timeout: 60_000 }, () => {
  it("só a área Ativação e o administrador mexem", async () => {
    const db = await getDb();
    const [ativacao] = await db.insert(areas).values({ nome: "Ativação" }).returning();
    const daAtivacao = await criarUsuario("Ana da Ativação", "REQUISITANTE", ativacao);
    expect(podeGerenciarEstoque(daAtivacao)).toBe(true);
    expect(podeGerenciarEstoque(E.admin)).toBe(true);
    expect(podeGerenciarEstoque(E.requisitante)).toBe(false);
    expect(podeGerenciarEstoque(E.logistica)).toBe(false);
    await expect(listarEstoque(E.logistica)).rejects.toThrow(/Ativação/);
  });

  it("carga inicial uma vez só, com Puff Cubo → PUFF ligado", async () => {
    const db = await getDb();
    await db.insert(pecas).values([
      { codigo: "PUFF", nome: "Puff", setor: "ARENA" },
      { codigo: "OMBRELONE", nome: "Ombrelone", setor: "ARENA" },
    ]);
    const r = await importarEstoqueInicial("teste:estoque:1");
    expect(r).toMatchObject({ feito: true, itens: 244, ligados: 2 });
    const puff = await db.query.estoqueItens.findFirst({ where: eq(estoqueItens.nome, "Puff Cubo") });
    expect(puff?.quantidade).toBe(170);
    expect(puff?.pecaId).toBeTruthy();
    // Item sem contagem em 2025 entra com 0.
    expect((await db.query.estoqueItens.findFirst({ where: eq(estoqueItens.nome, "Avental Preto") }))?.quantidade).toBe(0);
    expect(await importarEstoqueInicial("teste:estoque:1")).toEqual({ feito: false });
  });

  it("restam = estoque − o que outro evento do mesmo período leva; ajuste e edição gravam", async () => {
    const db = await getDb();
    const puff = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "PUFF") }))!;
    const item = (await db.query.estoqueItens.findFirst({ where: eq(estoqueItens.pecaId, puff.id) }))!;
    await ajustarQuantidadeEstoque(E.admin, item.id, 100);

    const a = await novoEvento(E.logistica);
    const b = await novoEvento(E.logistica);
    const longe = await novoEvento(E.logistica);
    await db.update(eventos).set({ dataMontagem: "2030-01-01", dataInicio: "2030-01-02", dataFim: "2030-01-02", dataDesmontagem: "2030-01-03" }).where(eq(eventos.id, longe.id));
    await incluirPeca(E.logistica, b.id, puff.id, 40, null);
    await incluirPeca(E.logistica, longe.id, puff.id, 30, null);

    const est = await estoqueParaSolicitacao([a.id]);
    expect(est.porPeca[puff.id]).toMatchObject({ quantidade: 100 });
    // b cruza o período de a (40); o de 2030 não conta.
    expect(est.emOutros[a.id][puff.id]).toBe(40);
    expect(saldoEstoque(100, 40, 70)).toEqual({ restam: 60, falta: 10 });

    await salvarItemEstoque(E.admin, { id: item.id, nome: "Puff Cubo", categoria: "Ativação", quantidade: 90, comprar: 10, observacao: "2 rasgados", pecaId: puff.id });
    const depois = await db.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, item.id) });
    expect(depois).toMatchObject({ quantidade: 90, comprar: 10, observacao: "2 rasgados" });
    await expect(salvarItemEstoque(E.admin, { nome: "Puff Cubo", categoria: "Ativação", quantidade: 1, comprar: null, observacao: null, pecaId: null })).rejects.toThrow(/Já existe/);
  });
});
