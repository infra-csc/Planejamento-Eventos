import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { almoxarifados, areas, estoqueItens, eventoItens, eventos, eventosPai, locadores, perfisVeiculo, pecas, tours, type AtendePor, type EstruturaEvento } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { ATENDE_POR_LABEL, ESTRUTURA_LABEL } from "@/domain/logistica";
import { TIPOS_VEICULO, type TipoVeiculo } from "@/domain/carga-descarga";
import { bloquearEvento, registrarHistorico, type Executor } from "./support";

/**
 * Cadastros da logística de materiais (briefing NorteLog v2, Fase 0): almoxarifados, locadores, perfis de veículo, evento pai
 * e tour, e o que é decidido no evento (datas previstas, Estrutura, Atende por). Toda regra fica aqui, no servidor.
 */

const nomeLimpo = (nome: string, rotulo: string) => {
  const n = nome.replace(/\s+/g, " ").trim();
  if (!n) throw new ValidacaoError(`Informe o nome ${rotulo}.`, { nome: "Obrigatório." });
  return n;
};
const mesmoNome = (a: string, b: string) => a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");

async function exigirNomeLivre(lista: ReadonlyArray<{ id: string; nome: string }>, id: string | null, nome: string) {
  const dup = lista.find((x) => x.id !== id && mesmoNome(x.nome, nome));
  if (dup) throw new ValidacaoError(`Já existe “${dup.nome}”.`, { nome: `Nome em uso por “${dup.nome}”.` });
}

/* ------------------------------------------------------------------ */
/* Almoxarifados                                                        */
/* ------------------------------------------------------------------ */

export const NOME_ALMOXARIFADO_PRINCIPAL = "Galpão principal";
export const NOME_ALMOXARIFADO_ATIVACAO = "Ativação";

/** O galpão principal e o da Ativação existem desde o início. Só cria o que falta; roda ao subir, em qualquer banco. */
export async function garantirAlmoxarifados(ex?: Executor) {
  const db = ex ?? (await getDb());
  const existentes = await db.select({ nome: almoxarifados.nome, principal: almoxarifados.principal }).from(almoxarifados);
  let criados = 0;
  if (!existentes.some((a) => a.principal)) {
    await db.insert(almoxarifados).values({ nome: NOME_ALMOXARIFADO_PRINCIPAL, principal: true }).onConflictDoNothing({ target: almoxarifados.nome });
    criados++;
  }
  if (!existentes.some((a) => mesmoNome(a.nome, NOME_ALMOXARIFADO_ATIVACAO))) {
    const area = (await db.select({ id: areas.id, nome: areas.nome }).from(areas)).find((a) => mesmoNome(a.nome, NOME_ALMOXARIFADO_ATIVACAO));
    await db.insert(almoxarifados).values({ nome: NOME_ALMOXARIFADO_ATIVACAO, areaId: area?.id ?? null }).onConflictDoNothing({ target: almoxarifados.nome });
    criados++;
  }
  return criados;
}

export async function listarAlmoxarifados(ex?: Executor) {
  const db = ex ?? (await getDb());
  return db.query.almoxarifados.findMany({ orderBy: [asc(almoxarifados.nome)], with: { area: { columns: { nome: true } } } });
}

export async function almoxarifadoPrincipal(ex: Executor) {
  const [p] = await ex.select().from(almoxarifados).where(eq(almoxarifados.principal, true));
  return p ?? null;
}

export type DadosAlmoxarifado = { nome: string; endereco: string | null; areaId: string | null; principal: boolean; ativo: boolean };

export async function salvarAlmoxarifado(usuario: UsuarioAtual, id: string | null, dados: DadosAlmoxarifado) {
  exigir(usuario, "logistica.cadastros");
  const nome = nomeLimpo(dados.nome, "do almoxarifado");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await exigirNomeLivre(await tx.select({ id: almoxarifados.id, nome: almoxarifados.nome }).from(almoxarifados), id, nome);
    const atual = id ? await tx.query.almoxarifados.findFirst({ where: eq(almoxarifados.id, id) }) : null;
    if (id && !atual) throw new NaoEncontradoError("Almoxarifado");
    if (atual?.principal && (!dados.principal || !dados.ativo)) throw new ValidacaoError("Escolha outro almoxarifado como principal antes de mudar este.", { principal: "Sempre há um principal." });
    if (dados.principal && !dados.ativo) throw new ValidacaoError("O principal precisa estar ativo.", { principal: "Ative o almoxarifado." });
    if (dados.principal) await tx.update(almoxarifados).set({ principal: false }).where(id ? and(eq(almoxarifados.principal, true), ne(almoxarifados.id, id)) : eq(almoxarifados.principal, true));
    const valores = { nome, endereco: dados.endereco, areaId: dados.areaId, principal: dados.principal, ativo: dados.ativo };
    const [a] = id ? await tx.update(almoxarifados).set(valores).where(eq(almoxarifados.id, id)).returning() : await tx.insert(almoxarifados).values(valores).returning();
    await registrarHistorico(tx, { entidade: "almoxarifado", entidadeId: a.id, acao: id ? "EDITADO" : "CRIADO", descricao: `Almoxarifado “${nome}” ${id ? "alterado" : "criado"}`, usuarioId: usuario.id, dadosDepois: valores });
    return a.id;
  });
}

