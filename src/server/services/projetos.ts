import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { anexos, eventoItens, eventos, historico, pecas, projetoItens, projetoVersoes, projetos, type AnexoTipo } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { notificar, proximoCodigo, registrarHistorico, usuariosLogistica, buscaSemAcento } from "./support";
import { cacheDados, TAGS_DADOS } from "@/server/cache-dados";

export type DadosProjeto = {
  nome: string;
  categoria: string;
  descricao: string | null;
  observacaoVersao: string | null;
  itens: Array<{ pecaId: string; quantidade: number }>;
};

type FiltroProjetos = { busca?: string; incluirInativos?: boolean };

export async function listarProjetos(usuario: UsuarioAtual, filtro: FiltroProjetos = {}) {
  exigir(usuario, "projeto.ver");
  // Busca livre vai sempre ao banco; a lista sem busca fica em cache até uma action mexer nos projetos.
  if (filtro.busca) return consultarProjetos(filtro);
  return projetosEmCache(Boolean(filtro.incluirInativos));
}

const projetosEmCache = cacheDados((incluirInativos: boolean) => consultarProjetos({ incluirInativos }), "projetos:lista", [TAGS_DADOS.projetos]);

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
    with: { anexos: { columns: { id: true, tipo: true, nomeArquivo: true, mime: true } } },
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
        criadoPor: { columns: { id: true, nome: true } },
        anexos: { columns: { id: true, tipo: true, nomeArquivo: true, mime: true, tamanho: true, criadoEm: true }, orderBy: [asc(anexos.criadoEm)] },
        versoes: { with: { itens: { with: { peca: true } }, criadoPor: { columns: { id: true, nome: true } } }, orderBy: [desc(projetoVersoes.numero)] },
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
  if (itens.length === 0) throw new ValidacaoError("Adicione ao menos uma peça à lista de materiais.");
  const ids = itens.map((i) => i.pecaId);
  if (new Set(ids).size !== ids.length) throw new ValidacaoError("Há peças repetidas na lista. Some as quantidades em uma linha só.");
  const db = await getDb();
  const rows = await db.query.pecas.findMany({ where: inArray(pecas.id, ids) });
  for (const i of itens) {
    const p = rows.find((r) => r.id === i.pecaId);
    if (!p || !p.ativo) throw new ValidacaoError("Uma das peças está inativa ou não existe.");
    if (!p.permiteEmProjeto) throw new ValidacaoError(`"${p.nome}" não pode entrar em BOM: é sempre lançada como item avulso.`);
    if (!Number.isInteger(i.quantidade) || i.quantidade <= 0) throw new ValidacaoError("Quantidades devem ser inteiros maiores que zero.");
  }
}

export async function criarProjeto(usuario: UsuarioAtual, dados: DadosProjeto) {
  exigir(usuario, "projeto.gerenciar");
  await validarItens(dados.itens);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const codigo = await proximoCodigo(tx, "projeto");
    const [p] = await tx.insert(projetos).values({ codigo, nome: dados.nome, categoria: dados.categoria, descricao: dados.descricao, versaoAtual: 1, criadoPorId: usuario.id }).returning();
    const [v] = await tx.insert(projetoVersoes).values({ projetoId: p.id, numero: 1, observacao: dados.observacaoVersao ?? "Versão inicial", criadoPorId: usuario.id }).returning();
    await tx.insert(projetoItens).values(dados.itens.map((i) => ({ versaoId: v.id, pecaId: i.pecaId, quantidade: i.quantidade })));
    await registrarHistorico(tx, { entidade: "projeto", entidadeId: p.id, acao: "CRIADO", descricao: `Projeto ${p.codigo} · ${p.nome} criado (v1, ${dados.itens.length} peças).`, usuarioId: usuario.id, dadosDepois: dados });
    return p;
  });
}

