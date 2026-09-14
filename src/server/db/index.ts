import fs from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "./schema";

/**
 * Conexão com o banco.
 *
 * - Com DATABASE_URL definida (Replit / produção): PostgreSQL via node-postgres.
 * - Sem DATABASE_URL (desenvolvimento local): PostgreSQL embutido (PGlite) em ./.data/pglite.
 *
 * O tipo exposto é o mesmo nos dois casos, então serviços e scripts não sabem qual driver está ativo.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type Conn = { db: Db; kind: "pglite" | "postgres"; close: () => Promise<void> };

const globalForDb = globalThis as unknown as { __npeDb?: Promise<Conn> };

export function getDataDir() {
  return process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
}

async function connect(): Promise<Conn> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 10 });
    const db = drizzle(pool, { schema }) as unknown as Db;
    return { db, kind: "postgres", close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  const db = drizzle(client, { schema }) as unknown as Db;
  return { db, kind: "pglite", close: () => client.close() };
}

export function getConnection(): Promise<Conn> {
  if (!globalForDb.__npeDb) {
    globalForDb.__npeDb = connect();
  }
  return globalForDb.__npeDb;
}

export async function getDb(): Promise<Db> {
  return (await getConnection()).db;
}

export { schema };
