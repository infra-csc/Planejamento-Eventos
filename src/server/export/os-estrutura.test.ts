import { describe, expect, it } from "vitest";
import { aplicarAjustesBom, calcularOS, type LinhaAta } from "@/domain/os";
import type { BomSnapshotLinha } from "@/server/db/schema";
import { montarOsEstrutura, nomeAba, ROTULOS_Q30 } from "./os-estrutura";
import { montarOsMarcenaria } from "./os-marcenaria";
import { montarAtaLista } from "./ata-lista";
import { textoSeguro } from "./excel";

const pc = (codigo: string, quantidade: number, setor: BomSnapshotLinha["setor"] = "ESTRUTURA", nome = `Peça ${codigo}`): BomSnapshotLinha => ({ pecaId: codigo.toLowerCase(), codigo, nome, setor, unidade: "un", quantidade });

const bomPortico = [pc("BOX-3000", 9), pc("CUBO", 11), pc("PARAF", 176)];
const bomTenda5 = [pc("TND5-CANT", 4, "TENDA"), pc("TND5-TRAV", 4, "TENDA"), pc("TND5-PE", 4, "TENDA"), pc("TND5-MASTRO", 1, "TENDA"), pc("TND5-CABO", 1, "TENDA"), pc("TND5-LONA", 1, "TENDA")];
const bomEstande = [pc("BOX-4000", 8), pc("CUBO", 7), pc("PARAF", 112), pc("COL-FRONTAL", 2, "MARCENARIA", "Coluna frontal"), pc("TESTEIRA-9M", 1, "MARCENARIA", "Testeira de 9 m")];
const bomQ15 = [pc("Q15-2000", 4), pc("Q15-CUBO", 4), pc("Q15-PARAF", 40)];
const extra = (codigo: string, quantidade: number) => ({ pecaId: codigo.toLowerCase(), codigo, nome: `Peça ${codigo}`, quantidade, setor: "TENDA" as const, unidade: "un" });

const projeto = (id: string, codigo: string, nome: string, quantidade: number, bom: BomSnapshotLinha[], destino: string | null = null): LinhaAta => ({ id, tipo: "PROJETO", quantidade, destino, areaNome: null, projeto: { codigo, nome, versao: 1, bom } });

const linhas: LinhaAta[] = [
  projeto("1", "PRJ-1", "Pórtico 4 com orelha", 1, bomPortico, "Largada"),
  projeto("2", "PRJ-1", "Pórtico 4 com orelha", 1, bomPortico, "Chegada"),
  // Depósito: 2 tendas, 5 fechamentos e 1 calha → divididos por unidade (3+2 e 1+0).
  projeto("3", "PRJ-T5", "Tenda 5×5 m", 1, aplicarAjustesBom(bomTenda5, [extra("TND5-FECH", 3), extra("TND5-CALHA", 1)]), "Depósito"),
  projeto("4", "PRJ-T5", "Tenda 5×5 m", 1, aplicarAjustesBom(bomTenda5, [extra("TND5-FECH", 2)]), "Depósito"),
  projeto("5", "PRJ-T5", "Tenda 5×5 m", 3, bomTenda5, null),
  projeto("6", "PRJ-E", "Estande 9×6 m", 2, bomEstande, "Credenciamento"),
  projeto("9", "PRJ-Q15", "Quadro Q15 2,30×2,30 m", 2, bomQ15, "Kit"),
  { id: "7", tipo: "PECA", quantidade: 2, destino: "Palco", areaNome: null, peca: { id: "cubo", codigo: "CUBO", nome: "Peça CUBO", setor: "ESTRUTURA", unidade: "un" } },
  { id: "10", tipo: "PECA", quantidade: 26, destino: null, areaNome: null, peca: { id: "estaca", codigo: "ESTACA", nome: "Estaca", setor: "ESTRUTURA", unidade: "un" } },
  { id: "11", tipo: "PECA", quantidade: 350, destino: "Percurso", areaNome: null, peca: { id: "cone", codigo: "CONE-G", nome: "Cone grande", setor: "ARENA", unidade: "un" } },
  { id: "8", tipo: "AVULSO", quantidade: 4, destino: "Pit lane", areaNome: null, descricaoLivre: "Lona 9×6" },
];
const os = calcularOS(linhas);
const r = montarOsEstrutura(os);

