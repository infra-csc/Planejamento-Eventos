/** Logística de materiais (briefing v2): contagem como livro-razão, Atende por, Projeção com o que está no banco e permissões. */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { contagens, eventos, movimentacaoLinhas, movimentacoes, pecas, solicitacaoItens } from "@/server/db/schema";
import { SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { criarPeca, criarProjeto, enviarSolicitacao, fecharAta, incluirPeca, incluirProjeto, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { transicionarEvento } from "./eventos/transicoes";
import { almoxarifadoPrincipal, criarPecaDoItemAtivacao, definirAtendePor, garantirAlmoxarifados, listarAlmoxarifados, salvarAlmoxarifado, salvarEstruturaEvento, salvarLocador, salvarLogisticaEvento, salvarPerfil, salvarTour, listarPerfis, vincularItemAtivacao } from "./logistica";
import { calcularProjecao, documentoFornecedor, estimativaDoEvento } from "./projecao";
import { registrarContagem, salvarCobertura, saldosAtuais } from "./saldo";
import { dadosDoSaneamento } from "./saneamento";

let E: Elenco;
let principal: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  await garantirAlmoxarifados(db);
  principal = (await almoxarifadoPrincipal(db))!.id;
}, 120_000);

const ONTEM = "2026-06-01";
const contar = (pecaId: string, contado: number, extra: { justificativa?: string | null; locadorId?: string | null; almoxarifadoId?: string; dataContagem?: string } = {}) =>
  registrarContagem(E.admin, { almoxarifadoId: extra.almoxarifadoId ?? principal, dataContagem: extra.dataContagem ?? ONTEM, justificativa: "justificativa" in extra ? (extra.justificativa ?? null) : "Conferência", linhas: [{ pecaId, locadorId: extra.locadorId ?? null, contado }] });

/** Evento com saída e retorno fixos, para a conta não depender de hoje. */
async function eventoEm(saida: string, retorno: string) {
  const ev = await novoEvento(E.logistica);
  await salvarLogisticaEvento(E.admin, ev.id, { saidaPrevista: saida, retornoPrevisto: retorno, eventoPaiId: null, tourId: null });
  return ev;
}
const INICIO = "2030-03-04";
const linhaDa = async (pecaId: string, filtros = {}) => (await calcularProjecao(E.admin, { inicio: INICIO, semanas: 4, ...filtros })).linhas.find((l) => l.pecaId === pecaId);

describe("almoxarifados de partida", () => {
  it("garante o principal e a Ativação uma vez só", async () => {
    expect(await garantirAlmoxarifados()).toBe(0);
    const nomes = (await listarAlmoxarifados()).map((a) => a.nome);
    expect(nomes).toContain("Galpão principal");
    expect(nomes).toContain("Ativação");
  });

  it("sempre há um principal: trocar desmarca o outro, e o atual não pode ser desmarcado direto", async () => {
    const a = (await listarAlmoxarifados()).find((x) => x.principal)!;
    await expect(salvarAlmoxarifado(E.admin, a.id, { nome: a.nome, endereco: null, areaId: null, principal: false, ativo: true })).rejects.toBeInstanceOf(ValidacaoError);
  });
});

