/**
 * Evento de teste copiado de um real: solicitações com códigos novos, linhas da ata sem conferência e
 * ligadas às cópias dos itens, original intacto; uma vez só; sem o evento de origem, nada acontece.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventoItens, eventos, solicitacaoItens, solicitacoes } from "@/server/db/schema";
import { criarPeca, enviarSolicitacao, incluirPeca, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { conferirTodasLinhas } from "./reuniao";
import { copiarEventoParaTeste } from "./copia-teste";

let E: Elenco;
beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

describe("copiarEventoParaTeste", { timeout: 60_000 }, () => {
  it("sem o evento de origem não faz nada nem grava a marca", async () => {
    const r = await copiarEventoParaTeste({ chave: "teste:copia:inexistente", codigoOrigem: "EVT-9999", reuniao: "2026-10-20T09:00" });
    expect(r.feito).toBe(false);
    const db = await getDb();
    expect(await db.query.configuracoes.findFirst({ where: eq(configuracoes.chave, "teste:copia:inexistente") })).toBeUndefined();
  });

  it("copia solicitações e linhas da ata, sem conferência, e não mexe no original", async () => {
    const db = await getDb();
    const ev = await novoEvento(E.logistica);
    await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Banner da largada", 2), itemAvulso("Faixa de chegada", 1)]);
    const peca = await criarPeca();
    await incluirPeca(E.logistica, ev.id, peca.id, 7, null);
    await conferirTodasLinhas(E.logistica, ev.id);
    const antes = await db.select().from(eventoItens).where(eq(eventoItens.eventoId, ev.id));

    const r = await copiarEventoParaTeste({ chave: "teste:copia:1", codigoOrigem: ev.codigo, reuniao: "2026-10-20T09:00" });
    expect(r.feito).toBe(true);
    if (!r.feito) return;
    const copia = (await db.query.eventos.findFirst({ where: eq(eventos.codigo, r.codigo) }))!;
    expect(copia.nome.startsWith("TESTE · ")).toBe(true);
    expect(copia.status).toBe("PREPARACAO");
    expect(copia.dataCarga).toBeNull();

    const sols = await db.select().from(solicitacoes).where(eq(solicitacoes.eventoId, copia.id));
    expect(sols).toHaveLength(1);
    expect(r.solicitacoes).toEqual([sols[0].codigo]);
    const itens = await db.select().from(solicitacaoItens).where(eq(solicitacaoItens.solicitacaoId, sols[0].id));
    expect(itens.map((i) => i.descricaoLivre).sort()).toEqual(["Banner da largada", "Faixa de chegada"]);

    const linhas = await db.select().from(eventoItens).where(eq(eventoItens.eventoId, copia.id));
    expect(linhas).toHaveLength(antes.filter((l) => l.ativo).length);
    expect(linhas.every((l) => l.conferidoEm === null)).toBe(true);
    // Linha que veio de pedido aponta para o item copiado (nunca para o do evento original).
    const ids = new Set(itens.map((i) => i.id));
    expect(linhas.filter((l) => l.solicitacaoItemId).every((l) => ids.has(l.solicitacaoItemId!))).toBe(true);
    expect(linhas.filter((l) => l.solicitacaoItemId)).toHaveLength(2);

    // Original intacto: mesmas linhas, ainda conferidas.
    const depois = await db.select().from(eventoItens).where(eq(eventoItens.eventoId, ev.id));
    expect(depois.map((l) => [l.id, l.quantidade, Boolean(l.conferidoEm)])).toEqual(antes.map((l) => [l.id, l.quantidade, Boolean(l.conferidoEm)]));

    // Uma vez só.
    expect((await copiarEventoParaTeste({ chave: "teste:copia:1", codigoOrigem: ev.codigo, reuniao: "2026-10-20T09:00" })).feito).toBe(false);
  });
});
