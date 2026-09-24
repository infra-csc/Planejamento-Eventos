/**
 * GET /api/auth/portal (entrada pelo Portal NORTE) chamado direto, com PGlite em memória: cria o
 * usuário na primeira entrada, atualiza o perfil nas seguintes, recusa token repetido/vencido/de
 * outro app e fica desligada sem PORTAL_SSO_SECRET.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieGravado } = vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  process.env.PORTAL_SSO_SECRET = "segredo-do-portal-com-mais-de-32-caracteres";
  return { cookieGravado: { valor: null as string | null } };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: (_k: string, v: string) => (cookieGravado.valor = v), delete: () => undefined }),
  headers: async () => ({ get: () => null }),
}));

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessoes, usuarios } from "@/server/db/schema";
import { assinarTokenPortal } from "@/server/auth/portal";
import { hashToken } from "@/server/auth/password";
import { migrarBanco } from "@/test/apoio";
import { GET } from "./route";

const SEGREDO = process.env.PORTAL_SSO_SECRET!;
let seq = 0;
const token = (extra: Record<string, unknown> = {}) => {
  const agora = Math.floor(Date.now() / 1000);
  return assinarTokenPortal({ iss: "norte-portal", aud: "planejamento", app: "planejamento", sub: "ana@nortemkt.com", email: "ana@nortemkt.com", name: "Ana Souza", role: "Logística", level: 2, jti: `jti-${++seq}`, iat: agora, exp: agora + 120, ...extra }, SEGREDO);
};
const chamar = (jwt: string) => GET(new Request(`http://teste/api/auth/portal?portal_sso=${encodeURIComponent(jwt)}`));
const destino = (r: Response) => new URL(r.headers.get("location")!).pathname + new URL(r.headers.get("location")!).search;

beforeAll(async () => {
  await migrarBanco();
}, 120_000);

beforeEach(() => {
  cookieGravado.valor = null;
});

describe("GET /api/auth/portal", () => {
  it("primeira entrada: cria o usuário com o perfil do portal e abre a sessão", async () => {
    const r = await chamar(token());
    expect(r.status).toBe(303);
    expect(destino(r)).toBe("/");
    const db = await getDb();
    const [u] = await db.select().from(usuarios).where(sql`lower(${usuarios.email}) = 'ana@nortemkt.com'`);
    expect(u.perfil).toBe("LOGISTICA");
    expect(u.nome).toBe("Ana Souza");
    expect(u.ativo).toBe(true);
    expect(cookieGravado.valor).toBeTruthy();
    const [s] = await db.select().from(sessoes).where(eq(sessoes.tokenHash, hashToken(cookieGravado.valor!)));
    expect(s.usuarioId).toBe(u.id);
  });

  it("entrada seguinte: o papel do portal atualiza o perfil e reativa a conta", async () => {
    const db = await getDb();
    await db.update(usuarios).set({ ativo: false }).where(sql`lower(${usuarios.email}) = 'ana@nortemkt.com'`);
    const r = await chamar(token({ role: "Cenografia" }));
    expect(destino(r)).toBe("/");
    const [u] = await db.select().from(usuarios).where(sql`lower(${usuarios.email}) = 'ana@nortemkt.com'`);
    expect(u.perfil).toBe("CENOGRAFIA");
    expect(u.ativo).toBe(true);
  });

  it("o mesmo token não entra duas vezes; vencido e de outro app voltam ao login com o motivo", async () => {
    const t = token();
    expect(destino(await chamar(t))).toBe("/");
    cookieGravado.valor = null;
    expect(destino(await chamar(t))).toBe("/login?erro=portal-expirado");
    expect(destino(await chamar(token({ exp: Math.floor(Date.now() / 1000) - 60 })))).toBe("/login?erro=portal-expirado");
    expect(destino(await chamar(token({ aud: "checklist", app: "checklist" })))).toBe("/login?erro=portal-invalido");
    expect(destino(await chamar("lixo"))).toBe("/login?erro=portal-invalido");
    expect(cookieGravado.valor).toBeNull();
  });

  it("atrás do proxy do Replit redireciona para o endereço público, nunca para 0.0.0.0:3000", async () => {
    const guardado = process.env.APP_URL;
    delete process.env.APP_URL;
    try {
      const r = await GET(new Request("https://0.0.0.0:3000/api/auth/portal?portal_sso=lixo", { headers: { "x-forwarded-host": "planejamento-eventos.replit.app", "x-forwarded-proto": "https" } }));
      expect(r.headers.get("location")).toBe("https://planejamento-eventos.replit.app/login?erro=portal-invalido");
      process.env.APP_URL = "https://app.exemplo.com/";
      const r2 = await GET(new Request("https://0.0.0.0:3000/api/auth/portal?portal_sso=lixo"));
      expect(r2.headers.get("location")).toBe("https://app.exemplo.com/login?erro=portal-invalido");
    } finally {
      if (guardado === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = guardado;
    }
  });

  it("sem PORTAL_SSO_SECRET a entrada fica desligada", async () => {
    const guardado = process.env.PORTAL_SSO_SECRET;
    process.env.PORTAL_SSO_SECRET = "";
    try {
      expect(destino(await chamar(token()))).toBe("/login?erro=portal-desativado");
    } finally {
      process.env.PORTAL_SSO_SECRET = guardado;
    }
  });
});
