import { and, eq, inArray, ne, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/server/db";
import { configuracoes, historico, notificacoes, sequencias, solicitacoes, usuarios, type Perfil } from "@/server/db/schema";

export type Executor = Db | Tx;

/* ------------------------------------------------------------------ */
/* Concorrência                                                         */
/* ------------------------------------------------------------------ */

/**
 * Trava a linha do evento até o fim da transação. Toda mutação que mexe na ata, na OS ou na fase do
 * evento chama isto primeiro: duas pessoas respondendo, ajustando ou fechando a ata do mesmo evento
 * passam a acontecer uma depois da outra, e cada uma relê o estado já atualizado.
 */
export async function bloquearEvento(tx: Executor, eventoId: string) {
  await tx.execute(sql`select id from eventos where id = ${eventoId} for update`);
}

/* ------------------------------------------------------------------ */
/* Histórico / auditoria                                                */
/* ------------------------------------------------------------------ */

export async function registrarHistorico(
  ex: Executor,
  dados: {
    eventoId?: string | null;
    entidade: string;
    entidadeId: string;
    acao: string;
    descricao: string;
    usuarioId: string | null;
    dadosAntes?: unknown;
    dadosDepois?: unknown;
  },
) {
  await ex.insert(historico).values({
    eventoId: dados.eventoId ?? null,
    entidade: dados.entidade,
    entidadeId: dados.entidadeId,
    acao: dados.acao,
    descricao: dados.descricao,
    usuarioId: dados.usuarioId,
    dadosAntes: dados.dadosAntes ?? null,
    dadosDepois: dados.dadosDepois ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* Notificações                                                          */
/* ------------------------------------------------------------------ */

export async function notificar(
  ex: Executor,
  dados: { usuarioIds: string[]; tipo: string; titulo: string; mensagem: string; link?: string | null; chaveDedupe?: string | null; excetoUsuarioId?: string | null },
) {
  const ids = [...new Set(dados.usuarioIds)].filter((id) => id !== dados.excetoUsuarioId);
  if (ids.length === 0) return;
  await ex
    .insert(notificacoes)
    .values(
      ids.map((usuarioId) => ({
        usuarioId,
        tipo: dados.tipo,
        titulo: dados.titulo,
        mensagem: dados.mensagem,
        link: dados.link ?? null,
        chaveDedupe: dados.chaveDedupe ?? null,
      })),
    )
    .onConflictDoNothing();
}

export async function usuariosPorPerfil(ex: Executor, perfis: Perfil[]): Promise<string[]> {
  const rows = await ex
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(inArray(usuarios.perfil, perfis), eq(usuarios.ativo, true)));
  return rows.map((r) => r.id);
}

export async function usuariosDaArea(ex: Executor, areaId: string): Promise<string[]> {
  const rows = await ex
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.areaId, areaId), eq(usuarios.ativo, true)));
  return rows.map((r) => r.id);
}

/**
 * Quem pediu alguma coisa neste evento (e as áreas envolvidas): toda adição ou ajuste de item
 * no evento interessa a essas pessoas, mesmo quando mexe num item que elas não pediram.
 */
export async function usuariosComPedidoNoEvento(ex: Executor, eventoId: string): Promise<string[]> {
  const rows = await ex
    .select({ criadoPorId: solicitacoes.criadoPorId, areaId: solicitacoes.areaId })
    .from(solicitacoes)
    .where(and(eq(solicitacoes.eventoId, eventoId), eq(solicitacoes.excluida, false), ne(solicitacoes.status, "CANCELADA")));
  const ids = new Set(rows.map((r) => r.criadoPorId));
  for (const areaId of new Set(rows.map((r) => r.areaId))) for (const id of await usuariosDaArea(ex, areaId)) ids.add(id);
  return [...ids];
}

export const usuariosRequisitantes = (ex: Executor) => usuariosPorPerfil(ex, ["REQUISITANTE", "CENOGRAFIA"]);
/** Quem responde solicitações: logística e administrador (que tem os mesmos poderes e a mesma fila). */
export const usuariosLogistica = (ex: Executor) => usuariosPorPerfil(ex, ["LOGISTICA", "ADMIN"]);

/* ------------------------------------------------------------------ */
/* Sequências de código (EVT-0001, SOL-0001, PRJ-0001)                   */
/* ------------------------------------------------------------------ */

export async function proximoCodigo(ex: Executor, nome: "evento" | "solicitacao" | "projeto"): Promise<string> {
  const prefixo = { evento: "EVT", solicitacao: "SOL", projeto: "PRJ" }[nome];
  const [row] = await ex
    .insert(sequencias)
    .values({ nome, valor: 1 })
    .onConflictDoUpdate({ target: sequencias.nome, set: { valor: sql`${sequencias.valor} + 1` } })
    .returning({ valor: sequencias.valor });
  return `${prefixo}-${String(row.valor).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Configurações                                                        */
/* ------------------------------------------------------------------ */

export const CONFIG_PADRAO = {
  sla_resposta_horas: "48",
  aviso_prazo_horas: "12",
  antecedencia_reuniao_horas: "0",
  lembrete_reuniao_dias: "1",
  bloquear_encerramento_com_pendentes: "true",
} as const;

export type ChaveConfig = keyof typeof CONFIG_PADRAO;

export async function obterConfiguracoes(ex: Executor): Promise<Record<ChaveConfig, string>> {
  const rows = await ex.select().from(configuracoes);
  const out = { ...CONFIG_PADRAO } as Record<ChaveConfig, string>;
  for (const r of rows) if (r.chave in out) out[r.chave as ChaveConfig] = r.valor;
  return out;
}

export async function salvarConfiguracao(ex: Executor, chave: ChaveConfig, valor: string) {
  await ex
    .insert(configuracoes)
    .values({ chave, valor })
    .onConflictDoUpdate({ target: configuracoes.chave, set: { valor, atualizadoEm: new Date() } });
}

const COM_ACENTO = "áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
const SEM_ACENTO = "aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn";

/**
 * Busca no banco sem diferenciar acento e maiúsculas: cada palavra do termo precisa aparecer em
 * alguma das colunas ("portico 4" acha "Pórtico boca de 4 m"). Usa translate(), que existe no
 * Postgres e no PGlite sem extensão.
 */
export function buscaSemAcento(colunas: AnyColumn[], termo: string): SQL | undefined {
  const palavras = termo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (palavras.length === 0 || colunas.length === 0) return undefined;
  const alvo = sql.join(
    colunas.map((c) => sql`coalesce(${c}, '')`),
    sql` || ' ' || `,
  );
  const normalizado = sql`lower(translate(${alvo}, ${COM_ACENTO}, ${SEM_ACENTO}))`;
  // % e _ são curingas do LIKE: saem do termo para a busca ser literal.
  const literais = palavras.map((p) => p.replace(/[%_]/g, "")).filter(Boolean);
  if (literais.length === 0) return undefined;
  return and(...literais.map((p) => sql`${normalizado} like ${`%${p}%`}`));
}
