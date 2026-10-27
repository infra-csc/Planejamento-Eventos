/** Regras da logística na ata: ráfia por ultrabag, testeira a definir com tenda; tina e pallet saíram (vêm nos projetos). */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, osVersoes, pecas, projetos } from "@/server/db/schema";
import { criarPeca, criarProjeto, fecharAta, incluirPeca, incluirProjeto, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { ajustarLinhaNaConferencia, definirExtraDaRegra, obterConferencia } from "./conferencia";
import { transicionarEvento } from "./eventos/transicoes";
import { aplicarCavaleteRetoNasAtasFechadas, aplicarGradesDoPrismaNasAtasFechadas, ressincronizarAtasAbertas } from "./eventos/regras-kit";

let E: Elenco;
let estande: string;
let palcoShow: string;
let ultrabag: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  await db.insert(pecas).values([
    { codigo: "TINA-1000", nome: "Tina 1000 l", setor: "ARENA" },
    { codigo: "PALLET-FE", nome: "Pallet de ferro", setor: "ESTRUTURA" },
    { codigo: "SACO-RAFIA", nome: "Saco de ráfia", setor: "ARENA" },
  ]);
  const [ub] = await db.insert(pecas).values({ codigo: "LIXEIRA-BAG", nome: "Lixeira ultra bag", setor: "ARENA" }).returning();
  ultrabag = ub.id;
  const peca = await criarPeca();
  estande = (await criarProjeto(peca.id)).id;
  await db.update(projetos).set({ nome: "Estande 9×6 m", categoria: "Estande" }).where(eq(projetos.id, estande));
  palcoShow = (await criarProjeto(peca.id)).id;
  await db.update(projetos).set({ nome: "Palco show", categoria: "Palco" }).where(eq(projetos.id, palcoShow));
}, 120_000);

const regras = async (eventoId: string) => {
  const ls = await (await getDb()).select().from(eventoItens).where(eq(eventoItens.eventoId, eventoId));
  return Object.fromEntries(ls.filter((l) => l.regra).map((l) => [l.regra!, l.ativo ? l.quantidade : 0]));
};