describe("montarOsEstrutura", () => {
  it("ESTRUTURAS em maiúsculas com as unidades somadas; tendas ficam no quadro por local", () => {
    expect(r.semProjetos).toBe(false);
    expect(r.estruturas).toEqual([
      { nome: "PÓRTICO 4 COM ORELHA", quantidade: 2 },
      { nome: "ESTANDE 9×6 M", quantidade: 2 },
      { nome: "QUADRO Q15 2,30×2,30 M", quantidade: 2 },
    ]);
    expect(r.tendas.map((t) => t.titulo)).toEqual(["TENDAS 5X5"]);
  });

  it("bloco PEÇA: as linhas fixas na ordem da planilha (mesmo zeradas), com os rótulos da cenografia", () => {
    expect(r.pecas.slice(0, ROTULOS_Q30.length).map((p) => p.rotulo)).toEqual(ROTULOS_Q30.map(([, rot]) => rot));
    const de = (rot: string) => r.pecas.find((p) => p.rotulo === rot)?.total;
    expect(de("3000")).toBe(18);
    expect(de("4000")).toBe(16);
    expect(de("Cubos")).toBe(11 * 2 + 7 * 2 + 2);
    expect(de("Parafusos")).toBe(176 * 2 + 112 * 2);
    expect(de("500")).toBe(0);
    expect(r.totalPecas).toBe(r.pecas.reduce((a, p) => a + p.total, 0));
    // Marcenaria, tendas, Q15 e estaiamento não entram no bloco PEÇA.
    expect(r.pecas.some((p) => /Coluna|TND|Estaca/.test(p.rotulo))).toBe(false);
  });

  it("Q-15 KIT, ESTAIAMENTO e OUTROS MATERIAIS nos blocos próprios", () => {
    expect(r.q15?.map((p) => [p.rotulo, p.total])).toEqual([
      ["500", 0],
      ["1000", 0],
      ["2000", 8],
      ["3000", 0],
      ["CUBO", 8],
      ["PARAFUSO", 80],
    ]);
    expect(r.estaiamento.find((p) => p.rotulo === "ESTACAS")?.total).toBe(26);
    expect(r.outros.map((o) => o.rotulo).slice(0, 3)).toEqual(["LONA 9X6", "GARFO", "MEDALHA"]);
    expect(r.outros.find((o) => o.rotulo === "MEDALHA")?.valor).toBe("X");
    expect(r.outros.at(-2)).toEqual({ rotulo: "LONA 9×6 — PIT LANE", valor: 4 });
    expect(r.outros.at(-1)).toEqual({ rotulo: "CONE GRANDE — PERCURSO", valor: 350 });
  });

  it("MARCENARIA por seção (projeto e quantidade) com as peças do projeto", () => {
    expect(r.marcenaria).toEqual([
      { tipo: "secao", nome: "ESTANDE 9×6 M", quantidade: 2 },
      { tipo: "peca", nome: "COLUNA FRONTAL", total: 4 },
      { tipo: "peca", nome: "TESTEIRA DE 9 M", total: 2 },
    ]);
  });

  it("tendas: uma linha por local, colunas do kit na ordem da planilha; sem local vira EXTRA", () => {
    const t = r.tendas[0];
    expect(t.colunas.map((c) => c.rotulo)).toEqual(["FECHAMENTOS", "CANTONEIRAS", "TRAVESSA", "PE", "MASTRO", "CABO", "CALHA"]);
    expect(t.linhas).toEqual([
      { local: "Depósito", quantidade: 2, valores: [5, 8, 8, 8, 2, 2, 1] },
      { local: "EXTRA", quantidade: 3, valores: [0, 12, 12, 12, 3, 3, 0] },
    ]);
  });

  it("SOMATORIA: rótulos do bloco PEÇA × projetos Q30 + extras = total", () => {
    const s = r.somatoria;
    expect(s.projetos.map((p) => p.nome)).toEqual(["PÓRTICO 4 COM ORELHA", "ESTANDE 9×6 M"]);
    const cubos = s.linhas.find((l) => l.rotulo === "Cubos")!;
    expect(cubos.porProjeto).toEqual([22, 14]);
    expect(cubos.extras).toBe(2);
    for (const l of s.linhas) expect(l.porProjeto.reduce((a, v) => a + v, 0) + l.extras).toBe(l.total);
  });

  it("abas por projeto: quantidade POR UNIDADE nas linhas fixas, total e nome '(NX)'", () => {
    const a = r.abas.find((x) => x.codigo === "PRJ-1")!;
    expect(a.nomeAba).toBe("Pórtico 4 com orelha (2X)");
    expect(a.nome).toBe("PÓRTICO 4 COM ORELHA");
    expect(a.pecas.find((p) => p.rotulo === "3000")?.porUnidade).toBe(9);
    expect(a.pecas.find((p) => p.rotulo === "Cubos")?.porUnidade).toBe(11);
    expect(a.total).toBe(9 + 11 + 176);
    const q = r.abas.find((x) => x.codigo === "PRJ-Q15")!;
    expect(q.q15).toBe(true);
    expect(q.pecas.map((p) => p.rotulo)).toEqual(["500", "1000", "2000", "3000", "CUBO", "PARAFUSO"]);
    // Estande: só a estrutura na aba (marcenaria fica no bloco MARCENARIA).
    const e = r.abas.find((x) => x.codigo === "PRJ-E")!;
    expect(e.pecas.some((p) => /Coluna/i.test(p.rotulo))).toBe(false);
    expect(r.tendas.length).toBe(1);
    expect(r.abas.some((x) => x.codigo === "PRJ-T5")).toBe(false);
  });

  it("OS antiga (sem visão por projeto): só os blocos por peça", () => {
    const antiga = montarOsEstrutura({ setores: os.setores, semSetor: os.semSetor });
    expect(antiga.semProjetos).toBe(true);
    expect(antiga.estruturas).toEqual([]);
    expect(antiga.abas).toEqual([]);
    expect(antiga.totalPecas).toBe(r.totalPecas);
  });
});

