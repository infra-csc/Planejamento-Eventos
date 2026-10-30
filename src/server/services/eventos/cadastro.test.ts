/**
 * Cadastro do evento: a reunião de OS fica até o dia do evento e a janela de alterações termina depois da
 * reunião (auditoria 30/10, B-04). Evento no passado continua aceito (acertos de eventos antigos).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos } from "@/server/db/schema";
import { ValidacaoError } from "@/domain/errors";
import { migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { criarEvento, editarEvento } from "./cadastro";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

const base = { cliente: null, local: null };
const erroDe = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as ValidacaoError);

describe("ordem das datas do evento", { timeout: 60_000 }, () => {
  it("recusa reunião depois do evento e janela que termina antes da reunião, apontando o campo", async () => {
    const depois = await erroDe(criarEvento(E.logistica, { ...base, nome: "Reunião depois", dataInicio: "2026-12-10", dataReuniao: new Date("2026-12-20T14:00:00-03:00") }));
    expect(depois).toBeInstanceOf(ValidacaoError);
    expect(depois?.message).toBe("A reunião de OS (20/12/2026) fica depois do evento (10/12/2026).");
    expect(depois?.campos?.dataReuniao).toBeTruthy();

    const janela = await erroDe(criarEvento(E.logistica, { ...base, nome: "Janela antes", dataInicio: "2026-12-10", dataReuniao: new Date("2026-11-20T14:00:00-03:00"), janelaAlteracoesAte: "2026-11-01" }));
    expect(janela?.campos?.janelaAlteracoesAte).toBeTruthy();

    // Reunião no mesmo dia do evento e janela depois da reunião passam; evento no passado também.
    await expect(criarEvento(E.logistica, { ...base, nome: "Mesmo dia", dataInicio: "2026-12-10", dataReuniao: new Date("2026-12-10T09:00:00-03:00"), janelaAlteracoesAte: "2026-12-10" })).resolves.toBeTruthy();
    await expect(criarEvento(E.logistica, { ...base, nome: "Passado", dataInicio: "2026-10-01", dataReuniao: new Date("2026-08-25T14:00:00-03:00") })).resolves.toBeTruthy();
  });

  it("evento antigo fora de ordem continua editável quando as datas não mudam", async () => {
    const ev = await criarEvento(E.logistica, { ...base, nome: "Antigo", dataInicio: "2026-12-10", dataReuniao: new Date("2026-11-20T14:00:00-03:00") });
    await (await getDb()).update(eventos).set({ dataReuniao: new Date("2026-12-20T14:00:00-03:00") }).where(eq(eventos.id, ev.id));
    await expect(editarEvento(E.logistica, ev.id, { ...base, nome: "Antigo renomeado", dataInicio: "2026-12-10", dataReuniao: new Date("2026-12-20T14:00:00-03:00") })).resolves.toBeTruthy();
    await expect(editarEvento(E.logistica, ev.id, { ...base, nome: "Antigo renomeado", dataInicio: "2026-12-15", dataReuniao: new Date("2026-12-20T14:00:00-03:00") })).rejects.toBeInstanceOf(ValidacaoError);
  });
});
