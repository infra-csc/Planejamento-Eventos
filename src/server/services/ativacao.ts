import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { estoqueAnexos, estoqueItens, estoqueReformas, estoqueRetornos, eventoItens, eventos, historico, usuarios, type BomSnapshotLinha } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { INICIO_RETORNOS, podeGerenciarEstoque, problemaConclusao, problemaRetorno, situacaoItem, STATUS_COM_OS } from "@/domain/estoque";
import { apagarArquivo, gravarArquivo, inicioDoArquivo, lerArquivo } from "@/server/armazenamento";
import { detectarMimeAnexo } from "./projetos";
import { diaBrasilia, registrarHistorico, type Executor } from "./support";

/*
 * Módulo Ativação (27/10): o estoque da Ativação com saída pela OS, retorno manual e reformas.
 * - Saída: o item ligado a uma peça do catálogo sai com a OS do evento (ata fechada) a partir da montagem.
 * - Retorno: depois do evento a Ativação registra quantos voltaram bons, quantos foram para reforma e quantos se
 *   perderam; reforma e perdidos saem da quantidade em posse.
 * - Reforma: fica à parte até concluir; os consertados voltam à quantidade, os baixados saem de vez.
 */

function exigirAtivacao(usuario: UsuarioAtual) {
  if (!podeGerenciarEstoque(usuario)) throw new SemPermissaoError("O módulo é da Ativação e do administrador.");
}

type EventoComOs = { id: string; codigo: string; nome: string; dataMontagem: string; dataDesmontagem: string; status: string };
export type SaidaItem = { itemId: string; nome: string; levou: number };

/**
 * O que cada evento com OS leva de cada item do estoque ligado a uma peça (peça solta ou dentro de projeto), só
 * dos eventos que desmontam a partir de `INICIO_RETORNOS`. Item ligado à mesma peça que outro: o primeiro pelo nome.
 */
async function saidasPelaOs(ex: Executor, filtro: { eventoId?: string; itemId?: string } = {}) {
  const ligados = await ex
    .select({ id: estoqueItens.id, nome: estoqueItens.nome, pecaId: estoqueItens.pecaId })
    .from(estoqueItens)
    .where(and(eq(estoqueItens.ativo, true), sql`${estoqueItens.pecaId} is not null`, ...(filtro.itemId ? [eq(estoqueItens.id, filtro.itemId)] : [])))
    .orderBy(asc(estoqueItens.nome));
  const itemDaPeca = new Map<string, { id: string; nome: string }>();
  for (const l of ligados) if (l.pecaId && !itemDaPeca.has(l.pecaId)) itemDaPeca.set(l.pecaId, { id: l.id, nome: l.nome });
  if (!itemDaPeca.size) return [] as Array<{ evento: EventoComOs; itens: SaidaItem[] }>;

  const evs: EventoComOs[] = await ex
    .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, dataMontagem: eventos.dataMontagem, dataDesmontagem: eventos.dataDesmontagem, status: eventos.status })
    .from(eventos)
    .where(and(inArray(eventos.status, [...STATUS_COM_OS]), gte(eventos.dataDesmontagem, INICIO_RETORNOS), ...(filtro.eventoId ? [eq(eventos.id, filtro.eventoId)] : [])));
  if (!evs.length) return [];
  const linhas = await ex
    .select({ eventoId: eventoItens.eventoId, tipo: eventoItens.tipo, pecaId: eventoItens.pecaId, quantidade: eventoItens.quantidade, bom: eventoItens.bomSnapshot })
    .from(eventoItens)
    .where(and(eq(eventoItens.ativo, true), inArray(eventoItens.eventoId, evs.map((e) => e.id))));
  const porEvento = new Map<string, Map<string, SaidaItem>>();
  const somar = (eventoId: string, pecaId: string | null, q: number) => {
    const item = pecaId ? itemDaPeca.get(pecaId) : undefined;
    if (!item || q <= 0) return;
    const m = porEvento.get(eventoId) ?? new Map<string, SaidaItem>();
    const s = m.get(item.id) ?? { itemId: item.id, nome: item.nome, levou: 0 };
    s.levou += q;
    m.set(item.id, s);
    porEvento.set(eventoId, m);
  };
  for (const l of linhas) {
    if (l.tipo === "PECA") somar(l.eventoId, l.pecaId, l.quantidade);
    if (l.tipo === "PROJETO") for (const b of (l.bom as BomSnapshotLinha[] | null) ?? []) somar(l.eventoId, b.pecaId, b.quantidade * l.quantidade);
  }
  return evs
    .filter((e) => porEvento.has(e.id))
    .map((e) => ({ evento: e, itens: [...porEvento.get(e.id)!.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) }))
    .sort((a, b) => a.evento.dataMontagem.localeCompare(b.evento.dataMontagem) || a.evento.codigo.localeCompare(b.evento.codigo));
}