export async function editarProjeto(usuario: UsuarioAtual, id: string, dados: DadosProjeto) {
  exigir(usuario, "projeto.gerenciar");
  await validarItens(dados.itens);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const p = await tx.query.projetos.findFirst({ where: eq(projetos.id, id), with: { versoes: { with: { itens: true } } } });
    if (!p) throw new NaoEncontradoError("Projeto padrão");
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
    await tx.update(projetos).set({ nome: dados.nome, categoria: dados.categoria, descricao: dados.descricao, versaoAtual: novaVersao }).where(eq(projetos.id, id));
    await registrarHistorico(tx, {
      entidade: "projeto",
      entidadeId: id,
      acao: bomMudou ? "NOVA_VERSAO" : "EDITADO",
      descricao: bomMudou ? `${p.nome}: nova versão v${novaVersao}${dados.observacaoVersao ? ` — ${dados.observacaoVersao}` : ""}` : `${p.nome}: dados alterados (sem mudança no BOM).`,
      usuarioId: usuario.id,
      dadosAntes: bomMudou ? { itens: atual.itens.map((i) => ({ pecaId: i.pecaId, quantidade: i.quantidade })) } : null,
      dadosDepois: bomMudou ? { itens: dados.itens } : null,
    });
    if (bomMudou) {
      const usos = await tx
        .select({ eventoId: eventos.id, nome: eventos.nome })
        .from(eventoItens)
        .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
        .where(and(eq(eventoItens.projetoId, id), eq(eventoItens.ativo, true), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"])));
      const nomes = [...new Set(usos.map((u) => u.nome))];
      if (nomes.length) {
        await notificar(tx, {
          usuarioIds: await usuariosLogistica(tx),
          tipo: "PROJETO_NOVA_VERSAO",
          titulo: `${p.nome} tem nova versão (v${novaVersao})`,
          mensagem: `Em uso em: ${nomes.join(", ")}. Decida na ata de cada evento se a versão deve ser atualizada.`,
          link: `/projetos/${id}`,
        });
      }
    }
    return { bomMudou, versao: novaVersao };
  });
}

export async function alterarAtivoProjeto(usuario: UsuarioAtual, id: string, ativo: boolean) {
  exigir(usuario, "projeto.gerenciar");
  const db = await getDb();
  const p = await db.query.projetos.findFirst({ where: eq(projetos.id, id) });
  if (!p) throw new NaoEncontradoError("Projeto padrão");
  await db.update(projetos).set({ ativo }).where(eq(projetos.id, id));
  await registrarHistorico(db, { entidade: "projeto", entidadeId: id, acao: ativo ? "REATIVADO" : "INATIVADO", descricao: `Projeto ${p.nome} ${ativo ? "reativado" : "inativado"}.`, usuarioId: usuario.id });
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
  const db = await getDb();
  const p = await db.query.projetos.findFirst({ where: eq(projetos.id, projetoId) });
  if (!p) throw new NaoEncontradoError("Projeto padrão");
  const [a] = await db
    .insert(anexos)
    .values({ projetoId, tipo, nomeArquivo: file.name.slice(0, 160), mime, tamanho: file.size, conteudo, criadoPorId: usuario.id })
    .returning({ id: anexos.id });
  await registrarHistorico(db, { entidade: "projeto", entidadeId: projetoId, acao: "ANEXO_ADICIONADO", descricao: `${p.nome}: anexo "${file.name}" adicionado.`, usuarioId: usuario.id });
  return a;
}

export async function removerAnexo(usuario: UsuarioAtual, anexoId: string) {
  exigir(usuario, "projeto.gerenciar");
  const db = await getDb();
  const a = await db.query.anexos.findFirst({ where: eq(anexos.id, anexoId), columns: { id: true, projetoId: true, nomeArquivo: true } });
  if (!a) throw new NaoEncontradoError("Anexo");
  await db.delete(anexos).where(eq(anexos.id, anexoId));
  await registrarHistorico(db, { entidade: "projeto", entidadeId: a.projetoId, acao: "ANEXO_REMOVIDO", descricao: `Anexo "${a.nomeArquivo}" removido.`, usuarioId: usuario.id });
  return a.projetoId;
}

export async function obterAnexo(usuario: UsuarioAtual, anexoId: string) {
  exigir(usuario, "projeto.ver");
  const db = await getDb();
  const a = await db.query.anexos.findFirst({ where: eq(anexos.id, anexoId) });
  if (!a) throw new NaoEncontradoError("Anexo");
  return a;
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
export async function contarUsoProjetos() {
  const db = await getDb();
  // Uma linha por projeto, contada no banco (antes: todas as linhas de ata do histórico).
  const rows = await db
    .select({ projetoId: eventoItens.projetoId, n: sql<number>`count(distinct ${eventoItens.eventoId})::int` })
    .from(eventoItens)
    .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
    .where(and(eq(eventoItens.ativo, true), isNotNull(eventoItens.projetoId), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO", "ENCERRADO"])))
    .groupBy(eventoItens.projetoId);
  return new Map(rows.map((r) => [r.projetoId!, Number(r.n)]));
}
