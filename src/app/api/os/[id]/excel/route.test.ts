/**
 * GET /api/os/[id]/excel chamado direto, com sessão de verdade (cookie simulado) e PGlite em
 * memória. os.exportar é de todos os perfis: o 403 é exercitado tirando a ação de um perfil
 * (`restricao`), para garantir que a rota checa a MATRIZ em vez de confiar na tela.
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

import ExcelJS from "exceljs";
import { COOKIE_SESSAO } from "@/server/auth/cookies";
import { PERFIS } from "@/domain/permissions";
import { abrirSessao, criarPeca, eventoAberto, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { GET } from "./route";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
let E: Elenco;
let eventoId: string;
let codigoEvento: string;

async function entrar(usuarioId: string) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
}
const chamar = (id: string, query = "") => GET(new Request(`http://teste/api/os/${id}/excel${query}`), { params: Promise.resolve({ id }) });

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const { ev } = await eventoAberto(E.logistica, (await criarPeca()).id, E.areas.a.id);
  eventoId = ev.id;
  codigoEvento = ev.codigo;
}, 120_000);

beforeEach(() => {
  req.cookies.clear();
  restricao.negar.clear();
});

describe("GET /api/os/[id]/excel", { timeout: 30_000 }, () => {
  it("401 sem sessão", async () => {
    expect((await chamar(eventoId)).status).toBe(401);
  });

  it("403 quando o perfil não tem os.exportar", async () => {
    restricao.negar.add("REQUISITANTE:os.exportar");
    await entrar(E.requisitante.id);
    expect((await chamar(eventoId)).status).toBe(403);
  });

  it("404 para evento inexistente", async () => {
    await entrar(E.logistica.id);
    expect((await chamar("evento-que-nao-existe")).status).toBe(404);
  });

  it("200: todo perfil baixa um .xlsx válido da OS atual", async () => {
    for (const perfil of PERFIS) {
      req.cookies.clear();
      await entrar(E.porPerfil[perfil].id);
      const r = await chamar(eventoId);
      expect(r.status, perfil).toBe(200);
      expect(r.headers.get("content-type")).toBe(XLSX);
      expect(r.headers.get("content-disposition")).toContain(`OS-${codigoEvento}-v1.xlsx`);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await r.arrayBuffer());
      expect(wb.worksheets.length).toBeGreaterThan(0);
    }
  });

  it("versão pedida (?v=1) e evento sem OS (prévia)", async () => {
    await entrar(E.logistica.id);
    const v1 = await chamar(eventoId, "?v=1");
    expect(v1.status).toBe(200);
    expect(v1.headers.get("content-disposition")).toContain("-v1.xlsx");
    const semOs = await novoEvento(E.logistica);
    const previa = await chamar(semOs.id);
    expect(previa.status).toBe(200);
    expect(previa.headers.get("content-disposition")).toContain("previa");
  });
});