/** Por item: quanto está fora agora (saiu na montagem e não voltou) e quanto está em reforma. */
export async function situacaoDoEstoque(ex?: Executor) {
  const db = ex ?? (await getDb());
  const hoje = diaBrasilia();
  const [saidas, retornos, reformas] = await Promise.all([
    saidasPelaOs(db),
    db.select({ itemId: estoqueRetornos.itemId, eventoId: estoqueRetornos.eventoId }).from(estoqueRetornos),
    db
      .select({ itemId: estoqueReformas.itemId, n: sql<number>`sum(${estoqueReformas.quantidade})::int` })
      .from(estoqueReformas)
      .where(eq(estoqueReformas.status, "ABERTA"))
      .groupBy(estoqueReformas.itemId),
  ]);
  const voltou = new Set(retornos.map((r) => `${r.itemId}|${r.eventoId}`));
  const emEvento = new Map<string, number>();
  const reservado = new Map<string, number>();
  for (const s of saidas)
    for (const i of s.itens) {
      if (voltou.has(`${i.itemId}|${s.evento.id}`)) continue;
      const alvo = s.evento.dataMontagem <= hoje ? emEvento : reservado;
      alvo.set(i.itemId, (alvo.get(i.itemId) ?? 0) + i.levou);
    }
  return { emEvento, reservado, emReforma: new Map(reformas.map((r) => [r.itemId, Number(r.n)])) };
}

/* ------------------------------------------------------------------ */
/* Retornos                                                             */
/* ------------------------------------------------------------------ */

export type RetornoRegistrado = { voltaram: number; reforma: number; perdidos: number; observacao: string | null; em: string; por: string | null; reformaConcluida: boolean };

/** Eventos com OS que levam itens do estoque: os que já saíram primeiro (pendentes de retorno), depois os próximos. */
export async function listarRetornos(usuario: UsuarioAtual) {
  exigirAtivacao(usuario);
  const db = await getDb();
  const hoje = diaBrasilia();
  const saidas = await saidasPelaOs(db);
  const registrados = saidas.length
    ? await db
        .select({
          itemId: estoqueRetornos.itemId,
          eventoId: estoqueRetornos.eventoId,
          voltaram: estoqueRetornos.voltaram,
          reforma: estoqueRetornos.reforma,
          perdidos: estoqueRetornos.perdidos,
          observacao: estoqueRetornos.observacao,
          em: estoqueRetornos.atualizadoEm,
          por: usuarios.nome,
          reformaStatus: estoqueReformas.status,
        })
        .from(estoqueRetornos)
        .leftJoin(usuarios, eq(estoqueRetornos.registradoPorId, usuarios.id))
        .leftJoin(estoqueReformas, eq(estoqueRetornos.reformaId, estoqueReformas.id))
        .where(inArray(estoqueRetornos.eventoId, saidas.map((s) => s.evento.id)))
    : [];
  const deRetorno = new Map(registrados.map((r) => [`${r.itemId}|${r.eventoId}`, r]));
  const eventosLista = saidas.map((s) => {
    const itens = s.itens.map((i) => {
      const r = deRetorno.get(`${i.itemId}|${s.evento.id}`);
      const retorno: RetornoRegistrado | null = r ? { voltaram: r.voltaram, reforma: r.reforma, perdidos: r.perdidos, observacao: r.observacao, em: r.em.toISOString(), por: r.por, reformaConcluida: r.reformaStatus === "CONCLUIDA" } : null;
      return { ...i, retorno };
    });
    const saiu = s.evento.dataMontagem <= hoje;
    const completo = itens.every((i) => i.retorno);
    return { evento: s.evento, itens, saiu, situacao: completo ? ("registrado" as const) : saiu ? ("pendente" as const) : ("proximo" as const) };
  });
  const ordem = { pendente: 0, proximo: 1, registrado: 2 };
  return eventosLista.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || (a.situacao === "proximo" ? a.evento.dataMontagem.localeCompare(b.evento.dataMontagem) : b.evento.dataDesmontagem.localeCompare(a.evento.dataDesmontagem)));
}

