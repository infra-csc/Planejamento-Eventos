import path from "node:path";
import { getConnection } from "../src/server/db";

/** Chave do advisory lock: várias instâncias do deployment subindo juntas migram uma de cada vez. */
const TRAVA_MIGRACAO = 727_274_619;

async function main() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    // Conexão dedicada: o advisory lock vale por sessão, e o migrator precisa usar a mesma conexão.
    const { Client } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("select pg_advisory_lock($1)", [TRAVA_MIGRACAO]);
      await migrate(drizzle(client), { migrationsFolder });
      console.log("Migrações aplicadas (postgres).");
    } finally {
      await client.query("select pg_advisory_unlock($1)", [TRAVA_MIGRACAO]).catch(() => undefined);
      await client.end();
    }
    return;
  }

  const conn = await getConnection();
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(conn.db as any, { migrationsFolder });
  console.log(`Migrações aplicadas (${conn.kind}).`);
  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
