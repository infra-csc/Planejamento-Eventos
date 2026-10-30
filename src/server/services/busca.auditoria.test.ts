/**
 * Busca global (auditoria 30/10, parte A N18): o atalho "Ver solicitações atrasadas" só aparece quando há
 * solicitação em atraso. Antes, a contagem chegava como lista e a ação "0 em atraso" aparecia para todos.
 */
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.PGLITE_DATA_DIR = "memory://";
  delete process.env.DATABASE_URL;
});

import { getDb } from "@/server/db";
import { areas, usuarios } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { buscar } from "./busca";

let logistica: UsuarioAtual;

beforeAll(async () => {
  const db = await getDb();
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const [aLog] = await db.insert(areas).values([{ nome: "Logística" }]).returning();
  const [u] = await db.insert(usuarios).values({ nome: "Marina", email: "marina@t.com", perfil: "LOGISTICA", areaId: aLog.id, senhaHash: "x" }).returning();
  logistica = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, areaId: u.areaId, areaNome: aLog.nome };
}, 60_000);

describe("busca global — atalho de atrasadas", () => {
  it("sem solicitação atrasada, não oferece 'Ver solicitações atrasadas'", async () => {
    const r = await buscar(logistica, "");
    expect(r.map((x) => x.titulo)).not.toContain("Ver solicitações atrasadas");
  });
});
