import { and, desc, eq, isNotNull, sql, sum } from "drizzle-orm";
import { getDb } from "@/server/db";
import { almoxarifados, coberturasPrevistas, contagemLinhas, contagens, estoqueItens, eventos, locadores, movimentacaoLinhas, movimentacoes, pecas, sequencias, type TipoCobertura } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { TIPOS_COBERTURA } from "@/domain/constantes";
import { QTD_MAXIMA_SALDO, sugestaoDaContagem } from "@/domain/saldo";
import { hojeISO } from "@/lib/format";
import { NOME_ALMOXARIFADO_ATIVACAO } from "./logistica";
import { registrarHistorico, type Executor } from "./support";

/**
 * Saldo como soma de lançamentos (briefing NorteLog v2): nenhum número é digitado solto. A contagem compara o que foi visto com o
 * saldo calculado e grava só a diferença. Esta é a única função que escreve no livro-razão, e tudo acontece numa transação.
 */

/** MV-2026-000001. A linha de `sequencias` trava a numeração até o fim da transação: dois lançamentos não pegam o mesmo número. */
async function proximoNumero(tx: Executor, ano: string) {
  const nome = `movimentacao:${ano}`;
  const [r] = await tx
    .insert(sequencias)
    .values({ nome, valor: 1 })
    .onConflictDoUpdate({ target: sequencias.nome, set: { valor: sql`${sequencias.valor} + 1` } })
    .returning({ valor: sequencias.valor });
  return `MV-${ano}-${String(r.valor).padStart(6, "0")}`;
}

export type LinhaSaldo = { almoxarifadoId: string; pecaId: string; locadorId: string | null; quantidade: number };

/** O saldo, sempre da soma das movimentações, por almoxarifado, peça e proprietário (só as linhas com saldo diferente de zero). */
export async function saldosAtuais(ex?: Executor, almoxarifadoId?: string): Promise<LinhaSaldo[]> {
  const db = ex ?? (await getDb());
  const rows = await db
    .select({ almoxarifadoId: movimentacoes.almoxarifadoId, pecaId: movimentacaoLinhas.pecaId, locadorId: movimentacaoLinhas.locadorId, quantidade: sum(movimentacaoLinhas.quantidade) })
    .from(movimentacaoLinhas)
    .innerJoin(movimentacoes, eq(movimentacaoLinhas.movimentacaoId, movimentacoes.id))
    .where(almoxarifadoId ? and(eq(movimentacoes.almoxarifadoId, almoxarifadoId), eq(movimentacaoLinhas.condicao, "OK")) : eq(movimentacaoLinhas.condicao, "OK"))
    .groupBy(movimentacoes.almoxarifadoId, movimentacaoLinhas.pecaId, movimentacaoLinhas.locadorId);
  return rows.map((r) => ({ ...r, quantidade: Number(r.quantidade ?? 0) })).filter((r) => r.quantidade !== 0);
}

/** Quando cada peça foi contada em cada almoxarifado, e quando cada almoxarifado foi contado pela última vez. */
export async function datasDasContagens(ex?: Executor) {
  const db = ex ?? (await getDb());
  const [porPeca, porAlmoxarifado] = await Promise.all([
    db
      .select({ almoxarifadoId: contagens.almoxarifadoId, pecaId: contagemLinhas.pecaId, em: sql<string>`max(${contagens.dataContagem})` })
      .from(contagemLinhas)
      .innerJoin(contagens, eq(contagemLinhas.contagemId, contagens.id))
      .groupBy(contagens.almoxarifadoId, contagemLinhas.pecaId),
    db.select({ almoxarifadoId: contagens.almoxarifadoId, em: sql<string>`max(${contagens.dataContagem})` }).from(contagens).groupBy(contagens.almoxarifadoId),
  ]);
  return { porPeca: new Map(porPeca.map((r) => [`${r.almoxarifadoId}|${r.pecaId}`, String(r.em)])), porAlmoxarifado: new Map(porAlmoxarifado.map((r) => [r.almoxarifadoId, String(r.em)])) };
}

export type LinhaContagem = { pecaId: string; locadorId: string | null; contado: number };
export type DadosContagem = { almoxarifadoId: string; dataContagem: string; justificativa: string | null; linhas: LinhaContagem[] };

