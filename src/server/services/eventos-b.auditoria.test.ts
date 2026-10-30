/**
 * Auditoria de 28/10 e 30/10, parte B (eventos, ata, OS): o que mudou no servidor. Cada `it` cita o achado
 * (nº do consolidado ou B-xx de docs/auditoria/2026-10-30-parte-B.md).
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, historico, pecas, projetoItens, projetoVersoes, projetos } from "@/server/db/schema";
import { criarPeca, enviarSolicitacao, eventoAberto, fecharAta, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { descricoesIguais } from "@/domain/descricoes-itens";
import { conferirLinha, contarAjustesPosAta, contarLinhasConferidas, detalhesListaEventos, editarEvento, incluirLinhaAta, listarEventos, resumoAbasEvento, salvarDadosReuniao, transicionarEvento } from "./eventos";
import { ajustarTendasDoLocal, obterConferencia } from "./conferencia";
import { salvarSeparacao } from "./separacao";

let E: Elenco;
let tendaId: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  const codigos = ["TND5-CANT", "TND5-PE", "TND5-CALHA", "TND5-FECH"];
  const criadas = await db.insert(pecas).values(codigos.map((codigo) => ({ codigo, nome: codigo, setor: "ESTRUTURA" as const }))).returning();
  const id = (c: string) => criadas.find((p) => p.codigo === c)!.id;
  const [pr] = await db.insert(projetos).values({ codigo: "PRJ-TENDA5-AUDB", nome: "Tenda 5×5 m" }).returning();
  const [v] = await db.insert(projetoVersoes).values({ projetoId: pr.id, numero: 1 }).returning();
  await db.insert(projetoItens).values([
    { versaoId: v.id, pecaId: id("TND5-CANT"), quantidade: 4 },
    { versaoId: v.id, pecaId: id("TND5-PE"), quantidade: 4 },
    { versaoId: v.id, pecaId: id("TND5-CALHA"), quantidade: 1 },
  ]);
  tendaId = pr.id;
}, 180_000);

const novaPeca = async (eventoId: string, quantidade = 1) =>
  incluirLinhaAta(E.logistica, eventoId, { referenciaTipo: "PECA", projetoId: null, pecaId: (await criarPeca()).id, descricaoLivre: null, quantidade, destino: null, areaId: null, justificativa: "entrou depois da ata" });

describe("auditoria parte B · servidor", () => {
  it("B-09 · a fase “Reunião de OS” conta as linhas da ata congelada, não as de hoje", async () => {
    const { ev } = await eventoAberto(E.logistica, (await criarPeca()).id, null);
    const antes = await resumoAbasEvento(E.logistica, ev.id);
    await novaPeca(ev.id);
    await novaPeca(ev.id);
    const depois = await resumoAbasEvento(E.logistica, ev.id);
    expect(depois.linhas).toBe(antes.linhas + 2);
    expect(depois.linhasAtaFechada).toBe(antes.linhasAtaFechada);
    expect(depois.linhasAtaFechada).toBeGreaterThan(0);
    const semAta = await novoEvento(E.logistica);
    expect((await resumoAbasEvento(E.logistica, semAta.id)).linhasAtaFechada).toBeNull();
  });

  it("B-11 · a folha de separação não muda em evento cancelado (a tela não oferece; o servidor aceitava)", async () => {
    const ev = await novoEvento(E.logistica);
    await expect(salvarSeparacao(E.logistica, ev.id, { locada: true, q15Locado: false })).resolves.toMatchObject({ locada: true });
    await transicionarEvento(E.logistica, ev.id, "CANCELAR", "Cliente desistiu");
    await expect(salvarSeparacao(E.logistica, ev.id, { locada: false, q15Locado: false })).rejects.toThrow("Evento cancelado: a folha de separação não muda mais.");
  });

  it("B-30 · dados da reunião de evento cancelado: a mensagem não fala em “fechar a ata”", async () => {
    const ev = await novoEvento(E.logistica);
    await transicionarEvento(E.logistica, ev.id, "CANCELAR", "Cliente desistiu");
    const dados = { reuniaoPresentes: "Marina", publicoEsperado: null, caminhaoCarrega: null, caminhaoSai: null, arenaDescarrega: null, kitDescarrega: null };
    await expect(salvarDadosReuniao(E.logistica, ev.id, dados)).rejects.toThrow("Evento cancelado: os dados da reunião não mudam mais.");
  });

  it("nº 81 · a ação fora da fase diz o que fazer, e não “não é possível no estado atual”", async () => {
    const ev = await novoEvento(E.logistica);
    await expect(transicionarEvento(E.logistica, ev.id, "FECHAR_ATA")).rejects.toThrow("Não dá para “Fechar ata” agora: o evento mudou de fase. Atualize a página.");
  });

  it("B-25 · busca “%” ou “_” é literal (antes virava busca vazia e listava todos os eventos)", async () => {
    const ev = await novoEvento(E.logistica);
    await editarEvento(E.logistica, ev.id, { nome: "Corrida 100% Mulher", cliente: "Cliente", local: "Local", dataMontagem: ev.dataMontagem, dataInicio: ev.dataInicio, dataFim: ev.dataFim, dataDesmontagem: ev.dataDesmontagem, dataReuniao: ev.dataReuniao, dataCarga: null, responsavelId: E.logistica.id });
    const todos = await listarEventos(E.logistica);
    const porcento = await listarEventos(E.logistica, { busca: "%" });
    expect(todos.length).toBeGreaterThan(1);
    expect(porcento.map((e) => e.id)).toEqual([ev.id]);
    expect(await listarEventos(E.logistica, { busca: "_" })).toEqual([]);
  });

  it("nº 69 · versão da OS e áreas que pediram vêm só dos eventos da página", async () => {
    const { ev } = await eventoAberto(E.logistica, (await criarPeca()).id, null);
    const outro = await novoEvento(E.logistica);
    await enviarSolicitacao(E.requisitante, E.logistica, outro.id, [{ operacao: "ADICIONAR", projetoId: tendaId, quantidadeSolicitada: 1, destino: "GV", descricoes: descricoesIguais(1, "Tenda") }]);
    const d = await detalhesListaEventos([ev.id, outro.id]);
    expect(d.get(ev.id)).toEqual({ versaoOs: 1, areasQuePediram: [] });
    expect(d.get(outro.id)).toEqual({ versaoOs: 0, areasQuePediram: [E.requisitante.areaId] });
    expect((await detalhesListaEventos([])).size).toBe(0);
    // A lista em si não traz mais esses campos (eram agregados de todas as solicitações e OS do banco).
    const linha = (await listarEventos(E.logistica)).find((e) => e.id === ev.id)!;
    expect("versaoOs" in linha).toBe(false);
  });

  it("nº 146 · a edição do evento conta as linhas conferidas no banco, sem montar a ata", async () => {
    const ev = await novoEvento(E.logistica);
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId: (await criarPeca()).id, descricaoLivre: null, quantidade: 1, destino: null, areaId: null, justificativa: null });
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId: (await criarPeca()).id, descricaoLivre: null, quantidade: 1, destino: null, areaId: null, justificativa: null });
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    expect(await contarLinhasConferidas(ev.id)).toBe(0);
    const [primeira] = await obterConferencia(ev.id);
    await conferirLinha(E.logistica, ev.id, primeira.id, true);
    expect(await contarLinhasConferidas(ev.id)).toBe(1);
  });

  it("nº 146 · a aba Ata conta os ajustes depois da ata sem ler o histórico inteiro, com a mesma conta da visão geral", async () => {
    const { ev } = await eventoAberto(E.logistica, (await criarPeca()).id, null);
    const ataFechadaEm = (await (await getDb()).query.eventos.findFirst({ where: (t, { eq }) => eq(t.id, ev.id) }))!.ataFechadaEm;
    expect(await contarAjustesPosAta(E.logistica, ev.id, ataFechadaEm)).toBe(0);
    await novaPeca(ev.id);
    await novaPeca(ev.id);
    expect(await contarAjustesPosAta(E.logistica, ev.id, ataFechadaEm)).toBe(2);
    expect(await contarAjustesPosAta(E.logistica, ev.id, null)).toBe(0);
  });

  it("B-16 · o histórico do quadro de tendas mostra só o que mudou (sem “1 → 1”) e o aviso não repete totais iguais", async () => {
    const ev = await novoEvento(E.logistica);
    await enviarSolicitacao(E.requisitante, E.admin, ev.id, [{ operacao: "ADICIONAR", projetoId: tendaId, quantidadeSolicitada: 2, destino: "Praça", descricoes: descricoesIguais(2, "Tenda") }]);
    await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const ls = (await obterConferencia(ev.id)).filter((l) => l.tenda && l.destino === "Praça");
    // Só os fechamentos mudam: 2 tendas continuam 2, e as calhas (2) também.
    await ajustarTendasDoLocal(E.admin, ev.id, { linhaIds: ls.map((l) => l.id), tendas: 2, totais: { fechamento: 4, calha: 2 }, motivo: "Cliente pediu fechamento" });
    const db = await getDb();
    const [h] = await db
      .select({ descricao: historico.descricao })
      .from(historico)
      .where(and(eq(historico.eventoId, ev.id), eq(historico.entidade, "evento_item"), eq(historico.acao, "ATA_QUANTIDADE")))
      .orderBy(desc(historico.criadoEm))
      .limit(1);
    expect(h.descricao).toContain("Tendas de Praça: 2 tendas");
    expect(h.descricao).not.toMatch(/\b2 → 2\b/);
    expect(h.descricao).toContain("2 fechamentos e 1 calha por tenda");
    const ativas = await db.select({ id: eventoItens.id }).from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.ativo, true)));
    expect(ativas.length).toBeGreaterThan(0);
  });
});
