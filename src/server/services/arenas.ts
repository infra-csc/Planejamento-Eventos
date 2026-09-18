import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { arenas } from "@/server/db/schema";
import { ARENAS, obterArenaPorSlug } from "@/domain/arena/eco-run-sp-2026";
import type { Arena } from "@/domain/arena/tipos";

/**
 * Uma arena, de onde quer que venha: a Eco Run SP 2026 (fixa no código) ou uma arena de evento
 * criada no app (tabela arenas). Quem lê a arena passa sempre por aqui.
 */
export type ArenaCarregada = { arena: Arena; origem: "fixa" | "evento"; eventoId: string | null; temPlanta: boolean };

export async function obterArenaBase(slug: string): Promise<ArenaCarregada | null> {
  const fixa = obterArenaPorSlug(slug);
  if (fixa) return { arena: fixa, origem: "fixa", eventoId: null, temPlanta: false };
  const db = await getDb();
  const row = await db.query.arenas.findFirst({
    where: eq(arenas.slug, slug),
    columns: { slug: true, base: true, eventoId: true, plantaMime: true },
  });
  if (!row) return null;
  return { arena: { ...row.base, slug: row.slug }, origem: "evento", eventoId: row.eventoId, temPlanta: Boolean(row.plantaMime) };
}

export async function arenaExiste(slug: string): Promise<boolean> {
  return Boolean(await obterArenaBase(slug));
}

/** Todas as arenas: as fixas primeiro, depois as de evento. */
export async function listarArenasResumo() {
  const db = await getDb();
  const doBanco = await db.query.arenas.findMany({ columns: { slug: true, nome: true, eventoId: true, criadoEm: true }, with: { evento: { columns: { id: true, codigo: true, nome: true, status: true } } } });
  return [
    ...ARENAS.map((a) => ({ slug: a.slug, nome: a.evento.nome, origem: "fixa" as const, evento: null })),
    ...doBanco.map((a) => ({ slug: a.slug, nome: a.nome, origem: "evento" as const, evento: a.evento })),
  ];
}