describe("contagem: o saldo nunca é digitado", () => {
  it("primeira contagem é saldo inicial; depois, a diferença vira ajuste, com justificativa", async () => {
    const db = await getDb();
    const alm = await salvarAlmoxarifado(E.admin, null, { nome: "Galpão de teste A", endereco: null, areaId: null, principal: false, ativo: true });
    const peca = await criarPeca();
    const r1 = await contar(peca.id, 100, { almoxarifadoId: alm });
    expect(r1).toMatchObject({ primeira: true, diferencas: 1 });
    expect(r1.numero).toMatch(/^MV-2026-\d{6}$/);
    const saldo = async () => (await saldosAtuais(db, alm)).find((s) => s.pecaId === peca.id)?.quantidade;
    expect(await saldo()).toBe(100);
    await expect(contar(peca.id, 90, { almoxarifadoId: alm, justificativa: null })).rejects.toBeInstanceOf(ValidacaoError);
    const r2 = await contar(peca.id, 90, { almoxarifadoId: alm });
    expect(await saldo()).toBe(90);
    const mov = (await db.select().from(movimentacoes).where(eq(movimentacoes.numero, r2.numero!)))[0];
    expect(mov.tipo).toBe("AJUSTE_INVENTARIO");
    expect((await db.select().from(movimentacaoLinhas).where(eq(movimentacaoLinhas.movimentacaoId, mov.id))).map((l) => l.quantidade)).toEqual([-10]);
    // Sem diferença: registra a contagem, não gera lançamento nem pede justificativa.
    expect(await contar(peca.id, 90, { almoxarifadoId: alm, justificativa: null })).toMatchObject({ diferencas: 0, numero: null });
    expect((await db.select().from(contagens).where(eq(contagens.almoxarifadoId, alm))).length).toBe(3);
  });

  it("recusa data futura, data antes da última contagem, quantidade negativa e linha repetida", async () => {
    const peca = await criarPeca();
    await expect(contar(peca.id, 1, { dataContagem: "2999-01-01" })).rejects.toBeInstanceOf(ValidacaoError);
    await expect(contar(peca.id, -1)).rejects.toBeInstanceOf(ValidacaoError);
    await expect(registrarContagem(E.admin, { almoxarifadoId: principal, dataContagem: ONTEM, justificativa: "x", linhas: [{ pecaId: peca.id, locadorId: null, contado: 1 }, { pecaId: peca.id, locadorId: null, contado: 2 }] })).rejects.toBeInstanceOf(ValidacaoError);
    const alm = await salvarAlmoxarifado(E.admin, null, { nome: `Galpão ${peca.codigo}`, endereco: null, areaId: null, principal: false, ativo: true });
    await contar(peca.id, 5, { dataContagem: "2026-02-01", almoxarifadoId: alm });
    await expect(contar(peca.id, 6, { dataContagem: "2026-01-15", almoxarifadoId: alm })).rejects.toBeInstanceOf(ValidacaoError);
  });

  it("o dono fica no saldo: Norte e locador somam separados", async () => {
    const peca = await criarPeca();
    const locadorId = await salvarLocador(E.admin, null, { nome: `Locador ${peca.codigo}`, contato: null, cnpj: null, ativo: true });
    await contar(peca.id, 10, {});
    await contar(peca.id, 4, { locadorId });
    const s = (await saldosAtuais()).filter((x) => x.pecaId === peca.id && x.almoxarifadoId === principal);
    expect(s.map((x) => [x.locadorId, x.quantidade]).sort((a, b) => Number(b[1]) - Number(a[1]))).toEqual([[null, 10], [locadorId, 4]]);
  });

  it("por enquanto, só o administrador conta", async () => {
    const peca = await criarPeca();
    for (const u of [E.logistica, E.requisitante, E.cenografia, E.gestao]) await expect(registrarContagem(u, { almoxarifadoId: principal, dataContagem: ONTEM, justificativa: null, linhas: [{ pecaId: peca.id, locadorId: null, contado: 1 }] })).rejects.toBeInstanceOf(SemPermissaoError);
  });
});

