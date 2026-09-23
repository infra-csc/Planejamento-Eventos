import { and, count, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError } from "@/domain/errors";
import { descricaoLinha } from "@/domain/os";
import { montarLinhasAta } from "../os";
import { bloquearEvento, registrarHistorico, registrarHistoricos } from "../support";

/* ------------------------------------------------------------------ */
/* Reunião de OS: observações, dados da reunião e conferência          */
/* ------------------------------------------------------------------ */

export async function salvarObservacoesReuniao(usuario: UsuarioAtual, id: string, observacoes: string | null) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, id) });
  if (!ev) throw new NaoEncontradoError("Evento");
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("Observações só podem ser editadas antes de fechar a ata.");
  const r = await db.update(eventos).set({ observacoesReuniao: observacoes }).where(and(eq(eventos.id, id), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO"]))).returning({ id: eventos.id });
  if (r.length === 0) throw new DomainError("A ata acabou de ser fechada; as observações ficaram como estavam.");
}

export type DadosReuniao = {
  reuniaoPresentes: string | null;
  publicoEsperado: number | null;
  caminhaoCarrega: string | null;
  caminhaoSai: string | null;
  arenaDescarrega: string | null;
  kitDescarrega: string | null;
};

/** Campos da ata preenchidos pela logística na reunião (presentes, público, carga). Congelam no fechamento. */
export async function salvarDadosReuniao(usuario: UsuarioAtual, id: string, dados: DadosReuniao) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, id) });
  if (!ev) throw new NaoEncontradoError("Evento");
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("Os dados da reunião só podem ser editados antes de fechar a ata.");
  const r = await db.update(eventos).set(dados).where(and(eq(eventos.id, id), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO"]))).returning({ id: eventos.id });
  if (r.length === 0) throw new DomainError("A ata acabou de ser fechada; os dados ficaram como estavam.");
}

/** Marca (ou desmarca) uma linha da ata como conferida na reunião. Pré-requisito para fechar a ata. */
export async function conferirLinha(usuario: UsuarioAtual, eventoId: string, linhaId: string, conferida: boolean) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Fase lida depois da trava: um "Fechar ata" em andamento termina antes, e a conferência não muda uma ata fechada.
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("A conferência acontece antes de fechar a ata.");
    const [linha] = await tx
      .update(eventoItens)
      .set(conferida ? { conferidoEm: new Date(), conferidoPorId: usuario.id } : { conferidoEm: null, conferidoPorId: null })
      .where(and(eq(eventoItens.id, linhaId), eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)))
      .returning({ id: eventoItens.id });
    if (!linha) throw new NaoEncontradoError("Linha da ata");
    const [l] = await montarLinhasAta(tx, eventoId, { linhaId });
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linhaId,
      acao: conferida ? "CONFERIDO" : "CONFERENCIA_DESFEITA",
      descricao: `${l ? descricaoLinha(l) : "Linha"}: ${conferida ? "conferida na reunião" : "conferência desfeita"}`,
      usuarioId: usuario.id,
    });
    const [{ total, conferidas }] = await tx
      .select({ total: count(), conferidas: sql<number>`count(${eventoItens.conferidoEm})` })
      .from(eventoItens)
      .where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)));
    return { total: Number(total), conferidas: Number(conferidas) };
  });
}

/** Conferência em lote (seed, testes, "conferir todas as restantes"). */
/**
 * "Conferir as restantes": marca só as linhas que a pessoa tinha na tela (`linhaIds`). Linha que
 * chegou depois (pedido novo, correção que desfez a conferência) continua pendente e é contada em
 * `novas`, para a tela avisar. Sem `linhaIds` (scripts), vale para todas as pendentes.
 */
export async function conferirTodasLinhas(usuario: UsuarioAtual, eventoId: string, linhaIds?: string[]) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("A conferência acontece antes de fechar a ata.");
    if (linhaIds && linhaIds.length === 0) return { marcadas: 0, novas: 0 };
    const marcadas = await tx
      .update(eventoItens)
      .set({ conferidoEm: new Date(), conferidoPorId: usuario.id })
      .where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true), sql`${eventoItens.conferidoEm} is null`, ...(linhaIds ? [inArray(eventoItens.id, linhaIds)] : [])))
      .returning({ id: eventoItens.id });
    // Um registro por linha, gravados num insert só.
    await registrarHistoricos(
      tx,
      marcadas.map((m) => ({ eventoId, entidade: "evento_item", entidadeId: m.id, acao: "CONFERIDO", descricao: "Conferida na reunião (em lote: “conferir as restantes”)", usuarioId: usuario.id })),
    );
    const [{ pendentes }] = await tx
      .select({ pendentes: count() })
      .from(eventoItens)
      .where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true), sql`${eventoItens.conferidoEm} is null`));
    return { marcadas: marcadas.length, novas: Number(pendentes) };
  });
}
