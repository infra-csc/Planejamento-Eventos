import { describe, expect, it } from "vitest";
import { config } from "./proxy";

/**
 * Quais caminhos passam pelo proxy (CSP, cabeçalho do caminho, bloqueio da senha provisória). O "\." do matcher
 * virava "." numa string comum e "/historico" (termina em "ico") ficava de fora (auditoria 30/10, parte D N4).
 */
describe("proxy · matcher", () => {
  const passa = (caminho: string) => new RegExp(`^${config.matcher[0]}$`).test(caminho);

  it("telas do app passam pelo proxy, inclusive as que terminam como extensão de imagem", () => {
    for (const c of ["/", "/historico", "/calendario", "/eventos/abc", "/solicitacoes", "/api/historico/csv", "/arena/eco-run-sp-2026"]) expect(passa(c), c).toBe(true);
  });

  it("arquivos estáticos e anexos ficam de fora", () => {
    for (const c of ["/favicon.ico", "/logo.png", "/_next/static/chunk.js", "/_next/image", "/api/anexos/123", "/img/capa.webp"]) expect(passa(c), c).toBe(false);
  });
});
