import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, sessoes, usuarios } from "@/server/db/schema";
import { gerarToken, hashSenha, hashToken, verificarSenha } from "./password";
import { pode, PERFIS, type Acao } from "@/domain/permissions";
import type { Perfil } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "./autorizacao";
import { ipCliente, limiteExcedido, limparTentativas, registrarTentativas } from "./limite";

export { exigir, type UsuarioAtual };

export const COOKIE_SESSAO = "npe_sessao";
/** Administrador vendo o app como outro perfil: JSON { perfil, areaId } só neste navegador. */
export const COOKIE_VER_COMO = "npe_ver_como";
const DURACAO_SESSAO_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias
const JANELA_LOGIN_MS = 15 * 60_000;
const MAX_POR_EMAIL = 8;
const MAX_POR_IP = 40;

/* Hash de uma senha aleatória: comparar contra ele quando o e-mail não existe iguala o tempo de resposta. */
let hashFicticio: Promise<string> | null = null;
const obterHashFicticio = () => (hashFicticio ??= hashSenha(gerarToken()));

/** Cookie `Secure` sempre que o app é servido por HTTPS (produção ou o dev exposto do Replit). */
export function cookieSeguro() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.REPLIT_DEV_DOMAIN) || (process.env.APP_URL ?? "").startsWith("https://");
}

export async function autenticar(email: string, senha: string): Promise<{ ok: true; usuario: UsuarioAtual } | { ok: false; erro: string }> {
  const chave = email.trim().toLowerCase();
  const ip = await ipCliente();
  // Falhas contam por e-mail+IP: quem só sabe o e-mail de alguém não consegue trancar a conta dele.
  const chaves = [`login:email:${chave}:ip:${ip}`, `login:ip:${ip}`];
  if (
    await limiteExcedido(
      [
        { chave: chaves[0], maximo: MAX_POR_EMAIL },
        { chave: chaves[1], maximo: MAX_POR_IP },
      ],
      JANELA_LOGIN_MS,
    )
  ) {
    return { ok: false, erro: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  }
  const db = await getDb();
  const [u] = await db
    .select()
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${chave}`)
    .limit(1);
  const senhaOk = await verificarSenha(senha, u?.senhaHash ?? (await obterHashFicticio()));
  if (!u || !u.ativo || !senhaOk) {
    await registrarTentativas(chaves);
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }
  await limparTentativas([chaves[0]]);
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
    secure: cookieSeguro(),
    path: "/",
    maxAge: DURACAO_SESSAO_MS / 1000,
  });
  const usuario = await carregarUsuario(u.id);
  if (!usuario) return { ok: false, erro: "E-mail ou senha inválidos." };
  return { ok: true, usuario };
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

/** Depois de trocar a senha: derruba as sessões do usuário em outros navegadores, mantendo a atual. */
export async function encerrarOutrasSessoes(usuarioId: string) {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  const db = await getDb();
  await db.delete(sessoes).where(token ? and(eq(sessoes.usuarioId, usuarioId), ne(sessoes.tokenHash, hashToken(token))) : eq(sessoes.usuarioId, usuarioId));
}

async function carregarUsuario(id: string): Promise<UsuarioAtual | null> {
  const db = await getDb();
  const u = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id), with: { area: true } });
  if (!u || !u.ativo) return null;
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.area?.nome ?? null };
}

/** Usuário da sessão atual (memoizado por requisição). */
/** Quem está logado de fato (ignora o "ver como"). */
export const getUsuarioReal = cache(async (): Promise<UsuarioAtual | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const db = await getDb();
  // Sessão + usuário + área em uma consulta: roda em toda página e action.
  const [u] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, perfil: usuarios.perfil, areaId: usuarios.areaId, areaNome: areas.nome, ativo: usuarios.ativo })
    .from(sessoes)
    .innerJoin(usuarios, eq(sessoes.usuarioId, usuarios.id))
    .leftJoin(areas, eq(usuarios.areaId, areas.id))
    .where(and(eq(sessoes.tokenHash, hashToken(token)), gt(sessoes.expiraEm, new Date())))
    .limit(1);
  if (!u || !u.ativo) return null;
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.areaNome ?? null };
});

/**
 * Usuário como o app deve tratá-lo: o real, ou o perfil escolhido em "ver como" quando o real é
 * administrador. Páginas e actions usam esta função; permissões seguem o perfil visto.
 */
export const getUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const real = await getUsuarioReal();
  if (!real || real.perfil !== "ADMIN") return real;
  const store = await cookies();
  const bruto = store.get(COOKIE_VER_COMO)?.value;
  if (!bruto) return real;
  try {
    const { perfil, areaId } = JSON.parse(bruto) as { perfil?: string; areaId?: string | null };
    if (!perfil || perfil === "ADMIN" || !(PERFIS as readonly string[]).includes(perfil)) return real;
    const db = await getDb();
    const area = areaId ? await db.query.areas.findFirst({ where: and(eq(areas.id, areaId), eq(areas.ativo, true)), columns: { id: true, nome: true } }) : null;
    return { ...real, perfil: perfil as Perfil, areaId: area?.id ?? null, areaNome: area?.nome ?? null, verComo: { perfilReal: "ADMIN" } };
  } catch {
    return real;
  }
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
