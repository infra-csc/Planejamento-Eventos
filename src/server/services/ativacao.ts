import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { estoqueAnexos, estoqueItens, estoqueReformas, estoqueRetornos, historico, usuarios } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { INICIO_RETORNOS, podeGerenciarEstoque, problemaConclusao, problemaRetorno, semDestinoNoRetorno, situacaoItem } from "@/domain/estoque";
import { apagarArquivo, gravarArquivo, inicioDoArquivo, lerArquivo } from "@/server/armazenamento";
import { detectarMimeAnexo } from "./projetos";
import { diaBrasilia, registrarHistorico } from "./support";
import { saidasPelaOs, situacaoCompletaDoEstoque, situacaoDoEstoque } from "./ativacao-situacao";

export { capasDosItens, situacaoDoEstoque, type SaidaItem } from "./ativacao-situacao";

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
      const faltam = semDestinoNoRetorno({ levou, ...dados });
      const partes = [`${dados.voltaram} ${dados.voltaram === 1 ? "voltou" : "voltaram"}`, dados.reforma ? `${dados.reforma} para reforma` : null, dados.perdidos ? `${dados.perdidos} ${dados.perdidos === 1 ? "perdido" : "perdidos"}` : null, faltam ? `${faltam} sem destino (contam como no galpão)` : null].filter(Boolean).join(", ");
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
    // "Em posse" inclui o que saiu com a OS e ainda não voltou: só o que está no galpão vai para reforma. Antes
    // dava para mandar as unidades de um evento em andamento, e o retorno delas falhava (auditoria 30/10, parte C N6).
    const emEvento = (await situacaoDoEstoque(tx, item.id)).emEvento.get(item.id) ?? 0;
    const noGalpao = Math.max(0, item.quantidade - emEvento);
    if (dados.quantidade > noGalpao) {
      const detalhe = emEvento ? ` (${emEvento} de ${item.quantidade} estão fora em evento)` : "";
      throw new ValidacaoError(`${item.nome}: há ${noGalpao} no galpão${detalhe}.`, { quantidade: `No máximo ${noGalpao}.` });
    }
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
  // Situação e eventos só deste item, com a mesma conta da lista do estoque: antes calculava o estoque inteiro e lia
  // as saídas de novo (auditoria 28/10, nº 45). Os eventos incluem o pedido com a ata aberta, que a aba "Em eventos"
  // da lista já contava e a página não mostrava (auditoria 30/10, parte C N25).
  const [sit, retornos, reformas, anexos, hist] = await Promise.all([
    situacaoCompletaDoEstoque(db, itemId),
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
  ]);
  const eventosDoItem = (sit.eventos.get(itemId) ?? []).map((e) => ({
    evento: { id: e.eventoId, codigo: e.codigo, nome: e.nome, dataMontagem: e.dataMontagem, dataDesmontagem: e.dataDesmontagem },
    levou: e.quantidade,
    situacao: e.situacao,
    saiu: e.situacao === "fora",
  }));
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

/* ------------------------------------------------------------------ */
/* Pedidos do item (janela "Ver pedidos" do estoque)                    */
/* ------------------------------------------------------------------ */

export type PedidoDoItem = {
  quantidade: number;
  destino: string | null;
  /** "solta" ou o nome do projeto que leva a peça (ex.: Stand 9×6 m × 2). */
  origem: string;
  solicitacao: { id: string; codigo: string; titulo: string | null; area: string; solicitante: string | null; enviadaEm: string | null } | null;
};

export type EventoComPedidos = {
  evento: { id: string; codigo: string; nome: string; dataMontagem: string; dataDesmontagem: string };
  situacao: "pedido" | "na OS" | "fora" | "devolvido";
  total: number;
  pedidos: PedidoDoItem[];
  /** Quando já voltou: o que a Ativação registrou no retorno. */
  retorno: { voltaram: number; reforma: number; perdidos: number; observacao: string | null; em: string } | null;
};

/**
 * De onde vem cada unidade do item nos eventos: a linha da ata que leva a peça ligada (solta ou dentro de projeto) e,
 * quando veio de um pedido, a solicitação (código, área, quem pediu, quando). Eventos desde `INICIO_RETORNOS`.
 */
