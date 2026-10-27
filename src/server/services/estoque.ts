import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { configuracoes, estoqueItens, eventoItens, eventos, pecas, type BomSnapshotLinha } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { SemPermissaoError, ValidacaoError, NaoEncontradoError } from "@/domain/errors";
import { CATEGORIAS_ESTOQUE, periodosSeCruzam, podeGerenciarEstoque } from "@/domain/estoque";
import inventario from "@/data/estoque-ativacao-2025.json";
import { registrarHistorico } from "./support";
import { capasDosItens, situacaoDoEstoque } from "./ativacao-situacao";

function exigirEstoque(usuario: UsuarioAtual) {
  if (!podeGerenciarEstoque(usuario)) throw new SemPermissaoError("O estoque é da Ativação e do administrador.");
}

/** Itens do estoque com a peça ligada (código e nome), em ordem de categoria e nome. */
export async function listarEstoque(usuario: UsuarioAtual) {
  exigirEstoque(usuario);
  const db = await getDb();
  const rows = await db
    .select({
      id: estoqueItens.id,
      nome: estoqueItens.nome,
      categoria: estoqueItens.categoria,
      quantidade: estoqueItens.quantidade,
      comprar: estoqueItens.comprar,
      observacao: estoqueItens.observacao,
      pecaId: estoqueItens.pecaId,
      pecaCodigo: pecas.codigo,
      pecaNome: pecas.nome,
      ativo: estoqueItens.ativo,
      atualizadoEm: estoqueItens.atualizadoEm,
    })
    .from(estoqueItens)
    .leftJoin(pecas, eq(estoqueItens.pecaId, pecas.id))
    .orderBy(asc(estoqueItens.categoria), asc(estoqueItens.nome));
  const ordem = (c: string) => {
    const i = (CATEGORIAS_ESTOQUE as readonly string[]).indexOf(c);
    return i < 0 ? 99 : i;
  };
  // Saída pela OS, reformas e foto de capa (módulo Ativação).
  const [sit, capas] = await Promise.all([situacaoDoEstoque(db), capasDosItens(rows.map((r) => r.id))]);
  return rows
    .map((r) => ({ ...r, emEvento: sit.emEvento.get(r.id) ?? 0, reservado: sit.reservado.get(r.id) ?? 0, emReforma: sit.emReforma.get(r.id) ?? 0, capaId: capas.get(r.id) ?? null }))
    .sort((a, b) => ordem(a.categoria) - ordem(b.categoria) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export type ItemEstoque = Awaited<ReturnType<typeof listarEstoque>>[number];

export type DadosItemEstoque = { id?: string | null; nome: string; categoria: string; quantidade: number; comprar: number | null; observacao: string | null; pecaId: string | null; ativo?: boolean };

/** Cria ou edita um item (nome, categoria, quantidade, comprar, observação, peça ligada), com histórico. */
export async function salvarItemEstoque(usuario: UsuarioAtual, dados: DadosItemEstoque) {
  exigirEstoque(usuario);
  const nome = dados.nome.replace(/\s+/g, " ").trim();
  if (!nome) throw new ValidacaoError("Dê um nome ao item.", { nome: "Obrigatório." });
  if (!Number.isInteger(dados.quantidade) || dados.quantidade < 0) throw new ValidacaoError("Quantidade inválida.", { quantidade: "Use um número inteiro, 0 ou mais." });
  const db = await getDb();
  return db.transaction(async (tx) => {
    const repetido = await tx.query.estoqueItens.findFirst({ where: and(eq(estoqueItens.nome, nome), dados.id ? ne(estoqueItens.id, dados.id) : undefined) });
    if (repetido) throw new ValidacaoError("Já existe um item com esse nome.", { nome: "Já existe um item com esse nome." });
    // Uma peça do catálogo, um item: a OS que leva a peça tira do estoque daquele item (saída e retorno).
    if (dados.pecaId) {
      const outro = await tx.query.estoqueItens.findFirst({ where: and(eq(estoqueItens.pecaId, dados.pecaId), eq(estoqueItens.ativo, true), dados.id ? ne(estoqueItens.id, dados.id) : undefined), columns: { nome: true } });
      if (outro) throw new ValidacaoError(`Essa peça já está ligada a “${outro.nome}”.`, { pecaId: `Já ligada a “${outro.nome}”.` });
    }
    const valores = {
      nome,
      categoria: dados.categoria.trim() || "Ativação",
      quantidade: dados.quantidade,
      comprar: dados.comprar && dados.comprar > 0 ? dados.comprar : null,
      observacao: dados.observacao?.trim() || null,
      pecaId: dados.pecaId || null,
      ativo: dados.ativo ?? true,
      atualizadoPorId: usuario.id,
      atualizadoEm: new Date(),
    };
    if (dados.id) {
      const antes = await tx.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, dados.id) });
      if (!antes) throw new NaoEncontradoError("Item do estoque");
      await tx.update(estoqueItens).set(valores).where(eq(estoqueItens.id, dados.id));
      const mudou = antes.quantidade !== valores.quantidade ? `${antes.quantidade} → ${valores.quantidade}` : null;
      await registrarHistorico(tx, {
        entidade: "estoque_item",
        entidadeId: dados.id,
        acao: "ESTOQUE_ALTERADO",
        descricao: `Estoque · ${nome}${mudou ? `: ${mudou}` : " alterado"}`,
        usuarioId: usuario.id,
        dadosAntes: { quantidade: antes.quantidade, comprar: antes.comprar, observacao: antes.observacao, pecaId: antes.pecaId, ativo: antes.ativo },
        dadosDepois: { quantidade: valores.quantidade, comprar: valores.comprar, observacao: valores.observacao, pecaId: valores.pecaId, ativo: valores.ativo },
      });
      return { id: dados.id };
    }
    const [novo] = await tx.insert(estoqueItens).values({ ...valores, criadoPorId: usuario.id }).returning({ id: estoqueItens.id });
    await registrarHistorico(tx, { entidade: "estoque_item", entidadeId: novo.id, acao: "ESTOQUE_CRIADO", descricao: `Estoque · ${nome} incluído (${valores.quantidade})`, usuarioId: usuario.id, dadosDepois: valores });
    return { id: novo.id };
  });
}

