/**
 * Auditoria 30/10, B-02: a "Ata (lista de materiais)" sai com as quantidades de hoje (OS atual), mas o nome e o
 * rodapé diziam só "v1" (a versão da ata). Agora dizem de qual OS são as quantidades.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const req = vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  process.env.EXIBIR_DEMO = "false";
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

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { osVersoes } from "@/server/db/schema";
import { COOKIE_SESSAO } from "@/server/auth/session";
import { incluirLinhaAta } from "@/server/services/eventos";
import { abrirSessao, criarPeca, eventoAberto, migrarBanco, montarElenco, type Elenco } from "@/test/apoio";
import { GET as listaDaAta } from "@/app/api/eventos/[id]/ata/lista/route";

let E: Elenco;

beforeAll(async () => {
  await migrarBanco();
  E = await montarElenco();
}, 120_000);

describe("Ata (lista de materiais)", { timeout: 120_000 }, () => {
  it("o nome do arquivo diz a versão da OS das quantidades, não a da ata", async () => {
    const peca = await criarPeca();
    const { ev } = await eventoAberto(E.logistica, peca.id, null);
    // Depois da ata fechada, entra mais uma peça: a OS sobe de versão e a ata continua v1.
    await incluirLinhaAta(E.logistica, ev.id, { referenciaTipo: "PECA", projetoId: null, pecaId: (await criarPeca()).id, descricaoLivre: null, quantidade: 2, destino: null, areaId: null, justificativa: "chegou depois" });
    const [ultima] = await (await getDb()).select({ numero: osVersoes.numero }).from(osVersoes).where(eq(osVersoes.eventoId, ev.id)).orderBy(desc(osVersoes.numero)).limit(1);
    expect(ultima.numero).toBeGreaterThan(1);

    req.cookies.set(COOKIE_SESSAO, await abrirSessao(E.logistica.id));
    const r = await listaDaAta(new Request(`http://localhost/api/eventos/${ev.id}/ata/lista?v=1`), { params: Promise.resolve({ id: ev.id }) });
    expect(r.status).toBe(200);
    const arquivo = r.headers.get("content-disposition") ?? "";
    expect(arquivo).toContain(` - lista OS v${ultima.numero}.xlsx`);
    expect(arquivo).not.toMatch(/ v1\.xlsx/);
  });
});
