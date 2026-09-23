/**
 * Grava a arena da Eco Run SP 2026 (scripts/dados/arena-eco-run-sp-2026.ts) na tabela `arenas`.
 *
 * - Slug `eco-run-sp-2026`, sem evento vinculado; o app a trata como arena "fixa" (só leitura:
 *   sem troca de planta nem exclusão) e usa a ata gravada na própria base.
 * - Idempotente: se a arena já existe no banco, não mexe (as posições ajustadas no mapa ficam em
 *   `arena_posicoes` e continuam valendo).
 * - Enquanto este script não roda, o app lê a mesma arena direto do arquivo de dados (reserva).
 *
 * Uso: `npm run importar:arena` (local, PGlite) ou com DATABASE_URL apontando para o Postgres.
 */
import { eq } from "drizzle-orm";
import { getConnection } from "../src/server/db";
import { arenas } from "../src/server/db/schema";
import { ARENA_ECO_RUN_SP_2026 } from "./dados/arena-eco-run-sp-2026";

async function main() {
  const { db, close } = await getConnection();
  try {
    const arena = ARENA_ECO_RUN_SP_2026;
    const existente = await db.query.arenas.findFirst({ where: eq(arenas.slug, arena.slug), columns: { id: true, eventoId: true } });
    if (existente) {
      console.log(`Arena ${arena.slug} já está no banco${existente.eventoId ? " (vinculada a um evento)" : ""}: nada a fazer.`);
      return;
    }
    await db.insert(arenas).values({ slug: arena.slug, eventoId: null, nome: arena.evento.nome, base: arena, plantaMime: null, plantaImagem: null, criadoPorId: null });
    console.log(`Arena ${arena.slug} gravada no banco (${arena.pontos.length} pontos, ${arena.ata.length} linhas de ata).`);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
