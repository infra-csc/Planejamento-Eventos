import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, pecas } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { consolidar, type EventoConsolidacao } from "@/domain/consolidacao";
import { calcularOsAtual } from "./os";

export async function consolidarPeriodo(usuario: UsuarioAtual, periodo: { inicio: string; fim: string }) {
  exigir(usuario, "consolidacao.ver");
  const db = await getDb();
  const evs = await db.query.eventos.findMany({
    where: and(
      inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO", "ENCERRADO"]),
      sql`${eventos.dataDesmontagem} >= ${periodo.inicio}`,
      sql`${eventos.dataMontagem} <= ${periodo.fim}`,
    ),
    columns: { id: true, codigo: true, nome: true, dataMontagem: true, dataDesmontagem: true, status: true, dataInicio: true, dataFim: true },
    orderBy: [asc(eventos.dataMontagem)],
  });
  const lista: EventoConsolidacao[] = [];
  for (const ev of evs) {
    lista.push({ id: ev.id, codigo: ev.codigo, nome: ev.nome, dataMontagem: ev.dataMontagem, dataDesmontagem: ev.dataDesmontagem, os: await calcularOsAtual(db, ev.id) });
  }
  const todasPecas = await db.query.pecas.findMany({ where: eq(pecas.ativo, true) });
  const resultado = consolidar(lista, todasPecas, periodo);
  return { eventos: evs, pecas: resultado };
}
