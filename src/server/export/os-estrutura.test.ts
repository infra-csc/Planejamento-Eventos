import { describe, expect, it } from "vitest";
import { aplicarAjustesBom, calcularOS, type LinhaAta } from "@/domain/os";
import type { BomSnapshotLinha } from "@/server/db/schema";
import { montarOsEstrutura, nomeAba } from "./os-estrutura";
import { textoSeguro } from "./excel";

const pc = (codigo: string, quantidade: number, setor: BomSnapshotLinha["setor"] = "ESTRUTURA"): BomSnapshotLinha => ({ pecaId: codigo.toLowerCase(), codigo, nome: `Peça ${codigo}`, setor, unidade: "un", quantidade });

const bomPortico = [pc("BOX-3000", 9), pc("CUBO", 11), pc("PARAF", 176)];
const bomTenda5 = [pc("TND5-CANT", 4, "TENDA"), pc("TND5-TRAV", 4, "TENDA"), pc("TND5-PE", 4, "TENDA"), pc("TND5-MASTRO", 1, "TENDA"), pc("TND5-CABO", 1, "TENDA"), pc("TND5-LONA", 1, "TENDA")];
const bomBalcao = [pc("MDF-BALCAO", 1, "MARCENARIA"), pc("PARAF", 4)];
const extra = (codigo: string, quantidade: number) => ({ pecaId: codigo.toLowerCase(), codigo, nome: `Peça ${codigo}`, quantidade, setor: "TENDA" as const, unidade: "un" });

const projeto = (id: string, codigo: string, nome: string, quantidade: number, bom: BomSnapshotLinha[], destino: string | null = null): LinhaAta => ({ id, tipo: "PROJETO", quantidade, destino, areaNome: null, projeto: { codigo, nome, versao: 1, bom } });

const linhas: LinhaAta[] = [
  projeto("1", "PRJ-1", "Pórtico 4 com orelha", 1, bomPortico, "Largada"),
  projeto("2", "PRJ-1", "Pórtico 4 com orelha", 1, bomPortico, "Chegada"),
  // Depósito: 2 tendas, 5 fechamentos e 1 calha → divididos por unidade (3+2 e 1+0).
  projeto("3", "PRJ-T5", "Tenda 5×5 m", 1, aplicarAjustesBom(bomTenda5, [extra("TND5-FECH", 3), extra("TND5-CALHA", 1)]), "Depósito"),
  projeto("4", "PRJ-T5", "Tenda 5×5 m", 1, aplicarAjustesBom(bomTenda5, [extra("TND5-FECH", 2)]), "Depósito"),
  projeto("5", "PRJ-T5", "Tenda 5×5 m", 3, bomTenda5, null),
  projeto("6", "PRJ-B", "Balcão de madeira", 2, bomBalcao, "Credenciamento"),
  { id: "7", tipo: "PECA", quantidade: 2, destino: "Palco", areaNome: null, peca: { id: "cubo", codigo: "CUBO", nome: "Peça CUBO", setor: "ESTRUTURA", unidade: "un" } },
  { id: "8", tipo: "AVULSO", quantidade: 4, destino: "Pit lane", areaNome: null, descricaoLivre: "Lona 9×6" },
];
const os = calcularOS(linhas);
const r = montarOsEstrutura(os);