/**
 * Registra a contagem. A primeira do almoxarifado é o saldo inicial; depois, a diferença vira ajuste de inventário, com justificativa.
 * Peça que não veio na contagem não muda. Nada de saldo editável: só lançamento.
 */
export async function registrarContagem(usuario: UsuarioAtual, dados: DadosContagem) {
  exigir(usuario, "logistica.contagem");
  if (!dados.linhas.length) throw new ValidacaoError("Informe ao menos uma quantidade contada.");
  if (dados.dataContagem > hojeISO()) throw new ValidacaoError("A contagem não pode ter data futura.", { dataContagem: "Use hoje ou uma data passada." });
  const chaves = new Set<string>();
  for (const l of dados.linhas) {
    if (!Number.isInteger(l.contado) || l.contado < 0 || l.contado > QTD_MAXIMA_SALDO) throw new ValidacaoError("A quantidade contada é um inteiro, 0 ou mais.");
    const k = `${l.pecaId}|${l.locadorId ?? ""}`;
    if (chaves.has(k)) throw new ValidacaoError("A mesma peça e o mesmo proprietário apareceram duas vezes. Deixe uma linha só.");
    chaves.add(k);
  }
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Duas contagens do mesmo almoxarifado ao mesmo tempo calculariam a diferença sobre o mesmo saldo.
    await tx.execute(sql`select id from almoxarifados where id = ${dados.almoxarifadoId} for update`);
    const alm = await tx.query.almoxarifados.findFirst({ where: and(eq(almoxarifados.id, dados.almoxarifadoId), eq(almoxarifados.ativo, true)) });
    if (!alm) throw new NaoEncontradoError("Almoxarifado");
    const primeira = !(await tx.query.contagens.findFirst({ where: eq(contagens.almoxarifadoId, dados.almoxarifadoId), columns: { id: true } }));
    const ultima = await tx.query.contagens.findFirst({ where: eq(contagens.almoxarifadoId, dados.almoxarifadoId), orderBy: [desc(contagens.dataContagem)], columns: { dataContagem: true } });
    if (ultima && dados.dataContagem < ultima.dataContagem) throw new ValidacaoError(`Este almoxarifado já foi contado em ${ultima.dataContagem.split("-").reverse().join("/")}. Use essa data ou uma mais recente.`, { dataContagem: "Antes da última contagem." });

    const pecasIds = new Set((await tx.select({ id: pecas.id }).from(pecas)).map((p) => p.id));
    const locadoresIds = new Set((await tx.select({ id: locadores.id }).from(locadores)).map((l) => l.id));
    for (const l of dados.linhas) {
      if (!pecasIds.has(l.pecaId)) throw new NaoEncontradoError("Peça");
      if (l.locadorId && !locadoresIds.has(l.locadorId)) throw new NaoEncontradoError("Locador");
    }
    const atual = new Map((await saldosAtuais(tx, dados.almoxarifadoId)).map((s) => [`${s.pecaId}|${s.locadorId ?? ""}`, s.quantidade]));
    const diferencas = dados.linhas.flatMap((l) => {
      const anterior = atual.get(`${l.pecaId}|${l.locadorId ?? ""}`) ?? 0;
      return l.contado === anterior ? [] : [{ ...l, anterior, quantidade: l.contado - anterior }];
    });
    const justificativa = dados.justificativa?.trim() || null;
    if (!primeira && diferencas.length && !justificativa) throw new ValidacaoError("Informe a justificativa: a contagem mudou o saldo.", { justificativa: "Obrigatória no ajuste de inventário." });

    const [c] = await tx.insert(contagens).values({ almoxarifadoId: dados.almoxarifadoId, dataContagem: dados.dataContagem, responsavelId: usuario.id, observacao: justificativa }).returning();
    await tx.insert(contagemLinhas).values(dados.linhas.map((l) => ({ contagemId: c.id, pecaId: l.pecaId, locadorId: l.locadorId, contado: l.contado, anterior: atual.get(`${l.pecaId}|${l.locadorId ?? ""}`) ?? 0 })));
    let numero: string | null = null;
    if (diferencas.length) {
      numero = await proximoNumero(tx, dados.dataContagem.slice(0, 4));
      const [m] = await tx
        .insert(movimentacoes)
        .values({ numero, tipo: primeira ? "SALDO_INICIAL" : "AJUSTE_INVENTARIO", almoxarifadoId: dados.almoxarifadoId, contagemId: c.id, dataMovimento: dados.dataContagem, justificativa, usuarioId: usuario.id })
        .returning();
      await tx.insert(movimentacaoLinhas).values(diferencas.map((d) => ({ movimentacaoId: m.id, pecaId: d.pecaId, locadorId: d.locadorId, quantidade: d.quantidade })));
    }
    await registrarHistorico(tx, {
      entidade: "almoxarifado",
      entidadeId: alm.id,
      acao: primeira ? "SALDO_INICIAL" : "CONTAGEM",
      descricao: `Contagem de ${alm.nome}: ${dados.linhas.length} ${dados.linhas.length === 1 ? "linha contada" : "linhas contadas"}, ${diferencas.length} ${diferencas.length === 1 ? "diferença" : "diferenças"}${numero ? ` (${numero})` : ""}`,
      usuarioId: usuario.id,
      dadosDepois: { contagemId: c.id, numero, dataContagem: dados.dataContagem, diferencas: diferencas.map((d) => ({ pecaId: d.pecaId, locadorId: d.locadorId, antes: d.anterior, depois: d.contado })) },
    });
    return { contagemId: c.id, numero, diferencas: diferencas.length, primeira };
  });
}