export async function pedidosDoItem(usuario: UsuarioAtual, itemId: string): Promise<EventoComPedidos[]> {
  exigirAtivacao(usuario);
  const db = await getDb();
  const item = await db.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, itemId), columns: { pecaId: true } });
  if (!item) throw new NaoEncontradoError("Item do estoque");
  if (!item.pecaId) return [];
  const pecaId = item.pecaId;
  const hoje = diaBrasilia();
  const evs = await db.query.eventos.findMany({
    where: (e, { and: e_and, inArray: e_in, gte: e_gte }) => e_and(e_in(e.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO", "ENCERRADO"]), e_gte(e.dataDesmontagem, INICIO_RETORNOS)),
    columns: { id: true, codigo: true, nome: true, status: true, dataMontagem: true, dataDesmontagem: true },
  });
  if (!evs.length) return [];
  const linhas = await db.query.eventoItens.findMany({
    where: (l, { and: l_and, eq: l_eq, inArray: l_in }) => l_and(l_eq(l.ativo, true), l_in(l.eventoId, evs.map((e) => e.id))),
    columns: { id: true, eventoId: true, tipo: true, pecaId: true, quantidade: true, destino: true, bomSnapshot: true, solicitacaoItemId: true },
    with: { projeto: { columns: { nome: true } } },
  });
  const relevantes = linhas
    .map((l) => {
      if (l.tipo === "PECA" && l.pecaId === pecaId) return { l, quantidade: l.quantidade, origem: "solta" };
      const porUnidade = l.tipo === "PROJETO" ? (l.bomSnapshot ?? []).filter((b) => b.pecaId === pecaId).reduce((a, b) => a + b.quantidade, 0) : 0;
      return porUnidade > 0 ? { l, quantidade: porUnidade * l.quantidade, origem: `${l.projeto?.nome ?? "Projeto"} × ${l.quantidade}` } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x && x.quantidade > 0));
  if (!relevantes.length) return [];
  const itemIds = relevantes.map((r) => r.l.solicitacaoItemId).filter((x): x is string => Boolean(x));
  const origens = itemIds.length
    ? await db.query.solicitacaoItens.findMany({
        where: (si, { inArray: si_in }) => si_in(si.id, itemIds),
        columns: { id: true },
        with: { solicitacao: { columns: { id: true, codigo: true, titulo: true, enviadaEm: true }, with: { area: { columns: { nome: true } }, criadoPor: { columns: { nome: true } } } } },
      })
    : [];
  const origemDe = new Map(origens.map((o) => [o.id, o.solicitacao]));
  const retornos = await db
    .select({ eventoId: estoqueRetornos.eventoId, voltaram: estoqueRetornos.voltaram, reforma: estoqueRetornos.reforma, perdidos: estoqueRetornos.perdidos, observacao: estoqueRetornos.observacao, em: estoqueRetornos.atualizadoEm })
    .from(estoqueRetornos)
    .where(eq(estoqueRetornos.itemId, itemId));
  const retornoDe = new Map(retornos.map((r) => [r.eventoId, r]));

  const out: EventoComPedidos[] = [];
  for (const e of evs) {
    const doEvento = relevantes.filter((r) => r.l.eventoId === e.id);
    if (!doEvento.length) continue;
    const ataAberta = e.status === "PREPARACAO" || e.status === "EM_REUNIAO";
    const ret = retornoDe.get(e.id);
    const situacao: EventoComPedidos["situacao"] = ret ? "devolvido" : ataAberta ? "pedido" : e.dataMontagem > hoje ? "na OS" : "fora";
    out.push({
      evento: { id: e.id, codigo: e.codigo, nome: e.nome, dataMontagem: e.dataMontagem, dataDesmontagem: e.dataDesmontagem },
      situacao,
      retorno: ret ? { voltaram: ret.voltaram, reforma: ret.reforma, perdidos: ret.perdidos, observacao: ret.observacao, em: ret.em.toISOString() } : null,
      total: doEvento.reduce((a, r) => a + r.quantidade, 0),
      pedidos: doEvento.map((r) => {
        const s = r.l.solicitacaoItemId ? origemDe.get(r.l.solicitacaoItemId) : undefined;
        return {
          quantidade: r.quantidade,
          destino: r.l.destino,
          origem: r.origem,
          solicitacao: s ? { id: s.id, codigo: s.codigo, titulo: s.titulo, area: s.area.nome, solicitante: s.criadoPor?.nome ?? null, enviadaEm: s.enviadaEm ? s.enviadaEm.toISOString() : null } : null,
        };
      }),
    });
  }
  // Os que ainda estão em jogo primeiro (fora, na OS, pedido), por data de montagem; o histórico (devolvidos) do mais
  // recente para o mais antigo.
  const ordem = { fora: 0, "na OS": 1, pedido: 2, devolvido: 3 };
  return out.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || (a.situacao === "devolvido" ? b.evento.dataMontagem.localeCompare(a.evento.dataMontagem) : a.evento.dataMontagem.localeCompare(b.evento.dataMontagem)));
}
