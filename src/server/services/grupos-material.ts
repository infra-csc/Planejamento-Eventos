import { getDb } from "@/server/db";
import { pecas, projetos } from "@/server/db/schema";
import { grupoDaPeca, grupoDoProjeto, type MapaGrupos } from "@/domain/grupos-material";

/** Grupo de material de cada peça do catálogo (código → grupo), para separar a OS como a lista da ata. */
export async function mapaGruposPecas(): Promise<MapaGrupos> {
  const db = await getDb();
  const rows = await db.select({ codigo: pecas.codigo, setor: pecas.setor, familia: pecas.familia }).from(pecas);
  return Object.fromEntries(rows.map((p) => [p.codigo, grupoDaPeca(p)]));
}

/** Grupo de material de cada projeto padrão (código → grupo), pela categoria. */
export async function mapaGruposProjetos(): Promise<MapaGrupos> {
  const db = await getDb();
  const rows = await db.select({ codigo: projetos.codigo, categoria: projetos.categoria, nome: projetos.nome }).from(projetos);
  return Object.fromEntries(rows.map((p) => [p.codigo, grupoDoProjeto(p)]));
}
