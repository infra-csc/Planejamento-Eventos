import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { arenaPosicoes, arenas, eventos } from "@/server/db/schema";
import { ARENAS, obterArenaPorSlug } from "@/domain/arena/eco-run-sp-2026";
import { aplicarPosicoes, type PosicaoEditada } from "@/domain/arena/posicoes";
import type { Arena, ItemAta } from "@/domain/arena/tipos";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { formatarData } from "@/lib/format";
import { linhasAtaResumidas } from "./eventos";
import { registrarHistorico } from "./support";

/**
 * Uma arena, de onde quer que venha: a Eco Run SP 2026 (fixa no código) ou uma arena de evento
 * criada no app (tabela arenas). Quem lê a arena passa sempre por aqui.
 */
export type ArenaCarregada = {
  arena: Arena;
  origem: "fixa" | "evento";
  eventoId: string | null;
  temPlanta: boolean;
  /** Muda quando a arena é gravada: vai na URL da planta para o navegador não mostrar a imagem antiga. */
  versao: number | null;
};

export async function obterArenaBase(slug: string): Promise<ArenaCarregada | null> {
  const fixa = obterArenaPorSlug(slug);
  if (fixa) return { arena: fixa, origem: "fixa", eventoId: null, temPlanta: false, versao: null };
  const db = await getDb();
  const row = await db.query.arenas.findFirst({
    where: eq(arenas.slug, slug),
    columns: { slug: true, base: true, eventoId: true, plantaMime: true, atualizadoEm: true },
  });
  if (!row) return null;
  const arena: Arena = { ...row.base, slug: row.slug };
  // A ata da arena de evento é a do próprio evento, sempre a vigente: o que estiver salvo na base é ignorado.
  if (row.eventoId) {
    const linhas = (await linhasAtaResumidas([row.eventoId]))[row.eventoId] ?? [];
    arena.ata = ataDoEvento(linhas);
  }
  return { arena, origem: "evento", eventoId: row.eventoId, temPlanta: Boolean(row.plantaMime), versao: row.atualizadoEm.getTime() };
}

export async function arenaExiste(slug: string): Promise<boolean> {
  if (obterArenaPorSlug(slug)) return true;
  const db = await getDb();
  const row = await db.query.arenas.findFirst({ where: eq(arenas.slug, slug), columns: { id: true } });
  return Boolean(row);
}

export type ArenaResumo = {
  slug: string;
  nome: string;
  origem: "fixa" | "evento";
  evento: { id: string; codigo: string; nome: string; status: string } | null;
  pontos: number;
  temPlanta: boolean;
  atualizadoEm: Date | null;
};

/** Todas as arenas: as fixas primeiro, depois as de evento (mais recentes primeiro). */
export async function listarArenasResumo(): Promise<ArenaResumo[]> {
  const db = await getDb();
  const [doBanco, novos] = await Promise.all([
    db
      .select({
        slug: arenas.slug,
        nome: arenas.nome,
        atualizadoEm: arenas.atualizadoEm,
        temPlanta: sql<boolean>`${arenas.plantaMime} is not null`,
        pontos: sql<number>`coalesce(jsonb_array_length(${arenas.base}->'pontos'), 0)`,
        eventoId: eventos.id,
        eventoCodigo: eventos.codigo,
        eventoNome: eventos.nome,
        eventoStatus: eventos.status,
      })
      .from(arenas)
      .leftJoin(eventos, eq(arenas.eventoId, eventos.id))
      .orderBy(desc(arenas.atualizadoEm)),
    // Pontos criados direto no mapa também contam.
    db.select({ slug: arenaPosicoes.arenaSlug, n: count() }).from(arenaPosicoes).where(eq(arenaPosicoes.tipo, "NOVO")).groupBy(arenaPosicoes.arenaSlug),
  ]);
  const novosPor = new Map(novos.map((n) => [n.slug, Number(n.n)]));
  return [
    ...ARENAS.map((a) => ({ slug: a.slug, nome: a.evento.nome, origem: "fixa" as const, evento: null, pontos: a.pontos.length + (novosPor.get(a.slug) ?? 0), temPlanta: false, atualizadoEm: null })),
    ...doBanco.map((a) => ({
      slug: a.slug,
      nome: a.nome,
      origem: "evento" as const,
      evento: a.eventoId && a.eventoCodigo && a.eventoNome ? { id: a.eventoId, codigo: a.eventoCodigo, nome: a.eventoNome, status: String(a.eventoStatus) } : null,
      pontos: Number(a.pontos) + (novosPor.get(a.slug) ?? 0),
      temPlanta: Boolean(a.temPlanta),
      atualizadoEm: a.atualizadoEm,
    })),
  ];
}