describe("montarOsMarcenaria", () => {
  it("seção pela categoria do projeto, item '(N UNID)' e uma linha por peça de marcenaria", () => {
    const m = montarOsMarcenaria(os, new Map([["PRJ-E", "Estande"]]), new Map());
    const estandes = m.secoes.find((s) => s.nome === "ESTANDES")!;
    expect(estandes.itens).toEqual([{ item: "ESTANDE 9×6 M (2 UNID)", pecas: [{ nome: "COLUNA FRONTAL", quantidade: 4, observacao: "Credenciamento" }, { nome: "TESTEIRA DE 9 M", quantidade: 2, observacao: null }] }]);
    expect(m.secoes.map((s) => s.nome)).toEqual(["ESTANDES", "PALCO", "TENDAS", "MESAS", "ATIVAÇÃO", "ITENS ESPECÍFICOS DA PROVA", "GERAL"]);
    expect(m.totalPecas).toBe(6);
  });
});

describe("montarAtaLista", () => {
  it("PERCURSO com as linhas fixas, tendas por local, BOX TRUSS com os projetos e avulsos na ARENA", () => {
    const a = montarAtaLista(os);
    expect(a.percurso.linhas[0]).toEqual({ item: "Cavaletes Transito", quantidade: null, obs: null });
    expect(a.percurso.linhas.find((l) => l.item === "Cones GRANDES")).toEqual({ item: "Cones GRANDES", quantidade: 350, obs: "Percurso" });
    expect(a.percurso.total).toBe(350);
    expect(a.tendas[0].linhas.map((l) => l.local)).toEqual(["Depósito", "EXTRA"]);
    expect(a.boxTruss.linhas.map((l) => [l.item, l.quantidade, l.obs])).toEqual([
      ["PÓRTICO 4 COM ORELHA", 2, "1 Largada / 1 Chegada"],
      ["ESTANDE 9×6 M", 2, "2 Credenciamento"],
      ["QUADRO Q15 2,30×2,30 M", 2, "2 Kit"],
    ]);
    expect(a.arena.linhas.at(-1)).toEqual({ item: "Lona 9×6", quantidade: 4, obs: "Pit lane" });
  });
});

describe("nomeAba", () => {
  it("corta em 31 caracteres preservando o sufixo (NX), remove caracteres proibidos e não repete", () => {
    const usados = new Set<string>();
    const longo = nomeAba("Pórtico boca de 6 m com orelha e testeira dupla", 2, usados);
    expect(longo.length).toBeLessThanOrEqual(31);
    expect(longo.endsWith(" (2X)")).toBe(true);
    expect(nomeAba("A/B:C*D?E[F]", 1, usados)).toBe("A B C D E F (1X)");
    expect(nomeAba("Palco 8x4", 1, usados)).toBe("Palco 8x4 (1X)");
    expect(nomeAba("palco 8X4", 1, usados)).toBe("palco 8X4 2 (1X)");
    expect(nomeAba("'Apóstrofo'", 3, usados)).toBe("Apóstrofo (3X)");
  });
});

describe("textoSeguro", () => {
  it("texto que começa com = + - @ vira texto literal (rich text), nunca fórmula", () => {
    expect(textoSeguro("=SUM(A1)")).toEqual({ richText: [{ text: "=SUM(A1)" }] });
    expect(textoSeguro("Pórtico")).toBe("Pórtico");
  });
});
