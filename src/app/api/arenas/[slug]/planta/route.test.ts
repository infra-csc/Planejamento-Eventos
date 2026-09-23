/**
 * GET /api/arenas/[slug]/planta chamado direto, com sessão de verdade (cookie simulado) e PGlite
 * em memória. arena.ver é só do administrador: os outros perfis (e o administrador em "ver como")
 * recebem 403.
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

import { COOKIE_SESSAO, COOKIE_VER_COMO } from "@/server/auth/cookies";
import { pode, PERFIS } from "@/domain/permissions";
import { criarArena } from "@/server/services/arenas";
import { abrirSessao, migrarBanco, montarElenco, novoEvento, pngMinimo, unico, type Elenco } from "@/test/apoio";
import { GET } from "./route";

let E: Elenco;
let png: Buffer;
let comPlanta: string;
let semPlanta: string;

async function entrar(usuarioId: string) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
}
const chamar = (slug: string, headers: Record<string, string> = {}) => GET(new Request(`http://teste/api/arenas/${slug}/planta`, { headers }), { params: Promise.resolve({ slug }) });

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  png = await pngMinimo(64, 48);
  const nova = async (planta: boolean) =>
    (
      await criarArena(
        E.admin,
        { eventoId: (await novoEvento(E.logistica)).id, nome: unico("Arena"), partida: { tipo: "branco", largura: 80, profundidade: 60 } },
        planta ? new File([new Uint8Array(png)], "planta.png", { type: "image/png" }) : null,
      )
    ).slug;
  comPlanta = await nova(true);
  semPlanta = await nova(false);
}, 120_000);

beforeEach(() => req.cookies.clear());

describe("GET /api/arenas/[slug]/planta", { timeout: 30_000 }, () => {
  it("401 sem sessão", async () => {
    expect((await chamar(comPlanta)).status).toBe(401);
  });

  it("403 para todo perfil sem arena.ver", async () => {
    for (const perfil of PERFIS) {
      const u = E.porPerfil[perfil];
      if (pode(u, "arena.ver")) continue;
      req.cookies.clear();
      await entrar(u.id);
      expect((await chamar(comPlanta)).status, perfil).toBe(403);
    }
  });

  it("403 para o administrador em ver como (não eleva nem mantém o acesso de admin)", async () => {
    await entrar(E.admin.id);
    req.cookies.set(COOKIE_VER_COMO, JSON.stringify({ perfil: "LOGISTICA", areaId: E.areas.logistica.id }));
    expect((await chamar(comPlanta)).status).toBe(403);
  });

  it("404 para arena inexistente e para arena sem planta", async () => {
    await entrar(E.admin.id);
    expect((await chamar("arena-que-nao-existe")).status).toBe(404);
    expect((await chamar(semPlanta)).status).toBe(404);
  });

  it("200 com a imagem, nosniff, sandbox e ETag; 304 com If-None-Match", async () => {
    await entrar(E.admin.id);
    const r = await chamar(comPlanta);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toContain("sandbox");
    expect(Buffer.from(await r.arrayBuffer()).equals(png)).toBe(true);
    const etag = r.headers.get("etag")!;
    expect((await chamar(comPlanta, { "if-none-match": etag })).status).toBe(304);
  });
});