/** O que a tela de contagem precisa: peças, saldo de agora, sugestão dos cadastros antigos e o histórico do almoxarifado. */
export async function dadosDaContagem(usuario: UsuarioAtual, almoxarifadoId: string) {
  exigir(usuario, "logistica.contagem");
  const db = await getDb();
  const alm = await db.query.almoxarifados.findFirst({ where: eq(almoxarifados.id, almoxarifadoId) });
  if (!alm) throw new NaoEncontradoError("Almoxarifado");
  const ehAtivacao = alm.nome.trim().toLocaleLowerCase("pt-BR") === NOME_ALMOXARIFADO_ATIVACAO.toLocaleLowerCase("pt-BR");
  const [lista, saldos, emPosse, historico, listaLocadores] = await Promise.all([
    db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome, unidade: pecas.unidade, setor: pecas.setor, estoqueProprio: pecas.estoqueProprio }).from(pecas).where(eq(pecas.ativo, true)).orderBy(pecas.nome),
    saldosAtuais(db, almoxarifadoId),
    ehAtivacao ? db.select({ pecaId: estoqueItens.pecaId, quantidade: sum(estoqueItens.quantidade) }).from(estoqueItens).where(and(isNotNull(estoqueItens.pecaId), eq(estoqueItens.ativo, true))).groupBy(estoqueItens.pecaId) : Promise.resolve([]),
    db.query.contagens.findMany({ where: eq(contagens.almoxarifadoId, almoxarifadoId), orderBy: [desc(contagens.dataContagem), desc(contagens.criadoEm)], limit: 10, with: { responsavel: { columns: { nome: true } }, linhas: { columns: { id: true } } } }),
    db.select({ id: locadores.id, nome: locadores.nome }).from(locadores).where(eq(locadores.ativo, true)).orderBy(locadores.nome),
  ]);
  const posse = new Map(emPosse.map((p) => [p.pecaId as string, Number(p.quantidade ?? 0)]));
  const norte = new Map(saldos.filter((s) => !s.locadorId).map((s) => [s.pecaId, s.quantidade]));
  return {
    almoxarifado: alm,
    pecas: lista.map((p) => ({ ...p, saldo: norte.get(p.id) ?? 0, sugestao: sugestaoDaContagem({ ehAtivacao, emPosse: posse.get(p.id) ?? null, estoqueProprio: p.estoqueProprio }) })),
    saldosDeLocador: saldos.filter((s) => s.locadorId),
    locadores: listaLocadores,
    historico: historico.map((h) => ({ id: h.id, dataContagem: h.dataContagem, responsavel: h.responsavel.nome, linhas: h.linhas.length, observacao: h.observacao })),
    jaContado: historico.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Locação e compra previstas                                           */
/* ------------------------------------------------------------------ */

export type DadosCobertura = { tipo: TipoCobertura; pecaId: string; almoxarifadoId: string; quantidade: number; locadorId: string | null; dataEntrada: string; dataDevolucao: string | null; eventoId: string | null; observacao: string | null };

export async function listarCoberturas(ex?: Executor) {
  const db = ex ?? (await getDb());
  return db.query.coberturasPrevistas.findMany({
    where: eq(coberturasPrevistas.ativo, true),
    orderBy: (t, { asc }) => [asc(t.dataEntrada)],
    with: { peca: { columns: { codigo: true, nome: true } }, almoxarifado: { columns: { nome: true } }, locador: { columns: { nome: true } }, evento: { columns: { codigo: true, nome: true } } },
  });
}

/** A falta resolvida por locação ou compra deixa de aparecer. Só registro: quem contrata é a logística, fora do sistema. */
export async function salvarCobertura(usuario: UsuarioAtual, id: string | null, dados: DadosCobertura) {
  exigir(usuario, "logistica.previsao");
  if (!TIPOS_COBERTURA.includes(dados.tipo)) throw new ValidacaoError("Escolha locação ou compra.", { tipo: "Obrigatório." });
  if (!Number.isInteger(dados.quantidade) || dados.quantidade <= 0 || dados.quantidade > QTD_MAXIMA_SALDO) throw new ValidacaoError("A quantidade é um inteiro maior que zero.", { quantidade: "Maior que zero." });
  if (dados.tipo === "LOCACAO") {
    if (!dados.locadorId) throw new ValidacaoError("A locação exige um locador cadastrado.", { locadorId: "Escolha o locador." });
    if (!dados.dataDevolucao) throw new ValidacaoError("Informe quando devolve.", { dataDevolucao: "Obrigatória na locação." });
    if (dados.dataDevolucao <= dados.dataEntrada) throw new ValidacaoError("A devolução precisa ser depois da entrada.", { dataDevolucao: "Depois da entrada." });
  }
  const valores = { ...dados, locadorId: dados.tipo === "LOCACAO" ? dados.locadorId : null, dataDevolucao: dados.tipo === "LOCACAO" ? dados.dataDevolucao : null, observacao: dados.observacao?.trim() || null };
  const db = await getDb();
  return db.transaction(async (tx) => {
    if (!(await tx.query.pecas.findFirst({ where: eq(pecas.id, dados.pecaId), columns: { id: true } }))) throw new NaoEncontradoError("Peça");
    if (!(await tx.query.almoxarifados.findFirst({ where: eq(almoxarifados.id, dados.almoxarifadoId), columns: { id: true } }))) throw new NaoEncontradoError("Almoxarifado");
    if (valores.locadorId && !(await tx.query.locadores.findFirst({ where: and(eq(locadores.id, valores.locadorId), eq(locadores.ativo, true)), columns: { id: true } }))) throw new ValidacaoError("Locador inativo ou inexistente.", { locadorId: "Escolha outro." });
    if (valores.eventoId && !(await tx.query.eventos.findFirst({ where: eq(eventos.id, valores.eventoId), columns: { id: true } }))) throw new NaoEncontradoError("Evento");
    const [c] = id ? await tx.update(coberturasPrevistas).set(valores).where(and(eq(coberturasPrevistas.id, id), eq(coberturasPrevistas.ativo, true))).returning() : await tx.insert(coberturasPrevistas).values({ ...valores, criadoPorId: usuario.id }).returning();
    if (!c) throw new NaoEncontradoError("Previsão");
    await registrarHistorico(tx, { eventoId: valores.eventoId ?? undefined, entidade: "cobertura_prevista", entidadeId: c.id, acao: id ? "EDITADA" : "CRIADA", descricao: `${dados.tipo === "LOCACAO" ? "Locação" : "Compra"} prevista ${id ? "alterada" : "registrada"}: ${dados.quantidade} unidades`, usuarioId: usuario.id, dadosDepois: valores });
    return c.id;
  });
}

export async function removerCobertura(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "logistica.previsao");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [c] = await tx.update(coberturasPrevistas).set({ ativo: false }).where(and(eq(coberturasPrevistas.id, id), eq(coberturasPrevistas.ativo, true))).returning();
    if (!c) throw new DomainError("Esta previsão já foi removida.");
    await registrarHistorico(tx, { eventoId: c.eventoId ?? undefined, entidade: "cobertura_prevista", entidadeId: id, acao: "REMOVIDA", descricao: `${c.tipo === "LOCACAO" ? "Locação" : "Compra"} prevista removida: ${c.quantidade} unidades`, usuarioId: usuario.id });
  });
}
