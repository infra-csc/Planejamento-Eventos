/**
 * Tendas na conferência: o local mostra tendas, fechamentos e calhas, e o ajuste do local (como no
 * quadro de tendas) acerta as linhas: quantidade, peças por tenda, linhas que sobram e que faltam.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { getDb } from "@/server/db";
import { pecas, projetoItens, projetoVersoes, projetos } from "@/server/db/schema";
import { fecharAta, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { eq } from "drizzle-orm";
import { osVersoes } from "@/server/db/schema";
import { ValidacaoError } from "@/domain/errors";
import { incluirLinhaAta, transicionarEvento } from "./eventos";
import { ajustarTendasDoLocal, obterConferencia } from "./conferencia";

let E: Elenco;
let tendaId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  // Kit da 5×5 com os códigos reais (o kit é reconhecido pelos códigos); a calha vem 1 por tenda no padrão.
  const codigos = ["TND5-CANT", "TND5-TRAV", "TND5-PE", "TND5-MASTRO", "TND5-CABO", "TND5-CALHA", "TND5-FECH"];
  const criadas = await db.insert(pecas).values(codigos.map((codigo) => ({ codigo, nome: codigo, setor: "ESTRUTURA" as const }))).returning();
  const id = (c: string) => criadas.find((p) => p.codigo === c)!.id;
  const [pr] = await db.insert(projetos).values({ codigo: "PRJ-TENDA5", nome: "Tenda 5×5 m" }).returning();
  const [v] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
  await db.insert(projetoItens).values([
    { versaoId: v.id, pecaId: id("TND5-CANT"), quantidade: 4 },
    { versaoId: v.id, pecaId: id("TND5-PE"), quantidade: 4 },
    { versaoId: v.id, pecaId: id("TND5-CALHA"), quantidade: 1 },
  ]);
  tendaId = pr.id;
}, 120_000);

const doLocal = async (eventoId: string, local: string) => {
  const ls = (await obterConferencia(eventoId)).filter((l) => l.tenda && l.destino === local);
  const total = (papel: string) => ls.reduce((a, l) => a + l.quantidade * (l.tenda!.pecas.find((p) => p.papel === papel)?.porUnidade ?? 0), 0);
  return { ls, tendas: ls.reduce((a, l) => a + l.quantidade, 0), fechamentos: total("fechamento"), calhas: total("calha") };
};

describe("tendas na conferência", () => {
  it("mostra por local tendas, fechamentos e calhas, e o ajuste do local acerta as linhas", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PROJETO", projetoId: tendaId, pecaId: null, descricaoLivre: null, quantidade: 2, destino: "Dispersão", areaId: E.areas.a.id, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");

    const antes = await doLocal(ev.id, "Dispersão");
    expect(antes).toMatchObject({ tendas: 2, fechamentos: 0, calhas: 2 });
    expect(antes.ls[0].tenda).toMatchObject({ tamanho: "5×5" });

    // 3 tendas, 5 fechamentos (não divide igual: vira duas linhas) e 2 calhas.
    await ajustarTendasDoLocal(E.logistica, ev.id, { linhaIds: antes.ls.map((l) => l.id), tendas: 3, totais: { fechamento: 5, calha: 2 }, motivo: null });
    const depois = await doLocal(ev.id, "Dispersão");
    expect(depois).toMatchObject({ tendas: 3, fechamentos: 5, calhas: 2 });
    expect(depois.ls.every((l) => l.conferidoEm)).toBe(true);

    // Menos tendas: as linhas que sobram saem.
    await ajustarTendasDoLocal(E.logistica, ev.id, { linhaIds: depois.ls.map((l) => l.id), tendas: 1, totais: { fechamento: 2, calha: 1 }, motivo: "Cliente reduziu" });
    expect(await doLocal(ev.id, "Dispersão")).toMatchObject({ tendas: 1, fechamentos: 2, calhas: 1 });
  });
  it("com a ata fechada o mesmo quadro ajusta as tendas do local, com justificativa e nova versão da OS", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PROJETO", projetoId: tendaId, pecaId: null, descricaoLivre: null, quantidade: 2, destino: "GV", areaId: E.areas.a.id, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const db = await getDb();
    const versoes = async () => (await db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id))).length;
    const antesV = await versoes();
    const antes = await doLocal(ev.id, "GV");
    await expect(ajustarTendasDoLocal(E.admin, ev.id, { linhaIds: antes.ls.map((l) => l.id), tendas: 2, totais: { fechamento: 4, calha: 2 }, motivo: null })).rejects.toBeInstanceOf(ValidacaoError);
    await ajustarTendasDoLocal(E.admin, ev.id, { linhaIds: antes.ls.map((l) => l.id), tendas: 3, totais: { fechamento: 6, calha: 3 }, motivo: "Cliente pediu mais uma tenda fechada" });
    expect(await doLocal(ev.id, "GV")).toMatchObject({ tendas: 3, fechamentos: 6, calhas: 3 });
    expect(await versoes()).toBeGreaterThan(antesV);
    await expect(ajustarTendasDoLocal(E.requisitante, ev.id, { linhaIds: (await doLocal(ev.id, "GV")).ls.map((l) => l.id), tendas: 1, totais: {}, motivo: "x" })).rejects.toThrow();
  });
});
