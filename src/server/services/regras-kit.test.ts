/** Regras da logística na ata: ráfia por ultrabag, testeira a definir com tenda; tina e pallet saíram (vêm nos projetos). */
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, historico, osVersoes, pecas, projetos, solicitacoes } from "@/server/db/schema";
import { criarPeca, criarProjeto, enviarSolicitacao, fecharAta, itemAvulso, incluirPeca, incluirProjeto, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { acompanhantesDaAta, ajustarLinhaNaConferencia, completarAcompanhante, definirExtraDaRegra, obterConferencia } from "./conferencia";
import { transicionarEvento } from "./eventos/transicoes";
import { aplicarCavaleteRetoNasAtasFechadas, aplicarGradesDoPrismaNasAtasFechadas, passarPedidoParaKit, ressincronizarAtasAbertas } from "./eventos/regras-kit";

let E: Elenco;
let estande: string;
let palcoShow: string;
let ultrabag: string;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const db = await getDb();
  await db.insert(pecas).values([
    { codigo: "TINA-1000", nome: "Tina 1000 l", setor: "ARENA" },
    { codigo: "PALLET-FE", nome: "Pallet de ferro", setor: "ESTRUTURA" },
    { codigo: "SACO-RAFIA", nome: "Saco de ráfia", setor: "ARENA" },
  ]);
  const [ub] = await db.insert(pecas).values({ codigo: "LIXEIRA-BAG", nome: "Lixeira ultra bag", setor: "ARENA" }).returning();
  ultrabag = ub.id;
  const peca = await criarPeca();
  estande = (await criarProjeto(peca.id)).id;
  await db.update(projetos).set({ nome: "Estande 9×6 m", categoria: "Estande" }).where(eq(projetos.id, estande));
  palcoShow = (await criarProjeto(peca.id)).id;
  await db.update(projetos).set({ nome: "Palco show", categoria: "Palco" }).where(eq(projetos.id, palcoShow));
}, 120_000);

const regras = async (eventoId: string) => {
  const ls = await (await getDb()).select().from(eventoItens).where(eq(eventoItens.eventoId, eventoId));
  return Object.fromEntries(ls.filter((l) => l.regra).map((l) => [l.regra!, l.ativo ? l.quantidade : 0]));
};

