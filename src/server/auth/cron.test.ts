import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const executar = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/server/jobs/verificacoes", () => ({ executarVerificacoesSeNecessario: executar }));

import { autorizarCron } from "./cron";
import { GET, POST } from "@/app/api/cron/verificacoes/route";

const pedido = (auth?: string, metodo = "POST") => new Request("http://localhost/api/cron/verificacoes", { method: metodo, headers: auth ? { authorization: auth } : {} });

describe("autorizarCron", () => {
  it("503 sem CRON_SECRET configurado (rota desligada, não aberta)", () => {
    expect(autorizarCron("Bearer qualquer", undefined)).toMatchObject({ ok: false, status: 503 });
    expect(autorizarCron("Bearer qualquer", "   ")).toMatchObject({ ok: false, status: 503 });
  });
  it("401 sem cabeçalho, com esquema errado ou segredo errado", () => {
    expect(autorizarCron(null, "segredo-longo")).toMatchObject({ ok: false, status: 401 });
    expect(autorizarCron("Basic segredo-longo", "segredo-longo")).toMatchObject({ ok: false, status: 401 });
    expect(autorizarCron("Bearer segredo-errado", "segredo-longo")).toMatchObject({ ok: false, status: 401 });
    expect(autorizarCron("Bearer segredo-long", "segredo-longo")).toMatchObject({ ok: false, status: 401 });
  });
  it("aceita o segredo certo (Bearer, sem diferenciar maiúsculas no esquema)", () => {
    expect(autorizarCron("Bearer segredo-longo", "segredo-longo")).toEqual({ ok: true });
    expect(autorizarCron("bearer   segredo-longo ", "segredo-longo")).toEqual({ ok: true });
  });
});

describe("rota /api/cron/verificacoes", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => executar.mockClear());
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("503 quando CRON_SECRET não está configurado", async () => {
    delete process.env.CRON_SECRET;
    const r = await POST(pedido("Bearer x"));
    expect(r.status).toBe(503);
    expect(executar).not.toHaveBeenCalled();
  });

  it("401 sem o segredo ou com segredo errado", async () => {
    process.env.CRON_SECRET = "s3gredo-do-cron";
    expect((await POST(pedido())).status).toBe(401);
    expect((await GET(pedido("Bearer outro", "GET"))).status).toBe(401);
    expect(executar).not.toHaveBeenCalled();
  });

  it("200 e roda as verificações com o segredo certo (GET e POST)", async () => {
    process.env.CRON_SECRET = "s3gredo-do-cron";
    const r = await POST(pedido("Bearer s3gredo-do-cron"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect((await GET(pedido("Bearer s3gredo-do-cron", "GET"))).status).toBe(200);
    expect(executar).toHaveBeenCalledTimes(2);
  });
});