describe("montarOsEstrutura", () => {
  it("separa estruturas (projetos que não são tenda) e tendas, somando as unidades por projeto", () => {
    expect(r.semProjetos).toBe(false);
    expect(r.estruturas).toEqual([
      { codigo: "PRJ-1", nome: "Pórtico 4 com orelha", quantidade: 2 },
      { codigo: "PRJ-B", nome: "Balcão de madeira", quantidade: 2 },
    ]);
    expect(r.tendas.map((t) => t.titulo)).toEqual(["TENDAS 5×5"]);
  });

  it("peças e total geral batem com a OS", () => {
    const totalOs = os.setores.reduce((a, s) => a + s.linhas.reduce((b, l) => b + l.total, 0), 0);
    expect(r.totalPecas).toBe(totalOs);
    expect([...r.pecas, ...r.marcenaria].reduce((a, p) => a + p.total, 0)).toBe(totalOs);
    expect(r.marcenaria.map((p) => p.codigo)).toEqual(["MDF-BALCAO"]);
    expect(r.pecas.some((p) => p.setor === "MARCENARIA")).toBe(false);
    expect(r.pecas.find((p) => p.codigo === "CUBO")?.total).toBe(11 * 2 + 2);
    expect(r.pecas.find((p) => p.codigo === "PARAF")?.total).toBe(176 * 2 + 4 * 2);
  });

  it("tendas: uma linha por local, colunas do kit na ordem da planilha, fechamento e calha por local", () => {
    const t = r.tendas[0];
    expect(t.colunas.map((c) => c.codigo)).toEqual(["TND5-FECH", "TND5-CANT", "TND5-TRAV", "TND5-PE", "TND5-MASTRO", "TND5-CABO", "TND5-CALHA", "TND5-LONA"]);
    expect(t.linhas).toEqual([
      { local: "Depósito", quantidade: 2, valores: [5, 8, 8, 8, 2, 2, 1, 2] },
      { local: "Sem local", quantidade: 3, valores: [0, 12, 12, 12, 3, 3, 0, 3] },
    ]);
  });

  it("SOMATÓRIA: peça × projeto + extras (peças soltas) = total da OS em cada linha", () => {
    const s = r.somatoria;
    expect(s.projetos.map((p) => `${p.nome} ${p.quantidade}`)).toEqual(["Pórtico 4 com orelha 2", "Tenda 5×5 m 5", "Balcão de madeira 2"]);
    const cubo = s.linhas.find((l) => l.codigo === "CUBO")!;
    expect(cubo).toMatchObject({ porProjeto: [22, 0, 0], extras: 2, total: 24 });
    for (const l of s.linhas) expect(l.porProjeto.reduce((a, v) => a + v, 0) + l.extras).toBe(l.total);
  });

  it("outros materiais: itens fora do catálogo e peças pedidas soltas", () => {
    expect(r.outros).toEqual([
      { descricao: "Lona 9×6", quantidade: 4, local: "Pit lane", tipo: "avulso" },
      { descricao: "CUBO · Peça CUBO", quantidade: 2, local: "Palco", tipo: "peca" },
    ]);
  });

  it("abas por projeto: nome (NX), por unidade e total; marca quando varia entre locais", () => {
    const [portico, tenda] = r.abas;
    expect(portico.nomeAba).toBe("Pórtico 4 com orelha (2X)");
    expect(portico.varia).toBe(false);
    expect(portico.pecas.find((p) => p.codigo === "BOX-3000")).toMatchObject({ porUnidade: 9, total: 18 });
    expect(portico.locais).toEqual([{ local: "Largada", quantidade: 1 }, { local: "Chegada", quantidade: 1 }]);
    expect(tenda.nomeAba).toBe("Tenda 5×5 m (5X)");
    expect(tenda.varia).toBe(true);
    expect(tenda.pecas.find((p) => p.codigo === "TND5-FECH")).toMatchObject({ porUnidade: null, total: 5 });
    expect(tenda.pecas.find((p) => p.codigo === "TND5-CANT")).toMatchObject({ porUnidade: 4, total: 20 });
  });

  it("OS antiga sem visão por projeto: tudo vai para Extras, sem abas de projeto", () => {
    const antiga = montarOsEstrutura({ setores: os.setores, semSetor: [] });
    expect(antiga.semProjetos).toBe(true);
    expect(antiga.abas).toEqual([]);
    expect(antiga.somatoria.linhas.every((l) => l.extras === l.total)).toBe(true);
  });
});

describe("nomeAba", () => {
  it("tira caracteres proibidos, respeita 31 caracteres com o sufixo e não repete", () => {
    const usados = new Set(["total", "somatória"]);
    expect(nomeAba("Quadro 6/2,3 [LED]: *novo*?", 1, usados)).toBe("Quadro 6 2,3 LED novo (1X)");
    const longo = nomeAba("Palco 8×4 m com escada e rampa de acessibilidade", 12, usados);
    expect(longo.length).toBeLessThanOrEqual(31);
    expect(longo.endsWith(" (12X)")).toBe(true);
    const a = nomeAba("Tenda", 2, usados);
    const b = nomeAba("TENDA", 2, usados);
    expect(a).toBe("Tenda (2X)");
    expect(b).toBe("TENDA 2 (2X)");
    expect(nomeAba("Total", 1, usados)).toBe("Total (1X)");
    expect(nomeAba("'''", 1, usados)).toBe("Projeto (1X)");
  });
});

describe("textoSeguro", () => {
  it("texto que começa com = + - @ vira rich text (nunca fórmula)", () => {
    expect(textoSeguro("=HYPERLINK(\"x\")")).toEqual({ richText: [{ text: "=HYPERLINK(\"x\")" }] });
    expect(textoSeguro("@SUM(A1)")).toEqual({ richText: [{ text: "@SUM(A1)" }] });
    expect(textoSeguro("Depósito")).toBe("Depósito");
  });
});
