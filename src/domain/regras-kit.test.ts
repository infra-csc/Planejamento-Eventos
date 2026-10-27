import { describe, expect, it } from "vitest";
import { calcularRegrasKit, necessidadesAcompanhantes } from "./regras-kit";
import { grupoDaLinha, grupoDaPeca, grupoDoProjeto } from "./grupos-material";

const qtd = (r: ReturnType<typeof calcularRegrasKit>) => Object.fromEntries(r.filter((x) => x.quantidade > 0).map((x) => [x.codigoPeca, x.quantidade]));

describe("regras do kit", () => {
  it("ráfia: 1 por ultrabag; tina 1000 l e pallet não são mais regra (vêm dentro dos projetos)", () => {
    const r = calcularRegrasKit([
      { tipo: "PROJETO", quantidade: 3, projeto: { nome: "Stand 9×6 m", categoria: "Stand" } },
      { tipo: "PROJETO", quantidade: 1, projeto: { nome: "Palco show grande 9×6 m com LED", categoria: "Palco" } },
      { tipo: "PROJETO", quantidade: 1, projeto: { nome: "Palco 8×4 m com escada e rampa", categoria: "Palco" } },
      { tipo: "PECA", quantidade: 10, pecaCodigo: "LIXEIRA-BAG" },
      { tipo: "PROJETO", quantidade: 2, projeto: { nome: "Kit limpeza", categoria: "Arena" }, bom: [{ codigo: "LIXEIRA-BAG", quantidade: 4 }] },
    ]);
    expect(qtd(r)).toEqual({ "SACO-RAFIA": 18 });
  });

  it("conferência: quanto a regra pede de cavalete e quanto a ata tem (Blue Run Campinas: 2 mesas + 1 pranchão)", () => {
    const ls = [
      { tipo: "PECA", quantidade: 2, pecaCodigo: "MESA-1X1" },
      { tipo: "PECA", quantidade: 1, pecaCodigo: "PRANCHÃO-220" },
      { tipo: "PECA", quantidade: 4, pecaCodigo: "CAV-RETO" },
      { tipo: "PECA", quantidade: 4, pecaCodigo: "CAV-RETO" },
      { tipo: "PECA", quantidade: 1, pecaCodigo: "CAV-RETO" },
    ];
    expect(necessidadesAcompanhantes(ls).find((n) => n.codigo === "CAV-RETO")).toMatchObject({ precisa: 6, naAta: 9 });
    // Grades do prisma (linha da regra) não pedem pés.
    const grades = [{ tipo: "PECA", quantidade: 10, pecaCodigo: "GRADE-2X1" }, { tipo: "PECA", quantidade: 28, pecaCodigo: "GRADE-2X1", regra: "grade-prisma" }];
    expect(necessidadesAcompanhantes(grades).find((n) => n.codigo === "PE-GRADE-2X1")).toMatchObject({ precisa: 20, naAta: 0 });
  });

  it("testeira de madeira a definir: com tenda do tamanho e sem a testeira já pedida", () => {
    const presentes = (ls: Parameters<typeof calcularRegrasKit>[0]) => calcularRegrasKit(ls).filter((x) => x.presente).map((x) => x.regra);
    const tenda5 = { tipo: "PROJETO", quantidade: 2, projeto: { nome: "Tenda 5×5 m" }, bom: [{ codigo: "TND5-CANT", quantidade: 4 }, { codigo: "TND5-PE", quantidade: 4 }] };
    const tenda3 = { tipo: "PROJETO", quantidade: 1, projeto: { nome: "Tenda 3×3 m" }, bom: [{ codigo: "TND5-CANT", quantidade: 4 }, { codigo: "TND3-PE", quantidade: 4 }] };
    expect(presentes([tenda5])).toEqual(["testeira-tenda-5x5"]);
    expect(presentes([tenda5, tenda3])).toEqual(["testeira-tenda-5x5", "testeira-tenda-3x3"]);
    expect(presentes([tenda5, { tipo: "PECA", quantidade: 2, pecaCodigo: "TND5-TESTEIRA" }])).toEqual([]);
    expect(presentes([{ tipo: "PECA", quantidade: 5, pecaCodigo: "CONE-G" }])).toEqual([]);
    // Tenda 3×3 cadastrada sem pé (só travessa e mastro) também conta; cantoneira universal ou fechamento sozinhos, não.
    expect(presentes([{ tipo: "PROJETO", quantidade: 1, projeto: { nome: "Tenda 3×3" }, bom: [{ codigo: "TND5-CANT", quantidade: 4 }, { codigo: "TND3-TRAV", quantidade: 4 }, { codigo: "TND3-MASTRO", quantidade: 1 }] }])).toEqual(["testeira-tenda-3x3"]);
    expect(presentes([{ tipo: "PECA", quantidade: 8, pecaCodigo: "TND5-CANT" }, { tipo: "PECA", quantidade: 3, pecaCodigo: "TND3-FECH" }])).toEqual([]);
    // Já tem o projeto de testeira da tenda: não entra outra.
    expect(presentes([tenda5, { tipo: "PROJETO", quantidade: 6, projeto: { nome: "Testeira Madeira Tenda 5×5" }, bom: [{ codigo: "MRC-TESTEIRADE5M", quantidade: 1 }] }])).toEqual([]);
    expect(presentes([tenda5, tenda3, { tipo: "PROJETO", quantidade: 1, projeto: { nome: "Testeira Tenda 3×3" } }])).toEqual(["testeira-tenda-5x5"]);
    // Não pede número: fica 0 (a definir) para a conferência.
    expect(calcularRegrasKit([tenda5]).find((x) => x.regra === "testeira-tenda-5x5")?.quantidade).toBe(0);
  });

  it("acompanhantes: cocho, pranchão/mesa e grade 2×1; o que já foi pedido à parte é descontado", () => {
    const r = calcularRegrasKit([
      { tipo: "PECA", quantidade: 15, pecaCodigo: "COCHO" },
      { tipo: "PECA", quantidade: 5, pecaCodigo: "POSTO-HIDRATACAO" },
      { tipo: "PECA", quantidade: 40, pecaCodigo: "CAV-COCHO" },
      { tipo: "PECA", quantidade: 3, pecaCodigo: "PRANCHÃO-220" },
      { tipo: "PECA", quantidade: 1, pecaCodigo: "MESA-1X1" },
      { tipo: "PECA", quantidade: 2, pecaCodigo: "CAV-RETO" },
      { tipo: "PECA", quantidade: 45, pecaCodigo: "GRADE-2X1" },
    ]);
    expect(qtd(r)).toEqual({ "CAV-RETO": 6, "PE-GRADE-2X1": 90 });
  });

  it("prisma: 2 grades 2×1 cada, somadas às pedidas; os pés só das grades pedidas", () => {
    const r = calcularRegrasKit([
      { tipo: "PECA", quantidade: 10, pecaCodigo: "PRISMA" },
      { tipo: "PECA", quantidade: 5, pecaCodigo: "GRADE-2X1" },
    ]);
    // 20 grades do prisma (além das 5 pedidas); pés só das 5 pedidas: 5 × 2.
    expect(qtd(r)).toEqual({ "GRADE-2X1": 20, "PE-GRADE-2X1": 10 });
  });

  it("sem nada que puxe regra, tudo zero", () => {
    expect(qtd(calcularRegrasKit([{ tipo: "PECA", quantidade: 5, pecaCodigo: "CONE-G" }]))).toEqual({});
  });
});

