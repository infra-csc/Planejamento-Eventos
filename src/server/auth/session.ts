import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, count, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, sessoes, usuarios } from "@/server/db/schema";
import { gerarToken, hashSenha, hashToken, verificarSenha } from "./password";
import { pode, PERFIS, type Acao } from "@/domain/permissions";
import type { Perfil } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "./autorizacao";
import { consumirTentativa, ipCliente, liberarTentativas, limparTentativas } from "./limite";
import { COOKIE_SESSAO, COOKIE_VER_COMO, HEADER_CAMINHO } from "./cookies";
import { caminhoLiberadoComTrocaPendente, DURACAO_MAXIMA_MS, expiracaoInicial, novaExpiracao } from "./politica-sessao";
import { exibirDemo, SENHA_DEMO } from "./demo";
import { registrarAcessoDiario, registrarHistorico } from "@/server/services/support";

export { exigir, type UsuarioAtual, COOKIE_SESSAO, COOKIE_VER_COMO };

const JANELA_LOGIN_MS = 15 * 60_000;
/** Falhas do mesmo e-mail no mesmo IP (a pessoa errando a própria senha). */
const MAX_POR_EMAIL_IP = 8;
/** Falhas no mesmo e-mail vindas de qualquer IP (ataque distribuído contra uma conta). */
const MAX_POR_EMAIL = 20;
/** Falhas vindas do mesmo IP em qualquer e-mail. */
const MAX_POR_IP = 40;

/* Hash de uma senha aleatória: comparar contra ele quando o e-mail não existe iguala o tempo de resposta. */
let hashFicticio: Promise<string> | null = null;
const obterHashFicticio = () => (hashFicticio ??= hashSenha(gerarToken()));

/** Cookie `Secure` sempre que o app é servido por HTTPS (produção ou o dev exposto do Replit). */
export function cookieSeguro() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.REPLIT_DEV_DOMAIN) || (process.env.APP_URL ?? "").startsWith("https://");
}

/** Troca de senha obrigatória, exceto no modo demonstração (onde a senha do seed é pública de propósito). */
const exigeTroca = (trocarSenha: boolean) => trocarSenha && !exibirDemo();