/** Slug da arena de um evento, se ele já tiver uma (link "Arena / mapa" do evento). */
export async function slugArenaDoEvento(eventoId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.query.arenas.findFirst({ where: eq(arenas.eventoId, eventoId), columns: { slug: true } });
  return row?.slug ?? null;
}

/** Eventos que ainda não têm arena, para o formulário de criação (os mais recentes primeiro). */
export async function eventosSemArena(usuario: UsuarioAtual) {
  exigir(usuario, "arena.ver");
  const db = await getDb();
  return db
    .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, status: eventos.status, dataInicio: eventos.dataInicio, dataFim: eventos.dataFim, local: eventos.local })
    .from(eventos)
    .leftJoin(arenas, eq(arenas.eventoId, eventos.id))
    .where(isNull(arenas.id))
    .orderBy(desc(eventos.dataInicio));
}

/* ------------------------------------------------------------------ */
/* Funções puras (testadas em arenas.test.ts)                           */
/* ------------------------------------------------------------------ */

/** Caminhos que já são rotas próprias dentro de /arena. */
const SLUGS_RESERVADOS = ["nova"];

/** "Eco Run — São Paulo 2026" → "eco-run-sao-paulo-2026". Único entre `ocupados` (sufixo -2, -3…). */
export function gerarSlugArena(nome: string, ocupados: Iterable<string>): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "arena";
  const usados = new Set([...ocupados, ...SLUGS_RESERVADOS, ...ARENAS.map((a) => a.slug)]);
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidato = `${base}-${n}`;
    if (!usados.has(candidato)) return candidato;
  }
}

export type MimePlanta = "image/png" | "image/jpeg" | "image/webp";

