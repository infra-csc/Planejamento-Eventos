import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessoes, usuarios } from "@/server/db/schema";
import { gerarToken, hashToken, verificarSenha } from "./password";
import { pode, type Acao } from "@/domain/permissions";
import { exigir, type UsuarioAtual } from "./autorizacao";

export { exigir, type UsuarioAtual };

export const COOKIE_SESSAO = "npe_sessao";
const DURACAO_SESSAO_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias

/* Limite simples de tentativas de login por e-mail (em memória, por instância). */
const tentativas = new Map<string, { n: number; ate: number }>();
function registrarTentativa(email: string) {
  const agora = Date.now();
  const t = tentativas.get(email);
  if (!t || t.ate < agora) tentativas.set(email, { n: 1, ate: agora + 15 * 60_000 });
  else t.n += 1;
}
function bloqueado(email: string) {
  const t = tentativas.get(email);
  return Boolean(t && t.ate > Date.now() && t.n >= 8);
}

export async function autenticar(email: string, senha: string): Promise<{ ok: true; usuario: UsuarioAtual } | { ok: false; erro: string }> {
  const chave = email.trim().toLowerCase();
  if (bloqueado(chave)) return { ok: false, erro: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  const db = await getDb();
  const [u] = await db
    .select()
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${chave}`)
    .limit(1);
  if (!u || !u.ativo || !(await verificarSenha(senha, u.senhaHash))) {
    registrarTentativa(chave);
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }
  tentativas.delete(chave);
  const token = gerarToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.insert(sessoes).values({
    usuarioId: u.id,
    tokenHash: hashToken(token),
    expiraEm: new Date(Date.now() + DURACAO_SESSAO_MS),
    userAgent: ua,
  });
  await db.update(usuarios).set({ ultimoAcessoEm: new Date() }).where(eq(usuarios.id, u.id));
  const store = await cookies();
  store.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SESSAO_MS / 1000,
  });
  const usuario = await carregarUsuario(u.id);
  return { ok: true, usuario: usuario! };
}

export async function encerrarSessao() {
  const store = await cookies();
  const token = store.get(COOKIE_SESSAO)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessoes).where(eq(sessoes.tokenHash, hashToken(token)));
  }
  store.delete(COOKIE_SESSAO);
}

async function carregarUsuario(id: string): Promise<UsuarioAtual | null> {
  const db = await getDb();
  const u = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id), with: { area: true } });
  if (!u || !u.ativo) return null;
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.area?.nome ?? null };
}

/** Usuário da sessão atual (memoizado por requisição). */
export const getUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const db = await getDb();
  const [s] = await db
    .select({ usuarioId: sessoes.usuarioId })
    .from(sessoes)
    .where(and(eq(sessoes.tokenHash, hashToken(token)), gt(sessoes.expiraEm, new Date())))
    .limit(1);
  if (!s) return null;
  return carregarUsuario(s.usuarioId);
});

export async function requireUsuario(): Promise<UsuarioAtual> {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  return u;
}

/** Para páginas: redireciona para a tela de "sem permissão". */
export async function requirePermissao(acao: Acao): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!pode(u, acao)) redirect("/sem-permissao");
  return u;
}

