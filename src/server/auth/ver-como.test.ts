/**
 * "Ver como" pela sessão de verdade (cookie → getUsuarioAtual): o cookie só vale para quem é
 * administrador, nunca eleva o perfil de ninguém e, quando vale, rebaixa as permissões para as do
 * perfil visto. O histórico continua registrando o administrador, com o perfil assumido.
 * `next/headers` é simulado (não há requisição de verdade).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const req = vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  return { cookies: new Map<string, string>() };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (req.cookies.has(k) ? { name: k, value: req.cookies.get(k)! } : undefined),
    set: (k: string, v: string) => void req.cookies.set(k, v),
    delete: (k: string) => void req.cookies.delete(k),
  }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect ${destino}`);
  },
}));

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, historico } from "@/server/db/schema";
import { SemPermissaoError } from "@/domain/errors";
import { COOKIE_SESSAO, COOKIE_VER_COMO } from "./cookies";
import { getUsuarioAtual, getUsuarioReal } from "./session";
import { responderItem, salvarSolicitacaoCompleta } from "@/server/services/solicitacoes";
import { abrirSessao, criarPeca, enviarSolicitacao, eventoAberto, itemAvulso, migrarBanco, montarElenco, novoEvento, type Elenco } from "@/test/apoio";

let E: Elenco;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

beforeEach(() => req.cookies.clear());

async function entrar(usuarioId: string, verComo?: unknown) {
  req.cookies.set(COOKIE_SESSAO, await abrirSessao(usuarioId));
  if (verComo !== undefined) req.cookies.set(COOKIE_VER_COMO, typeof verComo === "string" ? verComo : JSON.stringify(verComo));
}

describe("cookie de ver como", { timeout: 30_000 }, () => {
  it("requisitante com o cookie forjado continua requisitante (não vira logística nem admin)", async () => {
    for (const perfil of ["LOGISTICA", "GESTAO", "ADMIN"]) {
      req.cookies.clear();
      await entrar(E.requisitante.id, { perfil, areaId: null });
      const u = await getUsuarioAtual();
      expect(u).toMatchObject({ id: E.requisitante.id, perfil: "REQUISITANTE", areaId: E.areas.a.id });
      expect(u?.verComo ?? null).toBeNull();
    }
  });

  it("logística com o cookie forjado de outra área continua na própria área", async () => {
    await entrar(E.logistica.id, { perfil: "REQUISITANTE", areaId: E.areas.b.id });
    expect(await getUsuarioAtual()).toMatchObject({ perfil: "LOGISTICA", areaId: E.areas.logistica.id });
  });

  it("administrador vendo como requisitante da área A: perfil e área do visto, id do administrador", async () => {
    await entrar(E.admin.id, { perfil: "REQUISITANTE", areaId: E.areas.a.id });
    const u = await getUsuarioAtual();
    expect(u).toMatchObject({ id: E.admin.id, perfil: "REQUISITANTE", areaId: E.areas.a.id, verComo: { perfilReal: "ADMIN" } });
    expect((await getUsuarioReal())?.perfil).toBe("ADMIN");
  });

  it("cookie pedindo ADMIN, perfil inexistente ou JSON quebrado é ignorado", async () => {
    for (const bruto of [{ perfil: "ADMIN", areaId: null }, { perfil: "DONO", areaId: null }, "{nao-e-json"]) {
      req.cookies.clear();
      await entrar(E.admin.id, bruto);
      const u = await getUsuarioAtual();
      expect(u).toMatchObject({ perfil: "ADMIN" });
      expect(u?.verComo ?? null).toBeNull();
    }
  });

  it("área inativa ou inexistente no cookie vira 'sem área' (não herda a área de ninguém)", async () => {
    const db = await getDb();
    const [inativa] = await db.insert(areas).values({ nome: `Inativa ${Date.now()}`, ativo: false }).returning();
    for (const areaId of [inativa.id, "area-que-nao-existe"]) {
      req.cookies.clear();
      await entrar(E.admin.id, { perfil: "REQUISITANTE", areaId });
      expect(await getUsuarioAtual()).toMatchObject({ perfil: "REQUISITANTE", areaId: null });
    }
  });

  it("sem sessão, o cookie de ver como sozinho não autentica ninguém", async () => {
    req.cookies.set(COOKIE_VER_COMO, JSON.stringify({ perfil: "LOGISTICA", areaId: null }));
    expect(await getUsuarioAtual()).toBeNull();
    req.cookies.set(COOKIE_SESSAO, "token-inventado");
    expect(await getUsuarioAtual()).toBeNull();
  });
});

describe("agindo em ver como", { timeout: 60_000 }, () => {
  it("as permissões seguem o perfil visto e o histórico registra o administrador com o perfil assumido", async () => {
    const pecaId = (await criarPeca()).id;
    const { ev } = await eventoAberto(E.logistica, pecaId, E.areas.a.id);
    const s = await enviarSolicitacao(E.requisitante, E.logistica, ev.id, [itemAvulso("Palco")]);

    await entrar(E.admin.id, { perfil: "REQUISITANTE", areaId: E.areas.a.id });
    const visto = (await getUsuarioAtual())!;
    await expect(responderItem(visto, s.itens[0].id, { status: "ATENDIDO" })).rejects.toBeInstanceOf(SemPermissaoError);

    const outro = await novoEvento(E.logistica);
    const r = await salvarSolicitacaoCompleta(visto, { eventoId: outro.id, areaId: E.areas.b.id, titulo: "Pelo ver como", observacao: null, enviar: false, itens: [itemAvulso("Totem")] });
    const db = await getDb();
    const [h] = await db
      .select()
      .from(historico)
      .where(and(eq(historico.entidade, "solicitacao"), eq(historico.entidadeId, r.id), eq(historico.acao, "RASCUNHO_CRIADO")));
    expect(h.usuarioId).toBe(E.admin.id);
    expect(h.verComo).toBe(`Requisitante · ${E.areas.a.nome}`);
  });
});
