/**
 * Auditoria de lógica (28/10) — tendas por local: `ajustarTendasDoLocal` (conferência, visão geral e quadro do item)
 * e "Incluir item" com fechamentos/calhas. Cada `it` descreve o resultado ESPERADO; os que falham comprovam um achado
 * do relatório docs/auditoria/2026-10-28-logic-auditor.md (o número do achado está no título).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, notificacoes, osVersoes, pecas, projetoItens, projetoVersoes, projetos, solicitacaoItens } from "@/server/db/schema";
import { enviarSolicitacao, fecharAta, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { incluirLinhaAta, transicionarEvento } from "./eventos";
import { ajustarTendasDoLocal, incluirTendaNaAta, obterConferencia } from "./conferencia";

let E: Elenco;
let tendaId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  const codigos = ["TND5-CANT", "TND5-TRAV", "TND5-PE", "TND5-MASTRO", "TND5-CABO", "TND5-CALHA", "TND5-FECH"];
  const criadas = await db.insert(pecas).values(codigos.map((codigo) => ({ codigo, nome: codigo, setor: "ESTRUTURA" as const }))).returning();
  const id = (c: string) => criadas.find((p) => p.codigo === c)!.id;
  const [pr] = await db.insert(projetos).values({ codigo: "PRJ-TENDA5-AUD", nome: "Tenda 5×5 m" }).returning();
  const [v] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
  await db.insert(projetoItens).values([
    { versaoId: v.id, pecaId: id("TND5-CANT"), quantidade: 4 },
    { versaoId: v.id, pecaId: id("TND5-PE"), quantidade: 4 },
    { versaoId: v.id, pecaId: id("TND5-CALHA"), quantidade: 1 },
  ]);
  tendaId = pr.id;
}, 180_000);

const doLocal = async (eventoId: string, local: string) => {
  const ls = (await obterConferencia(eventoId)).filter((l) => l.tenda && l.destino === local);
  const total = (papel: string) => ls.reduce((a, l) => a + l.quantidade * (l.tenda!.pecas.find((p) => p.papel === papel)?.porUnidade ?? 0), 0);
  return { ls, tendas: ls.reduce((a, l) => a + l.quantidade, 0), fechamentos: total("fechamento"), calhas: total("calha") };
};

const itemTenda = (quantidade: number, destino: string) => ({
  operacao: "ADICIONAR" as const,
  projetoId: tendaId,
  quantidadeSolicitada: quantidade,
  destino,
  descricoes: descricoesIguais(quantidade, "Tenda do local"),
});

const versoes = async (eventoId: string) => (await (await getDb()).select({ n: osVersoes.numero }).from(osVersoes).where(eq(osVersoes.eventoId, eventoId))).length;

describe("auditoria · tendas por local", () => {
  it("P1-1 · duas áreas pediram tenda no mesmo local: mudar só os fechamentos não pode tirar a tenda de uma área", async () => {
    const ev = await novoEvento(E.logistica);
    const solA = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [itemTenda(1, "GV")]);
    const solB = await enviarSolicitacao(E.requisitanteB, E.admin, ev.id, [itemTenda(1, "GV")]);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");

    const antes = await doLocal(ev.id, "GV");
    expect(antes).toMatchObject({ tendas: 2, fechamentos: 0, calhas: 2 });
    // A reunião só decide 1 fechamento por tenda (2 no local). Tendas e calhas continuam iguais.
    await ajustarTendasDoLocal(E.logistica, ev.id, { linhaIds: antes.ls.map((l) => l.id), tendas: 2, totais: { fechamento: 2, calha: 2 }, motivo: null });

    expect(await doLocal(ev.id, "GV")).toMatchObject({ tendas: 2, fechamentos: 2, calhas: 2 });
    const db = await getDb();
    const itemB = await db.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.solicitacaoId, solB!.id) });
    const itemA = await db.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.solicitacaoId, solA!.id) });
    // Esperado: cada área continua com a sua tenda atendida (nada foi reduzido).
    expect({ a: itemA!.status, b: itemB!.status, bAtendida: itemB!.quantidadeAtendida }).toEqual({ a: "ATENDIDO", b: "ATENDIDO", bAtendida: 1 });
    // E a área B não recebe aviso de "não atendido".
    const avisosB = await db.select().from(notificacoes).where(and(eq(notificacoes.usuarioId, E.requisitanteB.id), eq(notificacoes.tipo, "ITEM_RESPONDIDO")));
    expect(avisosB.filter((n) => /não atendido/i.test(n.titulo))).toHaveLength(0);
  });

  it("P1-2 · fechamentos que não dividem igual não podem marcar o pedido da área como parcial", async () => {
    const ev = await novoEvento(E.logistica);
    const sol = await enviarSolicitacao(E.requisitante, E.admin, ev.id, [itemTenda(2, "Dispersão")]);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    const antes = await doLocal(ev.id, "Dispersão");
    // 2 tendas, 3 fechamentos (1 tenda com 2 e 1 com 1): vira duas linhas, mas continuam 2 tendas.
    await ajustarTendasDoLocal(E.logistica, ev.id, { linhaIds: antes.ls.map((l) => l.id), tendas: 2, totais: { fechamento: 3, calha: 2 }, motivo: null });
    expect(await doLocal(ev.id, "Dispersão")).toMatchObject({ tendas: 2, fechamentos: 3, calhas: 2 });
    const item = await (await getDb()).query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.solicitacaoId, sol!.id) });
    expect({ status: item!.status, atendida: item!.quantidadeAtendida }).toEqual({ status: "ATENDIDO", atendida: 2 });
  });

  it("P2-4 · com a ata fechada, um único salvamento do quadro do local gera UMA versão da OS", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PROJETO", projetoId: tendaId, pecaId: null, descricaoLivre: null, quantidade: 2, destino: "GV", areaId: E.areas.a.id, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const antesV = await versoes(ev.id);
    const antes = await doLocal(ev.id, "GV");
    // 2 → 3 tendas, 0 → 5 fechamentos (não divide igual) e 2 → 4 calhas: uma decisão, um clique em "Salvar tendas".
    await ajustarTendasDoLocal(E.admin, ev.id, { linhaIds: antes.ls.map((l) => l.id), tendas: 3, totais: { fechamento: 5, calha: 4 }, motivo: "Cliente pediu mais uma tenda" });
    expect(await doLocal(ev.id, "GV")).toMatchObject({ tendas: 3, fechamentos: 5, calhas: 4 });
    expect(await versoes(ev.id)).toBe(antesV + 1);
  });

  it("P2-5 · incluir tenda depois da ata já com fechamentos (Incluir item) gera UMA versão da OS", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PROJETO", projetoId: tendaId, pecaId: null, descricaoLivre: null, quantidade: 1, destino: "Depósito", areaId: null, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const antesV = await versoes(ev.id);
    // Mesmo caminho de `incluirLinhaAtaAction` com tenda_fechamento/tenda_calha.
    const motivo = "Esquecida na reunião";
    await incluirTendaNaAta(E.logistica, ev.id, { referenciaTipo: "PROJETO", projetoId: tendaId, pecaId: null, descricaoLivre: null, quantidade: 2, destino: "Médica", areaId: null, justificativa: motivo }, { fechamento: 4, calha: 2 });
    expect(await doLocal(ev.id, "Médica")).toMatchObject({ tendas: 2, fechamentos: 4, calhas: 2 });
    expect(await versoes(ev.id)).toBe(antesV + 1);
  });

  it("P1-3 · o quadro do local é tudo ou nada: se um passo falha, nenhuma tenda some", async () => {
    const db = await getDb();
    // Outra tenda 5×5 (mesmo kit), que a Cenografia inativa na Biblioteca depois de a área pedir.
    const [pr] = await db.insert(projetos).values({ codigo: "PRJ-TENDA5-AUD-INAT", nome: "Tenda 5×5 m (antiga)" }).returning();
    const [v] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
    const kit = await db.query.pecas.findMany();
    const id = (c: string) => kit.find((p) => p.codigo === c)!.id;
    await db.insert(projetoItens).values([
      { versaoId: v.id, pecaId: id("TND5-CANT"), quantidade: 4 },
      { versaoId: v.id, pecaId: id("TND5-PE"), quantidade: 4 },
      { versaoId: v.id, pecaId: id("TND5-CALHA"), quantidade: 1 },
    ]);
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PROJETO", projetoId: pr.id, pecaId: null, descricaoLivre: null, quantidade: 2, destino: "Crono", areaId: null, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await db.update(projetos).set({ ativo: false }).where(eq(projetos.id, pr.id));
    const antes = (await obterConferencia(ev.id)).filter((l) => l.tenda && l.destino === "Crono");
    const tendasDoLocal = async () => (await obterConferencia(ev.id)).filter((l) => l.tenda && l.destino === "Crono").reduce((a, l) => a + l.quantidade, 0);
    expect(await tendasDoLocal()).toBe(2);
    // 2 tendas e 3 fechamentos: o quadro divide em 2 grupos (1 tenda com 2 e 1 com 1) e precisa de uma linha nova.
    const r = await ajustarTendasDoLocal(E.logistica, ev.id, { linhaIds: antes.map((l) => l.id), tendas: 2, totais: { fechamento: 3, calha: 2 }, motivo: null }).then(
      () => "ok",
      (e: Error) => `erro: ${e.message}`,
    );
    // Esperado: ou grava tudo, ou nada (continua com 2 tendas). Nunca 1 tenda com erro na tela.
    expect({ r, tendas: await tendasDoLocal() }).toMatchObject({ tendas: 2 });
  });

  it("P3-10 · totais sem a calha (campo ausente) não podem zerar as calhas do local", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PROJETO", projetoId: tendaId, pecaId: null, descricaoLivre: null, quantidade: 2, destino: "Extra", areaId: null, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    const antes = await doLocal(ev.id, "Extra");
    // A ação aceita `totais` parcial ({fechamento} sem calha); o domínio (`totalDoLocal`) trata ausente como "padrão × tendas".
    await ajustarTendasDoLocal(E.logistica, ev.id, { linhaIds: antes.ls.map((l) => l.id), tendas: 2, totais: { fechamento: 2 }, motivo: null });
    expect(await doLocal(ev.id, "Extra")).toMatchObject({ tendas: 2, fechamentos: 2, calhas: 2 });
  });

  it("OK · dois salvamentos seguidos do mesmo local (autosave) não podem duplicar linhas", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PROJETO", projetoId: tendaId, pecaId: null, descricaoLivre: null, quantidade: 2, destino: "Som", areaId: null, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    const ids = (await doLocal(ev.id, "Som")).ls.map((l) => l.id);
    // A tela de conferência grava 700 ms depois do último clique; com a máquina lenta, o segundo salvamento sai com a
    // mesma lista de linhas enquanto o primeiro ainda roda. O último valor (2 tendas, 4 fechamentos) é o que vale.
    const r = await Promise.allSettled([
      ajustarTendasDoLocal(E.logistica, ev.id, { linhaIds: ids, tendas: 2, totais: { fechamento: 3, calha: 2 }, motivo: null }),
      ajustarTendasDoLocal(E.logistica, ev.id, { linhaIds: ids, tendas: 2, totais: { fechamento: 4, calha: 2 }, motivo: null }),
    ]);
    const final = await doLocal(ev.id, "Som");
    const ativas = await (await getDb()).select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.destino, "Som"), eq(eventoItens.ativo, true)));
    // Aceitável: o segundo é recusado (linha mudou) OU o resultado é exatamente um dos dois pedidos. Nunca uma mistura.
    const coerente = (final.tendas === 2 && final.calhas === 2 && (final.fechamentos === 3 || final.fechamentos === 4));
    expect({ coerente, tendas: final.tendas, fechamentos: final.fechamentos, calhas: final.calhas, linhas: ativas.length, status: r.map((x) => x.status) }).toMatchObject({ coerente: true });
  });
});
