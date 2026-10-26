import { describe, expect, it } from "vitest";
import { dividirPorUnidade, ehProjetoTenda, extrasPermitidosTenda, itensDoQuadro, KITS_TENDA, kitDaTenda, locaisDosItens, locaisIniciaisTenda, novoLocalTenda, papelNoKit, previaTendas, totalDoLocal } from "./tendas";

const bom5 = [
  { codigo: "TND5-CANT", quantidade: 4 },
  { codigo: "TND5-TRAV", quantidade: 4 },
  { codigo: "TND5-PE", quantidade: 4 },
  { codigo: "TND5-MASTRO", quantidade: 1 },
  { codigo: "TND5-CABO", quantidade: 1 },
  { codigo: "TND5-LONA", quantidade: 1 },
];
const codigos5 = bom5.map((b) => b.codigo);

describe("projeto de tenda", () => {
  it("reconhece pelas peças do tamanho (a cantoneira universal não diz o tamanho)", () => {
    expect(kitDaTenda(codigos5)?.tamanho).toBe("5×5");
    expect(kitDaTenda(["TND3-CANT", "TND3-PE"])?.tamanho).toBe("3×3");
    expect(kitDaTenda(["TND3-FECH"])?.tamanho).toBe("3×3");
    expect(kitDaTenda(["TND5-CANT", "TND3-TRAV", "TND3-PE"])?.tamanho).toBe("3×3");
    expect(kitDaTenda(["TND5-CANT"])).toBeNull();
    expect(ehProjetoTenda(["BOX-3000", "CUBO", "PARAF"])).toBe(false);
    // Lona sozinha não caracteriza tenda.
    expect(ehProjetoTenda(["TND5-LONA"])).toBe(false);
  });

  it("peças por local (fechamento e calha) podem entrar como ajuste fora do padrão", () => {
    expect(extrasPermitidosTenda(codigos5)).toEqual(["TND5-FECH", "TND5-CALHA"]);
    expect(extrasPermitidosTenda(["TND3-CANT"])).toEqual(["TND3-FECH"]); // 3×3 não tem calha
    expect(extrasPermitidosTenda([...codigos5, "TND5-FECH"])).toEqual(["TND5-CALHA"]); // já está no padrão
    expect(extrasPermitidosTenda(["BOX-3000"])).toEqual([]);
  });

  it("papel da peça no kit", () => {
    const kit = KITS_TENDA[0];
    expect(papelNoKit(kit, "TND5-CALHA")).toBe("calha");
    expect(papelNoKit(kit, "TND5-LONA")).toBeNull();
  });
});

describe("dividirPorUnidade", () => {
  it("divide o total do local entre as tendas, somando exatamente o pedido", () => {
    const g = dividirPorUnidade(2, [5, 1]);
    expect(g).toEqual([{ quantidade: 1, porUnidade: [3, 1] }, { quantidade: 1, porUnidade: [2, 0] }]);
    const soma = (i: number) => g.reduce((a, x) => a + x.quantidade * x.porUnidade[i], 0);
    expect(soma(0)).toBe(5);
    expect(soma(1)).toBe(1);
  });

  it("divisão exata vira um grupo só", () => {
    expect(dividirPorUnidade(3, [6, 0])).toEqual([{ quantidade: 3, porUnidade: [2, 0] }]);
    expect(dividirPorUnidade(4, [0, 0])).toEqual([{ quantidade: 4, porUnidade: [0, 0] }]);
  });

  it("quantidade inválida não gera grupo", () => {
    expect(dividirPorUnidade(0, [3])).toEqual([]);
  });
});