/** Tipo da imagem pelos primeiros bytes (a extensão e o `type` do navegador não bastam). */
export function detectarMimeImagem(bytes: Uint8Array): MimePlanta | null {
  const b = (i: number) => bytes[i];
  if (bytes.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 && b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a) return "image/png";
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  const ascii = (de: number, ate: number) => String.fromCharCode(...bytes.subarray(de, ate));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

type LinhaAtaResumida = { nome: string; quantidade: number; destino: string | null; areaNome: string | null };

/**
 * Linhas vigentes da ata do evento no formato da arena: seção = área que pediu. A mesma linha pedida
 * pela mesma área para destinos diferentes vira um item só (a chave "seção|item" posiciona o ponto).
 */
export function ataDoEvento(linhas: LinhaAtaResumida[]): ItemAta[] {
  const porChave = new Map<string, { item: ItemAta; destinos: string[] }>();
  for (const l of linhas) {
    const secao = l.areaNome?.trim() || "Logística";
    const chave = `${secao}|${l.nome}`;
    const atual = porChave.get(chave);
    if (atual) {
      atual.item.quantidade = (atual.item.quantidade ?? 0) + l.quantidade;
      if (l.destino && !atual.destinos.includes(l.destino)) atual.destinos.push(l.destino);
    } else porChave.set(chave, { item: { secao, item: l.nome, quantidade: l.quantidade }, destinos: l.destino ? [l.destino] : [] });
  }
  return [...porChave.values()].map(({ item, destinos }) => (destinos.length ? { ...item, detalhe: destinos.join(" · ") } : item));
}

type EventoParaArena = {
  codigo: string;
  nome: string;
  cliente: string;
  local: string;
  dataInicio: string;
  dataMontagem: string;
  dataReuniao: Date;
  reuniaoPresentes: string | null;
  publicoEsperado: number | null;
  arenaDescarrega: string | null;
};

type Layout = Pick<Arena, "area" | "zonas" | "vias" | "edificacoes" | "percurso" | "currais" | "pontos" | "marco">;

/** Retângulo em branco de largura × profundidade metros, centrado no marco. */
export function layoutEmBranco(largura: number, profundidade: number): Layout {
  const meiaL = Math.round((largura / 2) * 10) / 10;
  const meiaP = Math.round((profundidade / 2) * 10) / 10;
  return { area: { minX: -meiaL, maxX: meiaL, minZ: -meiaP, maxZ: meiaP }, zonas: [], vias: [], edificacoes: [], percurso: { trechos: [], nota: "", conesGrandes: 0 }, currais: [], pontos: [], marco: null };
}

/**
 * Layout de outra arena (com as posições ajustadas no mapa). Os pontos perdem o vínculo com a ata,
 * o status e as observações da arena de origem: tudo isso era do outro evento.
 */
export function copiarLayout(origem: Arena, posicoes: PosicaoEditada[] = []): Layout {
  const ajustada = aplicarPosicoes(origem, posicoes.filter((p) => p.tipo === "MOVER"));
  const copia = structuredClone({
    area: ajustada.area,
    zonas: ajustada.zonas,
    vias: ajustada.vias,
    edificacoes: ajustada.edificacoes,
    percurso: ajustada.percurso,
    currais: ajustada.currais,
    pontos: ajustada.pontos,
    marco: ajustada.marco,
  });
  return { ...copia, pontos: copia.pontos.map((p) => ({ ...p, itensAta: [], status: null, observacoes: [], responsavel: null })) };
}

/** Base completa de uma arena nova: dados do evento + layout. A ata não é salva (vem do evento na leitura). */
export function montarBaseArena(slug: string, ev: EventoParaArena, layout: Layout, nomeArquivoPlanta: string | null): Arena {
  const presentes = (ev.reuniaoPresentes ?? "")
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    slug,
    evento: {
      nome: ev.nome,
      sku: ev.codigo,
      data: ev.dataInicio,
      local: ev.local,
      publicoEsperado: ev.publicoEsperado,
      diretorProva: null,
      reuniaoOs: ev.dataReuniao.toISOString(),
      presentesReuniao: presentes,
      montagem: ev.arenaDescarrega?.trim() ? `Arena descarrega ${ev.arenaDescarrega.trim()}` : `Montagem a partir de ${formatarData(ev.dataMontagem)}`,
      distancias: [],
      largadas: [],
      organizadora: ev.cliente.trim() || "Norte Marketing Esportivo",
    },
    fonte: {
      documentos: [
        ...(nomeArquivoPlanta ? [{ nome: "Planta da arena", detalhe: nomeArquivoPlanta }] : []),
        { nome: `Ata do evento ${ev.codigo}`, detalhe: "Linhas vigentes da ata, lidas do sistema a cada abertura do mapa" },
      ],
      nota: "Mapa montado no app. A ata vem do evento e acompanha cada ajuste; as posições são as marcadas no mapa.",
      rotuloPlanta: "Planta",
      rotuloAta: `Ata ${ev.codigo}`,
    },
    divergencias: [],
    ...layout,
    semPosicaoNaPlanta: [],
    contagensDaPlanta: [],
    ata: [],
    corredores: [],
  };
}

/* ------------------------------------------------------------------ */
/* Planta (imagem)                                                      */
/* ------------------------------------------------------------------ */

export const LIMITE_PLANTA = 8 * 1024 * 1024;

