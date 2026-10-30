import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { anexos, eventoItens, eventos, historico, pecas, projetoGrupos, projetoItens, projetoVersoes, projetos, type AnexoTipo } from "@/server/db/schema";
import { normalizarGrupoProjeto } from "@/domain/grupos-projeto";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { notificar, proximoCodigo, registrarHistorico, usuariosLogistica, buscaSemAcento, type Executor } from "./support";
import { cacheDados, TAGS_DADOS } from "@/server/cache-dados";
import { apagarArquivo, gravarArquivo, inicioDoArquivo, lerArquivo } from "@/server/armazenamento";

export type DadosProjeto = {
  nome: string;
  /** Nome livre; null = Padrão, ausente = preservar na edição. Não restringe eventos. */
  grupoEvento?: string | null;
  categoria: string;
  descricao: string | null;
  observacaoVersao: string | null;
  /** Ausente = não mexe (edição) / true (criação). */
  disponivelEmSolicitacoes?: boolean;
  itens: Array<{ pecaId: string; quantidade: number }>;
};

type FiltroProjetos = { busca?: string; incluirInativos?: boolean };

export async function listarGruposProjetos(usuario: UsuarioAtual) {
  exigir(usuario, "projeto.ver");
  const db = await getDb();
  return db.select({ id: projetoGrupos.id, nome: projetoGrupos.nome }).from(projetoGrupos).orderBy(asc(projetoGrupos.nome));
}

/** Grupos com quantos projetos e peças (ativos ou não) estão em cada um: tela de gerenciar grupos. */
export async function listarGruposComUso(usuario: UsuarioAtual) {
  exigir(usuario, "projeto.gerenciar");
  const db = await getDb();
  const [grupos, proj, pcs] = await Promise.all([
    db.select({ id: projetoGrupos.id, nome: projetoGrupos.nome }).from(projetoGrupos).orderBy(asc(projetoGrupos.nome)),
    db.select({ grupoId: projetos.grupoId, n: sql<number>`count(*)::int` }).from(projetos).where(isNotNull(projetos.grupoId)).groupBy(projetos.grupoId),
    db.select({ grupoId: pecas.grupoId, n: sql<number>`count(*)::int` }).from(pecas).where(isNotNull(pecas.grupoId)).groupBy(pecas.grupoId),
  ]);
  return grupos.map((g) => ({ ...g, projetos: Number(proj.find((p) => p.grupoId === g.id)?.n ?? 0), pecas: Number(pcs.find((p) => p.grupoId === g.id)?.n ?? 0) }));
}

/**
 * Exclui um grupo de prova: os projetos e as peças dele passam para Padrão (sem grupo); nada mais é apagado.
 * Fica no histórico com o que foi movido.
 */
export async function excluirGrupoProjeto(usuario: UsuarioAtual, grupoId: string) {
  exigir(usuario, "projeto.gerenciar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const g = await tx.query.projetoGrupos.findFirst({ where: eq(projetoGrupos.id, grupoId) });
    if (!g) throw new NaoEncontradoError("Grupo");
    const movidosProj = await tx.update(projetos).set({ grupoId: null }).where(eq(projetos.grupoId, grupoId)).returning({ codigo: projetos.codigo });
    const movidasPecas = await tx.update(pecas).set({ grupoId: null }).where(eq(pecas.grupoId, grupoId)).returning({ codigo: pecas.codigo });
    await tx.delete(projetoGrupos).where(eq(projetoGrupos.id, grupoId));
    await registrarHistorico(tx, {
      entidade: "projeto_grupo",
      entidadeId: grupoId,
      acao: "GRUPO_EXCLUIDO",
      descricao: `Grupo “${g.nome}” excluído: ${movidosProj.length} ${movidosProj.length === 1 ? "projeto" : "projetos"} e ${movidasPecas.length} ${movidasPecas.length === 1 ? "peça" : "peças"} passaram para Padrão.`,
      usuarioId: usuario.id,
      dadosAntes: { nome: g.nome, projetos: movidosProj.map((p) => p.codigo), pecas: movidasPecas.map((p) => p.codigo) },
    });
    return { nome: g.nome, projetos: movidosProj.length, pecas: movidasPecas.length };
  });
}

type ProjetoTx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

