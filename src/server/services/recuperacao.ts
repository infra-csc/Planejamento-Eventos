import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { sessoes, tokensRecuperacao, usuarios } from "@/server/db/schema";
import { gerarToken, hashSenha, hashToken } from "@/server/auth/password";
import { ipCliente, limiteExcedido, registrarTentativas } from "@/server/auth/limite";
import { DomainError } from "@/domain/errors";
import type { Executor } from "./support";
import { notificar, usuariosPorPerfil } from "./support";

const VALIDADE_MS = 60 * 60 * 1000;
export const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

/** Invalida links de acesso ainda não usados do usuário (um link novo, uma troca de senha ou um reset tornam os antigos inúteis). */
export async function invalidarLinksPendentes(ex: Executor, usuarioId: string) {
  await ex
    .update(tokensRecuperacao)
    .set({ usadoEm: new Date() })
    .where(and(eq(tokensRecuperacao.usuarioId, usuarioId), isNull(tokensRecuperacao.usadoEm)));
}

/** Gera um link de uso único para a pessoa definir (ou redefinir) a senha. Só o administrador recebe o link. */
export async function gerarLinkAcesso(usuarioId: string, validadeMs = VALIDADE_MS): Promise<string> {
  const db = await getDb();
  const token = gerarToken();
  await invalidarLinksPendentes(db, usuarioId);
  await db.insert(tokensRecuperacao).values({ usuarioId, tokenHash: hashToken(token), expiraEm: new Date(Date.now() + validadeMs) });
  const base = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/redefinir-senha/${token}`;
}

/**
 * RV-20: sem SMTP no MVP. O pedido de recuperação não gera nem expõe link: avisa os administradores,
 * que conferem a identidade da pessoa e geram o link na tela de usuários. A resposta é sempre a mesma,
 * exista ou não o e-mail, e há limite por e-mail e por IP.
 */
export async function solicitarRecuperacao(email: string): Promise<void> {
  const chave = email.trim().toLowerCase();
  const ip = await ipCliente();
  const chaves = [`recuperacao:email:${chave}`, `recuperacao:ip:${ip}`];
  const excedido = await limiteExcedido(
    [
      { chave: chaves[0], maximo: 3 },
      { chave: chaves[1], maximo: 10 },
    ],
    60 * 60 * 1000,
  );
  if (excedido) return;
  await registrarTentativas(chaves);
  const db = await getDb();
  const [u] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, ativo: usuarios.ativo })
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${chave}`)
    .limit(1);
  if (!u || !u.ativo) return;
  await notificar(db, {
    usuarioIds: await usuariosPorPerfil(db, ["ADMIN"]),
    tipo: "RECUPERACAO_SENHA",
    titulo: `${u.nome} pediu para recuperar o acesso`,
    mensagem: "Confirme com a pessoa e gere um novo link de acesso na tela de usuários.",
    link: "/admin",
    chaveDedupe: `recuperacao:${u.id}:${new Date().toISOString().slice(0, 13)}`,
  });
  console.info(`[recuperacao-senha] pedido registrado para o usuário ${u.id}`);
}

export async function redefinirSenha(token: string, novaSenha: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Marca o token como usado no mesmo comando que o encontra: duas requisições em paralelo não passam as duas.
    const [t] = await tx
      .update(tokensRecuperacao)
      .set({ usadoEm: new Date() })
      .where(and(eq(tokensRecuperacao.tokenHash, hashToken(token)), isNull(tokensRecuperacao.usadoEm), gt(tokensRecuperacao.expiraEm, new Date())))
      .returning({ usuarioId: tokensRecuperacao.usuarioId });
    if (!t) throw new DomainError("Link inválido ou expirado. Peça um novo link ao administrador.");
    await tx.update(usuarios).set({ senhaHash: await hashSenha(novaSenha) }).where(eq(usuarios.id, t.usuarioId));
    await invalidarLinksPendentes(tx, t.usuarioId);
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
