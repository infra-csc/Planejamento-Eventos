import { and, desc, eq } from "drizzle-orm";
import { eventoItens, osVersoes, type OsGatilho } from "@/server/db/schema";
import { calcularOS, type LinhaAta } from "@/domain/os";
import type { Executor } from "./support";

/** Carrega as linhas ativas da ata de um evento no formato que o cálculo de OS espera. */
export async function montarLinhasAta(ex: Executor, eventoId: string, incluirInativas = false): Promise<Array<LinhaAta & { registro: typeof eventoItens.$inferSelect & { projeto: { id: string; codigo: string; nome: string; versaoAtual: number } | null; peca: { id: string; codigo: string; nome: string; setor: "ESTRUTURA" | "TENDA" | "MARCENARIA"; unidade: string } | null; area: { id: string; nome: string } | null; projetoVersao: { numero: number } | null } }>> {
  const rows = await ex.query.eventoItens.findMany({
    where: incluirInativas ? eq(eventoItens.eventoId, eventoId) : and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)),
    with: { projeto: true, peca: true, area: true, projetoVersao: true },
    orderBy: (t, { asc }) => [asc(t.criadoEm)],
  });
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    quantidade: r.quantidade,
    destino: r.destino,
    areaNome: r.area?.nome ?? null,
    projeto:
      r.tipo === "PROJETO" && r.projeto
        ? { codigo: r.projeto.codigo, nome: r.projeto.nome, versao: r.projetoVersao?.numero ?? 0, bom: r.bomSnapshot ?? [] }
        : null,
    peca: r.tipo === "PECA" && r.peca ? { id: r.peca.id, codigo: r.peca.codigo, nome: r.peca.nome, setor: r.peca.setor, unidade: r.peca.unidade } : null,
    descricaoLivre: r.descricaoLivre,
    registro: r,
  }));
}

export async function calcularOsAtual(ex: Executor, eventoId: string) {
  const linhas = await montarLinhasAta(ex, eventoId);
  return calcularOS(linhas);
}

/** Gera e persiste uma nova versão da OS (RN-05). */
export async function gerarOsVersao(ex: Executor, eventoId: string, gatilho: OsGatilho, usuarioId: string | null, descricao: string) {
  const conteudo = await calcularOsAtual(ex, eventoId);
  const [ultima] = await ex
    .select({ numero: osVersoes.numero })
    .from(osVersoes)
    .where(eq(osVersoes.eventoId, eventoId))
    .orderBy(desc(osVersoes.numero))
    .limit(1);
  const numero = (ultima?.numero ?? 0) + 1;
  const [v] = await ex.insert(osVersoes).values({ eventoId, numero, gatilho, descricao, conteudo, geradaPorId: usuarioId }).returning();
  return v;
}

export async function listarOsVersoes(eventoId: string) {
  const { getDb } = await import("@/server/db");
  const db = await getDb();
  return db.query.osVersoes.findMany({
    where: eq(osVersoes.eventoId, eventoId),
    with: { geradaPor: { columns: { id: true, nome: true } } },
    orderBy: (t, { desc }) => [desc(t.numero)],
  });
}
