/**
 * IP do limite de tentativas a partir do x-forwarded-for, com o número de proxies confiáveis configurável
 * (endurecimento E1 da auditoria de segurança 28/10).
 */
import { afterEach, describe, expect, it } from "vitest";
import { ipDoEncaminhamento, proxiesConfiaveis } from "./limite";

afterEach(() => {
  delete process.env.PROXIES_CONFIAVEIS;
});

describe("ipDoEncaminhamento", () => {
  it("com um proxy (Replit), vale o último valor: o que o cliente manda antes não conta", () => {
    expect(ipDoEncaminhamento("1.1.1.1, 9.9.9.9", 1)).toBe("9.9.9.9");
  });

  it("com dois proxies, vale o penúltimo: o último é o do proxy de dentro", () => {
    expect(ipDoEncaminhamento("forjado, 203.0.113.7, 10.0.0.2", 2)).toBe("203.0.113.7");
  });

  it("cabeçalho curto ou vazio não quebra", () => {
    expect(ipDoEncaminhamento("203.0.113.7", 3)).toBe("203.0.113.7");
    expect(ipDoEncaminhamento(null)).toBeNull();
    expect(ipDoEncaminhamento(" , ")).toBeNull();
  });

  it("PROXIES_CONFIAVEIS inválido volta ao padrão 1", () => {
    process.env.PROXIES_CONFIAVEIS = "abc";
    expect(proxiesConfiaveis()).toBe(1);
    process.env.PROXIES_CONFIAVEIS = "2";
    expect(proxiesConfiaveis()).toBe(2);
    process.env.PROXIES_CONFIAVEIS = "0";
    expect(proxiesConfiaveis()).toBe(1);
  });
});
