/** Regras da logística na ata: ráfia por ultrabag, testeira a definir com tenda; tina e pallet saíram (vêm nos projetos). */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, pecas, projetos } from "@/server/db/schema";
import { criarPeca, criarProjeto, fecharAta, incluirPeca, incluirProjeto, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { ajustarLinhaNaConferencia, obterConferencia } from "./conferencia";
import { transicionarEvento } from "./eventos/transicoes";
import { ressincronizarAtasAbertas } from "./eventos/regras-kit";

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
    const [cant] = await db.insert(pecas).values({ codigo: "TND5-CANT", nome: "Cantoneira tenda 5×5", setor: "TENDA" }).returning();
    await db.insert(pecas).values({ codigo: "TND5-TESTEIRA", nome: "Testeira de madeira (Tenda 5x5)", setor: "MARCENARIA" });
    const tenda = (await criarProjeto(cant.id)).id;
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
    const cant = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "TND5-CANT") }))!;
    const tenda = (await criarProjeto(cant.id)).id;
    const ev = await novoEvento(E.logistica);
    // Linhas gravadas direto (como numa ata de antes da regra): tenda e ultrabag, sem as linhas das regras.
    await db.insert(eventoItens).values([
      { eventoId: ev.id, tipo: "PROJETO", projetoId: tenda, quantidade: 2, origem: "AJUSTE_LOGISTICA", bomSnapshot: [{ pecaId: cant.id, codigo: "TND5-CANT", nome: "Cantoneira", setor: "TENDA", unidade: "un", quantidade: 4 }] },
      { eventoId: ev.id, tipo: "PECA", pecaId: ultrabag, quantidade: 3, origem: "AJUSTE_LOGISTICA" },
    ]);
    expect(await ressincronizarAtasAbertas("teste:regras:1")).toMatchObject({ feito: true });
    expect(await regras(ev.id)).toEqual({ "testeira-tenda-5x5": 0 });
    expect((await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "testeira-tenda-5x5"))))[0].ativo).toBe(true);
    expect(await ressincronizarAtasAbertas("teste:regras:1")).toEqual({ feito: false });
  });
});