export async function lerPlantaEnviada(arquivo: File): Promise<{ mime: MimePlanta; bytes: Buffer }> {
  if (arquivo.size === 0) throw new ValidacaoError("O arquivo da planta está vazio.", { planta: "Arquivo vazio." });
  if (arquivo.size > LIMITE_PLANTA) throw new ValidacaoError("A planta passa de 8 MB. Reduza a imagem e envie de novo.", { planta: "Arquivo acima de 8 MB." });
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const mime = detectarMimeImagem(bytes);
  if (!mime) throw new ValidacaoError("A planta precisa ser uma imagem PNG, JPG ou WebP.", { planta: "Use PNG, JPG ou WebP." });
  return { mime, bytes };
}

/** Metadados da planta, sem os bytes (para responder 304). */
export async function obterPlantaMeta(usuario: UsuarioAtual, slug: string) {
  exigir(usuario, "arena.ver");
  const db = await getDb();
  const row = await db.query.arenas.findFirst({ where: eq(arenas.slug, slug), columns: { plantaMime: true, atualizadoEm: true } });
  if (!row?.plantaMime) return null;
  return { mime: row.plantaMime, versao: row.atualizadoEm.getTime() };
}

export async function obterPlanta(usuario: UsuarioAtual, slug: string) {
  exigir(usuario, "arena.ver");
  const db = await getDb();
  const row = await db.query.arenas.findFirst({ where: eq(arenas.slug, slug), columns: { plantaMime: true, plantaImagem: true, atualizadoEm: true } });
  if (!row?.plantaMime || !row.plantaImagem) return null;
  return { mime: row.plantaMime, bytes: row.plantaImagem, versao: row.atualizadoEm.getTime() };
}

async function arenaDeEvento(slug: string) {
  if (obterArenaPorSlug(slug)) throw new ValidacaoError("A arena da Eco Run é fixa no sistema e não pode ser alterada aqui.");
  const db = await getDb();
  const row = await db.query.arenas.findFirst({ where: eq(arenas.slug, slug), columns: { id: true, slug: true, nome: true, eventoId: true, plantaMime: true } });
  if (!row) throw new NaoEncontradoError("Arena");
  return row;
}

export async function trocarPlantaArena(usuario: UsuarioAtual, slug: string, arquivo: File) {
  exigir(usuario, "arena.ver");
  const a = await arenaDeEvento(slug);
  const planta = await lerPlantaEnviada(arquivo);
  const db = await getDb();
  await db.update(arenas).set({ plantaMime: planta.mime, plantaImagem: planta.bytes, atualizadoEm: new Date() }).where(eq(arenas.id, a.id));
  await registrarHistorico(db, { eventoId: a.eventoId, entidade: "arena", entidadeId: slug, acao: "ARENA_PLANTA_TROCADA", descricao: `Planta da arena ${a.nome} ${a.plantaMime ? "trocada" : "enviada"} (${arquivo.name.slice(0, 120)}).`, usuarioId: usuario.id });
  return { slug, eventoId: a.eventoId };
}

export async function removerPlantaArena(usuario: UsuarioAtual, slug: string) {
  exigir(usuario, "arena.ver");
  const a = await arenaDeEvento(slug);
  if (!a.plantaMime) throw new ValidacaoError("Esta arena não tem planta.");
  const db = await getDb();
  await db.update(arenas).set({ plantaMime: null, plantaImagem: null, atualizadoEm: new Date() }).where(eq(arenas.id, a.id));
  await registrarHistorico(db, { eventoId: a.eventoId, entidade: "arena", entidadeId: slug, acao: "ARENA_PLANTA_REMOVIDA", descricao: `Planta da arena ${a.nome} removida.`, usuarioId: usuario.id });
  return { slug, eventoId: a.eventoId };
}

/* ------------------------------------------------------------------ */
/* Criar / excluir                                                      */
/* ------------------------------------------------------------------ */

