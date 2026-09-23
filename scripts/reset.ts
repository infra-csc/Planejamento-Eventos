import fs from "node:fs";
import { sql } from "drizzle-orm";
import { getConnection, getDataDir } from "../src/server/db";

/**
 * Apaga todos os dados. Local: remove o diretório do PGlite. Postgres: derruba o schema public.
 * Depois rode `npm run setup`.
 *
 * Com DATABASE_URL (Replit), exige `--force`: o comando apaga o banco inteiro, sem volta.
 */
async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    const dir = getDataDir();
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Diretório ${dir} removido.`);
    return;
  }
  if (!process.argv.includes("--force")) {
    console.error(
      [
        "ATENÇÃO: DATABASE_URL está definida. Este comando APAGA TODO o banco PostgreSQL (tabelas e dados), sem volta.",
        "Se é isso mesmo (ex.: recarregar a demonstração), rode:",
        "",
        "  npm run db:reset -- --force && npm run setup",
      ].join("\n"),
    );
    process.exit(1);
  }
  const conn = await getConnection();
  await conn.db.execute(sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  console.log("Schema public recriado.");
  await conn.close();
  // O cache de dados do Next (catálogo, projetos, áreas) sobrevive a builds e guardaria ids do banco antigo.
  fs.rmSync(".next/cache/fetch-cache", { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
