import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, eventos, usuarios } from "@/server/db/schema";
import { casarComOApp, HORA_DA_REUNIAO, reuniaoDoEvento, type FotoDoUmmense } from "@/domain/ummense";
import { parseDateTimeLocal } from "@/lib/format";
import foto from "@/data/ummense-eventos.json";
import { notificar, usuariosRequisitantes } from "../support";
import { inserirEvento } from "./cadastro";

/** Lote combinado com o Yan (16/10): do Ummense, de 28/11 até o fim de 2026 (2027 não). */
export const LOTE_UMMENSE = { chave: "importacao:ummense:2026-11-28_2026-12-31", de: "2026-11-28", ate: "2026-12-31" } as const;

/** "Night Run - Etapa 2 - São Paulo" → "NIGHT RUN - ETAPA 2 - SÃO PAULO" (o padrão dos nomes no Planejamento). */
const nomeNoPadrao = (nome: string) => nome.replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");

export type ResultadoUmmense = { feito: false } | { feito: true; criados: Array<{ codigo: string; nome: string; data: string }>; jaExistiam: string[]; pulados: string[] };

/**
 * Cria no banco os eventos do Ummense do lote (uma vez só): os que já existem no Planejamento (mesma
 * marca, cidade e data, a regra de src/domain/ummense.ts) e os "pode já existir" ficam de fora.
 * Reunião de OS na terça a 35+ dias do evento, às 14:00; local = a cidade; responsável = o Yan (ou o
 * primeiro administrador ativo). Uma notificação só para os requisitantes, em vez de uma por evento.
 *
 * A marca em `configuracoes` entra na MESMA transação: rodar de novo (outro start, outra instância)
 * não cria nada, e um evento excluído depois não volta.
 */
export async function importarLoteDoUmmense(lote: { chave: string; de: string; ate: string } = LOTE_UMMENSE): Promise<ResultadoUmmense> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [marca] = await tx
      .insert(configuracoes)
      .values({ chave: lote.chave, valor: JSON.stringify({ status: "em andamento" }) })
      .onConflictDoNothing({ target: configuracoes.chave })
      .returning({ chave: configuracoes.chave });
    if (!marca) return { feito: false };

    const ativos = await tx.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(and(eq(usuarios.perfil, "ADMIN"), eq(usuarios.ativo, true))).orderBy(asc(usuarios.criadoEm));
    const responsavel = ativos.find((u) => /^yan\b/i.test(u.nome)) ?? ativos[0];
    if (!responsavel) throw new Error("Nenhum administrador ativo para ser o responsável pelos eventos do Ummense.");

    const doLote = (foto as FotoDoUmmense).eventos.filter((e) => e.data >= lote.de && e.data <= lote.ate);
    const existentes = await tx.select({ id: eventos.id, nome: eventos.nome, data: eventos.dataInicio, status: eventos.status }).from(eventos);
    const situacoes = casarComOApp(
      doLote,
      existentes.map((e) => ({ id: e.id, nome: e.nome, data: e.data, arquivado: e.status === "CANCELADO" })),
    );

    const criados: Array<{ codigo: string; nome: string; data: string }> = [];
    const jaExistiam: string[] = [];
    const pulados: string[] = [];
    for (const u of doLote) {
      const s = situacoes.get(u.id);
      if (s?.tipo === "existe") {
        jaExistiam.push(`${u.nome} (${u.data}) = ${s.evento.nome}`);
        continue;
      }
      if (s?.tipo === "talvez") {
        pulados.push(`${u.nome} (${u.data}): ${s.motivo} — ${s.evento.nome}`);
        continue;
      }
      const dataReuniao = parseDateTimeLocal(`${reuniaoDoEvento(u.data)}T${HORA_DA_REUNIAO}`);
      if (!dataReuniao) throw new Error(`Reunião inválida para ${u.nome}.`);
      const ev = await inserirEvento(tx, responsavel, { nome: nomeNoPadrao(u.nome), cliente: null, local: u.cidade, dataInicio: u.data, dataReuniao }, `importado do Ummense${u.dataNaoConfirmada ? ", data não confirmada no Ummense" : ""}`);
      criados.push({ codigo: ev.codigo, nome: ev.nome, data: ev.dataInicio });
    }

    if (criados.length) {
      await notificar(tx, {
        usuarioIds: await usuariosRequisitantes(tx),
        tipo: "EVENTO_CRIADO",
        titulo: `${criados.length} eventos novos em preparação (calendário do Ummense)`,
        mensagem: `De ${criados[0].data.split("-").reverse().join("/")} a ${criados.at(-1)!.data.split("-").reverse().join("/")}. Cada um tem a reunião de OS numa terça, 35 dias antes ou mais: envie as necessidades da sua área até lá.`,
        link: "/eventos",
      });
    }
    await tx
      .update(configuracoes)
      .set({ valor: JSON.stringify({ status: "feito", em: new Date().toISOString(), responsavel: responsavel.nome, criados: criados.map((c) => c.codigo), jaExistiam, pulados }) })
      .where(eq(configuracoes.chave, lote.chave));
    return { feito: true, criados, jaExistiam, pulados };
  });
}
