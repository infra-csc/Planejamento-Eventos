import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, pecaAnexos, pecas, projetoGrupos, projetoItens, projetoVersoes, projetos, solicitacaoItens, solicitacoes, type Setor } from "@/server/db/schema";
import { normalizarGrupoProjeto } from "@/domain/grupos-projeto";
import { apagarArquivo, gravarArquivo, inicioDoArquivo, lerArquivo } from "@/server/armazenamento";
import { detectarMimeAnexo, resolverGrupoProjeto } from "./projetos";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { registrarHistorico, buscaSemAcento, type Executor } from "./support";
import { cacheDados, TAGS_DADOS } from "@/server/cache-dados";
import { STATUS_ABERTOS, STATUS_EDITAVEIS } from "@/domain/solicitacao";

export type DadosPeca = {
  codigo: string;
  nome: string;
  setor: Setor;
  familia: string;
  unidade: string;
  descricao: string | null;
  estoqueProprio: number;
  permiteEmProjeto: boolean;
  /** Aparece nas solicitações; ausente = não mexe (na criação, aparece). */
  disponivelEmSolicitacoes?: boolean;
  /** Prova para a qual a peça foi feita (nome livre, os mesmos grupos dos projetos); null = do galpão; ausente = não mexe. */
  grupoEvento?: string | null;
};

type FiltroPecas = { busca?: string; setor?: Setor | "TODOS"; incluirInativas?: boolean };

async function consultarPecas(filtro: FiltroPecas) {
  const db = await getDb();
  const conds = [];
  if (!filtro.incluirInativas) conds.push(eq(pecas.ativo, true));
  if (filtro.setor && filtro.setor !== "TODOS") conds.push(eq(pecas.setor, filtro.setor));
  if (filtro.busca) {
    const cond = buscaSemAcento([pecas.codigo, pecas.nome, pecas.familia], filtro.busca);
    if (cond) conds.push(cond);
  }
  const lista = await db.query.pecas.findMany({ where: conds.length ? and(...conds) : undefined, orderBy: [asc(pecas.setor), asc(pecas.codigo)], with: { grupo: { columns: { nome: true } } } });
  // Capa (primeira foto), quantas fotos e quantos PDFs cada peça tem, numa consulta só e sem ler os arquivos.
  const anexos = lista.length ? await db.select({ pecaId: pecaAnexos.pecaId, id: pecaAnexos.id, tipo: pecaAnexos.tipo }).from(pecaAnexos).where(inArray(pecaAnexos.pecaId, lista.map((p) => p.id))).orderBy(asc(pecaAnexos.criadoEm)) : [];
  const porPeca = new Map<string, { capaId: string | null; fotos: number; pdfs: number }>();
  for (const a of anexos) {
    const atual = porPeca.get(a.pecaId) ?? { capaId: null, fotos: 0, pdfs: 0 };
    if (a.tipo === "IMAGEM") porPeca.set(a.pecaId, { ...atual, capaId: atual.capaId ?? a.id, fotos: atual.fotos + 1 });
    else porPeca.set(a.pecaId, { ...atual, pdfs: atual.pdfs + 1 });
  }
  return lista.map(({ grupo, ...p }) => ({ ...p, prova: grupo?.nome ?? null, capaFotoId: porPeca.get(p.id)?.capaId ?? null, nFotos: porPeca.get(p.id)?.fotos ?? 0, nPdfs: porPeca.get(p.id)?.pdfs ?? 0 }));
}

/** Catálogo sem busca (a lista que quase toda tela pede): em cache até uma action mexer nas peças. */
const pecasEmCache = cacheDados(
  (setor: Setor | "TODOS" | null, incluirInativas: boolean) => consultarPecas({ setor: setor ?? undefined, incluirInativas }),
  "catalogo:pecas",
  [TAGS_DADOS.catalogo],
);

export async function listarPecas(usuario: UsuarioAtual, filtro: FiltroPecas = {}) {
  exigir(usuario, "catalogo.ver");
  // Busca livre vai sempre ao banco (cada termo viraria uma entrada de cache).
  if (filtro.busca) return consultarPecas(filtro);
  return pecasEmCache(filtro.setor ?? null, Boolean(filtro.incluirInativas));
}

