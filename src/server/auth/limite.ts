// Sem "server-only": services importados pelos scripts (seed, smoke) dependem deste módulo.
import { and, count, gt, inArray, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/server/db";
import { tentativasAcesso } from "@/server/db/schema";
import { DomainError } from "@/domain/errors";

export type Regra = { chave: string; maximo: number };

/**
 * IP do cliente atrás do proxy do Replit: o ÚLTIMO valor de x-forwarded-for é o que o proxy
 * acrescentou (os anteriores podem ter sido enviados pelo próprio cliente).
 */
export async function ipCliente(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return xff[xff.length - 1] || h.get("x-real-ip") || "desconhecido";
}

/**
 * Conta e reserva uma tentativa de uma vez só: dentro de uma transação, trava cada chave
 * (pg_advisory_xact_lock), conta as tentativas da janela e, se nenhuma chave chegou ao máximo,
 * grava a tentativa nova. Duas requisições simultâneas não enxergam a mesma contagem, então
 * rajadas em paralelo não passam do limite. Quando excede, nada é gravado (o bloqueio não se
 * prolonga sozinho). Os ids devolvidos servem para `liberarTentativas` — ex.: login certo não
 * conta como falha.
 */
export async function consumirTentativa(regras: Regra[], janelaMs: number): Promise<{ excedido: boolean; ids: string[] }> {
  const chaves = [...new Set(regras.map((r) => r.chave))].sort();
  if (chaves.length === 0) return { excedido: false, ids: [] };
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Ordem fixa das travas: duas requisições com chaves em comum não se bloqueiam mutuamente.
    for (const chave of chaves) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${chave}))`);
    const desde = new Date(Date.now() - janelaMs);
    const rows = await tx
      .select({ chave: tentativasAcesso.chave, n: count() })
      .from(tentativasAcesso)
      .where(and(inArray(tentativasAcesso.chave, chaves), gt(tentativasAcesso.criadoEm, desde)))
      .groupBy(tentativasAcesso.chave);
    const excedido = regras.some((r) => Number(rows.find((x) => x.chave === r.chave)?.n ?? 0) >= r.maximo);
    if (excedido) return { excedido: true, ids: [] };
    const inseridos = await tx
      .insert(tentativasAcesso)
      .values(chaves.map((chave) => ({ chave })))
      .returning({ id: tentativasAcesso.id });
    return { excedido: false, ids: inseridos.map((i) => i.id) };
  });
}

/** Como `consumirTentativa`, mas lança erro de domínio com a mensagem quando o limite foi atingido. */
export async function exigirDentroDoLimite(regras: Regra[], janelaMs: number, mensagem: string): Promise<string[]> {
  const r = await consumirTentativa(regras, janelaMs);
  if (r.excedido) throw new DomainError(mensagem);
  return r.ids;
}

/** Desfaz tentativas reservadas por `consumirTentativa` (a operação deu certo e não deve contar). */
export async function liberarTentativas(ids: string[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.delete(tentativasAcesso).where(inArray(tentativasAcesso.id, ids));
}

/** true se alguma das chaves já atingiu o máximo dentro da janela (só leitura; para reservar use `consumirTentativa`). */
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
