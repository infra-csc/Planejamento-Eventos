import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { notificacoes } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";

export async function listarNotificacoes(usuario: UsuarioAtual, limite = 100) {
  const db = await getDb();
  return db.query.notificacoes.findMany({ where: eq(notificacoes.usuarioId, usuario.id), orderBy: [desc(notificacoes.criadoEm)], limit: limite });
}

export async function contarNaoLidas(usuario: UsuarioAtual) {
  const db = await getDb();
  const [r] = await db
    .select({ n: count() })
    .from(notificacoes)
    .where(and(eq(notificacoes.usuarioId, usuario.id), isNull(notificacoes.lidaEm)));
  return Number(r.n);
}

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