describe("regras da logística na ata", () => {
  it("acompanham a ata: ráfia por ultrabag; estande e palco show não puxam mais tina nem pallet", async () => {
    const ev = await novoEvento(E.logistica);
    expect(await regras(ev.id)).toEqual({});
    await incluirProjeto(E.logistica, ev.id, estande, 3, E.areas.a.id);
    await incluirProjeto(E.logistica, ev.id, palcoShow, 1, null);
    expect(await regras(ev.id)).toEqual({});
    const linhaUb = await incluirPeca(E.logistica, ev.id, ultrabag, 5, null);
    expect(await regras(ev.id)).toEqual({ "saco-rafia": 5 });
    // Ultrabag de 5 para 2: a ráfia desce junto.
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaUb.id, 2, "Só 2");
    expect(await regras(ev.id)).toEqual({ "saco-rafia": 2 });
    // Na conferência a linha da regra aparece com a explicação.
    const rafia = (await obterConferencia(ev.id)).find((l) => l.codigo === "SACO-RAFIA")!;
    expect(rafia.regra).toBe("1 por lixeira ultra bag");
  });

  it("ajuste à mão na linha da regra fica como a logística deixou; depois da ata fechada a regra para", async () => {
    const ev = await novoEvento(E.logistica);
    const linhaUb = await incluirPeca(E.logistica, ev.id, ultrabag, 2, null);
    const db = await getDb();
    const [rafia] = await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "saco-rafia")));
    expect(rafia.quantidade).toBe(2);
    await ajustarLinhaNaConferencia(E.logistica, ev.id, rafia.id, 10, "Levar reserva");
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaUb.id, 3, "Mais uma ultrabag");
    expect(await regras(ev.id)).toEqual({ "saco-rafia": 10 });
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    await ajustarLinhaNaConferencia(E.admin, ev.id, linhaUb.id, 5, "Depois da ata").catch(() => null);
    expect((await regras(ev.id))["saco-rafia"]).toBe(10);
  });

  it("linha antiga de tina (regra que saiu) fica como está e mostra por quê", async () => {
    const db = await getDb();
    const tina = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "TINA-1000") }))!;
    const ev = await novoEvento(E.logistica);
    await db.insert(eventoItens).values({ eventoId: ev.id, tipo: "PECA", pecaId: tina.id, quantidade: 6, origem: "AJUSTE_LOGISTICA", regra: "tina-contrapeso" });
    await incluirPeca(E.logistica, ev.id, ultrabag, 1, null);
    expect(await regras(ev.id)).toEqual({ "tina-contrapeso": 6, "saco-rafia": 1 });
    const l = (await obterConferencia(ev.id)).find((x) => x.codigo === "TINA-1000")!;
    expect(l.regra).toMatch(/agora vem dentro dos projetos/);
  });

  it("testeira de madeira: com tenda 5×5 na ata entra a definir, o número sai da conferência; sem tenda, sai", async () => {
    const db = await getDb();
    // O pé diz o tamanho da tenda (a cantoneira é universal).
    const [pe] = await db.insert(pecas).values({ codigo: "TND5-PE", nome: "Pé de tenda 5×5", setor: "TENDA" }).returning();
    await db.insert(pecas).values({ codigo: "TND5-TESTEIRA", nome: "Testeira de madeira (Tenda 5x5)", setor: "MARCENARIA" });
    const tenda = (await criarProjeto(pe.id)).id;
    const testeira = async (eventoId: string) => (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.regra, "testeira-tenda-5x5"))))[0];

    const ev = await novoEvento(E.logistica);
    const linhaTenda = await incluirProjeto(E.logistica, ev.id, tenda, 3, null);
    expect(await testeira(ev.id)).toMatchObject({ ativo: true, quantidade: 0 });
    const t = (await obterConferencia(ev.id)).find((l) => l.codigo === "TND5-TESTEIRA")!;
    expect(t.regra).toMatch(/a definir na conferência/);
    // A conferência define o número; mais tendas depois não mexem nele.
    await ajustarLinhaNaConferencia(E.logistica, ev.id, (await testeira(ev.id)).id, 3, "Uma por tenda");
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaTenda.id, 4, "Mais uma tenda");
    expect(await testeira(ev.id)).toMatchObject({ ativo: true, quantidade: 3, regraManual: true });

    // Sem tenda na ata (nunca definida), a linha sai.
    const ev2 = await novoEvento(E.logistica);
    const t2 = await incluirProjeto(E.logistica, ev2.id, tenda, 2, null);
    expect((await testeira(ev2.id)).ativo).toBe(true);
    await ajustarLinhaNaConferencia(E.logistica, ev2.id, t2.id, 0, "Sem tenda");
    expect((await testeira(ev2.id)).ativo).toBe(false);
  });
  it("uma vez ao subir: atas abertas ganham a testeira; as outras regras não são mexidas", async () => {
    const db = await getDb();
    const pe = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "TND5-PE") }))!;
    const tenda = (await criarProjeto(pe.id)).id;
    const ev = await novoEvento(E.logistica);
    // Linhas gravadas direto (como numa ata de antes da regra): tenda e ultrabag, sem as linhas das regras.
    await db.insert(eventoItens).values([
      { eventoId: ev.id, tipo: "PROJETO", projetoId: tenda, quantidade: 2, origem: "AJUSTE_LOGISTICA", bomSnapshot: [{ pecaId: pe.id, codigo: "TND5-PE", nome: "Pé", setor: "TENDA", unidade: "un", quantidade: 4 }] },
      { eventoId: ev.id, tipo: "PECA", pecaId: ultrabag, quantidade: 3, origem: "AJUSTE_LOGISTICA" },
    ]);
    expect(await ressincronizarAtasAbertas("teste:regras:1")).toMatchObject({ feito: true });
    expect(await regras(ev.id)).toEqual({ "testeira-tenda-5x5": 0 });
    expect((await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "testeira-tenda-5x5"))))[0].ativo).toBe(true);
    expect(await ressincronizarAtasAbertas("teste:regras:1")).toEqual({ feito: false });
  });
  it("grades do prisma: as a mais da reunião ficam numa linha própria e somam; as do prisma seguem os prismas", async () => {
    const db = await getDb();
    const [prisma] = await db.insert(pecas).values({ codigo: "PRISMA", nome: "Prisma", setor: "ARENA" }).returning();
    await db.insert(pecas).values({ codigo: "GRADE-2X1", nome: "Grade 2×1 m", setor: "ARENA" });
    const ev = await novoEvento(E.logistica);
    const linhaPrisma = await incluirPeca(E.logistica, ev.id, prisma.id, 5, null);
    const linhasGrade = async () => (await db.select().from(eventoItens).where(eq(eventoItens.eventoId, ev.id))).filter((l) => l.ativo && l.pecaId && l.regra !== "pe-grade-2x1" && l.quantidade > 0);
    const regraGrade = (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "grade-prisma"))))[0];
    expect(regraGrade.quantidade).toBe(10);

    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 6, "");
    const grade = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "GRADE-2X1") }))!;
    const aMais = (await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra);
    expect(aMais.map((l) => l.quantidade)).toEqual([6]);
    // Prismas de 5 para 7: as do prisma acompanham (14) e as a mais continuam 6.
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaPrisma.id, 7, "");
    expect(await regras(ev.id)).toMatchObject({ "grade-prisma": 14 });
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra).map((l) => l.quantidade)).toEqual([6]);
    // Mudar o a mais ajusta a mesma linha; 0 tira.
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 9, "");
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra).map((l) => l.quantidade)).toEqual([9]);
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 0, "");
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra)).toEqual([]);
    // Duas linhas a mais (uma incluída à mão): o número vale para as duas juntas, como a tela mostra a soma.
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 4, "");
    await incluirPeca(E.logistica, ev.id, grade.id, 3, null);
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 5, "");
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra).map((l) => l.quantidade)).toEqual([5]);
  });

  it("ata fechada antes da regra do prisma: as grades do prisma entram uma vez, com nova OS", async () => {
    const db = await getDb();
    const prisma = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "PRISMA") }))!;
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, prisma.id, 9, null);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    // Como nas atas antigas: sem a linha da regra.
    await db.delete(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "grade-prisma")));
    const { gerarOsVersao } = await import("./os");
    await gerarOsVersao(db, ev.id, "AJUSTE_LOGISTICA", null, "OS antiga, sem as grades do prisma");
    const versoes = async () => (await db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id))).length;
    const antes = await versoes();
    const r = await aplicarGradesDoPrismaNasAtasFechadas("teste:prisma:1");
    expect(r.feito && r.eventos).toContain(ev.codigo);
    expect((await regras(ev.id))["grade-prisma"]).toBe(18);
    expect(await versoes()).toBe(antes + 1);
    expect(await aplicarGradesDoPrismaNasAtasFechadas("teste:prisma:1")).toEqual({ feito: false });
  });

  it("ata fechada antes de o pranchão voltar ao cavalete reto: os cavaletes entram uma vez, descontando os já pedidos", async () => {
    const db = await getDb();
    const [pranchao] = await db.insert(pecas).values({ codigo: "PRANCHÃO-220", nome: "Pranchão 2,20 m", setor: "MARCENARIA" }).returning();
    const [cavalete] = await db.insert(pecas).values({ codigo: "CAV-RETO", nome: "Cavalete reto", setor: "ARENA" }).returning();
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pranchao.id, 6, null);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    // Como nas atas fechadas antes de 20/10: sem a linha da regra e com 4 cavaletes pedidos à parte.
    await db.delete(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "cavalete-reto")));
    await db.insert(eventoItens).values({ eventoId: ev.id, tipo: "PECA", pecaId: cavalete.id, quantidade: 4, origem: "AJUSTE_LOGISTICA" });
    const { gerarOsVersao } = await import("./os");
    await gerarOsVersao(db, ev.id, "AJUSTE_LOGISTICA", null, "OS antiga, só com os cavaletes pedidos");
    const versoes = async () => (await db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id))).length;
    const antes = await versoes();
    const r = await aplicarCavaleteRetoNasAtasFechadas("teste:cavalete:1");
    expect(r.feito && r.eventos).toContain(ev.codigo);
    // 6 pranchões = 12 cavaletes; 4 já estavam na ata, a regra completa com 8.
    expect((await regras(ev.id))["cavalete-reto"]).toBe(8);
    expect(await versoes()).toBe(antes + 1);
    expect(await aplicarCavaleteRetoNasAtasFechadas("teste:cavalete:1")).toEqual({ feito: false });
  });
});