export async function resolverGrupoProjeto(tx: ProjetoTx | Executor, usuario: UsuarioAtual, nome: string | null | undefined) {
  const grupo = normalizarGrupoProjeto(nome);
  if (!grupo) return null;
  const [criado] = await tx.insert(projetoGrupos).values({ ...grupo, criadoPorId: usuario.id })
    .onConflictDoNothing({ target: projetoGrupos.nomeNormalizado }).returning({ id: projetoGrupos.id });
  if (criado) return criado.id;
  const existente = await tx.query.projetoGrupos.findFirst({ where: eq(projetoGrupos.nomeNormalizado, grupo.nomeNormalizado) });
  if (!existente) throw new ValidacaoError("Não foi possível selecionar o grupo. Tente novamente.");
  return existente.id;
}

export async function listarProjetos(usuario: UsuarioAtual, filtro: FiltroProjetos = {}) {
  exigir(usuario, "projeto.ver");
  // Busca livre vai sempre ao banco; a lista sem busca fica em cache até uma action mexer nos projetos.
  if (filtro.busca) return consultarProjetos(filtro);
  return projetosEmCache(Boolean(filtro.incluirInativos));
}

const projetosEmCache = cacheDados((incluirInativos: boolean) => consultarProjetos({ incluirInativos }), "projetos:lista:grupos", [TAGS_DADOS.projetos]);