describe("previaTendas", () => {
  it("soma padrão × tendas + fechamentos e calhas por local (linha TOTAL da planilha)", () => {
    const kit = KITS_TENDA[0];
    const r = previaTendas(kit, bom5, [
      { local: "Depósito", quantidade: 2, totais: { fechamento: 6, calha: 1 } },
      { local: "GV", quantidade: 3, totais: { fechamento: 5, calha: 2 } },
    ]);
    const t = Object.fromEntries(r.map((x) => [x.papel, x.total]));
    expect(t).toEqual({ fechamento: 11, cantoneira: 20, travessa: 20, pe: 20, mastro: 5, cabo: 5, calha: 3 });
  });

  it("3×3 não mostra calha", () => {
    const r = previaTendas(KITS_TENDA[1], [{ codigo: "TND3-CANT", quantidade: 4 }], [{ local: "Buffet", quantidade: 3, totais: { fechamento: 9 } }]);
    expect(r.map((x) => x.papel)).not.toContain("calha");
    expect(r.find((x) => x.papel === "fechamento")?.total).toBe(9);
  });

  it("qualquer coluna digitada sobrescreve o padrão × tendas", () => {
    const kit = KITS_TENDA[0];
    const l = { local: "Médica", quantidade: 2, totais: { cantoneira: 10, fechamento: 4 } };
    expect(totalDoLocal(kit, bom5, l, "cantoneira")).toBe(10);
    expect(totalDoLocal(kit, bom5, l, "travessa")).toBe(8);
    expect(totalDoLocal(kit, bom5, l, "fechamento")).toBe(4);
    const r = previaTendas(kit, bom5, [l]);
    expect(r.find((x) => x.papel === "cantoneira")?.total).toBe(10);
  });
});

describe("itensDoQuadro", () => {
  const kit = KITS_TENDA[0];
  it("um item por local com o ajuste por unidade de cada peça (só o que difere do padrão)", () => {
    const itens = itensDoQuadro(kit, bom5, [
      { local: "Depósito", quantidade: 2, totais: { fechamento: 6, calha: 1 } },
      { local: "Extra", quantidade: 0, totais: { fechamento: 4 } },
      { local: "Médica", quantidade: 1, totais: { cantoneira: 6, mastro: 1 } },
    ]);
    // Depósito: 6 fechamentos e 1 calha em 2 tendas → 1 tenda (3 fech, 1 calha) + 1 tenda (3 fech).
    expect(itens).toEqual([
      { local: "Depósito", quantidade: 1, ajustes: { "TND5-FECH": 3, "TND5-CALHA": 1 } },
      { local: "Depósito", quantidade: 1, ajustes: { "TND5-FECH": 3 } },
      { local: "Médica", quantidade: 1, ajustes: { "TND5-CANT": 2 } },
    ]);
  });

  it("o quadro abre com os locais padrão e acessórios zerados", () => {
    const locais = locaisIniciaisTenda("5×5");
    expect(locais.map((l) => l.local)).toEqual(["Depósito", "GV", "Dispersão", "Médica", "Extra"]);
    const t = Object.fromEntries(previaTendas(kit, bom5, locais).map((x) => [x.papel, x.total]));
    expect(t.fechamento).toBe(0);
    expect(t.calha).toBe(0);
    expect(t.cantoneira).toBe(32);
    expect(locaisIniciaisTenda("9×9")).toEqual([{ local: "", quantidade: 0, totais: { fechamento: 0, calha: 0 } }]);
  });

  it("novos locais e mudanças na quantidade não acrescentam acessórios do BOM", () => {
    const bomComAcessorios = [...bom5, { codigo: "TND5-FECH", quantidade: 4 }, { codigo: "TND5-CALHA", quantidade: 1 }];
    for (const local of [...locaisIniciaisTenda("5×5"), { ...novoLocalTenda(), quantidade: 3 }]) {
      expect(totalDoLocal(kit, bomComAcessorios, local, "fechamento")).toBe(0);
      expect(totalDoLocal(kit, bomComAcessorios, local, "calha")).toBe(0);
      const itens = itensDoQuadro(kit, bomComAcessorios, [local]);
      expect(itens[0].ajustes).toEqual({ "TND5-FECH": -4, "TND5-CALHA": -1 });
    }
    expect(locaisIniciaisTenda("3×3").every((l) => l.totais.fechamento === 0)).toBe(true);
  });

  it("volta dos itens para o quadro: soma por local e só marca o que foge do padrão", () => {
    const locais = [
      { local: "Depósito", quantidade: 2, totais: { fechamento: 6, calha: 1 } },
      { local: "GV", quantidade: 3, totais: {} },
      { local: "Médica", quantidade: 1, totais: { cantoneira: 6 } },
    ];
    const itens = itensDoQuadro(kit, bom5, locais).map((i) => ({ destino: i.local, quantidade: i.quantidade, ajustes: i.ajustes }));
    const volta = locaisDosItens(kit, bom5, itens);
    expect(volta).toEqual(locais);
    // E o quadro de volta gera os mesmos itens.
    expect(itensDoQuadro(kit, bom5, volta)).toEqual(itensDoQuadro(kit, bom5, locais));
  });
});