/* ------------------------------------------------------------------ */
/* Locadores                                                            */
/* ------------------------------------------------------------------ */

export type DadosLocador = { nome: string; contato: string | null; cnpj: string | null; ativo: boolean };

export async function listarLocadores() {
  const db = await getDb();
  return db.select().from(locadores).orderBy(asc(locadores.nome));
}

export async function salvarLocador(usuario: UsuarioAtual, id: string | null, dados: DadosLocador) {
  exigir(usuario, "logistica.cadastros");
  const nome = nomeLimpo(dados.nome, "do locador");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await exigirNomeLivre(await tx.select({ id: locadores.id, nome: locadores.nome }).from(locadores), id, nome);
    const valores = { nome, contato: dados.contato, cnpj: dados.cnpj, ativo: dados.ativo };
    const [l] = id ? await tx.update(locadores).set(valores).where(eq(locadores.id, id)).returning() : await tx.insert(locadores).values(valores).returning();
    if (!l) throw new NaoEncontradoError("Locador");
    await registrarHistorico(tx, { entidade: "locador", entidadeId: l.id, acao: id ? "EDITADO" : "CRIADO", descricao: `Locador “${nome}” ${id ? "alterado" : "criado"}`, usuarioId: usuario.id, dadosDepois: valores });
    return l.id;
  });
}

/* ------------------------------------------------------------------ */
/* Perfis de veículo                                                    */
/* ------------------------------------------------------------------ */

export type DadosPerfil = { tipo: string; nome: string; comprimentoM: number; larguraM: number; alturaM: number; redutorPct: number; referencia: boolean; ativo: boolean };

export async function listarPerfis() {
  const db = await getDb();
  return db.select().from(perfisVeiculo).orderBy(asc(perfisVeiculo.tipo), asc(perfisVeiculo.nome));
}

export async function salvarPerfil(usuario: UsuarioAtual, id: string | null, dados: DadosPerfil) {
  exigir(usuario, "logistica.cadastros");
  const nome = nomeLimpo(dados.nome, "do perfil");
  if (!TIPOS_VEICULO.includes(dados.tipo as TipoVeiculo)) throw new ValidacaoError("Escolha o tipo do veículo.", { tipo: "Carreta, truck ou toco." });
  for (const [campo, v] of [["comprimentoM", dados.comprimentoM], ["larguraM", dados.larguraM], ["alturaM", dados.alturaM]] as const) {
    if (!(v > 0 && v <= 30)) throw new ValidacaoError("Informe as medidas internas em metros.", { [campo]: "Entre 0 e 30 m." });
  }
  if (!Number.isInteger(dados.redutorPct) || dados.redutorPct < 0 || dados.redutorPct > 90) throw new ValidacaoError("O redutor vai de 0 a 90%.", { redutorPct: "De 0 a 90." });
  if (dados.referencia && !dados.ativo) throw new ValidacaoError("O perfil de referência precisa estar ativo.", { referencia: "Ative o perfil." });
  const tipo = dados.tipo as TipoVeiculo;
  const db = await getDb();
  return db.transaction(async (tx) => {
    await exigirNomeLivre(await tx.select({ id: perfisVeiculo.id, nome: perfisVeiculo.nome }).from(perfisVeiculo), id, nome);
    // Um perfil de referência por tipo: marcar este desmarca o outro.
    if (dados.referencia) await tx.update(perfisVeiculo).set({ referencia: false }).where(id ? and(eq(perfisVeiculo.tipo, tipo), ne(perfisVeiculo.id, id)) : eq(perfisVeiculo.tipo, tipo));
    const valores = { tipo, nome, comprimentoM: dados.comprimentoM, larguraM: dados.larguraM, alturaM: dados.alturaM, redutorPct: dados.redutorPct, referencia: dados.referencia, ativo: dados.ativo };
    const [p] = id ? await tx.update(perfisVeiculo).set(valores).where(eq(perfisVeiculo.id, id)).returning() : await tx.insert(perfisVeiculo).values(valores).returning();
    if (!p) throw new NaoEncontradoError("Perfil de veículo");
    await registrarHistorico(tx, { entidade: "perfil_veiculo", entidadeId: p.id, acao: id ? "EDITADO" : "CRIADO", descricao: `Perfil de veículo “${nome}” ${id ? "alterado" : "criado"}`, usuarioId: usuario.id, dadosDepois: valores });
    return p.id;
  });
}

