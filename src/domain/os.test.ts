import { describe, expect, it } from "vitest";
import { calcularOS, diffOS, type LinhaAta } from "./os";

const bomPortico = [
  { pecaId: "p400", codigo: "BOX-400", nome: "Box 400", setor: "ESTRUTURA" as const, unidade: "un", quantidade: 1 },
  { pecaId: "p600", codigo: "BOX-600", nome: "Box 600", setor: "ESTRUTURA" as const, unidade: "un", quantidade: 5 },
  { pecaId: "cubo", codigo: "CUBO", nome: "Cubo", setor: "ESTRUTURA" as const, unidade: "un", quantidade: 10 },
  { pecaId: "paraf", codigo: "PARAF", nome: "Parafuso", setor: "ESTRUTURA" as const, unidade: "un", quantidade: 132 },
];

describe("calcularOS", () => {
  it("soma BOM × quantidade do projeto (slide 4)", () => {
    const linhas: LinhaAta[] = [
      { id: "1", tipo: "PROJETO", quantidade: 3, destino: null, areaNome: "Produção", projeto: { codigo: "PJ-1", nome: "Pórtico 6,60m", versao: 1, bom: bomPortico } },
    ];
    const os = calcularOS(linhas);
    const estrutura = os.setores.find((s) => s.setor === "ESTRUTURA")!;
    expect(estrutura.linhas.find((l) => l.codigo === "BOX-600")!.total).toBe(15);
    expect(estrutura.linhas.find((l) => l.codigo === "PARAF")!.total).toBe(396);
    expect(estrutura.linhas.find((l) => l.codigo === "BOX-400")!.origens).toEqual([{ descricao: "Pórtico 6,60m × 3", quantidade: 3 }]);
  });

  it("agrupa a mesma peça vinda de projetos diferentes e de peça avulsa", () => {
    const linhas: LinhaAta[] = [
      { id: "1", tipo: "PROJETO", quantidade: 1, destino: null, areaNome: null, projeto: { codigo: "PJ-1", nome: "Pórtico", versao: 1, bom: bomPortico } },
      { id: "2", tipo: "PROJETO", quantidade: 2, destino: null, areaNome: null, projeto: { codigo: "PJ-2", nome: "Torre", versao: 2, bom: [bomPortico[2]] } },
      { id: "3", tipo: "PECA", quantidade: 4, destino: "GV", areaNome: "Ativação", peca: { id: "cubo", codigo: "CUBO", nome: "Cubo", setor: "ESTRUTURA", unidade: "un" } },
    ];
    const os = calcularOS(linhas);
    const cubo = os.setores[0].linhas.find((l) => l.codigo === "CUBO")!;
    expect(cubo.total).toBe(10 + 20 + 4);
    expect(cubo.origens).toHaveLength(3);
  });

  it("separa setores e itens sem peça de catálogo", () => {
    const linhas: LinhaAta[] = [
      { id: "1", tipo: "PECA", quantidade: 2, destino: null, areaNome: null, peca: { id: "t1", codigo: "TND-MASTRO", nome: "Mastro", setor: "TENDA", unidade: "un" } },
      { id: "2", tipo: "AVULSO", quantidade: 4, destino: "GV", areaNome: "Produção", descricaoLivre: "Fechamento de tenda" },
      { id: "3", tipo: "PECA", quantidade: 0, destino: null, areaNome: null, peca: { id: "m1", codigo: "MDF", nome: "Chapa", setor: "MARCENARIA", unidade: "un" } },
    ];
    const os = calcularOS(linhas);
    expect(os.setores.map((s) => s.setor)).toEqual(["TENDA"]);
    expect(os.semSetor).toEqual([{ descricao: "Fechamento de tenda", quantidade: 4, destino: "GV", area: "Produção" }]);
  });

  it("diffOS aponta somente o que mudou", () => {
    const a = calcularOS([{ id: "1", tipo: "PROJETO", quantidade: 1, destino: null, areaNome: null, projeto: { codigo: "PJ", nome: "P", versao: 1, bom: bomPortico } }]);
    const b = calcularOS([{ id: "1", tipo: "PROJETO", quantidade: 2, destino: null, areaNome: null, projeto: { codigo: "PJ", nome: "P", versao: 1, bom: bomPortico } }]);
    const d = diffOS(a, b);
    expect(d).toHaveLength(4);
    expect(d.find((x) => x.codigo === "BOX-600")).toMatchObject({ antes: 5, depois: 10 });
    expect(diffOS(a, a)).toEqual([]);
  });
});