describe("regras da logística na ata", () => {
  it("acompanham a ata: ráfia por ultrabag; estande e palco show não puxam mais tina nem pallet", async () => {
    const ev = await novoEvento(E.logistica);
    expect(await regras(ev.id)).toEqual({});
    await incluirProjeto(E.logistica, ev.id, estande, 3, E.areas.a.id);
    await incluirProjeto(E.logistica, ev.id, palcoShow, 1, null);
    expect(await regras(ev.id)).toEqual({});
    const linhaUb = await incluirPeca(E.logistica, ev.id, ultrabag, 5, null);
    expect(await regras(ev.id)).toEqual({ "saco-rafia": 5 });
    // Ultrabag de 5 para 2: a ráfia desce junto.
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaUb.id, 2, "Só 2");
    expect(await regras(ev.id)).toEqual({ "saco-rafia": 2 });
    // Na conferência a linha da regra aparece com a explicação.
    const rafia = (await obterConferencia(ev.id)).find((l) => l.codigo === "SACO-RAFIA")!;
    expect(rafia.regra).toBe("1 por lixeira ultra bag");
  });

  it("ajuste à mão na linha da regra fica como a logística deixou; depois da ata fechada a regra para", async () => {
    const ev = await novoEvento(E.logistica);
    const linhaUb = await incluirPeca(E.logistica, ev.id, ultrabag, 2, null);
    const db = await getDb();
    const [rafia] = await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "saco-rafia")));
    expect(rafia.quantidade).toBe(2);
    await ajustarLinhaNaConferencia(E.logistica, ev.id, rafia.id, 10, "Levar reserva");
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaUb.id, 3, "Mais uma ultrabag");
    expect(await regras(ev.id)).toEqual({ "saco-rafia": 10 });
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    await ajustarLinhaNaConferencia(E.admin, ev.id, linhaUb.id, 5, "Depois da ata").catch(() => null);
    expect((await regras(ev.id))["saco-rafia"]).toBe(10);
  });

  it("linha antiga de tina (regra que saiu) fica como está e mostra por quê", async () => {
    const db = await getDb();
    const tina = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "TINA-1000") }))!;
    const ev = await novoEvento(E.logistica);
    await db.insert(eventoItens).values({ eventoId: ev.id, tipo: "PECA", pecaId: tina.id, quantidade: 6, origem: "AJUSTE_LOGISTICA", regra: "tina-contrapeso" });
    await incluirPeca(E.logistica, ev.id, ultrabag, 1, null);
    expect(await regras(ev.id)).toEqual({ "tina-contrapeso": 6, "saco-rafia": 1 });
    const l = (await obterConferencia(ev.id)).find((x) => x.codigo === "TINA-1000")!;
    expect(l.regra).toMatch(/agora vem dentro dos projetos/);
  });

  it("testeira de madeira: com tenda 5×5 na ata entra a definir, o número sai da conferência; sem tenda, sai", async () => {
    const db = await getDb();
    // O pé diz o tamanho da tenda (a cantoneira é universal).
    const [pe] = await db.insert(pecas).values({ codigo: "TND5-PE", nome: "Pé de tenda 5×5", setor: "TENDA" }).returning();
    await db.insert(pecas).values({ codigo: "TND5-TESTEIRA", nome: "Testeira de madeira (Tenda 5x5)", setor: "MARCENARIA" });
    const tenda = (await criarProjeto(pe.id)).id;
    const testeira = async (eventoId: string) => (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.regra, "testeira-tenda-5x5"))))[0];

    const ev = await novoEvento(E.logistica);
    const linhaTenda = await incluirProjeto(E.logistica, ev.id, tenda, 3, null);
    expect(await testeira(ev.id)).toMatchObject({ ativo: true, quantidade: 0 });
    const t = (await obterConferencia(ev.id)).find((l) => l.codigo === "TND5-TESTEIRA")!;
    expect(t.regra).toMatch(/a definir na conferência/);
    // A conferência define o número; mais tendas depois não mexem nele.
    await ajustarLinhaNaConferencia(E.logistica, ev.id, (await testeira(ev.id)).id, 3, "Uma por tenda");
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaTenda.id, 4, "Mais uma tenda");
    expect(await testeira(ev.id)).toMatchObject({ ativo: true, quantidade: 3, regraManual: true });

    // Sem tenda na ata (nunca definida), a linha sai.
    const ev2 = await novoEvento(E.logistica);
    const t2 = await incluirProjeto(E.logistica, ev2.id, tenda, 2, null);
    expect((await testeira(ev2.id)).ativo).toBe(true);
    await ajustarLinhaNaConferencia(E.logistica, ev2.id, t2.id, 0, "Sem tenda");
    expect((await testeira(ev2.id)).ativo).toBe(false);
  });
  it("uma vez ao subir: atas abertas ganham a testeira; as outras regras não são mexidas", async () => {
    const db = await getDb();
    const pe = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "TND5-PE") }))!;
    const tenda = (await criarProjeto(pe.id)).id;
    const ev = await novoEvento(E.logistica);
    // Linhas gravadas direto (como numa ata de antes da regra): tenda e ultrabag, sem as linhas das regras.
    await db.insert(eventoItens).values([
      { eventoId: ev.id, tipo: "PROJETO", projetoId: tenda, quantidade: 2, origem: "AJUSTE_LOGISTICA", bomSnapshot: [{ pecaId: pe.id, codigo: "TND5-PE", nome: "Pé", setor: "TENDA", unidade: "un", quantidade: 4 }] },
      { eventoId: ev.id, tipo: "PECA", pecaId: ultrabag, quantidade: 3, origem: "AJUSTE_LOGISTICA" },
    ]);
    expect(await ressincronizarAtasAbertas("teste:regras:1")).toMatchObject({ feito: true });
    expect(await regras(ev.id)).toEqual({ "testeira-tenda-5x5": 0 });
    expect((await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "testeira-tenda-5x5"))))[0].ativo).toBe(true);
    expect(await ressincronizarAtasAbertas("teste:regras:1")).toEqual({ feito: false });
  });
  it("grades do prisma: as a mais da reunião ficam numa linha própria e somam; as do prisma seguem os prismas", async () => {
    const db = await getDb();
    const [prisma] = await db.insert(pecas).values({ codigo: "PRISMA", nome: "Prisma", setor: "ARENA" }).returning();
    await db.insert(pecas).values({ codigo: "GRADE-2X1", nome: "Grade 2×1 m", setor: "ARENA" });
    const ev = await novoEvento(E.logistica);
    const linhaPrisma = await incluirPeca(E.logistica, ev.id, prisma.id, 5, null);
    const linhasGrade = async () => (await db.select().from(eventoItens).where(eq(eventoItens.eventoId, ev.id))).filter((l) => l.ativo && l.pecaId && l.regra !== "pe-grade-2x1" && l.quantidade > 0);
    const regraGrade = (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "grade-prisma"))))[0];
    expect(regraGrade.quantidade).toBe(10);

    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 6, "");
    const grade = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "GRADE-2X1") }))!;
    const aMais = (await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra);
    expect(aMais.map((l) => l.quantidade)).toEqual([6]);
    // Prismas de 5 para 7: as do prisma acompanham (14) e as a mais continuam 6.
    await ajustarLinhaNaConferencia(E.logistica, ev.id, linhaPrisma.id, 7, "");
    expect(await regras(ev.id)).toMatchObject({ "grade-prisma": 14 });
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra).map((l) => l.quantidade)).toEqual([6]);
    // Mudar o a mais ajusta a mesma linha; 0 tira.
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 9, "");
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra).map((l) => l.quantidade)).toEqual([9]);
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 0, "");
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra)).toEqual([]);
    // Duas linhas a mais (uma incluída à mão): o número vale para as duas juntas, como a tela mostra a soma.
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 4, "");
    await incluirPeca(E.logistica, ev.id, grade.id, 3, null);
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 5, "");
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra).map((l) => l.quantidade)).toEqual([5]);
    // Grade incluída à mão com local (ex.: chegada) não é "a mais" do prisma: o ajuste não mexe nela.
    const [chegada] = await db.insert(eventoItens).values({ eventoId: ev.id, tipo: "PECA", pecaId: grade.id, quantidade: 6, destino: "Chegada", origem: "AJUSTE_LOGISTICA" }).returning();
    await definirExtraDaRegra(E.logistica, ev.id, regraGrade.id, 2, "");
    expect((await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, chegada.id) }))?.quantidade).toBe(6);
    expect((await linhasGrade()).filter((l) => l.pecaId === grade.id && !l.regra && !l.destino).map((l) => l.quantidade)).toEqual([2]);
  });

  it("ata fechada antes da regra do prisma: as grades do prisma entram uma vez, com nova OS", async () => {
    const db = await getDb();
    const prisma = (await db.query.pecas.findFirst({ where: eq(pecas.codigo, "PRISMA") }))!;
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, prisma.id, 9, null);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    // Como nas atas antigas: sem a linha da regra.
    await db.delete(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "grade-prisma")));
    const { gerarOsVersao } = await import("./os");
    await gerarOsVersao(db, ev.id, "AJUSTE_LOGISTICA", null, "OS antiga, sem as grades do prisma");
    const versoes = async () => (await db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id))).length;
    const antes = await versoes();
    const r = await aplicarGradesDoPrismaNasAtasFechadas("teste:prisma:1");
    expect(r.feito && r.eventos).toContain(ev.codigo);
    expect((await regras(ev.id))["grade-prisma"]).toBe(18);
    expect(await versoes()).toBe(antes + 1);
    expect(await aplicarGradesDoPrismaNasAtasFechadas("teste:prisma:1")).toEqual({ feito: false });
  });

  it("ata fechada antes de o pranchão voltar ao cavalete reto: os cavaletes entram uma vez, descontando os já pedidos", async () => {
    const db = await getDb();
    const [pranchao] = await db.insert(pecas).values({ codigo: "PRANCHÃO-220", nome: "Pranchão 2,20 m", setor: "MARCENARIA" }).returning();
    const [cavalete] = await db.insert(pecas).values({ codigo: "CAV-RETO", nome: "Cavalete reto", setor: "ARENA" }).returning();
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pranchao.id, 6, null);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    // Como nas atas fechadas antes de 20/10: sem a linha da regra e com 4 cavaletes pedidos à parte.
    await db.delete(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "cavalete-reto")));
    await db.insert(eventoItens).values({ eventoId: ev.id, tipo: "PECA", pecaId: cavalete.id, quantidade: 4, origem: "AJUSTE_LOGISTICA" });
    const { gerarOsVersao } = await import("./os");
    await gerarOsVersao(db, ev.id, "AJUSTE_LOGISTICA", null, "OS antiga, só com os cavaletes pedidos");
    const versoes = async () => (await db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id))).length;
    const antes = await versoes();
    const r = await aplicarCavaleteRetoNasAtasFechadas("teste:cavalete:1");
    expect(r.feito && r.eventos).toContain(ev.codigo);
    // 6 pranchões = 12 cavaletes; 4 já estavam na ata, a regra completa com 8.
    expect((await regras(ev.id))["cavalete-reto"]).toBe(8);
    expect(await versoes()).toBe(antes + 1);
    expect(await aplicarCavaleteRetoNasAtasFechadas("teste:cavalete:1")).toEqual({ feito: false });
  });
});

