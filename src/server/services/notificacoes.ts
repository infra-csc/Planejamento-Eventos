import { cache } from "react";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { notificacoes } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";

export async function listarNotificacoes(usuario: UsuarioAtual, limite = 100) {
  const db = await getDb();
  return db.query.notificacoes.findMany({ where: eq(notificacoes.usuarioId, usuario.id), orderBy: [desc(notificacoes.criadoEm)], limit: limite });
}

/**
 * A lista (até `limite`) e o total de notificações da pessoa, para a tela dizer
 * "mostrando as 100 mais recentes de N" quando houver mais. `naoLidas` é o mesmo número do contador do sino.
 */
export async function listarNotificacoesComTotal(usuario: UsuarioAtual, limite = 100) {
  const [itens, total, naoLidas] = await Promise.all([listarNotificacoes(usuario, limite), contarNotificacoes(usuario), contarNaoLidas(usuario)]);
  return { itens, total, naoLidas, limite, truncada: total > itens.length };
}

/** Total de notificações da pessoa (lidas e não lidas). */
export async function contarNotificacoes(usuario: UsuarioAtual) {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(notificacoes).where(eq(notificacoes.usuarioId, usuario.id));
  return Number(r.n);
}

/**
 * Uma contagem por requisição: o layout (sino) e a página /notificacoes pediam o mesmo número
 * (o usuário vem do `getUsuarioAtual`, também em cache, então o argumento é o mesmo objeto). Auditoria 28/10, nº 148.
 */
export const contarNaoLidas = cache(async (usuario: UsuarioAtual) => {
  const db = await getDb();
  const [r] = await db
    .select({ n: count() })
    .from(notificacoes)
    .where(and(eq(notificacoes.usuarioId, usuario.id), isNull(notificacoes.lidaEm)));
  return Number(r.n);
});

export async function marcarLida(usuario: UsuarioAtual, id: string) {
  const db = await getDb();
  await db
    .update(notificacoes)
    .set({ lidaEm: new Date() })
    .where(and(eq(notificacoes.id, id), eq(notificacoes.usuarioId, usuario.id), isNull(notificacoes.lidaEm)));
}

export async function marcarTodasLidas(usuario: UsuarioAtual) {
  const db = await getDb();
  await db
    .update(notificacoes)
    .set({ lidaEm: new Date() })
    .where(and(eq(notificacoes.usuarioId, usuario.id), isNull(notificacoes.lidaEm)));
}
