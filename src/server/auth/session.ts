import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessoes, usuarios } from "@/server/db/schema";
import { gerarToken, hashSenha, hashToken, verificarSenha } from "./password";
import { pode, type Acao } from "@/domain/permissions";
import { exigir, type UsuarioAtual } from "./autorizacao";
import { ipCliente, limiteExcedido, limparTentativas, registrarTentativas } from "./limite";

export { exigir, type UsuarioAtual };

export const COOKIE_SESSAO = "npe_sessao";
const DURACAO_SESSAO_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias
const JANELA_LOGIN_MS = 15 * 60_000;
const MAX_POR_EMAIL = 8;
const MAX_POR_IP = 40;

/* Hash de uma senha aleatória: comparar contra ele quando o e-mail não existe iguala o tempo de resposta. */
let hashFicticio: Promise<string> | null = null;
const obterHashFicticio = () => (hashFicticio ??= hashSenha(gerarToken()));

/** Cookie `Secure` sempre que o app é servido por HTTPS (produção ou o dev exposto do Replit). */
function cookieSeguro() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.REPLIT_DEV_DOMAIN) || (process.env.APP_URL ?? "").startsWith("https://");
}

export async function autenticar(email: string, senha: string): Promise<{ ok: true; usuario: UsuarioAtual } | { ok: false; erro: string }> {
  const chave = email.trim().toLowerCase();
  const ip = await ipCliente();
  const chaves = [`login:email:${chave}`, `login:ip:${ip}`];
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
