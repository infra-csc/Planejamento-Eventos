/**
 * GET /api/os/[id]/complemento (o que mudou desde a OS enviada ao carregamento) chamado direto,
 * com sessão de verdade (cookie simulado) e PGlite em memória.
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
import { alterarQuantidadeLinha } from "@/server/services/eventos";
import { marcarOsEnviada } from "@/server/services/os";
import { abrirSessao, criarPeca, eventoAberto, migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { GET } from "./route";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
let E: Elenco;
let pecaId: string;

async function entrar(usuarioId: string) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
}
const chamar = (id: string) => GET(new Request(`http://teste/api/os/${id}/complemento`), { params: Promise.resolve({ id }) });

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  pecaId = (await criarPeca()).id;
}, 120_000);

beforeEach(() => {
  req.cookies.clear();
  restricao.negar.clear();
});

describe("GET /api/os/[id]/complemento", { timeout: 30_000 }, () => {
  it("401 sem sessão", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
    expect((await chamar(ev.id)).status).toBe(401);
  });

  it("403 quando o perfil não tem os.exportar", async () => {
    const { ev } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
    await marcarOsEnviada(E.logistica, ev.id);
    restricao.negar.add("LOGISTICA:os.exportar");
    await entrar(E.logistica.id);
    expect((await chamar(ev.id)).status).toBe(403);
  });

  it("404 para evento inexistente; 400 enquanto a OS não foi enviada", async () => {
    await entrar(E.logistica.id);
    expect((await chamar("evento-que-nao-existe")).status).toBe(404);
    const { ev } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
    const r = await chamar(ev.id);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toMatch(/enviada/);
  });

  it("200: as peças a mais depois do envio aparecem no complemento", async () => {
    const { ev, linhaId } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
    const enviada = await marcarOsEnviada(E.logistica, ev.id);
    await alterarQuantidadeLinha(E.logistica, ev.id, linhaId, 14, "Cliente pediu mais");
    await entrar(E.requisitante.id);
    const r = await chamar(ev.id);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe(XLSX);
    expect(r.headers.get("content-disposition")).toContain(`desde-v${enviada.numero}.xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.arrayBuffer());
    const ws = wb.getWorksheet("Complemento")!;
    const valores: unknown[] = [];
    ws.eachRow((row) => valores.push(...(row.values as unknown[])));
    // Na OS enviada 10, agora 14: 4 a mais.
    expect(valores).toEqual(expect.arrayContaining([10, 14, 4]));
  });
});
