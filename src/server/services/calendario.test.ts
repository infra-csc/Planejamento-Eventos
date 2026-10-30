/**
 * Calendário geral: a reunião que passou sem ser iniciada não diz "áreas enviam necessidades até aqui"
 * (auditoria 30/10, parte D N22).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos } from "@/server/db/schema";
import { dia, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { listarCalendario } from "./calendario";

let E: Elenco;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

describe("calendário › reunião", () => {
  it("reunião futura: as áreas enviam até aqui; reunião passada sem início: não iniciada", async () => {
    const futura = await novoEvento(E.logistica);
    const passada = await novoEvento(E.logistica);
    const db = await getDb();
    await db.update(eventos).set({ dataReuniao: new Date(Date.now() - 2 * 86_400_000) }).where(eq(eventos.id, passada.id));
    const itens = await listarCalendario(E.admin, dia(-5), dia(5));
    const reuniao = (id: string) => itens.find((i) => i.tipo === "reuniao" && i.evento?.id === id);
    expect(reuniao(futura.id)?.detalhe).toBe("áreas enviam necessidades até aqui");
    expect(reuniao(passada.id)?.detalhe).toBe("reunião não iniciada");
  });
});
