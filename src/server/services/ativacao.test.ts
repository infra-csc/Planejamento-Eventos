/**
 * Módulo Ativação: o item ligado a uma peça sai com a OS do evento, volta pelo retorno (bons, reforma, perdidos),
 * a reforma fica à parte até concluir e a solicitação mostra quais eventos do período levam o item.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, estoqueItens, estoqueReformas, eventos, pecas } from "@/server/db/schema";
import { DomainError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { problemaConclusao, problemaRetorno, semDestinoNoRetorno, situacaoItem } from "@/domain/estoque";
import { criarUsuario, dia, eventoAberto, incluirPeca, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { abrirReforma, concluirReforma, listarReformas, listarRetornos, obterItemAtivacao, pedidosDoItem, registrarRetorno } from "./ativacao";
import { estoqueParaSolicitacao, listarEstoque, salvarItemEstoque } from "./estoque";

let E: Elenco;
let ativacao: UsuarioAtual;
let pecaId: string;
let itemId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  const [area] = await db.insert(areas).values({ nome: "Ativação" }).returning();
  ativacao = await criarUsuario("Bia da Ativação", "REQUISITANTE", area);
  const [p] = await db.insert(pecas).values({ codigo: "PUFF-T", nome: "Puff", setor: "ARENA" }).returning();
  pecaId = p.id;
  itemId = (await salvarItemEstoque(ativacao, { nome: "Puff Cubo", categoria: "Ativação", quantidade: 20, comprar: null, observacao: null, pecaId })).id;
}, 120_000);

const quantidade = async () => (await (await getDb()).query.estoqueItens.findFirst({ where: eq(estoqueItens.id, itemId) }))!.quantidade;

describe("regras do módulo", () => {
  it("retorno precisa bater com o que a OS levou ou explicar; reforma conclui somando o que estava", () => {
    expect(problemaRetorno({ levou: 8, voltaram: 5, reforma: 2, perdidos: 1 })).toBeNull();
    expect(problemaRetorno({ levou: 8, voltaram: 5, reforma: 0, perdidos: 0 })).toMatch(/levou 8/);
    expect(problemaRetorno({ levou: 8, voltaram: 5, reforma: 0, perdidos: 0, observacao: "3 ficaram no cliente" })).toBeNull();
    expect(problemaRetorno({ levou: 8, voltaram: -1, reforma: 0, perdidos: 0 })).toMatch(/inválida/);
    expect(problemaConclusao(3, 2, 1)).toBeNull();
    expect(problemaConclusao(3, 2, 0)).toMatch(/somar 3/);
    expect(situacaoItem(17, 8, 2)).toEqual({ emPosse: 17, emEvento: 8, emReforma: 2, disponivel: 9, total: 19 });
  });
});

describe("módulo Ativação", { timeout: 60_000 }, () => {
  let eventoId: string;

  it("o item sai com a OS: reservado antes da montagem, em evento depois; o retorno só depois da montagem", async () => {
    const db = await getDb();
    const { ev } = await eventoAberto(E.logistica, pecaId, null);
    eventoId = ev.id;
    const r = (await listarRetornos(ativacao)).find((x) => x.evento.id === eventoId)!;
    expect(r).toMatchObject({ situacao: "proximo", itens: [{ itemId, levou: 10 }] });
    expect((await listarEstoque(ativacao)).find((i) => i.id === itemId)).toMatchObject({ reservado: 10, emEvento: 0 });
    await expect(registrarRetorno(ativacao, eventoId, [{ itemId, voltaram: 10, reforma: 0, perdidos: 0 }])).rejects.toBeInstanceOf(DomainError);

    // O evento já montou: o item está fora.
    await db.update(eventos).set({ dataMontagem: dia(-3), dataInicio: dia(-2), dataFim: dia(-2), dataDesmontagem: dia(-1) }).where(eq(eventos.id, eventoId));
    expect((await listarRetornos(ativacao)).find((x) => x.evento.id === eventoId)?.situacao).toBe("pendente");
    expect((await listarEstoque(ativacao)).find((i) => i.id === itemId)).toMatchObject({ emEvento: 10, reservado: 0, quantidade: 20 });
  });

  it("retorno: reforma e perdidos saem do estoque; a reforma aparece em Reformas; corrigir não desconta duas vezes", async () => {
    await expect(registrarRetorno(ativacao, eventoId, [{ itemId, voltaram: 6, reforma: 0, perdidos: 0 }])).rejects.toBeInstanceOf(ValidacaoError);
    await registrarRetorno(ativacao, eventoId, [{ itemId, voltaram: 7, reforma: 2, perdidos: 1, observacao: "tecido rasgado" }]);
    expect(await quantidade()).toBe(17);
    const r = (await listarRetornos(ativacao)).find((x) => x.evento.id === eventoId)!;
    expect(r.situacao).toBe("registrado");
    expect(r.itens[0].retorno).toMatchObject({ voltaram: 7, reforma: 2, perdidos: 1 });
    let ref = (await listarReformas(ativacao)).filter((x) => x.item.id === itemId && x.status === "ABERTA");
    expect(ref.map((x) => [x.quantidade, x.evento?.id, x.motivo])).toEqual([[2, eventoId, "tecido rasgado"]]);
    expect((await listarEstoque(ativacao)).find((i) => i.id === itemId)).toMatchObject({ emEvento: 0, emReforma: 2, quantidade: 17 });

    // Corrigido: 3 para reforma e nenhum perdido (a mesma soma sai do estoque).
    await registrarRetorno(ativacao, eventoId, [{ itemId, voltaram: 7, reforma: 3, perdidos: 0 }]);
    expect(await quantidade()).toBe(17);
    ref = (await listarReformas(ativacao)).filter((x) => x.item.id === itemId && x.status === "ABERTA");
    expect(ref.map((x) => x.quantidade)).toEqual([3]);
  });

  it("concluir a reforma devolve os consertados; depois disso a reforma do retorno não muda", async () => {
    const ref = (await listarReformas(ativacao)).find((x) => x.item.id === itemId && x.status === "ABERTA")!;
    await expect(concluirReforma(ativacao, ref.id, 2, 0)).rejects.toBeInstanceOf(ValidacaoError);
    await concluirReforma(ativacao, ref.id, 2, 1);
    expect(await quantidade()).toBe(19);
    await expect(concluirReforma(ativacao, ref.id, 3, 0)).rejects.toBeInstanceOf(DomainError);
    await expect(registrarRetorno(ativacao, eventoId, [{ itemId, voltaram: 8, reforma: 2, perdidos: 0 }])).rejects.toThrow(/já foi concluída/);
  });

  it("enviar para reforma à mão tira da posse; mais do que tem, não", async () => {
    await expect(abrirReforma(ativacao, { itemId, quantidade: 50 })).rejects.toBeInstanceOf(ValidacaoError);
    await abrirReforma(ativacao, { itemId, quantidade: 4, motivo: "haste torta", local: "marcenaria", previsao: dia(5) });
    expect(await quantidade()).toBe(15);
    const d = await obterItemAtivacao(ativacao, itemId);
    expect(d.situacao).toMatchObject({ emPosse: 15, emReforma: 4, disponivel: 15 });
    expect(d.retornos).toHaveLength(1);
    expect(d.reformas.map((r) => r.status)).toEqual(["ABERTA", "CONCLUIDA"]);
    expect(d.historico.length).toBeGreaterThan(0);
    const db = await getDb();
    expect((await db.select().from(estoqueReformas).where(eq(estoqueReformas.itemId, itemId))).length).toBe(2);
  });

  it("a solicitação mostra quais eventos do período levam o item e o que está em reforma", async () => {
    const db = await getDb();
    const { ev: outro } = await eventoAberto(E.logistica, pecaId, null);
    await db.update(eventos).set({ dataMontagem: dia(-3), dataInicio: dia(-2), dataFim: dia(-2), dataDesmontagem: dia(-1) }).where(eq(eventos.id, outro.id));
    const r = await estoqueParaSolicitacao([eventoId]);
    expect(r.porPeca[pecaId]).toMatchObject({ nome: "Puff Cubo", quantidade: 15, emReforma: 4, itemId });
    expect(r.outrosEventos[eventoId][pecaId]).toEqual([{ codigo: outro.codigo, nome: outro.nome, quantidade: 10 }]);
  });

  it("pedidos do item: o que ainda não voltou e o histórico com o retorno, e a lista mostra em que eventos está", async () => {
    const p = await pedidosDoItem(ativacao, itemId);
    const devolvido = p.find((e) => e.evento.id === eventoId)!;
    expect(devolvido).toMatchObject({ situacao: "devolvido", total: 10, retorno: { voltaram: 7, reforma: 3, perdidos: 0 } });
    expect(devolvido.pedidos[0]).toMatchObject({ quantidade: 10, origem: "solta", solicitacao: null });
    const fora = p.filter((e) => e.situacao === "fora");
    expect(fora).toHaveLength(1);
    // Em andamento primeiro, histórico no fim.
    expect(p.at(-1)!.situacao).toBe("devolvido");
    const naLista = (await listarEstoque(ativacao)).find((i) => i.id === itemId)!;
    expect(naLista.eventos.map((e) => e.situacao)).toEqual(["fora"]);
  });

  it("reforma só leva o que está no galpão, não o que está fora em evento (auditoria 30/10, parte C N6)", async () => {
    // 15 em posse, 10 fora no outro evento: no galpão há 5.
    expect((await listarEstoque(ativacao)).find((i) => i.id === itemId)).toMatchObject({ quantidade: 15, emEvento: 10 });
    await expect(abrirReforma(ativacao, { itemId, quantidade: 6 })).rejects.toThrow(/há 5 no galpão \(10 de 15 estão fora em evento\)/);
    await abrirReforma(ativacao, { itemId, quantidade: 5, motivo: "costura" });
    expect(await quantidade()).toBe(10);
  });

  it("retorno com soma menor que o levado registra no histórico as unidades sem destino (auditoria 30/10, parte C N7)", async () => {
    expect(semDestinoNoRetorno({ levou: 10, voltaram: 1, reforma: 3, perdidos: 1 })).toBe(5);
    expect(semDestinoNoRetorno({ levou: 10, voltaram: 12, reforma: 0, perdidos: 0 })).toBe(0);
    const fora = (await listarRetornos(ativacao)).find((x) => x.situacao === "pendente")!;
    await registrarRetorno(ativacao, fora.evento.id, [{ itemId, voltaram: 1, reforma: 3, perdidos: 1, observacao: "5 ficaram com o cliente" }]);
    const d = await obterItemAtivacao(ativacao, itemId);
    expect(d.historico[0].descricao).toMatch(/1 voltou, 3 para reforma, 1 perdido, 5 sem destino \(contam como no galpão\)/);
  });

  it("a página do item mostra o pedido com a ata aberta, como a lista, sem mexer nos números (auditoria 30/10, parte C N25)", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pecaId, 3, null);
    const naLista = (await listarEstoque(ativacao)).find((i) => i.id === itemId)!;
    const d = await obterItemAtivacao(ativacao, itemId);
    // Mesmos eventos e mesma conta nos dois lugares; o pedido não tira do estoque.
    expect(d.eventos.map((e) => [e.evento.id, e.situacao, e.levou])).toEqual(naLista.eventos.map((e) => [e.eventoId, e.situacao, e.quantidade]));
    expect(d.eventos.find((e) => e.evento.id === ev.id)).toMatchObject({ situacao: "pedido", levou: 3, saiu: false });
    expect(d.situacao).toMatchObject({ emEvento: naLista.emEvento, reservado: naLista.reservado, emReforma: naLista.emReforma });
  });

  it("uma peça, um item; só a Ativação e o admin usam o módulo", async () => {
    await expect(salvarItemEstoque(ativacao, { nome: "Puff duplicado", categoria: "Ativação", quantidade: 1, comprar: null, observacao: null, pecaId })).rejects.toThrow(/já está ligada/);
    await expect(listarRetornos(E.logistica)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(abrirReforma(E.requisitante, { itemId, quantidade: 1 })).rejects.toBeInstanceOf(SemPermissaoError);
    expect(await listarRetornos(E.admin)).not.toHaveLength(0);
  });
});
