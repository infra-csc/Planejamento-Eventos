/** Regras da logística na ata: tina e pallet por estande, tinas do palco show, ráfia por ultrabag. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, pecas, projetos } from "@/server/db/schema";
import { criarPeca, criarProjeto, fecharAta, incluirPeca, incluirProjeto, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { ajustarLinhaNaConferencia, obterConferencia } from "./conferencia";
import { transicionarEvento } from "./eventos/transicoes";

let E: Elenco;
let estande: string;
let palcoShow: string;
let ultrabag: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  await db.insert(pecas).values([
    { codigo: "TINA-500", nome: "Tina 500 l", setor: "ESTRUTURA" },
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
  it("acompanham a ata: estandes, palco show e ultrabags", async () => {
    const ev = await novoEvento(E.logistica);
    expect(await regras(ev.id)).toEqual({});
    const linhaEstande = await incluirProjeto(E.logistica, ev.id, estande, 3, E.areas.a.id);
    expect(await regras(ev.id)).toEqual({ "tina-contrapeso": 6, "pallet-ferro": 6 });
    await incluirProjeto(E.logistica, ev.id, palcoShow, 1, null);
    await incluirPeca(E.logistica, ev.id, ultrabag, 5, null);
    expect(await regras(ev.id)).toEqual({ "tina-contrapeso": 12, "pallet-ferro": 6, "saco-rafia": 5 });
    // Estande de 3 para 1: tina e pallet descem.
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaEstande.id, 1, "Só 1 estande");
    expect(await regras(ev.id)).toEqual({ "tina-contrapeso": 8, "pallet-ferro": 2, "saco-rafia": 5 });
    // Na conferência a linha da regra aparece com a explicação.
    const tina = (await obterConferencia(ev.id)).find((l) => l.codigo === "TINA-500")!;
    expect(tina.regra).toBe("2 por estande + 6 por palco show");
  });

  it("ajuste à mão na linha da regra fica como a logística deixou; depois da ata fechada a regra para", async () => {
    const ev = await novoEvento(E.logistica);
    const linhaEstande = await incluirProjeto(E.logistica, ev.id, estande, 2, null);
    const db = await getDb();
    const [tina] = await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "tina-contrapeso")));
    expect(tina.quantidade).toBe(4);
    await ajustarLinhaNaConferencia(E.logistica, ev.id, tina.id, 10, "Levar reserva");
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaEstande.id, 3, "Mais um estande");
    expect(await regras(ev.id)).toEqual({ "tina-contrapeso": 10, "pallet-ferro": 6 });
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    await ajustarLinhaNaConferencia(E.admin, ev.id, linhaEstande.id, 5, "Depois da ata").catch(() => null);
    expect((await regras(ev.id))["pallet-ferro"]).toBe(6);
  });
});