export async function obterPeca(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "catalogo.ver");
  const db = await getDb();
  const p = await db.query.pecas.findFirst({ where: eq(pecas.id, id), with: { grupo: { columns: { nome: true } } } });
  if (!p) throw new NaoEncontradoError("Peça");
  const anexos = await db.select({ id: pecaAnexos.id, tipo: pecaAnexos.tipo, nomeArquivo: pecaAnexos.nomeArquivo, tamanho: pecaAnexos.tamanho }).from(pecaAnexos).where(eq(pecaAnexos.pecaId, id)).orderBy(asc(pecaAnexos.criadoEm));
  // projetos ativos que usam a peça (na versão atual)
  const usos = await db
    .select({ id: projetos.id, nome: projetos.nome, codigo: projetos.codigo, quantidade: projetoItens.quantidade })
    .from(projetoItens)
    .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
    .innerJoin(projetos, and(eq(projetoVersoes.projetoId, projetos.id), eq(projetoVersoes.numero, projetos.versaoAtual)))
    .where(and(eq(projetoItens.pecaId, id), eq(projetos.ativo, true)));
  const { grupo, ...resto } = p;
  return { ...resto, prova: grupo?.nome ?? null, anexos, usos };
}

async function validarCodigoUnico(id: string | null, codigo: string, ex?: Executor) {
  const db = ex ?? (await getDb());
  const [dup] = await db
    .select({ id: pecas.id })
    .from(pecas)
    .where(sql`upper(${pecas.codigo}) = ${codigo.toUpperCase()}`)
    .limit(1);
  if (dup && dup.id !== id) throw new ValidacaoError("Já existe uma peça com este código.", { codigo: "Código em uso." });
}

export async function criarPeca(usuario: UsuarioAtual, dados: DadosPeca) {
  const db = await getDb();
  return db.transaction((tx) => criarPecaNaTransacao(tx, usuario, dados));
}

/** Cadastra a peça dentro de uma transação já aberta (ex.: vincular item fora do catálogo a uma peça nova). */
export async function criarPecaNaTransacao(ex: Executor, usuario: UsuarioAtual, dados: DadosPeca) {
  exigir(usuario, "catalogo.gerenciar");
  normalizarGrupoProjeto(dados.grupoEvento);
  await validarCodigoUnico(null, dados.codigo, ex);
  const { grupoEvento, ...campos } = dados;
  const grupoId = await resolverGrupoProjeto(ex, usuario, grupoEvento);
  const [p] = await ex.insert(pecas).values({ ...campos, grupoId, criadoPorId: usuario.id }).returning();
  await registrarHistorico(ex, { entidade: "peca", entidadeId: p.id, acao: "CRIADA", descricao: `Peça ${p.codigo} · ${p.nome} criada.`, usuarioId: usuario.id, dadosDepois: dados });
  return p;
}

export async function editarPeca(usuario: UsuarioAtual, id: string, dados: DadosPeca) {
  exigir(usuario, "catalogo.gerenciar");
  normalizarGrupoProjeto(dados.grupoEvento);
  await validarCodigoUnico(id, dados.codigo);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const atual = await tx.query.pecas.findFirst({ where: eq(pecas.id, id), with: { grupo: { columns: { nome: true } } } });
    if (!atual) throw new NaoEncontradoError("Peça");
    const { grupoEvento, ...campos } = dados;
    const grupoId = grupoEvento === undefined ? atual.grupoId : await resolverGrupoProjeto(tx, usuario, grupoEvento);
    const [p] = await tx.update(pecas).set({ ...campos, grupoId }).where(eq(pecas.id, id)).returning();
    const antes: Record<string, unknown> = {};
    const depois: Record<string, unknown> = {};
    for (const k of Object.keys(campos) as (keyof typeof campos)[]) {
      if (atual[k] !== campos[k]) {
        antes[k] = atual[k];
        depois[k] = campos[k];
      }
    }
    if (grupoId !== atual.grupoId) {
      antes.prova = atual.grupo?.nome ?? "galpão";
      depois.prova = grupoId ? ((await tx.query.projetoGrupos.findFirst({ where: eq(projetoGrupos.id, grupoId), columns: { nome: true } }))?.nome ?? "") : "galpão";
    }
    if (Object.keys(depois).length) {
      await registrarHistorico(tx, { entidade: "peca", entidadeId: id, acao: "EDITADA", descricao: `Peça ${p.codigo} alterada (${Object.keys(depois).join(", ")}).`, usuarioId: usuario.id, dadosAntes: antes, dadosDepois: depois });
    }
    return p;
  });
}

