import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ancestraisPermitidos, gerarNonce, montarCsp } from "./csp";
import { proxy } from "@/proxy";
import { HEADER_CAMINHO } from "./cookies";

const diretivas = (csp: string) => Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v.join(" ")]));

describe("montarCsp", () => {
  it("monta a política completa com o nonce", () => {
    const d = diretivas(montarCsp("abc123", { NODE_ENV: "production" }));
    expect(d["script-src"]).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(d["style-src"]).toBe("'self' 'unsafe-inline'");
    expect(d["img-src"]).toBe("'self' data: blob:");
    expect(d["connect-src"]).toBe("'self'");
    expect(d["worker-src"]).toBe("'self' blob:");
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
    expect(d["form-action"]).toBe("'self'");
    expect(d["object-src"]).toBe("'none'");
    expect(d["default-src"]).toBe("'self'");
  });

  it("em dev libera eval (React) e WebSocket (recarregamento)", () => {
    const d = diretivas(montarCsp("n", { NODE_ENV: "development" }));
    expect(d["script-src"]).toContain("'unsafe-eval'");
    expect(d["connect-src"]).toContain("ws:");
    expect(diretivas(montarCsp("n", { NODE_ENV: "production" }))["script-src"]).not.toContain("unsafe-eval");
  });

  it("iframe do editor só no workspace do Replit; publicado ou local, ninguém embute", () => {
    expect(ancestraisPermitidos({ REPLIT_DEV_DOMAIN: "x.replit.dev" })).toContain("https://replit.com");
    expect(ancestraisPermitidos({ REPLIT_DEV_DOMAIN: "x.replit.dev", REPLIT_DEPLOYMENT: "1" })).toBe("'none'");
    expect(ancestraisPermitidos({})).toBe("'none'");
  });

  it("nonce diferente a cada chamada", () => {
    const a = gerarNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(gerarNonce()).not.toBe(a);
  });
});

describe("proxy", () => {
  it("põe a CSP com nonce na resposta e repassa nonce, CSP e caminho na requisição", () => {
    const r = proxy(new NextRequest("http://localhost:3000/eventos", { headers: { cookie: "npe_sessao=abc", [HEADER_CAMINHO]: "/perfil" } }));
    const csp = r.headers.get("content-security-policy");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    const nonce = /'nonce-([^']+)'/.exec(csp!)![1];
    // O Next repassa os cabeçalhos da requisição alterados como x-middleware-request-*.
    expect(r.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(r.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    // O caminho que o cliente mandou é sobrescrito pelo real.
    expect(r.headers.get(`x-middleware-request-${HEADER_CAMINHO}`)).toBe("/eventos");
  });

  it("sem sessão manda para o login; /api/cron passa sem cookie e sem CSP de documento", () => {
    const semSessao = proxy(new NextRequest("http://localhost:3000/eventos"));
    expect(semSessao.headers.get("location")).toContain("/login?next=%2Feventos");
    const cron = proxy(new NextRequest("http://localhost:3000/api/cron/verificacoes", { method: "POST" }));
    expect(cron.headers.get("location")).toBeNull();
    expect(cron.headers.get("content-security-policy")).toBeNull();
  });
});
