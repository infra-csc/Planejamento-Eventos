import { and, eq, inArray, ne, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { cookies } from "next/headers";
import type { Db, Tx } from "@/server/db";
import { areas, configuracoes, historico, notificacoes, sequencias, solicitacoes, usuarios, type Perfil } from "@/server/db/schema";
import { COOKIE_VER_COMO } from "@/server/auth/cookies";
import { PERFIL_LABEL, PERFIS } from "@/domain/permissions";

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

type DadosHistorico = {
  eventoId?: string | null;
  entidade: string;
  entidadeId: string;
  acao: string;
  descricao: string;
  usuarioId: string | null;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  /** Perfil assumido em "ver como". Sem o campo, é descoberto pelo cookie da requisição atual. */
  verComo?: string | null;
};

const linhaHistorico = (dados: DadosHistorico, verComo: string | null) => ({
  eventoId: dados.eventoId ?? null,
  entidade: dados.entidade,
  entidadeId: dados.entidadeId,
  acao: dados.acao,
  // A descrição diz quem agiu de fato: o administrador, vendo o sistema como outro perfil.
  descricao: verComo && !dados.descricao.includes("pelo administrador") ? `${dados.descricao} (pelo administrador, vendo como ${verComo})` : dados.descricao,
  usuarioId: dados.usuarioId,
  dadosAntes: dados.dadosAntes ?? null,
  dadosDepois: dados.dadosDepois ?? null,
  verComo,
});

/** Cookie de "ver como" da requisição atual (null fora de uma requisição: scripts, testes, jobs). */
async function cookieVerComo(): Promise<{ perfil: Perfil; areaId: string | null } | null> {
  let bruto: string | undefined;
  try {
    bruto = (await cookies()).get(COOKIE_VER_COMO)?.value;
  } catch {
    return null;
  }
  if (!bruto) return null;
  try {
    const { perfil, areaId } = JSON.parse(bruto) as { perfil?: string; areaId?: string | null };
    if (!perfil || perfil === "ADMIN" || !(PERFIS as readonly string[]).includes(perfil)) return null;
    return { perfil: perfil as Perfil, areaId: areaId || null };
  } catch {
    return null;
  }
}

/**
 * Rótulo do perfil assumido ("Requisitante · Produção") quando quem registra é um administrador em
 * "ver como"; null nos demais casos. O cookie só vale para administradores (como em getUsuarioAtual).
 */
export async function verComoAtual(ex: Executor, usuarioId: string | null): Promise<string | null> {
  if (!usuarioId) return null;
  const vc = await cookieVerComo();
  if (!vc) return null;
  const [u] = await ex.select({ perfil: usuarios.perfil }).from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
  if (u?.perfil !== "ADMIN") return null;
  const [area] = vc.areaId ? await ex.select({ nome: areas.nome }).from(areas).where(eq(areas.id, vc.areaId)).limit(1) : [];
  return `${PERFIL_LABEL[vc.perfil]}${area ? ` · ${area.nome}` : ""}`;
}

async function resolverVerComo(ex: Executor, lista: DadosHistorico[]): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>();
  for (const d of lista) {
    if (d.verComo !== undefined || !d.usuarioId || mapa.has(d.usuarioId)) continue;
    mapa.set(d.usuarioId, await verComoAtual(ex, d.usuarioId));
  }
  return mapa;
}

export async function registrarHistorico(ex: Executor, dados: DadosHistorico) {
  const mapa = await resolverVerComo(ex, [dados]);
  await ex.insert(historico).values(linhaHistorico(dados, dados.verComo !== undefined ? dados.verComo : (mapa.get(dados.usuarioId ?? "") ?? null)));
}

/** Vários registros de histórico num insert só (mesmos registros que chamar `registrarHistorico` para cada um). */
export async function registrarHistoricos(ex: Executor, lista: DadosHistorico[]) {
  if (lista.length === 0) return;
  const mapa = await resolverVerComo(ex, lista);
  await ex.insert(historico).values(lista.map((d) => linhaHistorico(d, d.verComo !== undefined ? d.verComo : (mapa.get(d.usuarioId ?? "") ?? null))));
}