describe("descrições opcionais de tendas", () => {
  const kit = KITS_TENDA[0];
  const voltar = (itens: ReturnType<typeof itensDoQuadro>) => locaisDosItens(kit, bom5, itens.map((i) => ({ ...i, destino: i.local })));

  it("mantém cada descrição ao dividir o local por fechamentos e calhas e ao reabrir", () => {
    const local = { local: "Buffet", quantidade: 3, totais: { fechamento: 8, calha: 1 }, descricoes: ["Bebidas", "Doces", "Salgados"], semDescricao: false };
    const itens = itensDoQuadro(kit, bom5, [local]);
    expect(itens.flatMap((i) => i.descricoes ?? [])).toEqual(local.descricoes);
    expect(itens.every((i) => i.semDescricao === false)).toBe(true);
    expect(voltar(itens)).toEqual([local]);
    expect(itensDoQuadro(kit, bom5, voltar(itens))).toEqual(itens);
  });

  it("editar apenas peças ou nome do local não apaga descrições", () => {
    const local = { local: "Buffet", quantidade: 2, totais: { fechamento: 6 }, descricoes: ["Azul", "Branca"], semDescricao: false };
    const reaberto = voltar(itensDoQuadro(kit, bom5, [local]))[0];
    const editados = itensDoQuadro(kit, bom5, [{ ...reaberto, local: "Buffet externo", totais: { fechamento: 5 } }]);
    expect(editados.flatMap((i) => i.descricoes ?? [])).toEqual(["Azul", "Branca"]);
    expect(editados.every((i) => i.local === "Buffet externo")).toBe(true);
  });

  it("aumentar quantidade conserva textos e deixa só as novas unidades vazias", () => {
    const itens = itensDoQuadro(kit, bom5, [{ local: "Buffet", quantidade: 3, totais: {}, descricoes: ["Azul", "Branca"], semDescricao: false }]);
    expect(itens[0].descricoes).toEqual(["Azul", "Branca", ""]);
  });

  it("diminuir quantidade corta somente as unidades retiradas", () => {
    const itens = itensDoQuadro(kit, bom5, [{ local: "Buffet", quantidade: 1, totais: {}, descricoes: ["Azul", "Branca"], semDescricao: false }]);
    expect(itens[0].descricoes).toEqual(["Azul"]);
  });

  it("dispensar descrição mantém os textos em memória para reativar a opção", () => {
    const local = { local: "Buffet", quantidade: 2, totais: {}, descricoes: ["Azul", "Branca"], semDescricao: true };
    expect(voltar(itensDoQuadro(kit, bom5, [local]))).toEqual([local]);
  });

  it("tendas sem descrição continuam opcionais e não recebem um texto inventado", () => {
    const itens = itensDoQuadro(kit, bom5, [{ local: "Buffet", quantidade: 2, totais: {}, descricoes: [], semDescricao: true }]);
    expect(itens[0].descricoes).toEqual([]);
    expect(voltar(itens)[0].semDescricao).toBe(true);
  });

  it("acima de 50, distribui a descrição única entre os grupos do kit", () => {
    const local = { local: "Buffet", quantidade: 60, totais: { fechamento: 179 }, descricoes: ["Lona branca"], semDescricao: false };
    const itens = itensDoQuadro(kit, bom5, [local]);
    expect(itens).toHaveLength(2);
    expect(itens.every((i) => i.descricoes?.every((d) => d === "Lona branca"))).toBe(true);
    expect(voltar(itens)).toEqual([local]);
  });
});
