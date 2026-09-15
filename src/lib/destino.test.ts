import { describe, expect, it } from "vitest";
import { destinoInterno } from "./destino";

describe("destinoInterno", () => {
  it("mantém caminhos internos com query", () => {
    expect(destinoInterno("/eventos/1?aba=ata")).toBe("/eventos/1?aba=ata");
  });
  it("bloqueia redirecionamento para fora", () => {
    for (const v of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\t/evil.com", "", null]) {
      expect(destinoInterno(v)).toBe("/");
    }
  });
});
