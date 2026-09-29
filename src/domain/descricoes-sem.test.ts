/** Item marcado "não precisa descrever cada unidade": nada a descrever, um local só, nada gravado. */
import { describe, expect, it } from "vitest";
import { agruparPorLocal, descricoesEsperadas, descricoesParaGravar, faltamDescricoes } from "./descricoes-itens";

describe("item sem descrição por unidade", () => {
  it("não pede descrição nem bloqueia o envio", () => {
    expect(descricoesEsperadas("ADICIONAR", 20, true)).toBe(0);
    expect(faltamDescricoes({ operacao: "ADICIONAR", quantidadeSolicitada: 20, descricoes: [], semDescricao: true })).toBe(0);
    expect(faltamDescricoes({ operacao: "ADICIONAR", quantidadeSolicitada: 20, descricoes: [] })).toBe(20);
  });

  it("vira um item só, no local informado, sem descrições", () => {
    expect(agruparPorLocal("ADICIONAR", 20, [], ["Arena"], true)).toEqual([{ destino: "Arena", quantidade: 20, descricoes: [] }]);
    expect(descricoesParaGravar("ADICIONAR", 20, ["x"], true)).toBeNull();
  });
});
