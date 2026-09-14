import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessoes, tokensRecuperacao, usuarios } from "@/server/db/schema";
import { gerarToken, hashSenha, hashToken } from "@/server/auth/password";
import { DomainError } from "@/domain/errors";

const VALIDADE_MS = 60 * 60 * 1000;
export const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

/** Gera um link de uso único para a pessoa definir (ou redefinir) a senha. */
export async function gerarLinkAcesso(usuarioId: string, validadeMs = VALIDADE_MS): Promise<string> {
  const db = await getDb();
  const token = gerarToken();
  await db.insert(tokensRecuperacao).values({ usuarioId, tokenHash: hashToken(token), expiraEm: new Date(Date.now() + validadeMs) });
  const base = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/redefinir-senha/${token}`;
}

/**
 * RV-20: sem SMTP no MVP. Gera o link de redefinição, registra no log do servidor e
 * (fora de produção) devolve o link para exibição na tela.
 */
export async function solicitarRecuperacao(email: string): Promise<{ link: string | null }> {
  const db = await getDb();
  const [u] = await db
    .select({ id: usuarios.id, ativo: usuarios.ativo })
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  if (!u || !u.ativo) return { link: null };
  const link = await gerarLinkAcesso(u.id);
  console.info(`[recuperacao-senha] ${email}: ${link}`);
  return { link: process.env.NODE_ENV === "production" && process.env.EXIBIR_LINK_RECUPERACAO !== "true" ? null : link };
}

export async function redefinirSenha(token: string, novaSenha: string) {
  const db = await getDb();
  const t = await db.query.tokensRecuperacao.findFirst({
    where: and(eq(tokensRecuperacao.tokenHash, hashToken(token)), isNull(tokensRecuperacao.usadoEm), gt(tokensRecuperacao.expiraEm, new Date())),
  });
  if (!t) throw new DomainError("Link inválido ou expirado. Solicite uma nova recuperação.");
  await db.transaction(async (tx) => {
    await tx.update(usuarios).set({ senhaHash: await hashSenha(novaSenha) }).where(eq(usuarios.id, t.usuarioId));
    await tx.update(tokensRecuperacao).set({ usadoEm: new Date() }).where(eq(tokensRecuperacao.id, t.id));
    await tx.delete(sessoes).where(eq(sessoes.usuarioId, t.usuarioId));
  });
}

export async function tokenValido(token: string) {
  const db = await getDb();
  const t = await db.query.tokensRecuperacao.findFirst({
    where: and(eq(tokensRecuperacao.tokenHash, hashToken(token)), isNull(tokensRecuperacao.usadoEm), gt(tokensRecuperacao.expiraEm, new Date())),
    columns: { id: true },
  });
  return Boolean(t);
}
