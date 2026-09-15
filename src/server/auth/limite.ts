// Sem "server-only": services importados pelos scripts (seed, smoke) dependem deste módulo.
import { and, count, gt, inArray, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/server/db";
import { tentativasAcesso } from "@/server/db/schema";

export type Regra = { chave: string; maximo: number };

/** IP do cliente atrás do proxy do Replit (primeiro valor de x-forwarded-for). */
export async function ipCliente(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

/** true se alguma das chaves já atingiu o máximo dentro da janela. */
export async function limiteExcedido(regras: Regra[], janelaMs: number): Promise<boolean> {
  if (regras.length === 0) return false;
  const db = await getDb();
  const desde = new Date(Date.now() - janelaMs);
  const rows = await db
    .select({ chave: tentativasAcesso.chave, n: count() })
    .from(tentativasAcesso)
    .where(and(inArray(tentativasAcesso.chave, regras.map((r) => r.chave)), gt(tentativasAcesso.criadoEm, desde)))
    .groupBy(tentativasAcesso.chave);
  return regras.some((r) => Number(rows.find((x) => x.chave === r.chave)?.n ?? 0) >= r.maximo);
}

export async function registrarTentativas(chaves: string[]) {
  if (chaves.length === 0) return;
  const db = await getDb();
  await db.insert(tentativasAcesso).values(chaves.map((chave) => ({ chave })));
}

export async function limparTentativas(chaves: string[]) {
  if (chaves.length === 0) return;
  const db = await getDb();
  await db.delete(tentativasAcesso).where(inArray(tentativasAcesso.chave, chaves));
}

/** Remove registros com mais de um dia (chamado pelo job de verificações). */
export async function purgarTentativasAntigas() {
  const db = await getDb();
  await db.delete(tentativasAcesso).where(lt(tentativasAcesso.criadoEm, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}