/* ------------------------------------------------------------------ */
/* Evento pai e tour                                                    */
/* ------------------------------------------------------------------ */

export type DadosEventoPai = { nome: string; descricao: string | null; ativo: boolean };

export async function listarEventosPai() {
  const db = await getDb();
  const [lista, usos] = await Promise.all([db.select().from(eventosPai).orderBy(asc(eventosPai.nome)), db.select({ id: eventos.eventoPaiId, n: count() }).from(eventos).groupBy(eventos.eventoPaiId)]);
  const n = new Map(usos.map((u) => [u.id, Number(u.n)]));
  return lista.map((p) => ({ ...p, eventos: n.get(p.id) ?? 0 }));
}

export async function salvarEventoPai(usuario: UsuarioAtual, id: string | null, dados: DadosEventoPai) {
  exigir(usuario, "logistica.cadastros");
  const nome = nomeLimpo(dados.nome, "do evento pai");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await exigirNomeLivre(await tx.select({ id: eventosPai.id, nome: eventosPai.nome }).from(eventosPai), id, nome);
    const valores = { nome, descricao: dados.descricao, ativo: dados.ativo };
    const [p] = id ? await tx.update(eventosPai).set(valores).where(eq(eventosPai.id, id)).returning() : await tx.insert(eventosPai).values(valores).returning();
    if (!p) throw new NaoEncontradoError("Evento pai");
    await registrarHistorico(tx, { entidade: "evento_pai", entidadeId: p.id, acao: id ? "EDITADO" : "CRIADO", descricao: `Evento pai “${nome}” ${id ? "alterado" : "criado"}`, usuarioId: usuario.id, dadosDepois: valores });
    return p.id;
  });
}

export type DadosTour = { nome: string; ativo: boolean; eventoIds: string[] };

export async function listarTours() {
  const db = await getDb();
  const [lista, evs] = await Promise.all([
    db.select().from(tours).orderBy(asc(tours.nome)),
    db.select({ id: eventos.id, codigo: eventos.codigo, nome: eventos.nome, tourId: eventos.tourId, tourOrdem: eventos.tourOrdem, dataInicio: eventos.dataInicio }).from(eventos).orderBy(asc(eventos.tourOrdem), asc(eventos.dataInicio)),
  ]);
  return lista.map((t) => ({ ...t, eventos: evs.filter((e) => e.tourId === t.id) }));
}

/** Cria ou edita o tour com os eventos na ordem dada. O evento só está em um tour: entrar neste tira do outro. */
export async function salvarTour(usuario: UsuarioAtual, id: string | null, dados: DadosTour) {
  exigir(usuario, "logistica.cadastros");
  const nome = nomeLimpo(dados.nome, "do tour");
  if (new Set(dados.eventoIds).size !== dados.eventoIds.length) throw new ValidacaoError("O mesmo evento apareceu duas vezes no tour.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await exigirNomeLivre(await tx.select({ id: tours.id, nome: tours.nome }).from(tours), id, nome);
    const valores = { nome, ativo: dados.ativo };
    const [t] = id ? await tx.update(tours).set(valores).where(eq(tours.id, id)).returning() : await tx.insert(tours).values(valores).returning();
    if (!t) throw new NaoEncontradoError("Tour");
    if (dados.eventoIds.length) {
      const achados = await tx.select({ id: eventos.id }).from(eventos).where(inArray(eventos.id, dados.eventoIds));
      if (achados.length !== dados.eventoIds.length) throw new NaoEncontradoError("Evento");
    }
    await tx.update(eventos).set({ tourId: null, tourOrdem: null }).where(eq(eventos.tourId, t.id));
    for (const [i, eventoId] of dados.eventoIds.entries()) await tx.update(eventos).set({ tourId: t.id, tourOrdem: i + 1 }).where(eq(eventos.id, eventoId));
    await registrarHistorico(tx, { entidade: "tour", entidadeId: t.id, acao: id ? "EDITADO" : "CRIADO", descricao: `Tour “${nome}” ${id ? "alterado" : "criado"}: ${dados.eventoIds.length} ${dados.eventoIds.length === 1 ? "evento" : "eventos"}`, usuarioId: usuario.id, dadosDepois: { ...valores, eventoIds: dados.eventoIds } });
    return t.id;
  });
}