describe("Projeção com o que está no banco", () => {
  it("critério 1: duas saídas sobrepostas, faltam 10", async () => {
    const peca = await criarPeca();
    await contar(peca.id, 100);
    const a = await eventoEm("2030-03-05", "2030-03-10");
    const b = await eventoEm("2030-03-08", "2030-03-12");
    await incluirPeca(E.logistica, a.id, peca.id, 60, null);
    await incluirPeca(E.logistica, b.id, peca.id, 50, null);
    const l = await linhaDa(peca.id);
    expect(l?.celulas[0].minimo).toBe(-10);
    const p = await calcularProjecao(E.admin, { inicio: INICIO, semanas: 4 });
    const falta = p.faltas.find((f) => f.pecaId === peca.id)!;
    expect(falta.faltam).toBe(10);
    expect(new Set(falta.eventos.map((e) => e.eventoId))).toEqual(new Set([a.id, b.id]));
  });

  it("critério 3: antes da ata é estimada; tirar a camada tira da conta", async () => {
    const peca = await criarPeca();
    await contar(peca.id, 100);
    const ev = await eventoEm("2030-03-05", "2030-03-10");
    await incluirPeca(E.logistica, ev.id, peca.id, 60, null);
    expect((await linhaDa(peca.id))?.celulas[0].minimo).toBe(40);
    expect(await linhaDa(peca.id, { camadas: ["CONFIRMADA"] })).toBeUndefined();
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    expect((await linhaDa(peca.id, { camadas: ["CONFIRMADA"] }))?.celulas[0].minimo).toBe(40);
  });

  it("critério 4: estrutura terceirizada não entra; a marcenaria do projeto e o complemento ao montador entram", async () => {
    const db = await getDb();
    const box = await criarPeca();
    await db.update(pecas).set({ setor: "ESTRUTURA" }).where(eq(pecas.id, box.id));
    const coluna = await criarPeca();
    await db.update(pecas).set({ setor: "MARCENARIA" }).where(eq(pecas.id, coluna.id));
    const estaio = await criarPeca();
    await db.update(pecas).set({ setor: "ESTRUTURA" }).where(eq(pecas.id, estaio.id));
    await contar(box.id, 100);
    await contar(coluna.id, 100);
    await contar(estaio.id, 100);
    const ev = await eventoEm("2030-03-05", "2030-03-10");
    const projeto = await criarProjeto(box.id);
    const { projetoItens, projetoVersoes, projetos } = await import("@/server/db/schema");
    await db.update(projetos).set({ nome: "Stand 9×6 m", categoria: "Estande" }).where(eq(projetos.id, projeto.id));
    const versao = (await db.select().from(projetoVersoes).where(eq(projetoVersoes.projetoId, projeto.id)))[0];
    await db.insert(projetoItens).values({ versaoId: versao.id, pecaId: coluna.id, quantidade: 2 });
    await incluirProjeto(E.logistica, ev.id, projeto.id, 1, null);
    const complemento = await incluirPeca(E.logistica, ev.id, estaio.id, 3, null);
    expect(await linhaDa(box.id)).toBeDefined();
    await salvarEstruturaEvento(E.admin, ev.id, "TERCEIRIZADA", "Montadora X");
    expect(await linhaDa(box.id)).toBeUndefined();
    expect((await linhaDa(coluna.id))?.celulas[0].minimo).toBe(98);
    // O complemento é decidido na linha: a mudança no evento não mexe nele.
    expect(await linhaDa(estaio.id)).toBeUndefined();
    await definirAtendePor(E.admin, ev.id, [complemento.id], { atendePor: "GALPAO_NORTE", almoxarifadoId: null, montador: "Montadora X" });
    expect((await linhaDa(estaio.id))?.celulas[0].minimo).toBe(97);
    // Documento do fornecedor: só o terceirizado, mais "Enviado pela Norte".
    const doc = await documentoFornecedor(ev.id);
    expect(doc.terceirizadas.flatMap((b) => b.pecas.map((p) => p.codigo))).toEqual([box.codigo]);
    expect(doc.enviadoPelaNorte.map((b) => b.montador)).toEqual(["Montadora X"]);
    expect(doc.enviadoPelaNorte[0].pecas.map((p) => p.codigo)).toEqual([estaio.codigo]);
    // A definir: entra só com o filtro.
    await salvarEstruturaEvento(E.admin, ev.id, "A_DEFINIR", null);
    expect((await linhaDa(box.id))?.celulas[0]).toBeDefined();
    expect(await linhaDa(box.id, { incluirADefinir: false })).toBeUndefined();
  });

  it("critério 5: pedido 30, parcial 20, a Projeção usa 20", async () => {
    const db = await getDb();
    const peca = await criarPeca();
    await contar(peca.id, 100);
    const ev = await eventoEm("2030-03-05", "2030-03-10");
    // A linha guarda a quantidade atendida; a marca de parcial no item faz dela confirmada.
    const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Item qualquer", 30)]);
    const [item] = await db.select().from(solicitacaoItens).where(eq(solicitacaoItens.solicitacaoId, s.id));
    await db.update(solicitacaoItens).set({ status: "PARCIAL", pecaId: peca.id, descricaoLivre: null, quantidadeAtendida: 20 }).where(eq(solicitacaoItens.id, item.id));
    const { eventoItens } = await import("@/server/db/schema");
    const ligadas = await db.update(eventoItens).set({ tipo: "PECA", pecaId: peca.id, descricaoLivre: null, quantidade: 20 }).where(eq(eventoItens.solicitacaoItemId, item.id)).returning();
    expect(ligadas).toHaveLength(1);
    expect((await linhaDa(peca.id, { camadas: ["CONFIRMADA"] }))?.celulas[0].minimo).toBe(80);
  });

  it("critério 2: tour no banco, retornável pelo maior e consumível pela soma", async () => {
    const db = await getDb();
    const ret = await criarPeca();
    const con = await criarPeca();
    await db.update(pecas).set({ tipoItem: "CONSUMIVEL" }).where(eq(pecas.id, con.id));
    await contar(ret.id, 100);
    await contar(con.id, 500);
    const a = await eventoEm("2030-03-05", "2030-03-07");
    const b = await eventoEm("2030-03-08", "2030-03-10");
    const c = await eventoEm("2030-03-11", "2030-03-13");
    await salvarTour(E.admin, null, { nome: `Tour ${ret.codigo}`, ativo: true, eventoIds: [a.id, b.id, c.id] });
    for (const [ev, r, s] of [[a, 30, 100], [b, 40, 120], [c, 35, 90]] as const) {
      await incluirPeca(E.logistica, ev.id, ret.id, r, null);
      await incluirPeca(E.logistica, ev.id, con.id, s, null);
    }
    expect((await linhaDa(ret.id))?.celulas.map((x) => x.minimo)).toEqual([60, 60, 100, 100]);
    expect((await linhaDa(con.id))?.celulas.map((x) => x.minimo)).toEqual([190, 190, 190, 190]);
    expect((await db.select().from(eventos).where(eq(eventos.id, b.id)))[0].tourOrdem).toBe(2);
  });

  it("locação prevista cobre a falta; exige locador; almoxarifado sem contagem fica de fora", async () => {
    const peca = await criarPeca();
    await contar(peca.id, 10);
    const ev = await eventoEm("2030-03-05", "2030-03-10");
    await incluirPeca(E.logistica, ev.id, peca.id, 15, null);
    expect((await calcularProjecao(E.admin, { inicio: INICIO, semanas: 4 })).faltas.some((f) => f.pecaId === peca.id)).toBe(true);
    const base = { tipo: "LOCACAO" as const, pecaId: peca.id, almoxarifadoId: principal, quantidade: 5, dataEntrada: "2030-03-01", dataDevolucao: "2030-03-20", eventoId: null, observacao: null };
    await expect(salvarCobertura(E.admin, null, { ...base, locadorId: null })).rejects.toBeInstanceOf(ValidacaoError);
    const locadorId = await salvarLocador(E.admin, null, { nome: `Locador 2 ${peca.codigo}`, contato: null, cnpj: null, ativo: true });
    await salvarCobertura(E.admin, null, { ...base, locadorId });
    expect((await calcularProjecao(E.admin, { inicio: INICIO, semanas: 4 })).faltas.some((f) => f.pecaId === peca.id)).toBe(false);
    await expect(salvarCobertura(E.requisitante, null, { ...base, locadorId })).rejects.toBeInstanceOf(SemPermissaoError);
  });

  it("por enquanto, só o administrador vê e usa", async () => {
    const ev = await novoEvento(E.logistica);
    await expect(calcularProjecao(E.admin, { inicio: INICIO, semanas: 4 })).resolves.toBeDefined();
    for (const u of [E.logistica, E.cenografia, E.gestao, E.requisitante]) {
      await expect(calcularProjecao(u, { inicio: INICIO, semanas: 4 })).rejects.toBeInstanceOf(SemPermissaoError);
      await expect(salvarEstruturaEvento(u, ev.id, "TERCEIRIZADA", null)).rejects.toBeInstanceOf(SemPermissaoError);
      await expect(salvarLogisticaEvento(u, ev.id, { saidaPrevista: null, retornoPrevisto: null, eventoPaiId: null, tourId: null })).rejects.toBeInstanceOf(SemPermissaoError);
      await expect(definirAtendePor(u, ev.id, ["x"], { atendePor: null, almoxarifadoId: null, montador: null })).rejects.toBeInstanceOf(SemPermissaoError);
      await expect(salvarLocador(u, null, { nome: "Sem permissão", contato: null, cnpj: null, ativo: true })).rejects.toBeInstanceOf(SemPermissaoError);
      await expect(dadosDoSaneamento(u)).rejects.toBeInstanceOf(SemPermissaoError);
    }
  });
});

