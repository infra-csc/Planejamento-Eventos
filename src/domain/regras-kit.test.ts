import { describe, expect, it } from "vitest";
import { calcularRegrasKit } from "./regras-kit";
import { grupoDaLinha, grupoDaPeca, grupoDoProjeto } from "./grupos-material";

const qtd = (r: ReturnType<typeof calcularRegrasKit>) => Object.fromEntries(r.filter((x) => x.quantidade > 0).map((x) => [x.codigoPeca, x.quantidade]));

describe("regras do kit", () => {
  it("tina 1000 l e pallet: 2 por stand + 6 por palco show; ráfia: 1 por ultrabag", () => {
    const r = calcularRegrasKit([
      { tipo: "PROJETO", quantidade: 3, projeto: { nome: "Stand 9×6 m", categoria: "Stand" } },
      { tipo: "PROJETO", quantidade: 1, projeto: { nome: "Palco show grande 9×6 m com LED", categoria: "Palco" } },
      { tipo: "PROJETO", quantidade: 1, projeto: { nome: "Palco 8×4 m com escada e rampa", categoria: "Palco" } },
      { tipo: "PECA", quantidade: 10, pecaCodigo: "LIXEIRA-BAG" },
      { tipo: "PROJETO", quantidade: 2, projeto: { nome: "Kit limpeza", categoria: "Arena" }, bom: [{ codigo: "LIXEIRA-BAG", quantidade: 4 }] },
    ]);
    expect(qtd(r)).toEqual({ "TINA-1000": 12, "PALLET-FE": 12, "SACO-RAFIA": 18 });
  });

  it("acompanhantes: cocho, bancada/mesa e grade 2×1; o que já foi pedido à parte é descontado", () => {
    const r = calcularRegrasKit([
      { tipo: "PECA", quantidade: 20, pecaCodigo: "COCHO" },
      { tipo: "PECA", quantidade: 40, pecaCodigo: "CAV-COCHO" },
      { tipo: "PECA", quantidade: 3, pecaCodigo: "BANCADA-210" },
      { tipo: "PECA", quantidade: 1, pecaCodigo: "MESA-1X1" },
      { tipo: "PECA", quantidade: 2, pecaCodigo: "CAV-RETO" },
      { tipo: "PECA", quantidade: 45, pecaCodigo: "GRADE-2X1" },
    ]);
    expect(qtd(r)).toEqual({ "CAV-RETO": 6, "PE-GRADE-2X1": 90 });
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
    expect(grupoDaPeca({ codigo: "PALLET-FE", setor: "ESTRUTURA", familia: "Base" })).toBe("PERCURSO");
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