/* ------------------------------------------------------------------ */
/* No evento: datas previstas, evento pai, tour, Estrutura, Atende por  */
/* ------------------------------------------------------------------ */

export type DadosLogisticaEvento = { saidaPrevista: string | null; retornoPrevisto: string | null; eventoPaiId: string | null; tourId: string | null };

async function eventoEditavel(tx: Executor, eventoId: string) {
  await bloquearEvento(tx, eventoId);
  const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
  if (!ev) throw new NaoEncontradoError("Evento");
  if (ev.status === "CANCELADO") throw new DomainError("Evento cancelado não muda mais.");
  return ev;
}

export async function salvarLogisticaEvento(usuario: UsuarioAtual, eventoId: string, dados: DadosLogisticaEvento) {
  exigir(usuario, "evento.datas_previstas");
  if (dados.saidaPrevista && dados.retornoPrevisto && dados.retornoPrevisto < dados.saidaPrevista) throw new ValidacaoError("O retorno precisa ser depois da saída.", { retornoPrevisto: "Antes da saída prevista." });
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await eventoEditavel(tx, eventoId);
    if (dados.eventoPaiId && !(await tx.query.eventosPai.findFirst({ where: eq(eventosPai.id, dados.eventoPaiId), columns: { id: true } }))) throw new NaoEncontradoError("Evento pai");
    if (dados.tourId && !(await tx.query.tours.findFirst({ where: eq(tours.id, dados.tourId), columns: { id: true } }))) throw new NaoEncontradoError("Tour");
    let tourOrdem = ev.tourOrdem;
    if (dados.tourId !== ev.tourId) {
      // Entra no fim da sequência; a ordem se ajusta no cadastro do tour.
      tourOrdem = dados.tourId ? Number((await tx.select({ n: count() }).from(eventos).where(eq(eventos.tourId, dados.tourId)))[0].n) + 1 : null;
    }
    await tx.update(eventos).set({ ...dados, tourOrdem }).where(eq(eventos.id, eventoId));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento",
      entidadeId: eventoId,
      acao: "LOGISTICA_EDITADA",
      descricao: "Dados de logística do evento alterados (saída, retorno, evento pai ou tour)",
      usuarioId: usuario.id,
      dadosAntes: { saidaPrevista: ev.saidaPrevista, retornoPrevisto: ev.retornoPrevisto, eventoPaiId: ev.eventoPaiId, tourId: ev.tourId },
      dadosDepois: dados,
    });
  });
}

export async function salvarEstruturaEvento(usuario: UsuarioAtual, eventoId: string, estrutura: EstruturaEvento, fornecedor: string | null) {
  exigir(usuario, "evento.estrutura");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await eventoEditavel(tx, eventoId);
    const fornecedorEstrutura = estrutura === "TERCEIRIZADA" ? fornecedor?.trim() || null : null;
    await tx.update(eventos).set({ estrutura, fornecedorEstrutura }).where(eq(eventos.id, eventoId));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento",
      entidadeId: eventoId,
      acao: "ESTRUTURA_ALTERADA",
      descricao: `Estrutura do evento: ${ESTRUTURA_LABEL[ev.estrutura]} → ${ESTRUTURA_LABEL[estrutura]}${fornecedorEstrutura ? ` (${fornecedorEstrutura})` : ""}`,
      usuarioId: usuario.id,
      dadosAntes: { estrutura: ev.estrutura, fornecedorEstrutura: ev.fornecedorEstrutura },
      dadosDepois: { estrutura, fornecedorEstrutura },
    });
  });
}

/** `atendePor` null volta a herdar do evento. Almoxarifado e montador só valem para o que sai do galpão. */
export type DadosAtendePor = { atendePor: AtendePor | null; almoxarifadoId: string | null; montador: string | null };

