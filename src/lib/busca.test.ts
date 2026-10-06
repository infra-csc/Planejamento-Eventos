import { describe, expect, it } from "vitest";
import { combinaBusca, relevanciaBusca } from "./busca";

describe("busca", () => {
  it("x acha ×, sem acento e em qualquer ordem", () => {
    expect(combinaBusca("Tenda 5×5 m", "tenda 5x5")).toBe(true);
    expect(combinaBusca("Pórtico boca de 4 m", "portico 4")).toBe(true);
  });
  it("relevância: começa pelo termo, depois palavra, depois o resto; variação depois do original", () => {
    const nomes = ["Fundo de palco 8×4 m (moldura)", "Palco 8×4 m — modelo Blue Run", "Palco 8×4 m com escada e rampa"];
    const ordem = [...nomes].sort((a, b) => relevanciaBusca(a, "palco 8") - relevanciaBusca(b, "palco 8"));
    expect(ordem).toEqual(["Palco 8×4 m com escada e rampa", "Palco 8×4 m — modelo Blue Run", "Fundo de palco 8×4 m (moldura)"]);
  });
});
