import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, osVersoes, type OsConteudo, type OsGatilho, type Setor } from "@/server/db/schema";
import { calcularOS, diffOS, osIguais, resumoVersaoOs, type LinhaAta } from "@/domain/os";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError } from "@/domain/errors";
import { bloquearEvento, registrarHistorico, type Executor } from "./support";

type RegistroLinha = typeof eventoItens.$inferSelect & {
  projeto: { id: string; codigo: string; nome: string; versaoAtual: number } | null;
  peca: { id: string; codigo: string; nome: string; setor: Setor; unidade: string } | null;
  area: { id: string; nome: string } | null;
  projetoVersao: { numero: number } | null;
};

export type LinhaAtaRegistro = LinhaAta & { registro: RegistroLinha };

function paraLinhaAta(r: RegistroLinha): LinhaAtaRegistro {
  return {
    id: r.id,
    tipo: r.tipo,
    quantidade: r.quantidade,
    destino: r.destino,
    areaNome: r.area?.nome ?? null,
    projeto: r.tipo === "PROJETO" && r.projeto ? { codigo: r.projeto.codigo, nome: r.projeto.nome, versao: r.projetoVersao?.numero ?? 0, bom: r.bomSnapshot ?? [] } : null,
    peca: r.tipo === "PECA" && r.peca ? { id: r.peca.id, codigo: r.peca.codigo, nome: r.peca.nome, setor: r.peca.setor, unidade: r.peca.unidade } : null,
    descricaoLivre: r.descricaoLivre,
    registro: r,
  };
}

/** Carrega as linhas da ata de um evento (ativas, por padrão) no formato que o cálculo de OS espera. */
export async function montarLinhasAta(ex: Executor, eventoId: string, opcoes: { incluirInativas?: boolean; linhaId?: string } = {}): Promise<LinhaAtaRegistro[]> {
  const rows = await ex.query.eventoItens.findMany({
    where: and(eq(eventoItens.eventoId, eventoId), opcoes.incluirInativas ? undefined : eq(eventoItens.ativo, true), opcoes.linhaId ? eq(eventoItens.id, opcoes.linhaId) : undefined),
    with: { projeto: true, peca: true, area: true, projetoVersao: true },
    orderBy: (t, { asc }) => [asc(t.criadoEm)],
  });
  return rows.map(paraLinhaAta);
}

/** Linhas ativas de vários eventos numa consulta só (consolidação, formulário de solicitação). */
export async function montarLinhasAtaDeEventos(ex: Executor, eventoIds: string[]): Promise<Map<string, LinhaAtaRegistro[]>> {
  const mapa = new Map<string, LinhaAtaRegistro[]>(eventoIds.map((id) => [id, []]));
  if (eventoIds.length === 0) return mapa;
  const rows = await ex.query.eventoItens.findMany({
    where: and(inArray(eventoItens.eventoId, eventoIds), eq(eventoItens.ativo, true)),
    with: { projeto: true, peca: true, area: true, projetoVersao: true },
    orderBy: (t, { asc }) => [asc(t.criadoEm)],
  });
  for (const r of rows) mapa.get(r.eventoId)?.push(paraLinhaAta(r));
  return mapa;
}

export async function calcularOsAtual(ex: Executor, eventoId: string) {
  const linhas = await montarLinhasAta(ex, eventoId);
  return calcularOS(linhas);
}

/** Gera e persiste uma nova versão da OS (RN-05), já com o resumo do que mudou. */
export async function gerarOsVersao(ex: Executor, eventoId: string, gatilho: OsGatilho, usuarioId: string | null, descricao: string) {
  const conteudo = await calcularOsAtual(ex, eventoId);
  const [ultima] = await ex
    .select({ numero: osVersoes.numero, conteudo: osVersoes.conteudo })
    .from(osVersoes)
    .where(eq(osVersoes.eventoId, eventoId))
    .orderBy(desc(osVersoes.numero))
    .limit(1);
  // Resposta "não atendido", correção que só muda a observação, 10 → 10: a OS não mudou, não vale
  // uma versão nova. Marcos (ata fechada, encerramento, reabertura) sempre geram versão.
  const marco = gatilho === "ATA_FECHADA" || gatilho === "ENCERRAMENTO" || gatilho === "REABERTURA";
  if (ultima && !marco && osIguais(ultima.conteudo, conteudo)) return { ...ultima, nova: false as const };
  const numero = (ultima?.numero ?? 0) + 1;
  const resumo = resumoVersaoOs(ultima?.conteudo ?? null, conteudo);
  const [v] = await ex.insert(osVersoes).values({ eventoId, numero, gatilho, descricao, resumo, conteudo, geradaPorId: usuarioId }).returning();
  return { ...v, nova: true as const };
}