/** Dia no fuso de Brasília (AAAA-MM-DD): agrupa os registros de acesso por dia. */
export function diaBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/**
 * Login no histórico, agregado por dia: um registro por pessoa (ou "e-mail desconhecido") e tipo
 * (entrada / falha), com a contagem do dia em `dadosDepois.tentativas`. Nunca guarda senha nem o
 * e-mail digitado quando ele não existe.
 */
export async function registrarAcessoDiario(ex: Executor, dados: { usuarioId: string | null; nome: string | null; sucesso: boolean }) {
  const dia = diaBrasilia();
  const acao = dados.sucesso ? "LOGIN" : "LOGIN_FALHA";
  const entidadeId = dados.usuarioId ?? "desconhecido";
  const [atual] = await ex
    .select({ id: historico.id, dadosDepois: historico.dadosDepois })
    .from(historico)
    .where(and(eq(historico.entidade, "acesso"), eq(historico.entidadeId, entidadeId), eq(historico.acao, acao), sql`${historico.dadosDepois}->>'dia' = ${dia}`))
    .limit(1);
  const n = Number((atual?.dadosDepois as { tentativas?: number } | null)?.tentativas ?? 0) + 1;
  const quem = dados.nome ?? "e-mail não cadastrado";
  const descricao = dados.sucesso ? `${quem} entrou no sistema (${n}× em ${dia.split("-").reverse().join("/")})` : `Falha de login: ${quem} (${n}× em ${dia.split("-").reverse().join("/")})`;
  if (atual) {
    await ex.update(historico).set({ descricao, dadosDepois: { dia, tentativas: n } }).where(eq(historico.id, atual.id));
    return;
  }
  await ex.insert(historico).values({
    entidade: "acesso",
    entidadeId,
    acao,
    descricao,
    usuarioId: dados.sucesso ? dados.usuarioId : null,
    dadosDepois: { dia, tentativas: n },
    verComo: null,
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

/**
 * Aviso de mudança numa linha da ata: a área dona da linha recebe o texto com o motivo; quem só
 * tem pedido no evento recebe o texto sem ele (o motivo é detalhe interno da área, como no histórico).
 */
export async function notificarAjusteLinha(
  ex: Executor,
  dados: { eventoId: string; areaId: string | null; tipo: string; titulo: string; mensagem: string; mensagemSemMotivo: string; link: string; excetoUsuarioId: string },
) {
  const daArea = dados.areaId ? await usuariosDaArea(ex, dados.areaId) : [];
  const outros = (await usuariosComPedidoNoEvento(ex, dados.eventoId)).filter((id) => !daArea.includes(id));
  const base = { tipo: dados.tipo, titulo: dados.titulo, link: dados.link, excetoUsuarioId: dados.excetoUsuarioId };
  await notificar(ex, { ...base, usuarioIds: daArea, mensagem: dados.mensagem });
  await notificar(ex, { ...base, usuarioIds: outros, mensagem: dados.mensagemSemMotivo });
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
  const areaIds = [...new Set(rows.map((r) => r.areaId))];
  if (areaIds.length === 0) return [...ids];
  // Usuários de todas as áreas numa consulta só (antes: uma por área), acrescentados na mesma ordem de área.
  const daArea = await ex
    .select({ id: usuarios.id, areaId: usuarios.areaId })
    .from(usuarios)
    .where(and(inArray(usuarios.areaId, areaIds), eq(usuarios.ativo, true)));
  const porArea = new Map<string, string[]>();
  for (const u of daArea) {
    if (!u.areaId) continue;
    const lista = porArea.get(u.areaId) ?? [];
    lista.push(u.id);
    porArea.set(u.areaId, lista);
  }
  for (const areaId of areaIds) for (const id of porArea.get(areaId) ?? []) ids.add(id);
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
