import { describe, expect, it } from "vitest";
import { descricaoDaUnidade } from "./unidades-tenda";

describe("descrição individual das tendas", () => {
  it("preserva a ordem do pedido mesmo quando os textos se repetem", () => {
    const descricoes = ["Azul", "Branca", "Azul", "Verde", "Branca"];
    expect([1, 2, 3, 4, 5].map((n) => descricaoDaUnidade(descricoes, n))).toEqual(descricoes);
  });

  it("aplica uma descrição compartilhada a todas as unidades, inclusive acima de 50", () => {
    expect(descricaoDaUnidade([" Lona azul "], 1)).toBe("Lona azul");
    expect(descricaoDaUnidade([" Lona azul "], 60)).toBe("Lona azul");
  });

  it("não inventa descrições para unidades novas ou não descritas", () => {
    expect(descricaoDaUnidade(["Azul", "", "Branca"], 2)).toBeNull();
    expect(descricaoDaUnidade(["Azul", "Branca"], 3)).toBeNull();
    expect(descricaoDaUnidade([], 5)).toBeNull();
  });

  it("dados restritos ou ausentes não exibem descrição", () => {
    expect(descricaoDaUnidade(null, 1)).toBeNull();
    expect(descricaoDaUnidade(undefined, 1)).toBeNull();
  });

  it("ignora posições inválidas", () => {
    for (const n of [0, -1, 1.5, NaN, Infinity]) expect(descricaoDaUnidade(["Azul"], n)).toBeNull();
  });
});