describe("grupos de material (lista de materiais da ata)", () => {
  it("peças pela família/setor, com as exceções da planilha", () => {
    expect(grupoDaPeca({ codigo: "BOX-2000", setor: "ESTRUTURA", familia: "Box truss Q30" })).toBe("ESTRUTURA");
    expect(grupoDaPeca({ codigo: "TND5-FECH", setor: "TENDA", familia: "Tenda 5×5" })).toBe("TENDAS");
    expect(grupoDaPeca({ codigo: "POSTO-HIDRATACAO", setor: "ARENA", familia: "Percurso" })).toBe("PERCURSO");
    expect(grupoDaPeca({ codigo: "TINA-300", setor: "ARENA", familia: "Ativação" })).toBe("ATIVACAO");
    expect(grupoDaPeca({ codigo: "BALCAO-120", setor: "MARCENARIA", familia: "Mobiliário" })).toBe("ATIVACAO");
    expect(grupoDaPeca({ codigo: "GERADOR", setor: "ARENA", familia: "Arena" })).toBe("ARENA");
    expect(grupoDaPeca({ codigo: "PALLET-FE", setor: "ESTRUTURA", familia: "Base" })).toBe("ESTRUTURA");
    // Marcenaria pedida solta (escadas, sarrafo, cases, calço): grupo Marcenaria, pelo código ou pelo nome.
    for (const [codigo, setor, nome] of [["ESCADA-ALU", "ARENA", "Escada de alumínio"], ["CALCO", "ESTRUTURA", "Caixa de calços"], ["MACO-SARRAFO", "MARCENARIA", "Maço de sarrafo"], ["MRC-CASEMONTAGEM", "MARCENARIA", "Case Montagem"], ["X1", "ARENA", "Escada de Madeira (montagem)"], ["X2", "ESTRUTURA", "Caixa com Calço"], ["MRC-PODIO", "MARCENARIA", "Pódio nível 1"]])
      expect(grupoDaPeca({ codigo, setor, familia: null, nome })).toBe("MARCENARIA");
    // Mobiliário de marcenaria continua na Ativação; testeira, nas tendas.
    expect(grupoDaPeca({ codigo: "PRANCHAO-210", setor: "MARCENARIA", familia: "Mobiliário", nome: "Pranchão" })).toBe("ATIVACAO");
    expect(grupoDaPeca({ codigo: "TND5-TESTEIRA", setor: "MARCENARIA", familia: "Tenda 5×5", nome: "Testeira" })).toBe("TENDAS");
    expect(grupoDaPeca({ codigo: "TINA-1000", setor: "ARENA", familia: "Percurso" })).toBe("ESTRUTURA");
    expect(grupoDaPeca({ codigo: "COL-TRAS", setor: "MARCENARIA", familia: "Stand" })).toBe("ESTRUTURA");
  });

  it("projetos pela categoria; avulso fica fora do catálogo", () => {
    expect(grupoDoProjeto({ categoria: "Stand" })).toBe("ESTRUTURA");
    expect(grupoDoProjeto({ categoria: "Tenda" })).toBe("TENDAS");
    expect(grupoDoProjeto({ categoria: "Ativação" })).toBe("ATIVACAO");
    expect(grupoDoProjeto({ categoria: "Percurso" })).toBe("PERCURSO");
    expect(grupoDoProjeto({ categoria: "Percurso", nome: "Grade de merchandising com pés" })).toBe("ARENA");
    expect(grupoDaLinha({ tipo: "AVULSO" })).toBe("OUTROS");
  });
});
