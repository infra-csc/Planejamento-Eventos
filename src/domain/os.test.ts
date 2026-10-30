import { describe, expect, it } from "vitest";
import { calcularOS, diffOS, individuaisAgrupadas, RESUMO_SEM_MUDANCA, resumoVersaoOs, textoLocais, type LinhaAta } from "./os";

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

  it("linhas iguais somam peças e projetos na origem: 4 quadros de 1 são “× 4”, não “× 1” (auditoria 30/10, B-01)", () => {
    const quadro = (id: string, quantidade: number, destino: string | null = null): LinhaAta => ({ id, tipo: "PROJETO", quantidade, destino, areaNome: "Produção", projeto: { codigo: "PJ-Q", nome: "Quadro de fotos", versao: 1, bom: [bomPortico[1]] } });
    const os = calcularOS([quadro("1", 1), quadro("2", 1), quadro("3", 1), quadro("4", 1), quadro("5", 2, "GV")]);
    const box = os.setores[0].linhas.find((l) => l.codigo === "BOX-600")!;
    expect(box.total).toBe(30);
    expect(box.origens).toEqual([
      { descricao: "Quadro de fotos × 4", quantidade: 20 },
      { descricao: "Quadro de fotos · GV × 2", quantidade: 10 },
    ]);
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

describe("peças soltas na OS", () => {
  it("somam por código, com cada local e área", () => {
    const cav = { codigo: "CAV-RETO", nome: "Cavalete reto", setor: "ARENA" as const, unidade: "un" };
    const g = individuaisAgrupadas([
      { ...cav, quantidade: 8, destino: "Dispersão", area: "Produção" },
      { ...cav, quantidade: 2, destino: "STAND", area: "Ativação" },
      { codigo: "CONE-G", nome: "Cone grande", setor: "ARENA", unidade: "un", quantidade: 5, destino: null, area: "Produção" },
    ]);
    expect(g.map((x) => [x.codigo, x.quantidade])).toEqual([["CAV-RETO", 10], ["CONE-G", 5]]);
    expect(textoLocais(g[0].locais)).toBe("Dispersão · Produção: 8; STAND · Ativação: 2");
    expect(textoLocais(g[1].locais)).toBe("Produção");
  });
});

describe("resumoVersaoOs", () => {
  const projeto = (q: number): LinhaAta[] => [{ id: "1", tipo: "PROJETO", quantidade: q, destino: null, areaNome: null, projeto: { codigo: "PJ-1", nome: "Pórtico", versao: 1, bom: bomPortico } }];

  it("com mais de 3 peças, o fim diz “e mais N peças” (antes “· +N”; auditoria 30/10, B-17)", () => {
    expect(resumoVersaoOs(calcularOS(projeto(1)), calcularOS(projeto(2)))).toBe("BOX-400 +1 · BOX-600 +5 · CUBO +10 · e mais 1 peça");
  });

  it("sem mudança, o texto que a aba OS troca por “igual à vN” (auditoria 30/10, B-12)", () => {
    expect(resumoVersaoOs(calcularOS(projeto(1)), calcularOS(projeto(1)))).toBe(RESUMO_SEM_MUDANCA);
  });
});
