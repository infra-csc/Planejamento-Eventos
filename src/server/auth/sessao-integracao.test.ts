/**
 * Integração da autenticação contra o PGlite em memória com as migrações reais: limite de
 * tentativas atômico, expiração da sessão por inatividade e troca obrigatória de senha.
 * `next/headers` e `next/navigation` são simulados (não há requisição de verdade).
 */
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// bcrypt de verdade em cada login: os testes levam alguns segundos.
vi.setConfig({ testTimeout: 60_000 });

const req = vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
  // Fora do modo demonstração: a senha do seed obriga a troca.
  process.env.EXIBIR_DEMO = "false";
  return { cookies: new Map<string, string>(), headers: new Map<string, string>() };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (req.cookies.has(k) ? { name: k, value: req.cookies.get(k)! } : undefined),
    set: (k: string, v: string) => void req.cookies.set(k, v),
    delete: (k: string) => void req.cookies.delete(k),
  }),
  headers: async () => ({ get: (k: string) => req.headers.get(k.toLowerCase()) ?? null }),
}));
const { Redirecionou } = vi.hoisted(() => ({
  Redirecionou: class Redirecionou extends Error {
    constructor(public destino: string) {
      super(`redirect ${destino}`);
    }
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redirecionou(destino);
  },
}));

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { historico, sessoes, tentativasAcesso, usuarios } from "@/server/db/schema";
import { hashSenha, hashToken } from "./password";
import { consumirTentativa } from "./limite";
import { autenticar, COOKIE_SESSAO, getUsuarioReal, requireUsuario } from "./session";
import { HEADER_CAMINHO } from "./cookies";
import { INATIVIDADE_MS } from "./politica-sessao";
import { alterarPropriaSenha } from "@/server/services/admin";

async function criarUsuario(email: string, senha: string, extra: Partial<typeof usuarios.$inferInsert> = {}) {
  const db = await getDb();
  const [u] = await db
    .insert(usuarios)
    .values({ nome: email.split("@")[0], email, perfil: "LOGISTICA", senhaHash: await hashSenha(senha), ...extra })
    .returning();
  return u;
}

beforeAll(async () => {
  const db = await getDb();
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}, 120_000);

beforeEach(() => {
  req.cookies.clear();
  req.headers.clear();
  req.headers.set("x-forwarded-for", "10.0.0.1");
});

describe("limite de tentativas atômico", () => {
  it("20 tentativas simultâneas com máximo 5: exatamente 5 passam", async () => {
    const regras = [{ chave: "teste:paralelo", maximo: 5 }];
    const r = await Promise.all(Array.from({ length: 20 }, () => consumirTentativa(regras, 60_000)));
    expect(r.filter((x) => !x.excedido)).toHaveLength(5);
    const db = await getDb();
    expect(await db.select().from(tentativasAcesso).where(eq(tentativasAcesso.chave, "teste:paralelo"))).toHaveLength(5);
  });

  it("login conta falhas por e-mail (qualquer IP) e não conta acertos", async () => {
    await criarUsuario("alvo@teste.local", "senha-certa-1");
    // Falhas vindas de IPs diferentes: o limite por e-mail (20) segura o ataque distribuído.
    for (let i = 0; i < 20; i++) {
      req.headers.set("x-forwarded-for", `10.1.0.${i}`);
      expect((await autenticar("alvo@teste.local", "errada")).ok).toBe(false);
    }
    req.headers.set("x-forwarded-for", "10.9.9.9");
    const bloqueado = await autenticar("alvo@teste.local", "senha-certa-1");
    expect(bloqueado).toMatchObject({ ok: false, erro: expect.stringContaining("Muitas tentativas") });
    // Acerto não deixa rastro de tentativa.
    await criarUsuario("ok@teste.local", "senha-certa-2");
    for (let i = 0; i < 3; i++) expect((await autenticar("ok@teste.local", "senha-certa-2")).ok).toBe(true);
    const db = await getDb();
    expect(await db.select().from(tentativasAcesso).where(eq(tentativasAcesso.chave, "login:email:ok@teste.local"))).toHaveLength(0);
    // Histórico agregado por dia: uma linha de falha com a contagem, sem senha.
    const [falha] = await db.select().from(historico).where(and(eq(historico.entidade, "acesso"), eq(historico.acao, "LOGIN_FALHA")));
    expect(falha.dadosDepois).toMatchObject({ tentativas: 20 });
    expect(JSON.stringify(falha)).not.toContain("errada");
  });
});

