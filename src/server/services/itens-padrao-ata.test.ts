/** Itens padrão de toda ata: o garfo de içamento (2 un.) já nasce na ata de cada evento novo, para conferir. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, pecas } from "@/server/db/schema";
import { fecharAta, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { alterarQuantidadeLinha } from "./eventos/ata";
import { calcularOsAtual } from "./os";
import { transicionarEvento } from "./eventos/transicoes";
import { obterConferencia } from "./conferencia";
import { incluirItensPadraoAta } from "./eventos/itens-padrao";

let E: Elenco;
let garfoId: string;
let estacaId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  const [g] = await db.insert(pecas).values({ codigo: "GARFO", nome: "Garfo de içamento", setor: "ESTRUTURA" }).returning();
  garfoId = g.id;
  const [e] = await db.insert(pecas).values({ codigo: "ESTACA", nome: "Estaca de estaiamento", setor: "ESTRUTURA" }).returning();
  estacaId = e.id;
  await db.insert(pecas).values([{ codigo: "CORDA", nome: "Corda de estaiamento", setor: "ESTRUTURA" }, { codigo: "QUADRO-METAL", nome: "Quadro de metal", setor: "ESTRUTURA" }, { codigo: "GRADE-2X1", nome: "Grade 2×1 m", setor: "ESTRUTURA" }]);
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

  it("estaiamento vem a definir (0): a ata fecha assim e a projetista coloca o número depois", async () => {
    const ev = await novoEvento(E.logistica);
    const db = await getDb();
    const [estaca] = await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.pecaId, estacaId)));
    expect(estaca).toMatchObject({ quantidade: 0, ativo: true });
    expect((await obterConferencia(ev.id)).filter((l) => l.padrao).map((l) => l.codigo).sort()).toEqual(["CORDA", "ESTACA", "GARFO", "GRADE-2X1", "QUADRO-METAL"]);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    // Enquanto 0, não entra na OS.
    expect(JSON.stringify(await calcularOsAtual(db, ev.id))).not.toContain("Estaca de estaiamento");
    await alterarQuantidadeLinha(E.admin, ev.id, estaca.id, 12, "Definido pela projetista");
    const [depois] = await db.select().from(eventoItens).where(eq(eventoItens.id, estaca.id));
    expect(depois).toMatchObject({ quantidade: 12, ativo: true });
    expect(JSON.stringify(await calcularOsAtual(db, ev.id))).toContain("Estaca de estaiamento");
  });
});
