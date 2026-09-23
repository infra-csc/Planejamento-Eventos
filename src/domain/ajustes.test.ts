import { describe, expect, it } from "vitest";
import { aplicarAjustesBom, resumirAjustes } from "./os";

const bom = [
  { pecaId: "prat", codigo: "PRAT-2X1", nome: "Praticável 2×1", setor: "ESTRUTURA" as const, unidade: "un", quantidade: 18 },
  { pecaId: "cubo", codigo: "CUBO", nome: "Cubo", setor: "ESTRUTURA" as const, unidade: "un", quantidade: 8 },
];

describe("ajustes na lista de peças do projeto", () => {
  it("soma e subtrai por peça, nunca abaixo de zero, e remove a peça zerada", () => {
    const r = aplicarAjustesBom(bom, [
      { pecaId: "prat", codigo: "PRAT-2X1", nome: "Praticável 2×1", quantidade: 2 },
      { pecaId: "cubo", codigo: "CUBO", nome: "Cubo", quantidade: -8 },
    ]);
    expect(r).toEqual([{ ...bom[0], quantidade: 20 }]);
  });

  it("sem ajustes devolve a lista padrão intacta", () => {
    expect(aplicarAjustesBom(bom, null)).toBe(bom);
    expect(aplicarAjustesBom(bom, [])).toBe(bom);
  });

  it("ignora peça que não está no projeto (o serviço já barra antes)", () => {
    expect(aplicarAjustesBom(bom, [{ pecaId: "x", codigo: "X", nome: "X", quantidade: 5 }])).toEqual(bom);
  });

  it("peça extra validada (fechamento de tenda, com setor e unidade) entra por unidade; negativa ou zero não", () => {
    const tenda = [{ pecaId: "cant", codigo: "TND5-CANT", nome: "Cantoneira", setor: "TENDA" as const, unidade: "un", quantidade: 4 }];
    const r = aplicarAjustesBom(tenda, [
      { pecaId: "fech", codigo: "TND5-FECH", nome: "Fechamento", quantidade: 3, setor: "TENDA", unidade: "un" },
      { pecaId: "calha", codigo: "TND5-CALHA", nome: "Calha", quantidade: -1, setor: "TENDA", unidade: "un" },
    ]);
    expect(r).toEqual([tenda[0], { pecaId: "fech", codigo: "TND5-FECH", nome: "Fechamento", setor: "TENDA", unidade: "un", quantidade: 3 }]);
  });

  it("resume em texto legível", () => {
    expect(resumirAjustes([{ pecaId: "prat", codigo: "PRAT-2X1", nome: "Praticável 2×1", quantidade: 2 }, { pecaId: "cubo", codigo: "CUBO", nome: "Cubo", quantidade: -1 }])).toBe("+2 Praticável 2×1 · −1 Cubo");
    expect(resumirAjustes(null)).toBeNull();
    expect(resumirAjustes([])).toBeNull();
  });
});