export async function autenticar(email: string, senha: string): Promise<{ ok: true; usuario: UsuarioAtual } | { ok: false; erro: string }> {
  const chave = email.trim().toLowerCase();
  const ip = await ipCliente();
  // Falhas contam por e-mail+IP (quem só sabe o e-mail de alguém não tranca a conta dele), por
  // e-mail (ataque distribuído, com teto mais alto) e por IP. A contagem e a reserva são atômicas.
  const chaveEmailIp = `login:email:${chave}:ip:${ip}`;
  const tentativa = await consumirTentativa(
    [
      { chave: chaveEmailIp, maximo: MAX_POR_EMAIL_IP },
      { chave: `login:email:${chave}`, maximo: MAX_POR_EMAIL },
      { chave: `login:ip:${ip}`, maximo: MAX_POR_IP },
    ],
    JANELA_LOGIN_MS,
  );
  if (tentativa.excedido) return { ok: false, erro: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  const db = await getDb();
  const [u] = await db
    .select()
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${chave}`)
    .limit(1);
  const senhaOk = await verificarSenha(senha, u?.senhaHash ?? (await obterHashFicticio()));
  if (!u || !u.ativo || !senhaOk) {
    await registrarAcessoDiario(db, { usuarioId: u?.id ?? null, nome: u?.nome ?? null, sucesso: false }).catch(() => undefined);
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }
  // Login certo não conta como falha: desfaz a reserva desta tentativa e zera as falhas deste e-mail neste IP.
  await liberarTentativas(tentativa.ids);
  await limparTentativas([chaveEmailIp]);
  // Senha do seed de demonstração fora do modo demonstração: a pessoa troca antes de usar o sistema.
  const marcarTroca = senha === SENHA_DEMO && !exibirDemo() && !u.trocarSenha;
  if (marcarTroca) await db.update(usuarios).set({ trocarSenha: true }).where(eq(usuarios.id, u.id));
  const usuario = await abrirSessaoUsuario(u.id);
  if (!usuario) return { ok: false, erro: "E-mail ou senha inválidos." };
  return { ok: true, usuario };
}

/**
 * Abre uma sessão para um usuário já autenticado (senha conferida ou entrada pelo Portal NORTE):
 * grava a sessão, registra o acesso e põe o cookie. Devolve o usuário carregado (null se inativo).
 */
export async function abrirSessaoUsuario(usuarioId: string): Promise<UsuarioAtual | null> {
  const db = await getDb();
  const [u] = await db.select({ id: usuarios.id, nome: usuarios.nome, ativo: usuarios.ativo }).from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
  if (!u || !u.ativo) return null;
  const token = gerarToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.insert(sessoes).values({ usuarioId: u.id, tokenHash: hashToken(token), expiraEm: expiracaoInicial(), userAgent: ua });
  await db.update(usuarios).set({ ultimoAcessoEm: new Date() }).where(eq(usuarios.id, u.id));
  await registrarAcessoDiario(db, { usuarioId: u.id, nome: u.nome, sucesso: true }).catch(() => undefined);
  const store = await cookies();
  // O cookie vive até o teto absoluto; a inatividade é controlada no banco (sessoes.expira_em).
  store.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSeguro(),
    path: "/",
    maxAge: DURACAO_MAXIMA_MS / 1000,
  });
  return carregarUsuario(u.id);
}

export async function encerrarSessao() {
  const store = await cookies();
  const token = store.get(COOKIE_SESSAO)?.value;
  if (token) {
    const db = await getDb();
    const [s] = await db.delete(sessoes).where(eq(sessoes.tokenHash, hashToken(token))).returning({ usuarioId: sessoes.usuarioId });
    if (s) await registrarHistorico(db, { entidade: "acesso", entidadeId: s.usuarioId, acao: "LOGOUT", descricao: "Saiu do sistema", usuarioId: s.usuarioId, verComo: null }).catch(() => undefined);
  }
  store.delete(COOKIE_SESSAO);
  store.delete(COOKIE_VER_COMO);
}

/** Derruba as sessões do usuário em outros navegadores, mantendo a atual. Devolve quantas foram encerradas. */
export async function encerrarOutrasSessoes(usuarioId: string): Promise<number> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  const db = await getDb();
  const removidas = await db
    .delete(sessoes)
    .where(token ? and(eq(sessoes.usuarioId, usuarioId), ne(sessoes.tokenHash, hashToken(token))) : eq(sessoes.usuarioId, usuarioId))
    .returning({ id: sessoes.id });
  return removidas.length;
}

/** Sessões válidas do usuário (inclui a atual). */
export async function contarSessoesAtivas(usuarioId: string): Promise<number> {
  const db = await getDb();
  const agora = new Date();
  const [r] = await db
    .select({ n: count() })
    .from(sessoes)
    .where(and(eq(sessoes.usuarioId, usuarioId), gt(sessoes.expiraEm, agora), gt(sessoes.criadoEm, new Date(agora.getTime() - DURACAO_MAXIMA_MS))));
  return Number(r?.n ?? 0);
}

/** Primeiro acesso: nenhum usuário ativo cadastrado (a tela de login explica como criar o administrador). */
export async function existeUsuarioAtivo(): Promise<boolean> {
  const db = await getDb();
  const [u] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.ativo, true)).limit(1);
  return Boolean(u);
}

async function carregarUsuario(id: string): Promise<UsuarioAtual | null> {
  const db = await getDb();
  const u = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id), with: { area: true } });
  if (!u || !u.ativo) return null;
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.area?.nome ?? null, trocarSenha: exigeTroca(u.trocarSenha) };
}

/**
 * Quem está logado de fato (ignora o "ver como"), memoizado por requisição.
 * A sessão vale até 14 dias sem uso ou 30 dias desde o login (ver politica-sessao.ts); o uso
 * renova a expiração no máximo uma vez por hora.
 */
export const getUsuarioReal = cache(async (): Promise<UsuarioAtual | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const db = await getDb();
  const agora = new Date();
  // Sessão + usuário + área em uma consulta: roda em toda página e action.
  const [u] = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      perfil: usuarios.perfil,
      areaId: usuarios.areaId,
      areaNome: areas.nome,
      ativo: usuarios.ativo,
      trocarSenha: usuarios.trocarSenha,
      sessaoId: sessoes.id,
      expiraEm: sessoes.expiraEm,
      criadoEm: sessoes.criadoEm,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(sessoes.usuarioId, usuarios.id))
    .leftJoin(areas, eq(usuarios.areaId, areas.id))
    .where(and(eq(sessoes.tokenHash, hashToken(token)), gt(sessoes.expiraEm, agora), gt(sessoes.criadoEm, new Date(agora.getTime() - DURACAO_MAXIMA_MS))))
    .limit(1);
  if (!u || !u.ativo) return null;
  const renovar = novaExpiracao({ expiraEm: u.expiraEm, criadoEm: u.criadoEm }, agora);
  if (renovar) {
    await Promise.all([
      db.update(sessoes).set({ expiraEm: renovar }).where(eq(sessoes.id, u.sessaoId)),
      db.update(usuarios).set({ ultimoAcessoEm: agora }).where(eq(usuarios.id, u.id)),
    ]);
  }
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: u.areaNome ?? null, trocarSenha: exigeTroca(u.trocarSenha) };
});

/** Lê o cookie de "ver como" (perfil e área escolhidos), sem validar a área. */
export async function lerVerComo(): Promise<{ perfil: Perfil; areaId: string | null } | null> {
  const bruto = (await cookies()).get(COOKIE_VER_COMO)?.value;
  if (!bruto) return null;
  try {
    const { perfil, areaId } = JSON.parse(bruto) as { perfil?: string; areaId?: string | null };
    if (!perfil || perfil === "ADMIN" || !(PERFIS as readonly string[]).includes(perfil)) return null;
    return { perfil: perfil as Perfil, areaId: areaId || null };
  } catch {
    return null;
  }
}

/**
 * Usuário como o app deve tratá-lo: o real, ou o perfil escolhido em "ver como" quando o real é
 * administrador. Páginas e actions usam esta função; permissões seguem o perfil visto.
 */
export const getUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const real = await getUsuarioReal();
  if (!real || real.perfil !== "ADMIN") return real;
  const vc = await lerVerComo();
  if (!vc) return real;
  const db = await getDb();
  const area = vc.areaId ? await db.query.areas.findFirst({ where: and(eq(areas.id, vc.areaId), eq(areas.ativo, true)), columns: { id: true, nome: true } }) : null;
  return { ...real, perfil: vc.perfil, areaId: area?.id ?? null, areaNome: area?.nome ?? null, verComo: { perfilReal: "ADMIN" } };
});

/**
 * Exige sessão. Com a troca de senha pendente, qualquer página (e action) fora do perfil manda
 * para /perfil?trocar=1 — o layout do app chama esta função em toda navegação. O caminho vem do
 * proxy (cabeçalho próprio, sobrescrito a cada requisição); sem ele (rotas fora do proxy), não bloqueia.
 */
export async function requireUsuario(): Promise<UsuarioAtual> {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  if (u.trocarSenha) {
    const caminho = (await headers()).get(HEADER_CAMINHO);
    if (caminho !== null && !caminhoLiberadoComTrocaPendente(caminho)) redirect("/perfil?trocar=1");
  }
  return u;
}

/** Para páginas: redireciona para a tela de "sem permissão". */
export async function requirePermissao(acao: Acao): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!pode(u, acao)) redirect("/sem-permissao");
  return u;
}
