/**
 * /api/cron/verificacoes chamado direto (GET e POST), com PGlite em memória. Sem sessão de
 * usuário: autoriza pelo segredo `Authorization: Bearer <CRON_SECRET>`.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
});

import { migrarBanco } from "@/test/apoio";
import { GET, POST } from "./route";

const SEGREDO = "segredo-do-cron-de-teste";
const estado = globalThis as unknown as { __npeUltimaVerificacao?: number };
const chamar = (metodo: typeof GET, authorization?: string) =>
  metodo(new Request("http://teste/api/cron/verificacoes", { method: metodo === POST ? "POST" : "GET", headers: authorization ? { authorization } : {} }));

beforeAll(async () => {
  await migrarBanco();
}, 120_000);

beforeEach(() => {
  process.env.CRON_SECRET = SEGREDO;
  estado.__npeUltimaVerificacao = undefined;
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("/api/cron/verificacoes", { timeout: 30_000 }, () => {
  it("503 quando CRON_SECRET não está configurado (rota desligada, não aberta)", async () => {
    delete process.env.CRON_SECRET;
    const r = await chamar(POST, `Bearer ${SEGREDO}`);
    expect(r.status).toBe(503);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("401 sem cabeçalho, com esquema errado ou segredo errado", async () => {
    for (const auth of [undefined, SEGREDO, `Basic ${SEGREDO}`, "Bearer errado", `Bearer ${SEGREDO}x`]) {
      expect((await chamar(POST, auth)).status, String(auth)).toBe(401);
    }
  });

  it("200 com o segredo certo, por GET e por POST", async () => {
    const r = await chamar(POST, `Bearer ${SEGREDO}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true });
    estado.__npeUltimaVerificacao = undefined;
    expect((await chamar(GET, `bearer   ${SEGREDO}  `)).status).toBe(200);
    expect(typeof estado.__npeUltimaVerificacao).toBe("number");
  });
});