export type EventoRetorno = Awaited<ReturnType<typeof listarRetornos>>[number];

/**
 * Registra (ou corrige) o retorno de um evento, item a item. Reforma e perdidos saem da quantidade em posse; a
 * reforma vira uma linha em Reformas (corrigir o retorno corrige a reforma enquanto ela não for concluída).
 */
export async function registrarRetorno(usuario: UsuarioAtual, eventoId: string, itens: ReadonlyArray<{ itemId: string; voltaram: number; reforma: number; perdidos: number; observacao?: string | null }>) {
  exigirAtivacao(usuario);
  if (!itens.length) throw new ValidacaoError("Informe ao menos um item.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [saida] = await saidasPelaOs(tx, { eventoId });
    if (!saida) throw new DomainError("Este evento não leva itens do estoque na OS (ou ainda não tem OS).");
    if (saida.evento.dataMontagem > diaBrasilia()) throw new DomainError(`Os itens só saem na montagem (${saida.evento.dataMontagem.split("-").reverse().join("/")}). Registre o retorno depois do evento.`);
    const feitos: string[] = [];
    for (const dados of itens) {
      const levou = saida.itens.find((i) => i.itemId === dados.itemId)?.levou;
      if (levou === undefined) throw new DomainError("Um dos itens não está na OS deste evento.");
      const observacao = dados.observacao?.trim() || null;
      const erro = problemaRetorno({ levou, voltaram: dados.voltaram, reforma: dados.reforma, perdidos: dados.perdidos, observacao });
      const item = await tx.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, dados.itemId) });
      if (!item) throw new NaoEncontradoError("Item do estoque");
      if (erro) throw new ValidacaoError(`${item.nome}: ${erro}`);
      const antes = await tx.query.estoqueRetornos.findFirst({ where: and(eq(estoqueRetornos.itemId, dados.itemId), eq(estoqueRetornos.eventoId, eventoId)) });
      const reformaAntes = antes?.reformaId ? await tx.query.estoqueReformas.findFirst({ where: eq(estoqueReformas.id, antes.reformaId) }) : null;
      if (reformaAntes?.status === "CONCLUIDA" && reformaAntes.quantidade !== dados.reforma) throw new DomainError(`${item.nome}: a reforma deste retorno já foi concluída; a quantidade em reforma não muda mais.`);
      // Só a diferença sai (ou volta) da quantidade em posse: corrigir um retorno não desconta duas vezes.
      const sai = dados.reforma + dados.perdidos - ((antes?.reforma ?? 0) + (antes?.perdidos ?? 0));
      if (item.quantidade - sai < 0) throw new ValidacaoError(`${item.nome}: o estoque tem ${item.quantidade} e o retorno tira ${sai}. Confira a quantidade do item antes.`);
      if (sai !== 0) await tx.update(estoqueItens).set({ quantidade: item.quantidade - sai, atualizadoPorId: usuario.id, atualizadoEm: new Date() }).where(eq(estoqueItens.id, item.id));

      let reformaId = reformaAntes?.id ?? null;
      const motivo = observacao ?? `Voltou do evento ${saida.evento.codigo}`;
      if (dados.reforma > 0 && !reformaAntes) {
        const [r] = await tx.insert(estoqueReformas).values({ itemId: item.id, eventoId, quantidade: dados.reforma, motivo, criadoPorId: usuario.id }).returning({ id: estoqueReformas.id });
        reformaId = r.id;
      } else if (dados.reforma > 0 && reformaAntes?.status === "ABERTA" && reformaAntes.quantidade !== dados.reforma) {
        await tx.update(estoqueReformas).set({ quantidade: dados.reforma, atualizadoEm: new Date() }).where(eq(estoqueReformas.id, reformaAntes.id));
      } else if (dados.reforma === 0 && reformaAntes?.status === "ABERTA") {
        await tx.delete(estoqueReformas).where(eq(estoqueReformas.id, reformaAntes.id));
        reformaId = null;
      }
      const valores = { levou, voltaram: dados.voltaram, reforma: dados.reforma, perdidos: dados.perdidos, observacao, reformaId, registradoPorId: usuario.id, atualizadoEm: new Date() };
      if (antes) await tx.update(estoqueRetornos).set(valores).where(eq(estoqueRetornos.id, antes.id));
      else await tx.insert(estoqueRetornos).values({ ...valores, itemId: item.id, eventoId });
      const partes = [`${dados.voltaram} voltaram`, dados.reforma ? `${dados.reforma} para reforma` : null, dados.perdidos ? `${dados.perdidos} perdidos` : null].filter(Boolean).join(", ");
      await registrarHistorico(tx, {
        eventoId,
        entidade: "estoque_item",
        entidadeId: item.id,
        acao: antes ? "ESTOQUE_RETORNO_CORRIGIDO" : "ESTOQUE_RETORNO",
        descricao: `Ativação · ${item.nome}: retorno do ${saida.evento.codigo} (levou ${levou}): ${partes}${observacao ? ` — ${observacao}` : ""}`,
        usuarioId: usuario.id,
        dadosAntes: antes ? { voltaram: antes.voltaram, reforma: antes.reforma, perdidos: antes.perdidos, quantidade: item.quantidade } : { quantidade: item.quantidade },
        dadosDepois: { voltaram: dados.voltaram, reforma: dados.reforma, perdidos: dados.perdidos, quantidade: item.quantidade - sai },
      });
      feitos.push(item.nome);
    }
    return { itens: feitos.length, evento: saida.evento.codigo };
  });
}