describe("cubagem e saneamento", () => {
  it("usa o perfil de referência, com o redutor, e avisa da peça sem m³", async () => {
    const db = await getDb();
    const comVolume = await criarPeca();
    const semVolume = await criarPeca();
    await db.update(pecas).set({ volumeM3: 2 }).where(eq(pecas.id, comVolume.id));
    await salvarPerfil(E.admin, null, { tipo: "carreta", nome: "Carreta teste", comprimentoM: 10, larguraM: 2, alturaM: 3, redutorPct: 15, referencia: true, ativo: true });
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, comVolume.id, 30, null);
    await incluirPeca(E.logistica, ev.id, semVolume.id, 1, null);
    const r = await estimativaDoEvento(ev.id);
    expect(r.volumeTotal).toBe(60);
    expect(r.pecasSemVolume).toBe(1);
    expect(r.porPerfil.find((p) => p.perfil === "Carreta teste")?.veiculos).toBe(2);
    // Referência é uma por tipo.
    await salvarPerfil(E.admin, null, { tipo: "carreta", nome: "Carreta teste 2", comprimentoM: 12, larguraM: 2, alturaM: 3, redutorPct: 15, referencia: true, ativo: true });
    expect((await listarPerfis()).filter((p) => p.tipo === "carreta" && p.referencia).map((p) => p.nome)).toEqual(["Carreta teste 2"]);
  });

  it("aponta evento antes da reunião, peça sem tipo e item da Ativação sem peça; ligar e criar resolvem", async () => {
    const db = await getDb();
    const { estoqueItens } = await import("@/server/db/schema");
    const ev = await novoEvento(E.logistica);
    await db.update(eventos).set({ dataInicio: "2020-01-01", dataMontagem: "2020-01-01", dataFim: "2020-01-01", dataDesmontagem: "2020-01-01" }).where(eq(eventos.id, ev.id));
    const peca = await criarPeca();
    const [i1] = await db.insert(estoqueItens).values({ nome: "Puff de teste", quantidade: 4 }).returning();
    const [i2] = await db.insert(estoqueItens).values({ nome: "Tapete Áurea", quantidade: 2 }).returning();
    const d = await dadosDoSaneamento(E.admin);
    expect(d.eventos.find((e) => e.id === ev.id)?.problemas).toContain("EVENTO_ANTES_DA_REUNIAO");
    expect(d.semTipo.some((p) => p.id === peca.id)).toBe(true);
    expect(d.itensSemVinculo.map((x) => x.id)).toEqual(expect.arrayContaining([i1.id, i2.id]));
    await vincularItemAtivacao(E.admin, i1.id, peca.id);
    const nova = await criarPecaDoItemAtivacao(E.admin, i2.id);
    expect(nova.codigo).toBe("ATV-TAPETE-AUREA");
    await expect(criarPecaDoItemAtivacao(E.admin, i2.id)).rejects.toThrow(/já está ligado/);
    expect((await dadosDoSaneamento(E.admin)).itensSemVinculo.map((x) => x.id)).not.toEqual(expect.arrayContaining([i1.id]));
    await expect(dadosDoSaneamento(E.requisitante)).rejects.toBeInstanceOf(SemPermissaoError);
  });
});