export async function alterarAtivoPeca(usuario: UsuarioAtual, id: string, ativo: boolean) {
  exigir(usuario, "catalogo.gerenciar");
  const peca = await obterPeca(usuario, id);
  if (!ativo && peca.usos.length > 0) {
    // "lista de peças" e plural de verdade, no lugar de "BOM de 2 projeto(s) ativo(s)" (auditoria 28/10, nº 73).
    throw new DomainError(`A peça está na lista de peças de ${peca.usos.length === 1 ? "1 projeto ativo" : `${peca.usos.length} projetos ativos`}: ${peca.usos.map((u) => u.nome).join(", ")}. Tire a peça desses projetos antes de inativá-la.`);
  }
  const db = await getDb();
  await db.update(pecas).set({ ativo }).where(eq(pecas.id, id));
  await registrarHistorico(db, { entidade: "peca", entidadeId: id, acao: ativo ? "REATIVADA" : "INATIVADA", descricao: `Peça ${peca.codigo} ${ativo ? "reativada" : "inativada"}.`, usuarioId: usuario.id });
}

/**
 * O que a inativação da peça atinge, para a tela confirmar antes: projetos ativos que a usam na versão
 * atual (bloqueiam — regra de `alterarAtivoPeca`) e pedidos em aberto que a citam (só aviso: solicitações
 * ainda não respondidas e atas de eventos em andamento). O que já foi pedido continua valendo; a peça só
 * deixa de aparecer nas escolhas novas.
 */