/* ------------------------------------------------------------------ */
/* Reformas                                                             */
/* ------------------------------------------------------------------ */

export async function listarReformas(usuario: UsuarioAtual) {
  exigirAtivacao(usuario);
  const db = await getDb();
  const rows = await db.query.estoqueReformas.findMany({
    with: { item: { columns: { id: true, nome: true, categoria: true } }, evento: { columns: { id: true, codigo: true, nome: true } }, anexos: { columns: { id: true, tipo: true, nomeArquivo: true } } },
    orderBy: [desc(estoqueReformas.criadoEm)],
  });
  return rows.map((r) => ({
    id: r.id,
    item: r.item,
    evento: r.evento,
    quantidade: r.quantidade,
    motivo: r.motivo,
    local: r.local,
    previsao: r.previsao,
    status: r.status,
    consertados: r.consertados,
    baixados: r.baixados,
    criadoEm: r.criadoEm.toISOString(),
    concluidaEm: r.concluidaEm ? r.concluidaEm.toISOString() : null,
    anexos: r.anexos,
  }));
}

export type ReformaTela = Awaited<ReturnType<typeof listarReformas>>[number];

const textoOuNull = (s: string | null | undefined, max: number) => s?.trim().slice(0, max) || null;
const dataOuNull = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** Separa itens do estoque para reforma (sem evento): saem da quantidade em posse até a reforma terminar. */
export async function abrirReforma(usuario: UsuarioAtual, dados: { itemId: string; quantidade: number; motivo?: string | null; local?: string | null; previsao?: string | null }) {
  exigirAtivacao(usuario);
  if (!Number.isInteger(dados.quantidade) || dados.quantidade <= 0) throw new ValidacaoError("Quantidade para reforma: um número inteiro maior que zero.", { quantidade: "Maior que zero." });
  const db = await getDb();
  return db.transaction(async (tx) => {
    const item = await tx.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, dados.itemId) });
    if (!item) throw new NaoEncontradoError("Item do estoque");
    if (dados.quantidade > item.quantidade) throw new ValidacaoError(`O estoque de ${item.nome} tem ${item.quantidade}.`, { quantidade: `No máximo ${item.quantidade}.` });
    const [r] = await tx
      .insert(estoqueReformas)
      .values({ itemId: item.id, quantidade: dados.quantidade, motivo: textoOuNull(dados.motivo, 500), local: textoOuNull(dados.local, 120), previsao: dataOuNull(dados.previsao), criadoPorId: usuario.id })
      .returning({ id: estoqueReformas.id });
    await tx.update(estoqueItens).set({ quantidade: item.quantidade - dados.quantidade, atualizadoPorId: usuario.id, atualizadoEm: new Date() }).where(eq(estoqueItens.id, item.id));
    await registrarHistorico(tx, {
      entidade: "estoque_item",
      entidadeId: item.id,
      acao: "ESTOQUE_REFORMA",
      descricao: `Ativação · ${item.nome}: ${dados.quantidade} para reforma${dados.motivo?.trim() ? ` — ${dados.motivo.trim()}` : ""}`,
      usuarioId: usuario.id,
      dadosAntes: { quantidade: item.quantidade },
      dadosDepois: { quantidade: item.quantidade - dados.quantidade, reforma: dados.quantidade },
    });
    return r;
  });
}