async function consultarProjetos(filtro: FiltroProjetos) {
  const db = await getDb();
  const conds = [];
  if (!filtro.incluirInativos) conds.push(eq(projetos.ativo, true));
  if (filtro.busca) {
    const cond = buscaSemAcento([projetos.nome, projetos.codigo, projetos.categoria], filtro.busca);
    if (cond) conds.push(cond);
  }
  const rows = await db.query.projetos.findMany({
    where: conds.length ? and(...conds) : undefined,
    with: { grupo: { columns: { id: true, nome: true } }, anexos: { columns: { id: true, tipo: true, nomeArquivo: true, mime: true } } },
    orderBy: [asc(projetos.categoria), asc(projetos.nome)],
  });
  // Totais só da versão atual de cada projeto, agregados no banco (antes: todas as versões com itens).
  const totais = rows.length
    ? await db
        .select({ projetoId: projetoVersoes.projetoId, total: sql<number>`coalesce(sum(${projetoItens.quantidade}), 0)`, tipos: sql<number>`count(${projetoItens.id})` })
        .from(projetoVersoes)
        .innerJoin(projetos, and(eq(projetos.id, projetoVersoes.projetoId), eq(projetos.versaoAtual, projetoVersoes.numero)))
        .leftJoin(projetoItens, eq(projetoItens.versaoId, projetoVersoes.id))
        .where(
          inArray(
            projetoVersoes.projetoId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(projetoVersoes.projetoId)
    : [];
  const porProjeto = new Map(totais.map((t) => [t.projetoId, t]));
  return rows.map((r) => ({
    ...r,
    totalPecas: Number(porProjeto.get(r.id)?.total ?? 0),
    tiposPeca: Number(porProjeto.get(r.id)?.tipos ?? 0),
    capa: r.anexos.find((a) => a.tipo === "IMAGEM") ?? null,
  }));
}

export async function obterProjeto(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "projeto.ver");
  const db = await getDb();
  // O projeto e os usos em eventos só se cruzam em memória (versão atual): as duas consultas vão juntas.
  const [p, usosDefasados] = await Promise.all([
    db.query.projetos.findFirst({
      where: eq(projetos.id, id),
      with: {
        grupo: { columns: { id: true, nome: true } },
        criadoPor: { columns: { id: true, nome: true } },
        anexos: { columns: { id: true, tipo: true, nomeArquivo: true, mime: true, tamanho: true, criadoEm: true }, orderBy: [asc(anexos.criadoEm)] },
        // Só o que as telas mostram da peça (código, nome, setor, unidade, situação): antes ia a peça inteira em cada
        // linha de cada versão (auditoria 28/10, nº 146).
        versoes: { with: { itens: { with: { peca: { columns: { id: true, codigo: true, nome: true, setor: true, unidade: true, ativo: true } } } }, criadoPor: { columns: { id: true, nome: true } } }, orderBy: [desc(projetoVersoes.numero)] },
      },
    }),
    // eventos não encerrados que usam versões antigas (MEL-02)
    db
      .select({ eventoId: eventos.id, codigo: eventos.codigo, nome: eventos.nome, versao: projetoVersoes.numero })
      .from(eventoItens)
      .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
      .innerJoin(projetoVersoes, eq(eventoItens.projetoVersaoId, projetoVersoes.id))
      .where(and(eq(eventoItens.projetoId, id), eq(eventoItens.ativo, true), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"]))),
  ]);
  if (!p) throw new NaoEncontradoError("Projeto padrão");
  const atual = p.versoes.find((v) => v.numero === p.versaoAtual) ?? p.versoes[0];
  return { ...p, versaoAtualObj: atual, usosDefasados: usosDefasados.filter((u) => u.versao < p.versaoAtual) };
}

async function validarItens(itens: DadosProjeto["itens"]) {
  if (itens.length === 0) throw new ValidacaoError("Adicione ao menos uma peça à lista de peças.");
  const ids = itens.map((i) => i.pecaId);
  if (new Set(ids).size !== ids.length) throw new ValidacaoError("Há peças repetidas na lista. Some as quantidades em uma linha só.");
  const db = await getDb();
  const rows = await db.query.pecas.findMany({ where: inArray(pecas.id, ids) });
  for (const i of itens) {
    const p = rows.find((r) => r.id === i.pecaId);
    // Diz qual peça: a mensagem genérica deixava a pessoa procurando a linha (auditoria 30/10, parte C N8).
    if (!p) throw new ValidacaoError("Uma das peças da lista não existe mais no catálogo. Remova a linha e salve de novo.", { itens: "Uma peça da lista não existe mais no catálogo." });
    if (!p.ativo) throw new ValidacaoError(`A peça ${p.codigo} (${p.nome}) está inativa no catálogo. Remova-a da lista ou reative a peça.`, { itens: `${p.codigo} (${p.nome}) está inativa no catálogo.` });
    // Sem "BOM": o app chama de lista de peças (auditoria 28/10, nº 73).
    if (!p.permiteEmProjeto) throw new ValidacaoError(`“${p.nome}” não entra na lista de peças de projeto: é sempre pedida solta, com destino.`);
    if (!Number.isInteger(i.quantidade) || i.quantidade <= 0) throw new ValidacaoError("Quantidades devem ser inteiros maiores que zero.");
  }
}

/** Dois projetos ativos com o mesmo nome confundem quem pede e o importador do catálogo (que acha pelo nome). */
async function exigirNomeUnico(nome: string, ignorarId?: string) {
  const db = await getDb();
  const [dup] = await db
    .select({ id: projetos.id, codigo: projetos.codigo })
    .from(projetos)
    .where(and(sql`lower(${projetos.nome}) = ${nome.trim().toLowerCase()}`, eq(projetos.ativo, true), ...(ignorarId ? [ne(projetos.id, ignorarId)] : [])))
    .limit(1);
  if (dup) throw new ValidacaoError(`Já existe um projeto ativo com este nome (${dup.codigo}).`, { nome: `Já existe: ${dup.codigo}. Se é uma variação, diga no nome o que muda.` });
}

export async function criarProjeto(usuario: UsuarioAtual, dados: DadosProjeto) {
  exigir(usuario, "projeto.gerenciar");
  normalizarGrupoProjeto(dados.grupoEvento);
  await validarItens(dados.itens);
  await exigirNomeUnico(dados.nome);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const codigo = await proximoCodigo(tx, "projeto");
    const grupoId = await resolverGrupoProjeto(tx, usuario, dados.grupoEvento);
    const [p] = await tx.insert(projetos).values({ codigo, nome: dados.nome, categoria: dados.categoria, descricao: dados.descricao, grupoId, versaoAtual: 1, disponivelEmSolicitacoes: dados.disponivelEmSolicitacoes ?? true, criadoPorId: usuario.id }).returning();
    const [v] = await tx.insert(projetoVersoes).values({ projetoId: p.id, numero: 1, observacao: dados.observacaoVersao ?? "Versão inicial", criadoPorId: usuario.id }).returning();
    await tx.insert(projetoItens).values(dados.itens.map((i) => ({ versaoId: v.id, pecaId: i.pecaId, quantidade: i.quantidade })));
    await registrarHistorico(tx, { entidade: "projeto", entidadeId: p.id, acao: "CRIADO", descricao: `Projeto ${p.codigo} · ${p.nome} criado (v1, ${dados.itens.length} peças).`, usuarioId: usuario.id, dadosDepois: dados });
    return p;
  });
}

export async function editarProjeto(usuario: UsuarioAtual, id: string, dados: DadosProjeto) {
  exigir(usuario, "projeto.gerenciar");
  normalizarGrupoProjeto(dados.grupoEvento);
  await validarItens(dados.itens);
  await exigirNomeUnico(dados.nome, id);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const p = await tx.query.projetos.findFirst({ where: eq(projetos.id, id), with: { versoes: { with: { itens: true } } } });
    if (!p) throw new NaoEncontradoError("Projeto padrão");
    const grupoId = dados.grupoEvento === undefined ? p.grupoId : await resolverGrupoProjeto(tx, usuario, dados.grupoEvento);
    const atual = p.versoes.find((v) => v.numero === p.versaoAtual)!;
    const chave = (itens: Array<{ pecaId: string; quantidade: number }>) =>
      itens
        .map((i) => `${i.pecaId}:${i.quantidade}`)
        .sort()
        .join("|");
    const bomMudou = chave(atual.itens) !== chave(dados.itens);
    let novaVersao = p.versaoAtual;
    if (bomMudou) {
      novaVersao = p.versaoAtual + 1;
      const [v] = await tx.insert(projetoVersoes).values({ projetoId: id, numero: novaVersao, observacao: dados.observacaoVersao, criadoPorId: usuario.id }).returning();
      await tx.insert(projetoItens).values(dados.itens.map((i) => ({ versaoId: v.id, pecaId: i.pecaId, quantidade: i.quantidade })));
    }
    await tx.update(projetos).set({ nome: dados.nome, categoria: dados.categoria, descricao: dados.descricao, grupoId, versaoAtual: novaVersao, ...(dados.disponivelEmSolicitacoes === undefined ? {} : { disponivelEmSolicitacoes: dados.disponivelEmSolicitacoes }) }).where(eq(projetos.id, id));
    await registrarHistorico(tx, {
      entidade: "projeto",
      entidadeId: id,
      acao: bomMudou ? "NOVA_VERSAO" : "EDITADO",
      descricao: bomMudou ? `${p.nome}: nova versão v${novaVersao}${dados.observacaoVersao ? ` — ${dados.observacaoVersao}` : ""}` : `${p.nome}: dados alterados (sem mudança na lista de peças).`,
      usuarioId: usuario.id,
      dadosAntes: bomMudou ? { itens: atual.itens.map((i) => ({ pecaId: i.pecaId, quantidade: i.quantidade })), grupoId: p.grupoId } : grupoId !== p.grupoId ? { grupoId: p.grupoId } : null,
      dadosDepois: bomMudou ? { itens: dados.itens, grupoId } : grupoId !== p.grupoId ? { grupoId } : null,
    });
    let atualizacao: { eventos: string[]; pendentes: Array<{ evento: string; projeto: string }> } | null = null;
    if (bomMudou) {
      // A versão nova vale nos eventos que usam o projeto (com a ata fechada, sai nova OS). Import tardio: ciclo com eventos/.
      const { atualizarProjetosNosEventos } = await import("./eventos/versoes");
      atualizacao = await atualizarProjetosNosEventos(tx, { projetoId: id, usuarioId: usuario.id });
      const pendentes = [...new Set(atualizacao.pendentes.map((x) => x.evento))];
      if (atualizacao.eventos.length || pendentes.length) {
        await notificar(tx, {
          usuarioIds: await usuariosLogistica(tx),
          tipo: "PROJETO_NOVA_VERSAO",
          titulo: `${p.nome} tem nova versão (v${novaVersao})`,
          mensagem: [
            atualizacao.eventos.length ? `Atualizado em: ${atualizacao.eventos.join(", ")} (com OS gerada, saiu versão nova da OS).` : null,
            pendentes.length ? `Ficou na versão anterior em ${pendentes.join(", ")}: tem peças ajustadas uma a uma; atualize na ata se for o caso.` : null,
          ]
            .filter(Boolean)
            .join(" "),
          link: `/projetos/${id}`,
        });
      }
    }
    return { bomMudou, versao: novaVersao, atualizacao };
  });
}

