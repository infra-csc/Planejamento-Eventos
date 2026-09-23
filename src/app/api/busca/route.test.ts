/**
 * GET /api/busca chamado direto, com sessão de verdade (cookie simulado) e PGlite em memória:
 * a busca global respeita a área de quem pergunta.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const req = vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  return { cookies: new Map<string, string>() };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (req.cookies.has(k) ? { name: k, value: req.cookies.get(k)! } : undefined), set: () => undefined, delete: () => undefined }),
  headers: async () => ({ get: () => null }),
}));

import { COOKIE_SESSAO } from "@/server/auth/cookies";
import { salvarSolicitacaoCompleta } from "@/server/services/solicitacoes";
import { abrirSessao, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { GET } from "./route";

let E: Elenco;
let idDaA: string;

async function entrar(usuarioId: string) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
}
const buscar = async (q: string) => GET(new Request(`http://teste/api/busca?q=${encodeURIComponent(q)}`));

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const ev = await novoEvento(E.logistica);
  const r = await salvarSolicitacaoCompleta(E.requisitante, { eventoId: ev.id, titulo: "Palco zebrado exclusivo", observacao: null, enviar: true, itens: [itemAvulso("Palco")] });
  idDaA = r.id;
}, 120_000);

beforeEach(() => req.cookies.clear());

describe("GET /api/busca", { timeout: 30_000 }, () => {
  it("401 sem sessão", async () => {
    expect((await buscar("palco")).status).toBe(401);
  });

  it("200: a própria área acha a solicitação; outra área não", async () => {
    await entrar(E.requisitante.id);
    const daA = await buscar("zebrado");
    expect(daA.status).toBe(200);
    expect(daA.headers.get("cache-control")).toBe("no-store");
    const { resultados } = (await daA.json()) as { resultados: Array<{ href: string }> };
    expect(resultados.some((x) => x.href.includes(idDaA))).toBe(true);

    req.cookies.clear();
    await entrar(E.requisitanteB.id);
    const daB = (await (await buscar("zebrado")).json()) as { resultados: Array<{ href: string }> };
    expect(daB.resultados.some((x) => x.href.includes(idDaA))).toBe(false);
  });
});