/** Todas as versões com o conteúdo completo (JSON). Prefira `listarOsResumo` quando só precisa da lista. */
export async function listarOsVersoes(eventoId: string) {
  const db = await getDb();
  return db.query.osVersoes.findMany({
    where: eq(osVersoes.eventoId, eventoId),
    with: { geradaPor: { columns: { id: true, nome: true } } },
    orderBy: (t, { desc }) => [desc(t.numero)],
  });
}

/** Lista de versões sem o JSON da OS: número, gatilho, autor, data e resumo. */
export async function listarOsResumo(eventoId: string) {
  const db = await getDb();
  return db.query.osVersoes.findMany({
    where: eq(osVersoes.eventoId, eventoId),
    columns: { conteudo: false },
    with: { geradaPor: { columns: { id: true, nome: true } } },
    orderBy: (t, { desc }) => [desc(t.numero)],
  });
}

/** Conteúdo só das versões pedidas. */
export async function obterConteudosOs(eventoId: string, numeros: number[]): Promise<Map<number, OsConteudo>> {
  const alvo = [...new Set(numeros.filter((n) => Number.isInteger(n) && n > 0))];
  if (alvo.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ numero: osVersoes.numero, conteudo: osVersoes.conteudo })
    .from(osVersoes)
    .where(and(eq(osVersoes.eventoId, eventoId), inArray(osVersoes.numero, alvo)));
  return new Map(rows.map((r) => [r.numero, r.conteudo]));
}

export async function numeroOsAtual(ex: Executor, eventoId: string): Promise<number> {
  const [r] = await ex
    .select({ v: sql<number | null>`max(${osVersoes.numero})` })
    .from(osVersoes)
    .where(eq(osVersoes.eventoId, eventoId));
  return Number(r?.v ?? 0);
}

/** OS calculada agora a partir da ata (prévia antes do fechamento; versão atual gravada sem as visões novas). */
export async function calcularOsAoVivo(eventoId: string) {
  return calcularOsAtual(await getDb(), eventoId);
}

/* ------------------------------------------------------------------ */
/* Envio para carregamento e complemento                                */
/* ------------------------------------------------------------------ */

/**
 * A logística marca a versão atual como "enviada para carregamento". A partir daí, tudo que
 * entrar ou mudar aparece como complemento: ela decide se manda só o complemento (exporta a
 * diferença) ou se incorpora, marcando a versão nova como a enviada.
 */
export async function marcarOsEnviada(usuario: UsuarioAtual, eventoId: string) {
  exigir(usuario, "ata.ajustar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, nome: true, status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status !== "ABERTO" && ev.status !== "ENCERRADO") throw new DomainError("A OS só pode ser enviada depois que a ata é fechada.");
    // A versão gravada pode estar atrás da ata (ajustes sem versão nova): garante que o que se marca é o que está valendo.
    const versao = await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, "Fechamento para envio ao carregamento");
    const [anterior] = await tx.select({ numero: osVersoes.numero }).from(osVersoes).where(and(eq(osVersoes.eventoId, eventoId), isNotNull(osVersoes.enviadaEm))).orderBy(desc(osVersoes.numero)).limit(1);
    if (anterior && anterior.numero === versao.numero) throw new DomainError(`A OS v${versao.numero} já é a versão enviada.`);
    await tx.update(osVersoes).set({ enviadaEm: new Date(), enviadaPorId: usuario.id }).where(and(eq(osVersoes.eventoId, eventoId), eq(osVersoes.numero, versao.numero)));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento",
      entidadeId: eventoId,
      acao: "OS_ENVIADA",
      descricao: anterior ? `OS v${versao.numero} enviada ao carregamento (incorpora o complemento desde a v${anterior.numero})` : `OS v${versao.numero} enviada ao carregamento`,
      usuarioId: usuario.id,
    });
    return { numero: versao.numero, incorporou: Boolean(anterior) };
  });
}

/** Última versão enviada ao carregamento e a diferença entre ela e a OS de agora (o "complemento"). */
export async function complementoOs(eventoId: string) {
  const db = await getDb();
  const enviada = await db.query.osVersoes.findFirst({
    where: and(eq(osVersoes.eventoId, eventoId), isNotNull(osVersoes.enviadaEm)),
    with: { enviadaPor: { columns: { id: true, nome: true } } },
    orderBy: (t, { desc }) => [desc(t.numero)],
  });
  if (!enviada) return null;
  const agora = await calcularOsAtual(db, eventoId);
  const diff = diffOS(enviada.conteudo, agora);
  return {
    numero: enviada.numero,
    enviadaEm: enviada.enviadaEm!,
    enviadaPor: enviada.enviadaPor?.nome ?? null,
    diff,
    /** Itens fora do catálogo que entraram depois do envio (não somam peças, mas embarcam). */
    avulsosNovos: agora.semSetor.filter((a) => !enviada.conteudo.semSetor.some((b) => b.descricao === a.descricao && b.quantidade === a.quantidade)),
  };
}
export type ComplementoOs = NonNullable<Awaited<ReturnType<typeof complementoOs>>>;
