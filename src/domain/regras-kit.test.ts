import { describe, expect, it } from "vitest";
import { calcularRegrasKit } from "./regras-kit";
import { grupoDaLinha, grupoDaPeca, grupoDoProjeto } from "./grupos-material";

const qtd = (r: ReturnType<typeof calcularRegrasKit>) => Object.fromEntries(r.map((x) => [x.codigoPeca, x.quantidade]));

describe("regras do kit", () => {
  it("tina: 2 por estande + 6 por palco show; pallet: 2 por estande; ráfia: 1 por ultrabag", () => {
    const r = calcularRegrasKit([
      { tipo: "PROJETO", quantidade: 3, projeto: { nome: "Estande 9×6 m", categoria: "Estande" } },
      { tipo: "PROJETO", quantidade: 1, projeto: { nome: "Palco show grande 9×6 m com LED", categoria: "Palco" } },
      { tipo: "PROJETO", quantidade: 1, projeto: { nome: "Palco 8×4 m com escada e rampa", categoria: "Palco" } },
      { tipo: "PECA", quantidade: 10, pecaCodigo: "LIXEIRA-BAG" },
      { tipo: "PROJETO", quantidade: 2, projeto: { nome: "Kit limpeza", categoria: "Arena" }, bom: [{ codigo: "LIXEIRA-BAG", quantidade: 4 }] },
    ]);
    expect(qtd(r)).toEqual({ "TINA-500": 12, "PALLET-FE": 6, "SACO-RAFIA": 18 });
  });

  it("sem estande, palco show nem ultrabag, tudo zero", () => {
    expect(qtd(calcularRegrasKit([{ tipo: "PECA", quantidade: 5, pecaCodigo: "CONE-G" }]))).toEqual({ "TINA-500": 0, "PALLET-FE": 0, "SACO-RAFIA": 0 });
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
    expect(grupoDaPeca({ codigo: "COL-TRAS", setor: "MARCENARIA", familia: "Estande" })).toBe("ESTRUTURA");
  });

  it("projetos pela categoria; avulso fica fora do catálogo", () => {
    expect(grupoDoProjeto({ categoria: "Estande" })).toBe("ESTRUTURA");
    expect(grupoDoProjeto({ categoria: "Tenda" })).toBe("TENDAS");
    expect(grupoDoProjeto({ categoria: "Ativação" })).toBe("ATIVACAO");
    expect(grupoDoProjeto({ categoria: "Percurso" })).toBe("PERCURSO");
    expect(grupoDoProjeto({ categoria: "Percurso", nome: "Grade de merchandising com pés" })).toBe("ARENA");
    expect(grupoDaLinha({ tipo: "AVULSO" })).toBe("OUTROS");
  });
});
