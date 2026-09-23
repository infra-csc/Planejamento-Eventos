import { inArray } from "drizzle-orm";
import { usuarios } from "@/server/db/schema";
import type { Executor } from "../support";

/* Utilitários compartilhados pelos módulos de eventos (não fazem parte da API pública de `eventos.ts`). */

export function nomeLinha(l: { tipo: string; projeto?: { nome: string } | null; peca?: { codigo: string; nome: string } | null; descricaoLivre?: string | null }) {
  if (l.tipo === "PROJETO" && l.projeto) return l.projeto.nome;
  if (l.tipo === "PECA" && l.peca) return `${l.peca.codigo} · ${l.peca.nome}`;
  return l.descricaoLivre ?? "Item avulso";
}

export async function nomesUsuarios(ex: Executor, ids: Array<string | null | undefined>) {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const rows = unicos.length ? await ex.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, unicos)) : [];
  return new Map(rows.map((r) => [r.id, r.nome]));
}