export type DadosNovaArena = {
  eventoId: string;
  nome: string;
  partida: { tipo: "branco"; largura: number; profundidade: number } | { tipo: "copiar"; origemSlug: string };
};

async function layoutDeOutraArena(slug: string): Promise<Layout> {
  const origem = await obterArenaBase(slug);
  if (!origem) throw new ValidacaoError("A arena escolhida para copiar não existe mais.", { origemSlug: "Escolha outra arena." });
  const db = await getDb();
  const posicoes = await db
    .select({ chave: arenaPosicoes.chave, tipo: arenaPosicoes.tipo, nome: arenaPosicoes.nome, categoria: arenaPosicoes.categoria, rotuloTipo: arenaPosicoes.rotuloTipo, itemAta: arenaPosicoes.itemAta, x: arenaPosicoes.x, z: arenaPosicoes.z })
    .from(arenaPosicoes)
    .where(and(eq(arenaPosicoes.arenaSlug, slug), eq(arenaPosicoes.tipo, "MOVER")));
  return copiarLayout(origem.arena, posicoes);
}

export async function criarArena(usuario: UsuarioAtual, dados: DadosNovaArena, planta: File | null) {
  exigir(usuario, "arena.ver");
  const nome = dados.nome.trim();
  if (nome.length < 2) throw new ValidacaoError("Dê um nome à arena.", { nome: "Informe o nome (mínimo 2 letras)." });
  if (nome.length > 120) throw new ValidacaoError("Nome longo demais.", { nome: "Até 120 caracteres." });
  const db = await getDb();
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, dados.eventoId) });
  if (!ev) throw new ValidacaoError("Escolha o evento da arena.", { eventoId: "Escolha um evento." });
  const jaTem = await db.query.arenas.findFirst({ where: eq(arenas.eventoId, ev.id), columns: { slug: true } });
  if (jaTem) throw new ValidacaoError(`O evento ${ev.codigo} já tem arena (${jaTem.slug}).`, { eventoId: "Este evento já tem arena." });
  const imagem = planta && planta.size > 0 ? await lerPlantaEnviada(planta) : null;
  const layout = dados.partida.tipo === "copiar" ? await layoutDeOutraArena(dados.partida.origemSlug) : layoutEmBranco(dados.partida.largura, dados.partida.profundidade);
  const slugsBanco = await db.select({ slug: arenas.slug }).from(arenas);
  const slug = gerarSlugArena(nome, slugsBanco.map((s) => s.slug));
  const base = montarBaseArena(slug, ev, layout, imagem && planta ? planta.name.slice(0, 160) : null);
  await db.insert(arenas).values({ slug, eventoId: ev.id, nome, base, plantaMime: imagem?.mime ?? null, plantaImagem: imagem?.bytes ?? null, criadoPorId: usuario.id });
  const partida = dados.partida.tipo === "copiar" ? `a partir do layout de ${dados.partida.origemSlug}` : `em branco (${dados.partida.largura} × ${dados.partida.profundidade} m)`;
  await registrarHistorico(db, { eventoId: ev.id, entidade: "arena", entidadeId: slug, acao: "ARENA_CRIADA", descricao: `Arena ${nome} criada ${partida}.`, usuarioId: usuario.id });
  return { slug, eventoId: ev.id };
}

/** Remove a arena de evento e as posições editadas dela. Arenas fixas não saem. */
export async function excluirArena(usuario: UsuarioAtual, slug: string) {
  exigir(usuario, "arena.ver");
  const a = await arenaDeEvento(slug);
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(arenaPosicoes).where(eq(arenaPosicoes.arenaSlug, slug));
    await tx.delete(arenas).where(eq(arenas.id, a.id));
    await registrarHistorico(tx, { eventoId: a.eventoId, entidade: "arena", entidadeId: slug, acao: "ARENA_EXCLUIDA", descricao: `Arena ${a.nome} excluída, com as posições marcadas no mapa.`, usuarioId: usuario.id });
  });
  return { slug, eventoId: a.eventoId };
}