/** Só a quantidade (o "−/+" da tela), com histórico. */
export async function ajustarQuantidadeEstoque(usuario: UsuarioAtual, id: string, quantidade: number) {
  exigirEstoque(usuario);
  if (!Number.isInteger(quantidade) || quantidade < 0) throw new ValidacaoError("Quantidade inválida.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const antes = await tx.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, id) });
    if (!antes) throw new NaoEncontradoError("Item do estoque");
    if (antes.quantidade === quantidade) return { id };
    await tx.update(estoqueItens).set({ quantidade, atualizadoPorId: usuario.id, atualizadoEm: new Date() }).where(eq(estoqueItens.id, id));
    await registrarHistorico(tx, {
      entidade: "estoque_item",
      entidadeId: id,
      acao: "ESTOQUE_ALTERADO",
      descricao: `Estoque · ${antes.nome}: ${antes.quantidade} → ${quantidade}`,
      usuarioId: usuario.id,
      dadosAntes: { quantidade: antes.quantidade },
      dadosDepois: { quantidade },
    });
    return { id };
  });
}

/**
 * Para a tela da solicitação: as peças ligadas ao estoque e, para cada evento, quanto outros eventos do
 * mesmo período (montagem a desmontagem) já levam de cada uma — linhas ativas da ata, peça solta ou dentro
 * de projeto. Só o necessário para "Estoque 170 · 40 em outro evento · restam 130".
 */
