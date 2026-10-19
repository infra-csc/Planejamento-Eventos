/**
 * Limpeza dos eventos de teste: apaga só os códigos combinados cujo nome ainda tem "teste", com as
 * solicitações, o histórico e as notificações deles; o resto do banco fica intacto; uma vez só.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, historico, notificacoes, solicitacoes } from "@/server/db/schema";
import { enviarSolicitacao, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { apagarEventosDeTeste } from "./limpeza-testes";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

describe("apagarEventosDeTeste", { timeout: 60_000 }, () => {
  it("apaga os eventos de teste combinados e o que é deles; o resto fica", async () => {
    const db = await getDb();
    const teste = await novoEvento(E.logistica);
    await db.update(eventos).set({ nome: "TESTE · NIGHT RUN BH" }).where(eq(eventos.id, teste.id));
    const sol = await enviarSolicitacao(E.requisitante, E.logistica, teste.id, [itemAvulso("Banner", 2)]);
    await db.insert(notificacoes).values({ usuarioId: E.logistica.id, tipo: "LEMBRETE_REUNIAO", titulo: "Reunião", mensagem: "x", link: `/eventos/${teste.id}` });

    // Mesmo código combinado, mas sem "teste" no nome: não apaga.
    const real = await novoEvento(E.logistica);
    await db.update(eventos).set({ nome: "NIGHT RUN BH" }).where(eq(eventos.id, real.id));
    const outro = await novoEvento(E.logistica);
    await enviarSolicitacao(E.requisitante, E.logistica, outro.id, [itemAvulso("Faixa", 1)]);

    const r = await apagarEventosDeTeste({ chave: "limpeza:t1", codigos: [teste.codigo, real.codigo] });
    expect(r).toEqual({ feito: true, eventos: [teste.codigo], solicitacoes: [sol.codigo] });

    expect(await db.query.eventos.findFirst({ where: eq(eventos.id, teste.id) })).toBeUndefined();
    expect(await db.select().from(solicitacoes).where(eq(solicitacoes.eventoId, teste.id))).toHaveLength(0);
    expect(await db.select().from(eventoItens).where(eq(eventoItens.eventoId, teste.id))).toHaveLength(0);
    expect(await db.select().from(historico).where(eq(historico.eventoId, teste.id))).toHaveLength(0);
    expect(await db.select().from(notificacoes).where(eq(notificacoes.link, `/eventos/${teste.id}`))).toHaveLength(0);

    // Os outros eventos e o que é deles continuam.
    expect(await db.select().from(eventos).where(inArray(eventos.id, [real.id, outro.id]))).toHaveLength(2);
    expect(await db.select().from(solicitacoes).where(eq(solicitacoes.eventoId, outro.id))).toHaveLength(1);

    // Uma vez só.
    expect(await apagarEventosDeTeste({ chave: "limpeza:t1", codigos: [teste.codigo] })).toEqual({ feito: false });
  });
});
