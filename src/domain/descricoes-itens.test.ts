import { describe, expect, it } from "vitest";
import { ajustarDescricoes, descricoesEsperadas, descricoesParaGravar, faltamDescricoes, MAX_DESCRICOES_POR_UNIDADE, textoDescricoes } from "./descricoes-itens";

describe("descrição por unidade", () => {
  it("uma por unidade até o limite; acima, uma só; alteração não pede", () => {
    expect(descricoesEsperadas("ADICIONAR", 10)).toBe(10);
    expect(descricoesEsperadas("ADICIONAR", MAX_DESCRICOES_POR_UNIDADE + 1)).toBe(1);
    expect(descricoesEsperadas("ALTERAR_QUANTIDADE", 10)).toBe(0);
    expect(descricoesEsperadas("REMOVER", 0)).toBe(0);
  });

  it("mudar a quantidade mantém o que foi escrito", () => {
    expect(ajustarDescricoes(["a", "b"], 4)).toEqual(["a", "b", "", ""]);
    expect(ajustarDescricoes(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });

  it("conta as que faltam e grava aparado no tamanho certo", () => {
    expect(faltamDescricoes({ operacao: "ADICIONAR", quantidadeSolicitada: 3, descricoes: ["x", " ", null as unknown as string].filter((d) => d !== null) })).toBe(2);
    expect(descricoesParaGravar("ADICIONAR", 2, [" a ", "b", "c"])).toEqual(["a", "b"]);
    expect(descricoesParaGravar("ADICIONAR", 2, ["", ""])).toBeNull();
    expect(descricoesParaGravar("REMOVER", 0, ["a"])).toBeNull();
  });

  it("texto legível para quem responde", () => {
    expect(textoDescricoes(["Logo azul", "Logo branco"])).toBe("1. Logo azul · 2. Logo branco");
    expect(textoDescricoes(["Igual", "Igual", "Igual"])).toBe("Todas as 3 unidades: Igual");
    expect(textoDescricoes(["Parafuso M8"], 200)).toBe("Todas as unidades: Parafuso M8");
    expect(textoDescricoes([" ", ""])).toBeNull();
  });
});