describe("sessão", () => {
  it("expira por inatividade e renova com o uso (no máximo 1×/hora)", async () => {
    const u = await criarUsuario("sessao@teste.local", "senha-da-sessao");
    const r = await autenticar("sessao@teste.local", "senha-da-sessao");
    expect(r.ok).toBe(true);
    const token = req.cookies.get(COOKIE_SESSAO)!;
    const db = await getDb();
    const [s] = await db.select().from(sessoes).where(eq(sessoes.tokenHash, hashToken(token)));
    expect(s.expiraEm.getTime() - Date.now()).toBeGreaterThan(INATIVIDADE_MS - 60_000);

    // Última renovação há 2 horas (expira em 14 dias − 2 h): o uso empurra de volta para 14 dias.
    await db.update(sessoes).set({ expiraEm: new Date(Date.now() + INATIVIDADE_MS - 2 * 3_600_000) }).where(eq(sessoes.id, s.id));
    expect((await getUsuarioReal())?.id).toBe(u.id);
    const [renovada] = await db.select().from(sessoes).where(eq(sessoes.id, s.id));
    expect(renovada.expiraEm.getTime()).toBeGreaterThan(Date.now() + INATIVIDADE_MS - 60_000);

    // 14 dias sem uso: a sessão deixa de valer.
    await db.update(sessoes).set({ expiraEm: new Date(Date.now() - 1000) }).where(eq(sessoes.id, s.id));
    expect(await getUsuarioReal()).toBeNull();

    // Teto de 30 dias desde o login, mesmo com expiração futura.
    await db.update(sessoes).set({ expiraEm: new Date(Date.now() + 86_400_000), criadoEm: new Date(Date.now() - 31 * 86_400_000) }).where(eq(sessoes.id, s.id));
    expect(await getUsuarioReal()).toBeNull();
  });
});

describe("troca obrigatória de senha", () => {
  it("senha provisória só abre o perfil até ser trocada", async () => {
    const u = await criarUsuario("provisoria@teste.local", "provisoria-123", { trocarSenha: true });
    const r = await autenticar("provisoria@teste.local", "provisoria-123");
    expect(r.ok && r.usuario.trocarSenha).toBe(true);

    req.headers.set(HEADER_CAMINHO, "/eventos");
    await expect(requireUsuario()).rejects.toMatchObject({ destino: "/perfil?trocar=1" });
    req.headers.set(HEADER_CAMINHO, "/perfil");
    expect((await requireUsuario()).id).toBe(u.id);

    const usuario = await requireUsuario();
    await expect(alterarPropriaSenha(usuario, "provisoria-123", "provisoria-123")).rejects.toThrow(/diferente/);
    await alterarPropriaSenha(usuario, "provisoria-123", "senha-nova-e-minha");
    req.headers.set(HEADER_CAMINHO, "/eventos");
    const depois = await requireUsuario();
    expect(depois.trocarSenha).toBe(false);
  });

  it("entrar com a senha de demonstração fora do modo demonstração marca a troca", async () => {
    await criarUsuario("demo@teste.local", "norte1234");
    const r = await autenticar("demo@teste.local", "norte1234");
    expect(r.ok && r.usuario.trocarSenha).toBe(true);
    const db = await getDb();
    const [u] = await db.select({ trocarSenha: usuarios.trocarSenha }).from(usuarios).where(eq(usuarios.email, "demo@teste.local"));
    expect(u.trocarSenha).toBe(true);
  });

  it("troca da própria senha tem limite por usuário", async () => {
    const u = await criarUsuario("limite-senha@teste.local", "senha-original-1");
    const usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: null, areaNome: null };
    for (let i = 0; i < 5; i++) await expect(alterarPropriaSenha(usuario, "errada", "qualquer-nova-1")).rejects.toThrow(/incorreta/);
    await expect(alterarPropriaSenha(usuario, "senha-original-1", "qualquer-nova-1")).rejects.toThrow(/Muitas tentativas/);
  });
});