export async function estoqueParaSolicitacao(eventoIds: string[]) {
  const db = await getDb();
  const ligados = await db
    .select({ id: estoqueItens.id, pecaId: estoqueItens.pecaId, nome: estoqueItens.nome, quantidade: estoqueItens.quantidade })
    .from(estoqueItens)
    .where(and(eq(estoqueItens.ativo, true)));
  // Detalhes do item para quem pede: em reforma (não conta como disponível) e a foto.
  const [sit, capas] = await Promise.all([situacaoDoEstoque(db), capasDosItens(ligados.filter((l) => l.pecaId).map((l) => l.id))]);
  const porPeca: Record<string, { nome: string; quantidade: number; emReforma: number; capaId: string | null; itemId: string }> = {};
  for (const l of ligados) {
    if (!l.pecaId) continue;
    const ja = porPeca[l.pecaId];
    porPeca[l.pecaId] = ja
      ? { ...ja, quantidade: ja.quantidade + l.quantidade, emReforma: ja.emReforma + (sit.emReforma.get(l.id) ?? 0) }
      : { nome: l.nome, quantidade: l.quantidade, emReforma: sit.emReforma.get(l.id) ?? 0, capaId: capas.get(l.id) ?? null, itemId: l.id };
  }
  const pecaIds = Object.keys(porPeca);
  const emOutros: Record<string, Record<string, number>> = {};
  /** Por evento e peça: quais outros eventos do período levam a peça e quanto (o "40 em outro evento" com nome). */
  const outrosEventos: Record<string, Record<string, Array<{ codigo: string; nome: string; quantidade: number }>>> = {};
  if (!pecaIds.length || !eventoIds.length) return { porPeca, emOutros, outrosEventos };

  const todos = await db
    .select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, inicio: eventos.dataMontagem, fim: eventos.dataDesmontagem, status: eventos.status })
    .from(eventos)
    .where(ne(eventos.status, "CANCELADO"));
  const linhas = await db
    .select({ eventoId: eventoItens.eventoId, tipo: eventoItens.tipo, pecaId: eventoItens.pecaId, quantidade: eventoItens.quantidade, bom: eventoItens.bomSnapshot })
    .from(eventoItens)
    .where(and(eq(eventoItens.ativo, true), inArray(eventoItens.eventoId, todos.map((e) => e.id))));
  // Quanto de cada peça ligada cada evento leva.
  const leva = new Map<string, Record<string, number>>();
  for (const l of linhas) {
    const somar = (pecaId: string, q: number) => {
      if (!porPeca[pecaId] || q <= 0) return;
      const m = leva.get(l.eventoId) ?? {};
      m[pecaId] = (m[pecaId] ?? 0) + q;
      leva.set(l.eventoId, m);
    };
    if (l.tipo === "PECA" && l.pecaId) somar(l.pecaId, l.quantidade);
    if (l.tipo === "PROJETO") for (const b of (l.bom as BomSnapshotLinha[] | null) ?? []) somar(b.pecaId, b.quantidade * l.quantidade);
  }
  const periodo = new Map(todos.map((e) => [e.id, { inicio: e.inicio, fim: e.fim, codigo: e.codigo, nome: e.nome }]));
  for (const id of eventoIds) {
    const p = periodo.get(id);
    if (!p) continue;
    const soma: Record<string, number> = {};
    const quais: Record<string, Array<{ codigo: string; nome: string; quantidade: number }>> = {};
    for (const [outro, m] of leva) {
      if (outro === id) continue;
      const q = periodo.get(outro);
      if (!q || !periodosSeCruzam(p, q)) continue;
      for (const [pecaId, n] of Object.entries(m)) {
        soma[pecaId] = (soma[pecaId] ?? 0) + n;
        (quais[pecaId] ??= []).push({ codigo: q.codigo, nome: q.nome, quantidade: n });
      }
    }
    emOutros[id] = soma;
    outrosEventos[id] = quais;
  }
  return { porPeca, emOutros, outrosEventos };
}

export type EstoqueSolicitacao = Awaited<ReturnType<typeof estoqueParaSolicitacao>>;

/** Itens da planilha ligados a peças do catálogo pelo código (o que a Ativação pede na solicitação). */
const LIGACOES_INICIAIS: Record<string, string> = { "Puff Cubo": "PUFF", "Ombrelone - Tecido Cinza": "OMBRELONE" };

/**
 * Carga inicial (uma vez só): o "Inventário - Ativação" de 2025 (src/data/estoque-ativacao-2025.json),
 * com Puff Cubo → PUFF e Ombrelone (tecido) → OMBRELONE já ligados. A marca entra na mesma transação;
 * com o estoque já preenchido (alguém cadastrou antes), não importa nada.
 */
export async function importarEstoqueInicial(chave = "importacao:estoque-ativacao-2025"): Promise<{ feito: false } | { feito: true; itens: number; ligados: number }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [marca] = await tx.insert(configuracoes).values({ chave, valor: JSON.stringify({ status: "em andamento" }) }).onConflictDoNothing({ target: configuracoes.chave }).returning({ chave: configuracoes.chave });
    if (!marca) return { feito: false };
    const ja = await tx.select({ id: estoqueItens.id }).from(estoqueItens).limit(1);
    let itens = 0;
    let ligados = 0;
    if (!ja.length) {
      const codigos = Object.values(LIGACOES_INICIAIS);
      const pecasLigadas = new Map((await tx.select({ id: pecas.id, codigo: pecas.codigo }).from(pecas).where(inArray(pecas.codigo, codigos))).map((p) => [p.codigo, p.id]));
      const lista = (inventario as { itens: Array<{ nome: string; categoria: string; quantidade: number; comprar: number | null; observacao: string | null }> }).itens;
      for (let i = 0; i < lista.length; i += 100) {
        const lote = lista.slice(i, i + 100).map((x) => {
          const pecaId = LIGACOES_INICIAIS[x.nome] ? (pecasLigadas.get(LIGACOES_INICIAIS[x.nome]) ?? null) : null;
          if (pecaId) ligados++;
          return { nome: x.nome, categoria: x.categoria, quantidade: x.quantidade, comprar: x.comprar, observacao: x.observacao, pecaId };
        });
        await tx.insert(estoqueItens).values(lote);
        itens += lote.length;
      }
    }
    await tx.update(configuracoes).set({ valor: JSON.stringify({ status: "feito", em: new Date().toISOString(), itens, ligados }) }).where(eq(configuracoes.chave, chave));
    return { feito: true, itens, ligados };
  });
}