/** Motivo, onde está e previsão de uma reforma em andamento. */
export async function editarReforma(usuario: UsuarioAtual, id: string, dados: { motivo?: string | null; local?: string | null; previsao?: string | null }) {
  exigirAtivacao(usuario);
  const db = await getDb();
  const r = await db.query.estoqueReformas.findFirst({ where: eq(estoqueReformas.id, id) });
  if (!r) throw new NaoEncontradoError("Reforma");
  if (r.status !== "ABERTA") throw new DomainError("Reforma concluída não muda mais.");
  await db.update(estoqueReformas).set({ motivo: textoOuNull(dados.motivo, 500), local: textoOuNull(dados.local, 120), previsao: dataOuNull(dados.previsao), atualizadoEm: new Date() }).where(eq(estoqueReformas.id, id));
  return { id };
}

/** Conclui: consertados voltam à quantidade em posse; baixados saem de vez (quebrou, não tem conserto). */
export async function concluirReforma(usuario: UsuarioAtual, id: string, consertados: number, baixados: number) {
  exigirAtivacao(usuario);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const r = await tx.query.estoqueReformas.findFirst({ where: eq(estoqueReformas.id, id), with: { item: true } });
    if (!r) throw new NaoEncontradoError("Reforma");
    if (r.status !== "ABERTA") throw new DomainError("Esta reforma já foi concluída.");
    const erro = problemaConclusao(r.quantidade, consertados, baixados);
    if (erro) throw new ValidacaoError(erro);
    await tx.update(estoqueReformas).set({ status: "CONCLUIDA", consertados, baixados, concluidaEm: new Date(), concluidaPorId: usuario.id, atualizadoEm: new Date() }).where(eq(estoqueReformas.id, id));
    if (consertados > 0) await tx.update(estoqueItens).set({ quantidade: r.item.quantidade + consertados, atualizadoPorId: usuario.id, atualizadoEm: new Date() }).where(eq(estoqueItens.id, r.itemId));
    await registrarHistorico(tx, {
      eventoId: r.eventoId,
      entidade: "estoque_item",
      entidadeId: r.itemId,
      acao: "ESTOQUE_REFORMA_CONCLUIDA",
      descricao: `Ativação · ${r.item.nome}: reforma concluída — ${consertados} de volta ao estoque${baixados ? `, ${baixados} baixados` : ""}`,
      usuarioId: usuario.id,
      dadosAntes: { quantidade: r.item.quantidade },
      dadosDepois: { quantidade: r.item.quantidade + consertados, consertados, baixados },
    });
    return { id };
  });
}

/* ------------------------------------------------------------------ */
/* Detalhe do item                                                      */
/* ------------------------------------------------------------------ */

