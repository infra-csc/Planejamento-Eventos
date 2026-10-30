/**
 * Projeto editado vale nos eventos que usam ele: a linha passa para a versão nova (com a ata fechada sai nova OS);
 * peças ajustadas uma a uma no evento seguram a linha na versão anterior; a regra antiga de tina e pallet diminui
 * o que o stand passou a trazer.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, osVersoes, pecas, projetoVersoes, projetos } from "@/server/db/schema";
import { criarPeca, criarProjeto, fecharAta, incluirProjeto, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { editarProjeto } from "./projetos";
import { ajustarPecaDoProjeto } from "./conferencia";
import { transicionarEvento } from "./eventos/transicoes";
import { atualizarProjetosDefasados } from "./eventos/versoes";
import { obterLinhasAta } from "./eventos";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

const versaoDa = async (linhaId: string) => {
  const db = await getDb();
  const l = await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, linhaId), with: { projetoVersao: true } });
  return { numero: l!.projetoVersao!.numero, bom: l!.bomSnapshot ?? [] };
};

describe("projeto editado atualiza os eventos", { timeout: 60_000 }, () => {
  it("antes e depois da ata: a linha vai para a versão nova; com a ata fechada sai nova OS", async () => {
    const db = await getDb();
    const peca = await criarPeca();
    const outra = await criarPeca();
    const p = await criarProjeto(peca.id, 4);
    const aberto = await novoEvento(E.logistica);
    const linhaAberto = await incluirProjeto(E.logistica, aberto.id, p.id, 2, null);
    await transicionarEvento(E.admin, aberto.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, aberto.id);
    const preparacao = await novoEvento(E.logistica);
    const linhaPrep = await incluirProjeto(E.logistica, preparacao.id, p.id, 1, null);
    const osAntes = (await db.select().from(osVersoes).where(eq(osVersoes.eventoId, aberto.id))).length;

    const r = await editarProjeto(E.admin, p.id, { nome: p.nome, categoria: "", descricao: null, observacaoVersao: "Mais uma peça", itens: [{ pecaId: peca.id, quantidade: 4 }, { pecaId: outra.id, quantidade: 1 }] });
    expect(r.atualizacao?.eventos.sort()).toEqual([aberto.codigo, preparacao.codigo].sort());
    expect((await versaoDa(linhaAberto.id)).numero).toBe(2);
    expect((await versaoDa(linhaPrep.id)).bom.map((b) => b.pecaId).sort()).toEqual([peca.id, outra.id].sort());
    expect((await db.select().from(osVersoes).where(eq(osVersoes.eventoId, aberto.id))).length).toBe(osAntes + 1);
  });

  it("peças ajustadas uma a uma no evento seguram a linha na versão anterior", async () => {
    const peca = await criarPeca();
    const p = await criarProjeto(peca.id, 4);
    const ev = await novoEvento(E.logistica);
    const linha = await incluirProjeto(E.logistica, ev.id, p.id, 1, null);
    await ajustarPecaDoProjeto(E.logistica, ev.id, linha.id, peca.id, 6, "Mais seis");
    const r = await editarProjeto(E.admin, p.id, { nome: p.nome, categoria: "", descricao: null, observacaoVersao: null, itens: [{ pecaId: peca.id, quantidade: 5 }] });
    expect(r.atualizacao?.eventos).toEqual([]);
    expect(r.atualizacao?.pendentes).toEqual([{ evento: ev.codigo, projeto: p.nome }]);
    expect((await versaoDa(linha.id)).numero).toBe(1);
    // A tela sabe que esta linha não atualiza com um clique (auditoria 30/10, B-03): o selo não é botão.
    const naAta = (await obterLinhasAta(ev.id)).find((l) => l.id === linha.id)!;
    expect(naAta).toMatchObject({ versaoDefasada: true, pecasAjustadas: true });
  });

  it("stand que passa a trazer tina e pallet: a linha antiga da regra desce; uma vez só ao subir", async () => {
    const db = await getDb();
    const [tina] = await db.insert(pecas).values({ codigo: "TINA-1000", nome: "Tina 1000 l", setor: "ARENA" }).returning();
    const [pallet] = await db.insert(pecas).values({ codigo: "PALLET-FE", nome: "Pallet de ferro", setor: "ESTRUTURA" }).returning();
    const peca = await criarPeca();
    const stand = await criarProjeto(peca.id, 4);
    await db.update(projetos).set({ nome: "Stand 9×6 m (teste)", categoria: "Stand" }).where(eq(projetos.id, stand.id));
    const ev = await novoEvento(E.logistica);
    const linha = await incluirProjeto(E.logistica, ev.id, stand.id, 3, null);
    // Linhas da regra antiga, como ficaram nas atas (2 por stand).
    await db.insert(eventoItens).values([
      { eventoId: ev.id, tipo: "PECA", pecaId: tina.id, quantidade: 6, origem: "AJUSTE_LOGISTICA", regra: "tina-contrapeso" },
      { eventoId: ev.id, tipo: "PECA", pecaId: pallet.id, quantidade: 6, origem: "AJUSTE_LOGISTICA", regra: "pallet-ferro", regraManual: true },
    ]);
    // Versão nova do stand com tina e pallet, gravada direto (como se tivesse sido editada antes desta regra existir).
    const [v2] = await db.insert(projetoVersoes).values({ projetoId: stand.id, numero: 2 }).returning();
    const { projetoItens } = await import("@/server/db/schema");
    await db.insert(projetoItens).values([
      { versaoId: v2.id, pecaId: peca.id, quantidade: 4 },
      { versaoId: v2.id, pecaId: tina.id, quantidade: 2 },
      { versaoId: v2.id, pecaId: pallet.id, quantidade: 2 },
    ]);
    await db.update(projetos).set({ versaoAtual: 2 }).where(eq(projetos.id, stand.id));

    const r = await atualizarProjetosDefasados("teste:versoes:1");
    expect(r).toMatchObject({ feito: true });
    expect((await versaoDa(linha.id)).numero).toBe(2);
    const regra = async (chave: string) => (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, chave))))[0];
    // A tina da regra antiga sai (o stand já leva 2 × 3); o pallet ajustado à mão fica como a logística deixou.
    expect((await regra("tina-contrapeso")).ativo).toBe(false);
    expect(await regra("pallet-ferro")).toMatchObject({ ativo: true, quantidade: 6 });
    expect(await atualizarProjetosDefasados("teste:versoes:1")).toEqual({ feito: false });
  });
});
