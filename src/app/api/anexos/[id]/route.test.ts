/**
 * GET /api/anexos/[id] chamado direto, com sessão de verdade no banco (cookie simulado em
 * `next/headers`) e PGlite em memória. `restricao` tira uma ação de um perfil na MATRIZ para
 * exercitar o caminho "sem permissão" (hoje todo perfil tem projeto.ver).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { req, restricao } = vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  return { req: { cookies: new Map<string, string>() }, restricao: { negar: new Set<string>() } };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (req.cookies.has(k) ? { name: k, value: req.cookies.get(k)! } : undefined), set: () => undefined, delete: () => undefined }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("@/domain/permissions", async (original) => {
  const m = await original<typeof import("@/domain/permissions")>();
  return { ...m, pode: (u: { perfil: string; areaId: string | null }, a: string) => !restricao.negar.has(`${u.perfil}:${a}`) && m.pode(u as never, a as never) };
});

import { COOKIE_SESSAO } from "@/server/auth/cookies";
import { anexarArquivo } from "@/server/services/projetos";
import { abrirSessao, criarPeca, criarProjeto, migrarBanco, montarElenco, pngMinimo, type Elenco } from "@/test/apoio";
import { GET } from "./route";

let E: Elenco;
let png: Buffer;
let imagemId: string;
let pdfId: string;

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function entrar(usuarioId: string) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
}
const chamar = (id: string, query = "", headers: Record<string, string> = {}) => GET(new Request(`http://teste/api/anexos/${id}${query}`, { headers }), { params: Promise.resolve({ id }) });

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  png = await pngMinimo(400, 300);
  const projeto = await criarProjeto((await criarPeca()).id);
  imagemId = (await anexarArquivo(E.cenografia, projeto.id, new File([new Uint8Array(png)], "planta do palco.png", { type: "image/png" }))).id;
  pdfId = (await anexarArquivo(E.cenografia, projeto.id, new File([PDF], "memorial.pdf", { type: "application/pdf" }))).id;
}, 120_000);

beforeEach(() => {
  req.cookies.clear();
  restricao.negar.clear();
});

describe("GET /api/anexos/[id]", { timeout: 30_000 }, () => {
  it("401 sem sessão (e com token que não existe)", async () => {
    expect((await chamar(imagemId)).status).toBe(401);
    req.cookies.set(COOKIE_SESSAO, "token-inventado");
    expect((await chamar(imagemId)).status).toBe(401);
  });

  it("404 para id inexistente ou malformado", async () => {
    await entrar(E.requisitante.id);
    for (const id of ["00000000-0000-0000-0000-000000000000", "nao-existe", "'; drop table anexos; --"]) {
      const r = await chamar(id);
      expect(r.status, id).toBe(404);
    }
  });

  it("200 com o original, isolado (nosniff + CSP sandbox) e cache imutável", async () => {
    await entrar(E.requisitante.id);
    const r = await chamar(imagemId);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toContain("sandbox");
    expect(r.headers.get("cache-control")).toContain("immutable");
    expect(r.headers.get("content-disposition")).toContain(encodeURIComponent("planta do palco.png"));
    expect(Buffer.from(await r.arrayBuffer()).equals(png)).toBe(true);
  });

  it("miniatura ?w=160 sai em WebP reduzido; largura fora da lista serve o original", async () => {
    await entrar(E.logistica.id);
    const r = await chamar(imagemId, "?w=160");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/webp");
    expect(r.headers.get("content-disposition")).toContain("planta%20do%20palco.webp");
    const corpo = Buffer.from(await r.arrayBuffer());
    expect(corpo.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(corpo.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(corpo.byteLength).toBeLessThan(png.byteLength);
    // Segunda chamada: mesma miniatura (cache da instância).
    expect(Buffer.from(await (await chamar(imagemId, "?w=160")).arrayBuffer()).equals(corpo)).toBe(true);
    const fora = await chamar(imagemId, "?w=999");
    expect(fora.headers.get("content-type")).toBe("image/png");
  });

  it("PDF nunca vira miniatura", async () => {
    await entrar(E.gestao.id);
    const r = await chamar(pdfId, "?w=160");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });

  it("304 quando o navegador já tem a versão (ETag)", async () => {
    await entrar(E.admin.id);
    const etag = (await chamar(imagemId)).headers.get("etag")!;
    expect(etag).toBeTruthy();
    const r = await chamar(imagemId, "", { "if-none-match": etag });
    expect(r.status).toBe(304);
    // A ETag da miniatura é outra: não serve o original como se fosse a reduzida.
    expect((await chamar(imagemId, "?w=160", { "if-none-match": etag })).status).toBe(200);
  });

  // Perfil sem projeto.ver: 403 (antes, SemPermissaoError escapava e virava 500).
  it("403 para perfil sem projeto.ver", async () => {
    restricao.negar.add("REQUISITANTE:projeto.ver");
    await entrar(E.requisitante.id);
    const r = await chamar(imagemId);
    expect(r.status).toBe(403);
  });
});
