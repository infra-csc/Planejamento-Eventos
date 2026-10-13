import { describe, expect, it } from "vitest";
import { agruparItensPedido, agruparLocaisTenda } from "./agrupamento-pedido";

const linha = (id: string, destino: string | null, ajustes: string, descricao = "Tenda 5×5 m", tenda = true) => ({ id, destino, ajustes, descricao, tenda });

describe("agrupamento de tendas no pedido", () => {
  it("mesmo nome nunca se separa por referência, ajuste, descrição de unidade ou operação", () => {
    const itens = [linha("a", "GV", "+2 fechamentos"), linha("b", "Depósito", "-1 calha"), linha("c", "GV", "+1 fechamento")];
    const grupos = agruparItensPedido(itens, (i) => i.id);
    expect(grupos).toEqual([itens]);
    expect(grupos[0][2]).toBe(itens[2]);
  });

  it("nomes e tamanhos diferentes permanecem distintos", () => {
    const itens = [linha("a", "GV", ""), linha("b", "GV", "", "Tenda 3×3 m"), linha("c", "GV", "")];
    expect(agruparItensPedido(itens, (i) => i.id)).toEqual([[itens[0], itens[2]], [itens[1]]]);
  });

  it("normaliza apenas caixa e espaçamento dos nomes", () => {
    const a = linha("a", "GV", "", " Tenda  5×5 m ");
    const b = linha("b", "GV", "", "TENDA 5×5 M");
    expect(agruparItensPedido([a, b], (i) => i.id)).toEqual([[a, b]]);
  });

  it("não altera o agrupamento dos outros materiais nem incorpora um fechamento avulso", () => {
    const itens = [linha("a", "GV", ""), linha("b", "GV", "", "Fechamento de tenda", false), linha("c", "GV", "", "Fechamento de tenda", false)];
    expect(agruparItensPedido(itens, (i) => i.id)).toEqual(itens.map((i) => [i]));
    expect(agruparItensPedido(itens, (i) => i.tenda ? i.id : "fechamento")).toEqual([[itens[0]], [itens[1], itens[2]]]);
  });

  it("agrupa GV uma única vez e preserva cada configuração na ordem", () => {
    const itens = [linha("a", "Depósito", "+3 fechamentos · -1 calha"), linha("b", "GV", "+2 fechamentos"), linha("c", "GV", "+1 fechamento"), linha("d", "GV", "+1 fechamento · -1 calha"), linha("e", "Dispersão", "")];
    expect(agruparLocaisTenda(itens)).toEqual([
      { local: "Depósito", itens: [itens[0]] },
      { local: "GV", itens: [itens[1], itens[2], itens[3]] },
      { local: "Dispersão", itens: [itens[4]] },
    ]);
  });

  it("locais repetidos não contíguos se juntam sem perder linhas", () => {
    const itens = [linha("a", " GV ", ""), linha("b", "Buffet", ""), linha("c", "gv", "")];
    const grupos = agruparLocaisTenda(itens);
    expect(grupos.map((g) => g.local)).toEqual(["GV", "Buffet"]);
    expect(grupos[0].itens).toEqual([itens[0], itens[2]]);
    expect(itens.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("locais ausentes compartilham um grupo, sem inventar um destino", () => {
    const itens = [linha("a", null, ""), linha("b", " ", ""), linha("c", "", "")];
    expect(agruparLocaisTenda(itens)).toEqual([{ local: null, itens }]);
  });
});