export async function impactoInativacaoPeca(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "catalogo.gerenciar");
  const peca = await obterPeca(usuario, id);
  const db = await getDb();
  const [sols, atas] = await Promise.all([
    db
      .selectDistinct({ id: solicitacoes.id, codigo: solicitacoes.codigo, status: solicitacoes.status, eventoNome: eventos.nome })
      .from(solicitacaoItens)
      .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
      .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
      .where(and(eq(solicitacaoItens.pecaId, id), eq(solicitacoes.excluida, false), inArray(solicitacoes.status, [...STATUS_EDITAVEIS, ...STATUS_ABERTOS]), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"])))
      .orderBy(asc(solicitacoes.codigo)),
    db
      .selectDistinct({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome })
      .from(eventoItens)
      .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
      .where(and(eq(eventoItens.pecaId, id), eq(eventoItens.tipo, "PECA"), eq(eventoItens.ativo, true), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"])))
      .orderBy(asc(eventos.codigo)),
  ]);
  const pedidos = [
    ...atas.map((e) => ({ href: `/eventos/${e.id}/ata`, rotulo: `${e.codigo} · ${e.nome}`, detalhe: "na ata do evento" })),
    ...sols.map((s) => ({ href: `/solicitacoes/${s.id}`, rotulo: `${s.codigo} · ${s.eventoNome}`, detalhe: s.status === "RASCUNHO" ? "rascunho" : s.status === "DEVOLVIDA" ? "devolvida para ajuste" : "aguardando resposta" })),
  ];
  return {
    peca: { id: peca.id, codigo: peca.codigo, nome: peca.nome, ativo: peca.ativo },
    projetos: peca.usos.map((u) => ({ href: `/biblioteca?p=${u.id}`, rotulo: `${u.codigo} · ${u.nome}`, detalhe: `${u.quantidade} por unidade` })),
    pedidos,
  };
}

export type ImpactoInativacaoPeca = Awaited<ReturnType<typeof impactoInativacaoPeca>>;

/** Em quantos projetos ativos (versão atual) cada peça aparece — coluna "Em BOM" do catálogo. */
const pecasEmBomEmCache = cacheDados(
  async () => {
    const db = await getDb();
    return db
      .select({ pecaId: projetoItens.pecaId })
      .from(projetoItens)
      .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
      .innerJoin(projetos, and(eq(projetoVersoes.projetoId, projetos.id), eq(projetoVersoes.numero, projetos.versaoAtual)))
      .where(eq(projetos.ativo, true));
  },
  "catalogo:pecas-em-bom",
  [TAGS_DADOS.projetos],
);

export async function contarPecasEmBom() {
  const rows = await pecasEmBomEmCache();
  const mapa = new Map<string, number>();
  for (const r of rows) mapa.set(r.pecaId, (mapa.get(r.pecaId) ?? 0) + 1);
  return mapa;
}

/* ------------------------------------------------------------------ */
/* Fotos e anexos da peça                                               */
/* ------------------------------------------------------------------ */

const LIMITE_ANEXO_PECA = 8 * 1024 * 1024;
export const MAX_ANEXOS_PECA = 20;
/** Lado maior gravado: foto de celular (4000 px, 5 MB) vira ~2000 px e algumas centenas de KB. */
const LADO_MAX = 2000;

/**
 * Inclui uma foto (PNG, JPG ou WEBP) ou um PDF, conferidos pelo conteúdo do arquivo (não pela extensão).
 * Foto é gravada reduzida e já na orientação certa; PDF, como veio.
 */
export async function adicionarAnexoPeca(usuario: UsuarioAtual, pecaId: string, file: File) {
  exigir(usuario, "catalogo.gerenciar");
  if (file.size === 0) throw new ValidacaoError("Arquivo vazio.");
  if (file.size > LIMITE_ANEXO_PECA) throw new ValidacaoError(`“${file.name}” passa de 8 MB.`);
  const original = Buffer.from(await file.arrayBuffer());
  const mime = detectarMimeAnexo(new Uint8Array(original));
  if (!mime) throw new ValidacaoError(`“${file.name}” não é foto (PNG, JPG, WEBP) nem PDF.`);
  const db = await getDb();
  const p = await db.query.pecas.findFirst({ where: eq(pecas.id, pecaId), columns: { id: true, codigo: true } });
  if (!p) throw new NaoEncontradoError("Peça");
  const [{ n }] = await db.select({ n: count() }).from(pecaAnexos).where(eq(pecaAnexos.pecaId, pecaId));
  if (n >= MAX_ANEXOS_PECA) throw new ValidacaoError(`A peça já tem ${MAX_ANEXOS_PECA} fotos e anexos. Remova algum antes de incluir outro.`);
  const pdf = mime === "application/pdf";
  const conteudo = pdf
    ? original
    : await sharp(original)
        .rotate()
        .resize({ width: LADO_MAX, height: LADO_MAX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer()
        .catch(() => {
          throw new ValidacaoError(`Não foi possível ler a imagem “${file.name}”. Envie outra foto.`);
        });
  const nome = pdf ? file.name.slice(0, 160) : file.name.replace(/\.[^.]+$/, "").slice(0, 150) + ".jpg";
  const valor = await gravarArquivo(`pecas/${pecaId}/${randomUUID()}`, conteudo);
  try {
    const [a] = await db
      .insert(pecaAnexos)
      .values({ pecaId, tipo: pdf ? "PDF" : "IMAGEM", nomeArquivo: nome, mime: pdf ? mime : "image/jpeg", tamanho: conteudo.byteLength, conteudo: valor, criadoPorId: usuario.id })
      .returning({ id: pecaAnexos.id });
    await registrarHistorico(db, { entidade: "peca", entidadeId: pecaId, acao: "ANEXO_ADICIONADO", descricao: `Peça ${p.codigo}: ${pdf ? `anexo “${nome}” incluído` : `foto “${nome}” incluída`}.`, usuarioId: usuario.id });
    return a;
  } catch (e) {
    if (valor !== conteudo) await apagarArquivo(valor);
    throw e;
  }
}

export async function removerAnexoPeca(usuario: UsuarioAtual, anexoId: string) {
  exigir(usuario, "catalogo.gerenciar");
  const db = await getDb();
  const [a] = await db.select({ id: pecaAnexos.id, pecaId: pecaAnexos.pecaId, nomeArquivo: pecaAnexos.nomeArquivo, inicio: inicioDoArquivo(pecaAnexos.conteudo) }).from(pecaAnexos).where(eq(pecaAnexos.id, anexoId));
  if (!a) throw new NaoEncontradoError("Anexo");
  await db.delete(pecaAnexos).where(eq(pecaAnexos.id, anexoId));
  await apagarArquivo(a.inicio);
  await registrarHistorico(db, { entidade: "peca", entidadeId: a.pecaId, acao: "ANEXO_REMOVIDO", descricao: `Anexo “${a.nomeArquivo}” removido.`, usuarioId: usuario.id });
  return a.pecaId;
}

/** Metadados do anexo, sem o arquivo (para responder 304 sem ler o conteúdo). */
export async function obterAnexoPecaMeta(usuario: UsuarioAtual, anexoId: string) {
  exigir(usuario, "catalogo.ver");
  const db = await getDb();
  const a = await db.query.pecaAnexos.findFirst({ where: eq(pecaAnexos.id, anexoId), columns: { conteudo: false } });
  if (!a) throw new NaoEncontradoError("Anexo");
  return a;
}

export async function obterAnexoPeca(usuario: UsuarioAtual, anexoId: string) {
  exigir(usuario, "catalogo.ver");
  const db = await getDb();
  const a = await db.query.pecaAnexos.findFirst({ where: eq(pecaAnexos.id, anexoId) });
  if (!a) throw new NaoEncontradoError("Anexo");
  return { ...a, conteudo: await lerArquivo(a.conteudo) };
}
