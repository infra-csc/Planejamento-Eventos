import fs from "node:fs";
import { sql } from "drizzle-orm";
import { getConnection, getDataDir } from "../src/server/db";

/**
 * Apaga todos os dados. Local: remove o diretório do PGlite. Postgres: derruba o schema public.
 * Depois rode `npm run setup`.
 */
async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    const dir = getDataDir();
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Diretório ${dir} removido.`);
    return;
  }
  const conn = await getConnection();
  await conn.db.execute(sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  console.log("Schema public recriado.");
  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