export async function alterarAtivoProjeto(usuario: UsuarioAtual, id: string, ativo: boolean) {
  exigir(usuario, "projeto.gerenciar");
  const db = await getDb();
  const p = await db.query.projetos.findFirst({ where: eq(projetos.id, id) });
  if (!p) throw new NaoEncontradoError("Projeto padrão");
  // Projeto ativo só com peças ativas (a peça só se inativa fora de projeto ativo): reativar com peça inativa
  // devolvia o projeto às solicitações e o formulário não salvava mais (auditoria 30/10, parte C N8).
  if (ativo && !p.ativo) {
    const inativas = await db
      .selectDistinct({ codigo: pecas.codigo, nome: pecas.nome })
      .from(projetoItens)
      .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
      .innerJoin(pecas, eq(projetoItens.pecaId, pecas.id))
      .where(and(eq(projetoVersoes.projetoId, id), eq(projetoVersoes.numero, p.versaoAtual), eq(pecas.ativo, false)));
    if (inativas.length) {
      const uma = inativas.length === 1;
      const lista = inativas.map((x) => `${x.codigo} (${x.nome})`).join(", ");
      throw new ValidacaoError(`Não dá para reativar: ${uma ? `a peça ${lista} está inativa` : `as peças ${lista} estão inativas`} no catálogo. Reative ${uma ? "a peça" : "as peças"} ou tire-${uma ? "a" : "as"} do projeto antes.`);
    }
  }
  await db.update(projetos).set({ ativo }).where(eq(projetos.id, id));
  await registrarHistorico(db, { entidade: "projeto", entidadeId: id, acao: ativo ? "REATIVADO" : "INATIVADO", descricao: `Projeto ${p.nome} ${ativo ? "reativado" : "inativado"}.`, usuarioId: usuario.id });
}

