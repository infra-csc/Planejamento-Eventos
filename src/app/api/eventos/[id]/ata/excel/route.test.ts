/**
 * GET /api/eventos/[id]/ata/excel chamado direto, com sessão de verdade (cookie simulado) e PGlite
 * em memória. Além dos códigos HTTP, confere o que cada perfil leva no arquivo: pedidos só da
 * própria área e a observação interna da reunião só para logística/gestão.
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
import { salvarObservacoesReuniao, transicionarEvento } from "@/server/services/eventos";
import { salvarArea } from "@/server/services/admin";
import { abrirSessao, enviarSolicitacao, fecharAta, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";
import { GET } from "./route";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const NOTA = "Nota interna sigilosa da reunião";
let E: Elenco;
let eventoId: string;

async function entrar(usuarioId: string) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
}
const chamar = (id: string, query = "") => GET(new Request(`http://teste/api/eventos/${id}/ata/excel${query}`), { params: Promise.resolve({ id }) });

/** Todos os textos da pasta, aba por aba. */
async function textos(r: Response) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await r.arrayBuffer());
  const porAba = new Map<string, string>();
  for (const ws of wb.worksheets) {
    const partes: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => partes.push(String(c.text ?? ""))));
    porAba.set(ws.name, partes.join(" | "));
  }
  return porAba;
}

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
  const ev = await novoEvento(E.logistica);
  await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Pedido da área A")]);
  await enviarSolicitacao(E.requisitanteB, E.logistica, ev.id, [itemAvulso("Pedido da área B")]);
  await transicionarEvento(E.logistica, ev.id, "INICIAR_REUNIAO");
  await salvarObservacoesReuniao(E.logistica, ev.id, NOTA);
  await fecharAta(E.logistica, ev.id);
  eventoId = ev.id;
}, 120_000);

beforeEach(() => {
  req.cookies.clear();
  restricao.negar.clear();
});

describe("GET /api/eventos/[id]/ata/excel", { timeout: 30_000 }, () => {
  it("401 sem sessão", async () => {
    expect((await chamar(eventoId)).status).toBe(401);
  });

  it("403 quando o perfil não tem os.exportar", async () => {
    restricao.negar.add("REQUISITANTE:os.exportar");
    await entrar(E.requisitante.id);
    expect((await chamar(eventoId)).status).toBe(403);
  });

  it("404 para evento inexistente e para versão inexistente", async () => {
    await entrar(E.logistica.id);
    expect((await chamar("evento-que-nao-existe")).status).toBe(404);
    expect((await chamar(eventoId, "?v=99")).status).toBe(404);
  });

  it("200: logística leva a ata v1 com todos os pedidos e a observação interna", async () => {
    await entrar(E.logistica.id);
    const r = await chamar(eventoId);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe(XLSX);
    expect(r.headers.get("content-disposition")).toMatch(/ATA-.*-v1\.xlsx/);
    const abas = await textos(r);
    expect(abas.get("Ata")).toContain(NOTA);
    expect(abas.get("Pedidos das áreas")).toContain("Pedido da área A");
    expect(abas.get("Pedidos das áreas")).toContain("Pedido da área B");
  });

  it("requisitante da área A: só os pedidos da própria área e sem a observação interna", async () => {
    await entrar(E.requisitante.id);
    const abas = await textos(await chamar(eventoId));
    expect(abas.get("Ata")).not.toContain(NOTA);
    expect(abas.get("Pedidos das áreas")).toContain("Pedido da área A");
    expect(abas.get("Pedidos das áreas")).not.toContain("Pedido da área B");
  });

  it("ata ainda em construção sai como 'em-construcao'", async () => {
    const ev = await novoEvento(E.logistica);
    await entrar(E.gestao.id);
    const r = await chamar(ev.id);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toContain("em-construcao.xlsx");
  });

  // Filtra pelo id da área: renomear a área depois do fechamento não esconde os próprios pedidos.
  it("área renomeada depois do fechamento continua vendo os próprios pedidos", async () => {
    await salvarArea(E.admin, E.areas.a.id, { nome: `${E.areas.a.nome} (renomeada)`, ativo: true });
    await entrar(E.requisitante.id);
    const abas = await textos(await chamar(eventoId));
    expect(abas.get("Pedidos das áreas") ?? "").toContain("Pedido da área A");
  });
});
