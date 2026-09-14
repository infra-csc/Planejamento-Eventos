import path from "node:path";
import { getConnection } from "../src/server/db";

async function main() {
  const conn = await getConnection();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (conn.kind === "postgres") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(conn.db as any, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(conn.db as any, { migrationsFolder });
  }
  console.log(`Migrações aplicadas (${conn.kind}).`);
  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