export async function definirAtendePor(usuario: UsuarioAtual, eventoId: string, linhaIds: string[], dados: DadosAtendePor) {
  exigir(usuario, "evento.estrutura");
  if (!linhaIds.length) throw new ValidacaoError("Escolha ao menos uma linha.");
  const sai = dados.atendePor === null || dados.atendePor === "GALPAO_NORTE" || dados.atendePor === "LOCACAO_VIA_GALPAO";
  const valores = { atendePor: dados.atendePor, almoxarifadoId: sai ? dados.almoxarifadoId : null, montador: dados.atendePor === "GALPAO_NORTE" ? dados.montador?.trim() || null : null };
  const db = await getDb();
  return db.transaction(async (tx) => {
    await eventoEditavel(tx, eventoId);
    if (valores.almoxarifadoId && !(await tx.query.almoxarifados.findFirst({ where: and(eq(almoxarifados.id, valores.almoxarifadoId), eq(almoxarifados.ativo, true)), columns: { id: true } }))) {
      throw new ValidacaoError("Almoxarifado inativo ou inexistente.", { almoxarifadoId: "Escolha outro." });
    }
    const linhas = await tx.select({ id: eventoItens.id }).from(eventoItens).where(and(eq(eventoItens.eventoId, eventoId), inArray(eventoItens.id, linhaIds), eq(eventoItens.ativo, true)));
    if (linhas.length !== new Set(linhaIds).size) throw new NaoEncontradoError("Linha do evento");
    await tx.update(eventoItens).set(valores).where(inArray(eventoItens.id, linhaIds));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento",
      entidadeId: eventoId,
      acao: "ATENDE_POR_ALTERADO",
      descricao: `Atende por: ${dados.atendePor ? ATENDE_POR_LABEL[dados.atendePor] : "padrão do evento"}${valores.montador ? `, para ${valores.montador}` : ""} em ${linhaIds.length} ${linhaIds.length === 1 ? "linha" : "linhas"}`,
      usuarioId: usuario.id,
      dadosDepois: { ...valores, linhas: linhaIds },
    });
  });
}

/* ------------------------------------------------------------------ */
/* Ativação → catálogo                                                  */
/* ------------------------------------------------------------------ */

const codigoDoItem = (nome: string) =>
  `ATV-${nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/, "")}`;

export async function vincularItemAtivacao(usuario: UsuarioAtual, itemId: string, pecaId: string) {
  exigir(usuario, "logistica.cadastros");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const item = await tx.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, itemId) });
    if (!item) throw new NaoEncontradoError("Item da Ativação");
    const peca = await tx.query.pecas.findFirst({ where: eq(pecas.id, pecaId), columns: { id: true, codigo: true, nome: true } });
    if (!peca) throw new NaoEncontradoError("Peça");
    await tx.update(estoqueItens).set({ pecaId, atualizadoPorId: usuario.id }).where(eq(estoqueItens.id, itemId));
    await registrarHistorico(tx, { entidade: "estoque_item", entidadeId: itemId, acao: "VINCULADO", descricao: `Item da Ativação “${item.nome}” ligado à peça ${peca.codigo}`, usuarioId: usuario.id, dadosAntes: { pecaId: item.pecaId }, dadosDepois: { pecaId } });
  });
}

/** Cria a peça com o nome do item (setor Arena, categoria da Ativação) e já liga. Tipo e m³ seguem pela pendência do saneamento. */
export async function criarPecaDoItemAtivacao(usuario: UsuarioAtual, itemId: string) {
  exigir(usuario, "logistica.cadastros");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const item = await tx.query.estoqueItens.findFirst({ where: eq(estoqueItens.id, itemId) });
    if (!item) throw new NaoEncontradoError("Item da Ativação");
    if (item.pecaId) throw new DomainError("Este item já está ligado a uma peça.");
    const base = codigoDoItem(item.nome);
    const usados = new Set((await tx.select({ codigo: pecas.codigo }).from(pecas)).map((p) => p.codigo));
    let codigo = base;
    for (let i = 2; usados.has(codigo); i++) codigo = `${base.slice(0, 27)}-${i}`;
    const [p] = await tx.insert(pecas).values({ codigo, nome: item.nome, setor: "ARENA", familia: item.categoria, criadoPorId: usuario.id }).returning();
    await tx.update(estoqueItens).set({ pecaId: p.id, atualizadoPorId: usuario.id }).where(eq(estoqueItens.id, itemId));
    await registrarHistorico(tx, { entidade: "estoque_item", entidadeId: itemId, acao: "VINCULADO", descricao: `Item da Ativação “${item.nome}” virou a peça ${codigo}`, usuarioId: usuario.id, dadosDepois: { pecaId: p.id, codigo } });
    return p;
  });
}