/** Tudo de um item: situação, fotos e anexos, eventos em que está (ou vai), retornos, reformas e histórico. */
export async function obterItemAtivacao(usuario: UsuarioAtual, itemId: string) {
  exigirAtivacao(usuario);
  const db = await getDb();
  const item = await db.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, itemId), with: { peca: { columns: { id: true, codigo: true, nome: true } } } });
  if (!item) throw new NaoEncontradoError("Item do estoque");
  const hoje = diaBrasilia();
  const [saidas, retornos, reformas, anexos, hist, sit] = await Promise.all([
    saidasPelaOs(db, { itemId }),
    db.query.estoqueRetornos.findMany({ where: eq(estoqueRetornos.itemId, itemId), with: { evento: { columns: { id: true, codigo: true, nome: true } }, registradoPor: { columns: { nome: true } } }, orderBy: [desc(estoqueRetornos.atualizadoEm)] }),
    db.query.estoqueReformas.findMany({ where: eq(estoqueReformas.itemId, itemId), with: { evento: { columns: { id: true, codigo: true, nome: true } } }, orderBy: [desc(estoqueReformas.criadoEm)] }),
    db.select({ id: estoqueAnexos.id, tipo: estoqueAnexos.tipo, nomeArquivo: estoqueAnexos.nomeArquivo, tamanho: estoqueAnexos.tamanho, reformaId: estoqueAnexos.reformaId }).from(estoqueAnexos).where(eq(estoqueAnexos.itemId, itemId)).orderBy(asc(estoqueAnexos.criadoEm)),
    db
      .select({ id: historico.id, descricao: historico.descricao, criadoEm: historico.criadoEm, por: usuarios.nome })
      .from(historico)
      .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
      .where(and(eq(historico.entidade, "estoque_item"), eq(historico.entidadeId, itemId)))
      .orderBy(desc(historico.criadoEm))
      .limit(30),
    situacaoDoEstoque(db),
  ]);
  const voltou = new Set(retornos.map((r) => r.eventoId));
  const eventosDoItem = saidas
    .map((s) => ({ evento: s.evento, levou: s.itens[0]?.levou ?? 0, retornou: voltou.has(s.evento.id), saiu: s.evento.dataMontagem <= hoje }))
    .filter((e) => !e.retornou);
  return {
    item: { id: item.id, nome: item.nome, categoria: item.categoria, quantidade: item.quantidade, comprar: item.comprar, observacao: item.observacao, ativo: item.ativo, peca: item.peca, pecaId: item.pecaId },
    situacao: { ...situacaoItem(item.quantidade, sit.emEvento.get(itemId) ?? 0, sit.emReforma.get(itemId) ?? 0), reservado: sit.reservado.get(itemId) ?? 0 },
    eventos: eventosDoItem,
    retornos: retornos.map((r) => ({ id: r.id, evento: r.evento, levou: r.levou, voltaram: r.voltaram, reforma: r.reforma, perdidos: r.perdidos, observacao: r.observacao, em: r.atualizadoEm.toISOString(), por: r.registradoPor?.nome ?? null })),
    reformas: reformas.map((r) => ({ id: r.id, evento: r.evento, quantidade: r.quantidade, motivo: r.motivo, local: r.local, previsao: r.previsao, status: r.status, consertados: r.consertados, baixados: r.baixados, criadoEm: r.criadoEm.toISOString() })),
    anexos,
    historico: hist.map((h) => ({ ...h, criadoEm: h.criadoEm.toISOString() })),
  };
}

export type ItemAtivacao = Awaited<ReturnType<typeof obterItemAtivacao>>;

/* ------------------------------------------------------------------ */
/* Fotos e anexos                                                       */
/* ------------------------------------------------------------------ */

const LIMITE_ANEXO = 8 * 1024 * 1024;
export const MAX_ANEXOS_ITEM = 30;
const LADO_MAX = 2000;

