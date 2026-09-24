/**
 * GET /api/os/[id]/estrutura (OS de estrutura no modelo da cenografia) chamado direto, com sessão
 * de verdade (cookie simulado) e PGlite em memória.
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
import { anexarArquivo } from "@/server/services/projetos";
import { transicionarEvento } from "@/server/services/eventos";
import { abrirSessao, criarPeca, criarProjeto, fecharAta, incluirPeca, incluirProjeto, migrarBanco, montarElenco, novoEvento, pngMinimo, type Elenco } from "@/test/apoio";
import { GET } from "./route";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
let E: Elenco;
let eventoId: string;
let nomeProjeto: string;

async function entrar(usuarioId: string) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
}
const chamar = (id: string, query = "") => GET(new Request(`http://teste/api/os/${id}/estrutura${query}`), { params: Promise.resolve({ id }) });

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const peca = await criarPeca();
  const projeto = await criarProjeto(peca.id, 4);
  nomeProjeto = projeto.nome;
  // Capa do projeto: a aba do projeto leva a imagem.
  await anexarArquivo(E.cenografia, projeto.id, new File([new Uint8Array(await pngMinimo(120, 80))], "capa.png", { type: "image/png" }));
  const ev = await novoEvento(E.logistica);
  await incluirProjeto(E.logistica, ev.id, projeto.id, 2, E.areas.a.id);
  await incluirPeca(E.logistica, ev.id, peca.id, 3, E.areas.a.id);
  await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
  await fecharAta(E.logistica, ev.id);
  eventoId = ev.id;
}, 120_000);

beforeEach(() => {
  req.cookies.clear();
  restricao.negar.clear();
});

describe("GET /api/os/[id]/estrutura", { timeout: 30_000 }, () => {
  it("401 sem sessão", async () => {
    expect((await chamar(eventoId)).status).toBe(401);
  });

  it("403 quando o perfil não tem os.exportar", async () => {
    restricao.negar.add("GESTAO:os.exportar");
    await entrar(E.gestao.id);
    expect((await chamar(eventoId)).status).toBe(403);
  });

  it("404 para evento inexistente", async () => {
    await entrar(E.logistica.id);
    expect((await chamar("evento-que-nao-existe")).status).toBe(404);
  });

  it("200: TOTAL, SOMATORIA e uma aba por projeto, com a capa", async () => {
    await entrar(E.requisitante.id);
    const r = await chamar(eventoId, "?v=1");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe(XLSX);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.arrayBuffer());
    const nomes = wb.worksheets.map((w) => w.name);
    expect(nomes.slice(0, 2)).toEqual(["TOTAL", "SOMATORIA"]);
    expect(nomes.length).toBe(3);
    expect(nomes[2]).toContain("(2X)");
    expect(wb.worksheets[2].getImages().length).toBe(1);
    expect(nomeProjeto.length).toBeGreaterThan(0);
  });

  it("sem projeto.ver, a pasta sai sem as imagens dos projetos", async () => {
    restricao.negar.add("REQUISITANTE:projeto.ver");
    await entrar(E.requisitante.id);
    const r = await chamar(eventoId);
    expect(r.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.arrayBuffer());
    expect(wb.worksheets.every((w) => w.getImages().length === 0)).toBe(true);
  });
});
