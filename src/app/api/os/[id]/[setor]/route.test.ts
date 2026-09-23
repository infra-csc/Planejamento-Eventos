/**
 * GET /api/os/[id]/[setor] (CSV de um setor) chamado direto, com sessão de verdade (cookie
 * simulado) e PGlite em memória. Inclui o escape contra CSV injection.
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

import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { pecas } from "@/server/db/schema";
import { COOKIE_SESSAO } from "@/server/auth/cookies";
import { abrirSessao, criarPeca, eventoAberto, migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { csvEscape, GET } from "./route";

let E: Elenco;
let eventoId: string;
let codigoPeca: string;

async function entrar(usuarioId: string) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
}
const chamar = (id: string, setor: string, query = "") => GET(new Request(`http://teste/api/os/${id}/${setor}${query}`), { params: Promise.resolve({ id, setor }) });

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const peca = await criarPeca("ESTRUTURA");
  // Nome digitado por alguém que tenta uma fórmula no Excel.
  const db = await getDb();
  await db.update(pecas).set({ nome: '=HYPERLINK("http://mal.example","clique")' }).where(eq(pecas.id, peca.id));
  codigoPeca = peca.codigo;
  eventoId = (await eventoAberto(E.logistica, peca.id, E.areas.a.id)).ev.id;
}, 120_000);

beforeEach(() => {
  req.cookies.clear();
  restricao.negar.clear();
});

describe("GET /api/os/[id]/[setor]", { timeout: 30_000 }, () => {
  it("401 sem sessão", async () => {
    expect((await chamar(eventoId, "ESTRUTURA")).status).toBe(401);
  });

  it("403 quando o perfil não tem os.exportar", async () => {
    restricao.negar.add("CENOGRAFIA:os.exportar");
    await entrar(E.cenografia.id);
    expect((await chamar(eventoId, "ESTRUTURA")).status).toBe(403);
  });

  it("400 para setor inválido e 404 para evento inexistente", async () => {
    await entrar(E.requisitante.id);
    expect((await chamar(eventoId, "COZINHA")).status).toBe(400);
    expect((await chamar("evento-que-nao-existe", "ESTRUTURA")).status).toBe(404);
  });

  it("200: CSV com BOM, separador ; e a peça do setor; fórmula neutralizada", async () => {
    await entrar(E.requisitante.id);
    const r = await chamar(eventoId, "ESTRUTURA", "?v=1");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="OS-.*-ESTRUTURA-v1\.csv"/);
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder().decode(bytes.subarray(3));
    const linha = csv.split("\r\n").find((l) => l.startsWith(codigoPeca));
    expect(linha).toBeDefined();
    expect(linha).toContain(`"'=HYPERLINK(""http://mal.example"",""clique"")"`);
    expect(linha).toContain(";10;");
  });

  it("setor sem peças sai só com o cabeçalho", async () => {
    await entrar(E.logistica.id);
    const csv = await (await chamar(eventoId, "MARCENARIA")).text();
    expect(csv.trim().split("\r\n").at(-1)).toBe("Código;Peça;Unidade;Total;Composição");
  });
});

describe("csvEscape", () => {
  it("neutraliza = + - @ tab e CR no início de texto, sem mexer em número", () => {
    for (const perigoso of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx", "\rx"]) expect(csvEscape(perigoso).startsWith(`"'`)).toBe(true);
    expect(csvEscape(-5)).toBe("-5");
    expect(csvEscape("texto; com separador")).toBe('"texto; com separador"');
    expect(csvEscape('aspas "duplas"')).toBe('"aspas ""duplas"""');
    expect(csvEscape("normal")).toBe("normal");
  });
});