/** Foto (PNG, JPG, WEBP, reduzida e na orientação certa) ou PDF de um item; com `reformaId`, da reforma do item. */
export async function adicionarAnexoEstoque(usuario: UsuarioAtual, itemId: string, file: File, reformaId?: string | null) {
  exigirAtivacao(usuario);
  if (file.size === 0) throw new ValidacaoError("Arquivo vazio.");
  if (file.size > LIMITE_ANEXO) throw new ValidacaoError(`"${file.name}" passa de 8 MB.`);
  const original = Buffer.from(await file.arrayBuffer());
  const mime = detectarMimeAnexo(new Uint8Array(original));
  if (!mime) throw new ValidacaoError(`"${file.name}" não é foto (PNG, JPG, WEBP) nem PDF.`);
  const db = await getDb();
  const item = await db.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, itemId), columns: { id: true, nome: true } });
  if (!item) throw new NaoEncontradoError("Item do estoque");
  if (reformaId) {
    const r = await db.query.estoqueReformas.findFirst({ where: and(eq(estoqueReformas.id, reformaId), eq(estoqueReformas.itemId, itemId)), columns: { id: true } });
    if (!r) throw new NaoEncontradoError("Reforma");
  }
  const [{ n }] = await db.select({ n: count() }).from(estoqueAnexos).where(eq(estoqueAnexos.itemId, itemId));
  if (n >= MAX_ANEXOS_ITEM) throw new ValidacaoError(`O item já tem ${MAX_ANEXOS_ITEM} fotos e anexos. Remova algum antes de incluir outro.`);
  const pdf = mime === "application/pdf";
  const conteudo = pdf
    ? original
    : await sharp(original)
        .rotate()
        .resize({ width: LADO_MAX, height: LADO_MAX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer()
        .catch(() => {
          throw new ValidacaoError(`Não consegui ler a imagem "${file.name}". Envie outra foto.`);
        });
  const nome = pdf ? file.name.slice(0, 160) : file.name.replace(/\.[^.]+$/, "").slice(0, 150) + ".jpg";
  const valor = await gravarArquivo(`estoque/${itemId}/${randomUUID()}`, conteudo);
  try {
    const [a] = await db
      .insert(estoqueAnexos)
      .values({ itemId, reformaId: reformaId ?? null, tipo: pdf ? "PDF" : "IMAGEM", nomeArquivo: nome, mime: pdf ? mime : "image/jpeg", tamanho: conteudo.byteLength, conteudo: valor, criadoPorId: usuario.id })
      .returning({ id: estoqueAnexos.id });
    await registrarHistorico(db, { entidade: "estoque_item", entidadeId: itemId, acao: "ANEXO_ADICIONADO", descricao: `Ativação · ${item.nome}: ${pdf ? "anexo" : "foto"} "${nome}" incluído${reformaId ? " (reforma)" : ""}.`, usuarioId: usuario.id });
    return a;
  } catch (e) {
    if (valor !== conteudo) await apagarArquivo(valor);
    throw e;
  }
}

export async function removerAnexoEstoque(usuario: UsuarioAtual, anexoId: string) {
  exigirAtivacao(usuario);
  const db = await getDb();
  const [a] = await db.select({ id: estoqueAnexos.id, itemId: estoqueAnexos.itemId, nomeArquivo: estoqueAnexos.nomeArquivo, inicio: inicioDoArquivo(estoqueAnexos.conteudo) }).from(estoqueAnexos).where(eq(estoqueAnexos.id, anexoId));
  if (!a) throw new NaoEncontradoError("Anexo");
  await db.delete(estoqueAnexos).where(eq(estoqueAnexos.id, anexoId));
  await apagarArquivo(a.inicio);
  await registrarHistorico(db, { entidade: "estoque_item", entidadeId: a.itemId, acao: "ANEXO_REMOVIDO", descricao: `Ativação: anexo "${a.nomeArquivo}" removido.`, usuarioId: usuario.id });
  return a.itemId;
}

/** Metadados (sem o arquivo) e o arquivo. A foto também aparece na solicitação: quem pode ver o estoque nela vê a foto. */
export async function obterAnexoEstoqueMeta(usuario: UsuarioAtual, anexoId: string) {
  exigirAtivacao(usuario);
  const db = await getDb();
  const a = await db.query.estoqueAnexos.findFirst({ where: eq(estoqueAnexos.id, anexoId), columns: { conteudo: false } });
  if (!a) throw new NaoEncontradoError("Anexo");
  return a;
}

export async function obterAnexoEstoque(usuario: UsuarioAtual, anexoId: string) {
  exigirAtivacao(usuario);
  const db = await getDb();
  const a = await db.query.estoqueAnexos.findFirst({ where: eq(estoqueAnexos.id, anexoId) });
  if (!a) throw new NaoEncontradoError("Anexo");
  return { ...a, conteudo: await lerArquivo(a.conteudo) };
}

/** Primeira foto de cada item (capa da lista), sem ler os arquivos. */
export async function capasDosItens(itemIds: string[]) {
  if (!itemIds.length) return new Map<string, string>();
  const db = await getDb();
  const rows = await db
    .select({ itemId: estoqueAnexos.itemId, id: estoqueAnexos.id })
    .from(estoqueAnexos)
    .where(and(inArray(estoqueAnexos.itemId, itemIds), eq(estoqueAnexos.tipo, "IMAGEM"), sql`${estoqueAnexos.reformaId} is null`))
    .orderBy(asc(estoqueAnexos.criadoEm));
  const m = new Map<string, string>();
  for (const r of rows) if (!m.has(r.itemId)) m.set(r.itemId, r.id);
  return m;
}
