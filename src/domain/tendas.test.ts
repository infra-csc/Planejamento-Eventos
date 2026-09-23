import { describe, expect, it } from "vitest";
import { dividirPorUnidade, ehProjetoTenda, extrasPermitidosTenda, KITS_TENDA, kitDaTenda, papelNoKit, previaTendas } from "./tendas";

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
  it("reconhece pelo kit (cantoneira ou fechamento) e acha o tamanho", () => {
    expect(kitDaTenda(codigos5)?.tamanho).toBe("5×5");
    expect(kitDaTenda(["TND3-CANT", "TND3-PE"])?.tamanho).toBe("3×3");
    expect(kitDaTenda(["TND3-FECH"])?.tamanho).toBe("3×3");
    expect(ehProjetoTenda(["BOX-3000", "CUBO", "PARAF"])).toBe(false);
    // Lona sozinha não caracteriza tenda: a regra olha cantoneira ou fechamento.
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
      { local: "Depósito", quantidade: 2, fechamentos: 6, calhas: 1 },
      { local: "GV", quantidade: 3, fechamentos: 5, calhas: 2 },
    ]);
    const t = Object.fromEntries(r.map((x) => [x.papel, x.total]));
    expect(t).toEqual({ fechamento: 11, cantoneira: 20, travessa: 20, pe: 20, mastro: 5, cabo: 5, calha: 3 });
  });

  it("3×3 não mostra calha", () => {
    const r = previaTendas(KITS_TENDA[1], [{ codigo: "TND3-CANT", quantidade: 4 }], [{ local: "Buffet", quantidade: 3, fechamentos: 9, calhas: 0 }]);
    expect(r.map((x) => x.papel)).not.toContain("calha");
    expect(r.find((x) => x.papel === "fechamento")?.total).toBe(9);
  });
});