/** Tira/põe o projeto nas listas de seleção das solicitações sem inativá-lo (continua na biblioteca). */
export async function alterarDisponivelProjeto(usuario: UsuarioAtual, id: string, disponivel: boolean) {
  exigir(usuario, "projeto.gerenciar");
  const db = await getDb();
  const p = await db.query.projetos.findFirst({ where: eq(projetos.id, id) });
  if (!p) throw new NaoEncontradoError("Projeto padrão");
  await db.update(projetos).set({ disponivelEmSolicitacoes: disponivel }).where(eq(projetos.id, id));
  await registrarHistorico(db, { entidade: "projeto", entidadeId: id, acao: "EDITADO", descricao: `Projeto ${p.nome} ${disponivel ? "disponível" : "fora das listas"} das solicitações.`, usuarioId: usuario.id });
}

const LIMITE_ANEXO = 8 * 1024 * 1024;
const MIMES: Record<string, AnexoTipo> = { "image/png": "IMAGEM", "image/jpeg": "IMAGEM", "image/webp": "IMAGEM", "application/pdf": "PDF" };

/** Tipo real pelos primeiros bytes (assinatura do arquivo): um .exe renomeado para .pdf não passa. */
export function detectarMimeAnexo(bytes: Uint8Array): keyof typeof MIMES | null {
  const b = (i: number) => bytes[i];
  const ascii = (de: number, ate: number) => String.fromCharCode(...bytes.subarray(de, ate));
  if (bytes.length >= 8 && b(0) === 0x89 && ascii(1, 4) === "PNG" && b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a) return "image/png";
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 5 && ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export async function anexarArquivo(usuario: UsuarioAtual, projetoId: string, file: File) {
  exigir(usuario, "projeto.gerenciar");
  if (file.size > LIMITE_ANEXO) throw new ValidacaoError("Arquivo acima de 8 MB.");
  if (file.size === 0) throw new ValidacaoError("Arquivo vazio.");
  const conteudo = Buffer.from(await file.arrayBuffer());
  const mime = detectarMimeAnexo(new Uint8Array(conteudo));
  const tipo = mime ? MIMES[mime] : undefined;
  if (!mime || !tipo) throw new ValidacaoError("Formato não suportado. Use PNG, JPG, WEBP ou PDF (o conteúdo do arquivo não corresponde a nenhum deles).");
  // A foto precisa abrir de verdade: um JPEG corrompido passava pela assinatura e ficava quebrado na galeria e como
  // capa (a peça e a Ativação já recusavam; auditoria 30/10, parte C N14). Import tardio: o sharp não vai para quem
  // só importa este módulo sem enviar foto.
  if (tipo === "IMAGEM") {
    const sharp = (await import("sharp")).default;
    await sharp(conteudo)
      .stats()
      .catch(() => {
        throw new ValidacaoError(`Não foi possível ler a imagem “${file.name}”. Envie outra foto.`);
      });
  }
  const db = await getDb();
  const p = await db.query.projetos.findFirst({ where: eq(projetos.id, projetoId) });
  if (!p) throw new NaoEncontradoError("Projeto padrão");
  // No banco (padrão) a coluna guarda o arquivo; com Object Storage, só a referência (ver armazenamento.ts).
  const valor = await gravarArquivo(`anexos/${projetoId}/${randomUUID()}`, conteudo);
  let a: { id: string };
  try {
    [a] = await db
      .insert(anexos)
      .values({ projetoId, tipo, nomeArquivo: file.name.slice(0, 160), mime, tamanho: file.size, conteudo: valor, criadoPorId: usuario.id })
      .returning({ id: anexos.id });
  } catch (e) {
    if (valor !== conteudo) await apagarArquivo(valor);
    throw e;
  }
  await registrarHistorico(db, { entidade: "projeto", entidadeId: projetoId, acao: "ANEXO_ADICIONADO", descricao: `${p.nome}: anexo “${file.name}” adicionado.`, usuarioId: usuario.id });
  return a;
}

export async function removerAnexo(usuario: UsuarioAtual, anexoId: string) {
  exigir(usuario, "projeto.gerenciar");
  const db = await getDb();
  const [a] = await db
    .select({ id: anexos.id, projetoId: anexos.projetoId, nomeArquivo: anexos.nomeArquivo, inicio: inicioDoArquivo(anexos.conteudo) })
    .from(anexos)
    .where(eq(anexos.id, anexoId));
  if (!a) throw new NaoEncontradoError("Anexo");
  await db.delete(anexos).where(eq(anexos.id, anexoId));
  await apagarArquivo(a.inicio);
  await registrarHistorico(db, { entidade: "projeto", entidadeId: a.projetoId, acao: "ANEXO_REMOVIDO", descricao: `Anexo “${a.nomeArquivo}” removido.`, usuarioId: usuario.id });
  return a.projetoId;
}

export async function obterAnexo(usuario: UsuarioAtual, anexoId: string) {
  exigir(usuario, "projeto.ver");
  const db = await getDb();
  const a = await db.query.anexos.findFirst({ where: eq(anexos.id, anexoId) });
  if (!a) throw new NaoEncontradoError("Anexo");
  return { ...a, conteudo: await lerArquivo(a.conteudo) };
}

/** Metadados do anexo sem o arquivo (para responder 304 sem ler o bytea). */
export async function obterAnexoMeta(usuario: UsuarioAtual, anexoId: string) {
  exigir(usuario, "projeto.ver");
  const db = await getDb();
  const a = await db.query.anexos.findFirst({ where: eq(anexos.id, anexoId), columns: { conteudo: false } });
  if (!a) throw new NaoEncontradoError("Anexo");
  return a;
}

export async function historicoProjeto(id: string) {
  const db = await getDb();
  return db.query.historico.findMany({ where: and(eq(historico.entidade, "projeto"), eq(historico.entidadeId, id)), with: { usuario: { columns: { nome: true } } }, orderBy: [desc(historico.criadoEm)], limit: 50 });
}

/** Quantos eventos (não cancelados) usam cada projeto na ata — coluna "uso" da Biblioteca. */
export type UsoProjeto = { n: number; eventos: Array<{ id: string; codigo: string; nome: string; status: string; dataInicio: string; quantidade: number }> };

/**
 * Em quais eventos cada projeto está (linhas ativas da ata, eventos não cancelados), com as
 * unidades somadas — para o filtro por evento e o "Em uso em" da biblioteca.
 */
export async function usoProjetosPorEvento(): Promise<Map<string, UsoProjeto>> {
  const db = await getDb();
  const rows = await db
    .select({ projetoId: eventoItens.projetoId, eventoId: eventos.id, codigo: eventos.codigo, nome: eventos.nome, status: eventos.status, dataInicio: eventos.dataInicio, quantidade: sql<number>`sum(${eventoItens.quantidade})::int` })
    .from(eventoItens)
    .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
    .where(and(eq(eventoItens.ativo, true), isNotNull(eventoItens.projetoId), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO", "ENCERRADO"])))
    .groupBy(eventoItens.projetoId, eventos.id, eventos.codigo, eventos.nome, eventos.status, eventos.dataInicio)
    .orderBy(desc(eventos.dataInicio));
  const mapa = new Map<string, UsoProjeto>();
  for (const r of rows) {
    const u = mapa.get(r.projetoId!) ?? { n: 0, eventos: [] };
    u.n++;
    u.eventos.push({ id: r.eventoId, codigo: r.codigo, nome: r.nome, status: r.status, dataInicio: r.dataInicio, quantidade: Number(r.quantidade) });
    mapa.set(r.projetoId!, u);
  }
  return mapa;
}

