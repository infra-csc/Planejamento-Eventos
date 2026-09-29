/** Itens padrão de toda ata: o garfo de içamento (2 un.) já nasce na ata de cada evento novo, para conferir. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, pecas } from "@/server/db/schema";
import { migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { obterConferencia } from "./conferencia";
import { incluirItensPadraoAta } from "./eventos/itens-padrao";

let E: Elenco;
let garfoId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  const [g] = await db.insert(pecas).values({ codigo: "GARFO", nome: "Garfo de içamento", setor: "ESTRUTURA" }).returning();
  garfoId = g.id;
}, 120_000);

const linhasGarfo = async (eventoId: string) => (await getDb()).select().from(eventoItens).where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.pecaId, garfoId)));

describe("itens padrão da ata", () => {
  it("evento novo já vem com 2 garfos para conferir, marcados como item padrão", async () => {
    const ev = await novoEvento(E.logistica);
    const ls = await linhasGarfo(ev.id);
    expect(ls).toHaveLength(1);
    expect(ls[0]).toMatchObject({ quantidade: 2, tipo: "PECA", areaId: null, ativo: true, conferidoEm: null });
    const conf = await obterConferencia(ev.id);
    const garfo = conf.find((l) => l.codigo === "GARFO");
    expect(garfo?.padrao).toBe(true);
    expect(garfo?.origem).toBeNull();
  });

  it("não repete: nem se rodar de novo, nem se a logística tirou da ata", async () => {
    const ev = await novoEvento(E.logistica);
    const db = await getDb();
    expect(await incluirItensPadraoAta(db, ev.id, E.admin.id)).toHaveLength(0);
    await db.update(eventoItens).set({ ativo: false }).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.pecaId, garfoId)));
    expect(await incluirItensPadraoAta(db, ev.id, E.admin.id)).toHaveLength(0);
    expect(await linhasGarfo(ev.id)).toHaveLength(1);
  });
});