describe("o que acompanha um pedido do Kit vai para o Kit (03/11)", () => {
  let kit: { id: string };
  beforeAll(async () => {
    [kit] = await (await getDb()).insert(areas).values({ nome: "Kit" }).returning();
  });

  it("cavaletes dos pranchões do Kit ficam em linha própria da área Kit; a linha geral conta só os demais pedidos", async () => {
    const db = await getDb();

    const pranchao = (await db.select().from(pecas).where(eq(pecas.codigo, "PRANCHÃO-220")))[0];
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pranchao.id, 1, E.areas.a.id);
    const doKit = await incluirPeca(E.logistica, ev.id, pranchao.id, 3, kit.id);
    const cavaletes = async () => (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "cavalete-reto")))).filter((l) => l.ativo).map((l) => [l.areaId, l.quantidade]).sort((a, b) => Number(b[1]) - Number(a[1]));
    expect(await cavaletes()).toEqual([[kit.id, 6], [null, 2]]);
    const { calcularOsAtual } = await import("./os");
    const os = await calcularOsAtual(db, ev.id);
    const totalDe = (c: typeof os | undefined) => c?.setores.flatMap((s) => s.linhas).find((l) => l.codigo === "CAV-RETO")?.total;
    expect(totalDe(os)).toBe(2);
    expect(totalDe(os.kit)).toBe(6);
    // Sai o pedido do Kit: sai também o cavalete dele, e a linha geral não muda.
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await ajustarLinhaNaConferencia(E.admin, ev.id, doKit.id, 0, "Teste");
    expect(await cavaletes()).toEqual([[null, 2]]);
  });

  it("evento sem nada do Kit segue com uma linha só, como antes", async () => {
    const db = await getDb();
    const pranchao = (await db.select().from(pecas).where(eq(pecas.codigo, "PRANCHÃO-220")))[0];
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pranchao.id, 2, E.areas.a.id);
    const ls = (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "cavalete-reto"))));
    expect(ls.map((l) => [l.areaId, l.quantidade])).toEqual([[null, 4]]);
  });

  it("passa o pedido para a área Kit uma vez só e gera a versão da OS, com os itens na lista à parte", async () => {
    const db = await getDb();

    const ev = await novoEvento(E.logistica);
    const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Saco de brinde", 5)]);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    await fecharAta(E.admin, ev.id);
    const { codigo } = (await db.select({ codigo: solicitacoes.codigo }).from(solicitacoes).where(eq(solicitacoes.id, s.id)))[0];
    const versoes = async () => db.select().from(osVersoes).where(eq(osVersoes.eventoId, ev.id));
    const antes = (await versoes()).length;
    expect(await passarPedidoParaKit(codigo, "teste:kit:1", ev.codigo)).toEqual({ feito: true, linhas: 1 });
    const depois = await versoes();
    expect(depois.length).toBe(antes + 1);
    const ultima = depois.sort((a, b) => b.numero - a.numero)[0].conteudo;
    expect(ultima.semSetor).toEqual([]);
    expect(ultima.kit?.semSetor.map((x) => x.descricao)).toEqual(["Saco de brinde"]);
    expect((await db.select().from(solicitacoes).where(eq(solicitacoes.id, s.id)))[0].areaId).toBe(kit.id);
    expect(await passarPedidoParaKit(codigo, "teste:kit:1", ev.codigo)).toEqual({ feito: false });
  });

  it("mesmo código em outro evento: não mexe no pedido", async () => {
    const db = await getDb();
    const ev = await novoEvento(E.logistica);
    const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Outro brinde", 2)]);
    const { codigo, areaId } = (await db.select().from(solicitacoes).where(eq(solicitacoes.id, s.id)))[0];
    expect(await passarPedidoParaKit(codigo, "teste:kit:3", "EVT-OUTRO")).toEqual({ feito: true, linhas: 0 });
    expect((await db.select().from(solicitacoes).where(eq(solicitacoes.id, s.id)))[0].areaId).toBe(areaId);
  });

  it("cavaletes: a conta é de cada lado, e completar a falta do Kit cria a linha no Kit", async () => {
    const db = await getDb();
    const pranchao = (await db.select().from(pecas).where(eq(pecas.codigo, "PRANCHÃO-220")))[0];
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pranchao.id, 1, E.areas.a.id);
    await incluirPeca(E.logistica, ev.id, pranchao.id, 3, kit.id);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    const regraKit = (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "cavalete-reto"), eq(eventoItens.areaId, kit.id))))[0];
    await ajustarLinhaNaConferencia(E.logistica, ev.id, regraKit.id, 4, "Reduzido na reunião");
    const conta = async () => (await acompanhantesDaAta(ev.id)).filter((n) => n.codigo === "CAV-RETO").map((n) => [n.kit, n.precisa, n.naAta]);
    expect(await conta()).toEqual([[false, 2, 2], [true, 6, 4]]);
    const nova = await completarAcompanhante(E.logistica, ev.id, "CAV-RETO", true);
    expect(nova.quantidade).toBe(2);
    expect((await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, nova.id) }))?.areaId).toBe(kit.id);
    expect(await conta()).toEqual([[false, 2, 2], [true, 6, 6]]);
    await expect(completarAcompanhante(E.logistica, ev.id, "CAV-RETO")).rejects.toThrow(/Nada a completar/);
  });

  it("grades a mais do prisma: as do Kit ficam no Kit e não se confundem com as da lista geral", async () => {
    const db = await getDb();
    const prisma = (await db.select().from(pecas).where(eq(pecas.codigo, "PRISMA")))[0];
    const grade = (await db.select().from(pecas).where(eq(pecas.codigo, "GRADE-2X1")))[0];
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, prisma.id, 1, E.areas.a.id);
    await incluirPeca(E.logistica, ev.id, prisma.id, 2, kit.id);
    const regrasGrade = await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "grade-prisma")));
    const doKit = regrasGrade.find((l) => l.areaId === kit.id)!;
    const geral = regrasGrade.find((l) => l.areaId === null)!;
    const aMais = async () => (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.pecaId, grade.id), eq(eventoItens.ativo, true)))).filter((l) => !l.regra).map((l) => [l.areaId, l.quantidade]);
    await definirExtraDaRegra(E.logistica, ev.id, doKit.id, 3, "");
    expect(await aMais()).toEqual([[kit.id, 3]]);
    await definirExtraDaRegra(E.logistica, ev.id, geral.id, 5, "");
    expect((await aMais()).sort((a, b) => Number(a[1]) - Number(b[1]))).toEqual([[kit.id, 3], [null, 5]]);
    await definirExtraDaRegra(E.logistica, ev.id, doKit.id, 0, "");
    expect(await aMais()).toEqual([[null, 5]]);
  });

  it("nasce a linha do Kit com a geral ajustada à mão: o número fica e a geral volta para conferência", async () => {
    const db = await getDb();
    const pranchao = (await db.select().from(pecas).where(eq(pecas.codigo, "PRANCHÃO-220")))[0];
    const ev = await novoEvento(E.logistica);
    await incluirPeca(E.logistica, ev.id, pranchao.id, 2, E.areas.a.id);
    await transicionarEvento(E.admin, ev.id, "INICIAR_REUNIAO");
    const geral = (await db.select().from(eventoItens).where(and(eq(eventoItens.eventoId, ev.id), eq(eventoItens.regra, "cavalete-reto"))))[0];
    await ajustarLinhaNaConferencia(E.logistica, ev.id, geral.id, 8, "Decidido na reunião");
    expect((await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, geral.id) }))?.conferidoEm).not.toBeNull();
    await incluirPeca(E.logistica, ev.id, pranchao.id, 3, kit.id);
    const depois = await db.query.eventoItens.findFirst({ where: eq(eventoItens.id, geral.id) });
    expect(depois).toMatchObject({ quantidade: 8, conferidoEm: null });
    const registros = await db.select().from(historico).where(eq(historico.entidadeId, geral.id));
    expect(registros.some((r) => r.descricao.includes("volta para conferência"))).toBe(true);
  });

  it("em banco sem o pedido, só fica a marca", async () => {
    expect(await passarPedidoParaKit("SOL-NAO-EXISTE", "teste:kit:2")).toEqual({ feito: true, linhas: 0 });
  });
});
