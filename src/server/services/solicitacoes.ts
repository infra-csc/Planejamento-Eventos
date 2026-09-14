import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, historico, pecas, projetos, solicitacaoItens, solicitacoes, type ItemStatus, type SolicitacaoStatus } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { aceitaSolicitacao, janelaPreReuniaoAberta, tipoSolicitacaoParaStatus } from "@/domain/evento";
import { pode, podeEditarSolicitacao, podeVerSolicitacao } from "@/domain/permissions";
import {
  ITEM_STATUS_LABEL,
  podeCancelar,
  podeCorrigirResposta,
  podeDevolver,
  podeEnviar,
  podeResponder,
  statusAposResposta,
  validarItem,
  validarResposta,
  type ItemRascunho,
} from "@/domain/solicitacao";
import { formatarDataHora } from "@/lib/format";
import { gerarOsVersao } from "./os";
import { snapshotBom } from "./eventos";
import { notificar, obterConfiguracoes, proximoCodigo, registrarHistorico, usuariosDaArea, usuariosLogistica, type Executor } from "./support";

/** Uma resposta a item pode ser desfeita pelo próprio autor por este tempo (toast "Desfazer"). */
export const JANELA_DESFAZER_MS = 10 * 60_000;

/* ------------------------------------------------------------------ */
/* Consultas                                                            */
/* ------------------------------------------------------------------ */

export type FiltroSolicitacoes = {
  eventoId?: string;
  status?: SolicitacaoStatus | "ABERTAS" | "TODAS";
  areaId?: string;
  atrasadas?: boolean;
  somenteMinhaArea?: boolean;
};

export async function listarSolicitacoes(usuario: UsuarioAtual, filtro: FiltroSolicitacoes = {}) {
  const db = await getDb();
  const conds = [eq(solicitacoes.excluida, false)];
  if (!pode(usuario, "solicitacao.ver_todas") || filtro.somenteMinhaArea) {
    if (!usuario.areaId) return [];
    conds.push(eq(solicitacoes.areaId, usuario.areaId));
  }
  if (filtro.eventoId) conds.push(eq(solicitacoes.eventoId, filtro.eventoId));
  if (filtro.areaId) conds.push(eq(solicitacoes.areaId, filtro.areaId));
  if (filtro.status === "ABERTAS") conds.push(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]));
  else if (filtro.status && filtro.status !== "TODAS") conds.push(eq(solicitacoes.status, filtro.status));
  if (filtro.atrasadas) {
    conds.push(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]));
    conds.push(lt(solicitacoes.prazoRespostaEm, new Date()));
  }
  const rows = await db.query.solicitacoes.findMany({
    where: and(...conds),
    with: {
      evento: { columns: { id: true, codigo: true, nome: true, status: true } },
      area: true,
      criadoPor: { columns: { id: true, nome: true } },
      itens: { columns: { id: true, status: true } },
    },
    orderBy: [desc(solicitacoes.atualizadoEm)],
  });
  return rows.map((r) => ({
    ...r,
    totalItens: r.itens.length,
    itensRespondidos: r.itens.filter((i) => i.status !== "EM_ANALISE").length,
  }));
}

export type SolicitacaoLista = Awaited<ReturnType<typeof listarSolicitacoes>>[number];

/** Fila de resposta da logística: abertas, ordenadas por prazo (sem prazo por último). */
export async function listarFila(usuario: UsuarioAtual) {
  const lista = await listarSolicitacoes(usuario, { status: "ABERTAS" });
  return lista.sort((a, b) => (a.prazoRespostaEm?.getTime() ?? Infinity) - (b.prazoRespostaEm?.getTime() ?? Infinity));
}

export async function obterSolicitacao(usuario: UsuarioAtual, id: string) {
  const db = await getDb();
  const s = await db.query.solicitacoes.findFirst({
    where: and(eq(solicitacoes.id, id), eq(solicitacoes.excluida, false)),
    with: {
      evento: true,
      area: true,
      criadoPor: { columns: { id: true, nome: true } },
      itens: {
        with: { projeto: true, peca: true, projetoVersao: true, eventoItem: { with: { projeto: true, peca: true } }, respondidoPor: { columns: { id: true, nome: true } } },
        orderBy: [asc(solicitacaoItens.ordem), asc(solicitacaoItens.criadoEm)],
      },
    },
  });
  if (!s) throw new NaoEncontradoError("Solicitação");
  if (!podeVerSolicitacao(usuario, s)) throw new SemPermissaoError("Esta solicitação pertence a outra área.");
  return s;
}

export type Solicitacao = Awaited<ReturnType<typeof obterSolicitacao>>;
export type SolicitacaoItem = Solicitacao["itens"][number];

export function descricaoItem(i: {
  projeto?: { nome: string } | null;
  peca?: { codigo: string; nome: string } | null;
  descricaoLivre?: string | null;
  eventoItem?: { projeto?: { nome: string } | null; peca?: { codigo: string; nome: string } | null; descricaoLivre: string | null } | null;
  operacao: string;
}) {
  if (i.operacao !== "ADICIONAR" && i.eventoItem) {
    const e = i.eventoItem;
    return e.projeto?.nome ?? (e.peca ? `${e.peca.codigo} · ${e.peca.nome}` : e.descricaoLivre ?? "Linha da ata");
  }
  if (i.projeto) return i.projeto.nome;
  if (i.peca) return `${i.peca.codigo} · ${i.peca.nome}`;
  return i.descricaoLivre ?? "Item";
}

/* ------------------------------------------------------------------ */
/* Rascunho                                                             */
/* ------------------------------------------------------------------ */

async function verificarJanelaPreReuniao(ex: Executor, ev: { dataReuniao: Date }) {
  const cfg = await obterConfiguracoes(ex);
  const horas = Number(cfg.antecedencia_reuniao_horas) || 0;
  if (!janelaPreReuniaoAberta(ev.dataReuniao, horas)) {
    throw new DomainError(`Envios de necessidades encerraram ${horas}h antes da reunião de OS (${formatarDataHora(ev.dataReuniao)}).`);
  }
}

export async function criarRascunho(usuario: UsuarioAtual, eventoId: string) {
  exigir(usuario, "solicitacao.criar");
  if (!usuario.areaId) throw new DomainError("Seu usuário não está vinculado a uma área. Peça ao administrador.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
    if (!ev) throw new NaoEncontradoError("Evento");
    const tipo = tipoSolicitacaoParaStatus(ev.status);
    if (!tipo) throw new DomainError("Este evento não está aceitando solicitações no momento.");
    if (tipo === "PRE_REUNIAO") await verificarJanelaPreReuniao(tx, ev);
    const codigo = await proximoCodigo(tx, "solicitacao");
    const [s] = await tx
      .insert(solicitacoes)
      .values({ codigo, eventoId, areaId: usuario.areaId!, tipo, status: "RASCUNHO", criadoPorId: usuario.id, atualizadoPorId: usuario.id })
      .returning();
    await registrarHistorico(tx, {
      eventoId,
      entidade: "solicitacao",
      entidadeId: s.id,
      acao: "RASCUNHO_CRIADO",
      descricao: `Rascunho ${s.codigo} criado — ${tipo === "PRE_REUNIAO" ? "necessidade pré-reunião" : "alteração pós-ata"}`,
      usuarioId: usuario.id,
    });
    return s;
  });
}

async function carregarEditavel(ex: Executor, usuario: UsuarioAtual, id: string) {
  const s = await ex.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, id), eq(solicitacoes.excluida, false)), with: { evento: true, itens: true } });
  if (!s) throw new NaoEncontradoError("Solicitação");
  if (!podeEditarSolicitacao(usuario, s)) throw new SemPermissaoError("Só usuários da área da solicitação podem editá-la.");
  if (!podeEnviar(s.status)) throw new DomainError("Esta solicitação não está mais em rascunho.");
  return s;
}

export async function atualizarCabecalho(usuario: UsuarioAtual, id: string, dados: { titulo: string | null; observacao: string | null }) {
  const db = await getDb();
  await carregarEditavel(db, usuario, id);
  await db.update(solicitacoes).set({ ...dados, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, id));
}

type DadosItem = ItemRascunho & { justificativa?: string | null };

/** Valida e resolve as referências de um item (projeto/peça/avulso/linha da ata). */
async function prepararItem(tx: Executor, s: { eventoId: string; tipo: "PRE_REUNIAO" | "ALTERACAO" }, dados: DadosItem) {
  validarItem(dados);
  if (s.tipo === "PRE_REUNIAO" && dados.operacao !== "ADICIONAR") throw new DomainError("Necessidades pré-reunião só podem adicionar itens.");
  const valores: Partial<typeof solicitacaoItens.$inferInsert> = {
    operacao: dados.operacao,
    quantidadeSolicitada: dados.operacao === "REMOVER" ? 0 : dados.quantidadeSolicitada,
    destino: dados.destino ?? null,
    justificativa: dados.justificativa ?? null,
    projetoId: null,
    projetoVersaoId: null,
    pecaId: null,
    descricaoLivre: null,
    eventoItemId: null,
  };
  if (dados.operacao === "ADICIONAR") {
    if (dados.projetoId) {
      const p = await tx.query.projetos.findFirst({ where: eq(projetos.id, dados.projetoId) });
      if (!p || !p.ativo) throw new DomainError("Projeto padrão inativo ou inexistente.");
      const snap = await snapshotBom(tx, p.id);
      valores.projetoId = p.id;
      valores.projetoVersaoId = snap.versaoId;
    } else if (dados.pecaId) {
      const pc = await tx.query.pecas.findFirst({ where: eq(pecas.id, dados.pecaId) });
      if (!pc || !pc.ativo) throw new DomainError("Peça inativa ou inexistente.");
      valores.pecaId = pc.id;
    } else {
      valores.descricaoLivre = dados.descricaoLivre!.trim();
    }
  } else {
    const linha = await tx.query.eventoItens.findFirst({
      where: and(eq(eventoItens.id, dados.eventoItemId!), eq(eventoItens.eventoId, s.eventoId), eq(eventoItens.ativo, true)),
    });
    if (!linha) throw new DomainError("A linha da ata escolhida não existe mais.");
    valores.eventoItemId = linha.id;
    if (dados.operacao === "ALTERAR_QUANTIDADE" && dados.quantidadeSolicitada === linha.quantidade) {
      throw new ValidacaoError("A nova quantidade é igual à atual.", { quantidadeSolicitada: "Informe uma quantidade diferente." });
    }
  }
  return valores;
}

export async function salvarItem(usuario: UsuarioAtual, solicitacaoId: string, itemId: string | null, dados: DadosItem) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await carregarEditavel(tx, usuario, solicitacaoId);
    const valores = await prepararItem(tx, s, dados);
    let id = itemId;
    if (itemId) {
      if (!s.itens.some((i) => i.id === itemId)) throw new NaoEncontradoError("Item");
      await tx.update(solicitacaoItens).set(valores).where(eq(solicitacaoItens.id, itemId));
    } else {
      const [novo] = await tx
        .insert(solicitacaoItens)
        .values({ ...(valores as typeof solicitacaoItens.$inferInsert), solicitacaoId, ordem: s.itens.length })
        .returning();
      id = novo.id;
    }
    await tx.update(solicitacoes).set({ atualizadoPorId: usuario.id, atualizadoEm: new Date() }).where(eq(solicitacoes.id, solicitacaoId));
    return id!;
  });
}

export async function removerItem(usuario: UsuarioAtual, solicitacaoId: string, itemId: string) {
  const db = await getDb();
  await carregarEditavel(db, usuario, solicitacaoId);
  await db.delete(solicitacaoItens).where(and(eq(solicitacaoItens.id, itemId), eq(solicitacaoItens.solicitacaoId, solicitacaoId)));
}

export async function excluirRascunho(usuario: UsuarioAtual, id: string) {
  const db = await getDb();
  const s = await carregarEditavel(db, usuario, id);
  if (s.status !== "RASCUNHO") throw new DomainError("Só rascunhos podem ser excluídos. Use cancelar.");
  await db.update(solicitacoes).set({ excluida: true }).where(eq(solicitacoes.id, id));
}

export type DadosSolicitacaoCompleta = {
  id?: string | null;
  eventoId: string;
  titulo: string | null;
  observacao: string | null;
  enviar: boolean;
  itens: DadosItem[];
};

export const MSG_TITULO_OBRIGATORIO = "Dê um título para a logística identificar a solicitação na fila.";

/**
 * Formulário único de solicitação (handoff §5.11): cria ou atualiza o rascunho com todos os
 * itens de uma vez e, se pedido, envia. Se o envio falhar por regra do evento, o rascunho
 * fica salvo e o erro volta em `erroEnvio`.
 */
export async function salvarSolicitacaoCompleta(usuario: UsuarioAtual, dados: DadosSolicitacaoCompleta): Promise<{ id: string; codigo: string; enviada: boolean; erroEnvio: string | null }> {
  exigir(usuario, "solicitacao.criar");
  if (dados.enviar) {
    const campos: Record<string, string> = {};
    if (!dados.titulo) campos.titulo = MSG_TITULO_OBRIGATORIO;
    if (dados.itens.length === 0) campos.itens = "Adicione ao menos um item.";
    if (Object.keys(campos).length) throw new ValidacaoError("Falta preencher antes de enviar.", campos);
  }
  dados.itens.forEach((i) => validarItem(i));

  const db = await getDb();
  const novo = !dados.id;
  let id: string;
  if (dados.id) {
    const atual = await carregarEditavel(db, usuario, dados.id);
    if (atual.eventoId !== dados.eventoId) throw new DomainError("Para trocar de evento, exclua este rascunho e crie outro.");
    id = dados.id;
  } else {
    id = (await criarRascunho(usuario, dados.eventoId)).id;
  }

  let codigo: string;
  try {
    codigo = await db.transaction(async (tx) => {
      const s = await carregarEditavel(tx, usuario, id);
      await tx
        .update(solicitacoes)
        .set({ titulo: dados.titulo, observacao: dados.observacao, atualizadoPorId: usuario.id, atualizadoEm: new Date() })
        .where(eq(solicitacoes.id, id));
      await tx.delete(solicitacaoItens).where(eq(solicitacaoItens.solicitacaoId, id));
      let ordem = 0;
      for (const item of dados.itens) {
        const valores = await prepararItem(tx, s, item);
        await tx.insert(solicitacaoItens).values({ ...(valores as typeof solicitacaoItens.$inferInsert), solicitacaoId: id, ordem: ordem++ });
      }
      return s.codigo;
    });
  } catch (e) {
    if (novo) await db.update(solicitacoes).set({ excluida: true }).where(eq(solicitacoes.id, id));
    throw e;
  }

  if (!dados.enviar) return { id, codigo, enviada: false, erroEnvio: null };
  try {
    await enviarSolicitacao(usuario, id);
    return { id, codigo, enviada: true, erroEnvio: null };
  } catch (e) {
    if (e instanceof DomainError) return { id, codigo, enviada: false, erroEnvio: e.message };
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Enviar / cancelar / devolver                                         */
/* ------------------------------------------------------------------ */

export async function enviarSolicitacao(usuario: UsuarioAtual, id: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await carregarEditavel(tx, usuario, id);
    if (s.itens.length === 0) throw new DomainError("Adicione ao menos um item antes de enviar.");
    if (!aceitaSolicitacao(s.evento.status, s.tipo)) {
      const motivo =
        s.evento.status === "ENCERRADO"
          ? `O evento foi encerrado para alterações${s.evento.encerradoEm ? ` em ${formatarDataHora(s.evento.encerradoEm)}` : ""}. O rascunho foi preservado.`
          : "O evento não está aceitando este tipo de solicitação no momento. O rascunho foi preservado.";
      throw new DomainError(motivo);
    }
    if (s.tipo === "PRE_REUNIAO") await verificarJanelaPreReuniao(tx, s.evento);
    const cfg = await obterConfiguracoes(tx);
    const agora = new Date();
    // Pré-reunião é respondida na reunião de OS: o prazo é a própria reunião.
    // Alteração pós-ata tem o prazo padrão (48h) a partir do envio.
    const prazo =
      s.tipo === "PRE_REUNIAO" && s.evento.dataReuniao.getTime() > agora.getTime()
        ? s.evento.dataReuniao
        : new Date(agora.getTime() + Number(cfg.sla_resposta_horas) * 3_600_000);
    // Idempotente: só RASCUNHO/DEVOLVIDA → ENVIADA
    const res = await tx
      .update(solicitacoes)
      .set({ status: "ENVIADA", enviadaEm: agora, prazoRespostaEm: prazo, devolvidaMotivo: null, atualizadoPorId: usuario.id })
      .where(and(eq(solicitacoes.id, id), inArray(solicitacoes.status, ["RASCUNHO", "DEVOLVIDA"])))
      .returning({ id: solicitacoes.id });
    if (res.length === 0) throw new DomainError("A solicitação já foi enviada.");
    await tx.update(solicitacaoItens).set({ status: "EM_ANALISE" }).where(eq(solicitacaoItens.solicitacaoId, id));
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao",
      entidadeId: id,
      acao: "ENVIADA",
      descricao: `${s.codigo} enviada pela ${usuario.areaNome ?? "área"} — ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"} · prazo ${formatarDataHora(prazo)}`,
      usuarioId: usuario.id,
    });
    await notificar(tx, {
      usuarioIds: await usuariosLogistica(tx),
      tipo: "SOLICITACAO_ENVIADA",
      titulo: s.tipo === "PRE_REUNIAO" ? "Nova necessidade pré-reunião" : "Nova solicitação de alteração",
      mensagem: `${s.codigo} · ${usuario.areaNome ?? "Área"} · ${s.evento.nome} · ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}`,
      link: `/solicitacoes/${id}`,
    });
    return { codigo: s.codigo, prazo };
  });
}

export async function cancelarSolicitacao(usuario: UsuarioAtual, id: string, motivo: string | null) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, id), with: { itens: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    if (!podeEditarSolicitacao(usuario, s)) throw new SemPermissaoError();
    const algumRespondido = s.itens.some((i) => i.status !== "EM_ANALISE");
    if (!podeCancelar(s.status, algumRespondido)) throw new DomainError("A solicitação já começou a ser respondida e não pode mais ser cancelada.");
    await tx.update(solicitacoes).set({ status: "CANCELADA", canceladaEm: new Date(), canceladaMotivo: motivo, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, id));
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao",
      entidadeId: id,
      acao: "CANCELADA",
      descricao: `${s.codigo} cancelada pelo solicitante${motivo ? ` — ${motivo}` : ""}`,
      usuarioId: usuario.id,
    });
  });
}

export async function devolverSolicitacao(usuario: UsuarioAtual, id: string, motivo: string) {
  exigir(usuario, "solicitacao.responder");
  if (!motivo.trim()) throw new ValidacaoError("Informe o motivo da devolução.", { justificativa: "Obrigatório." });
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, id), with: { itens: true, evento: true, area: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    if (!podeDevolver(s.status, s.itens.some((i) => i.status !== "EM_ANALISE"))) throw new DomainError("Só solicitações enviadas e ainda sem resposta podem ser devolvidas.");
    await tx.update(solicitacoes).set({ status: "DEVOLVIDA", devolvidaMotivo: motivo, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, id));
    await registrarHistorico(tx, { eventoId: s.eventoId, entidade: "solicitacao", entidadeId: id, acao: "DEVOLVIDA", descricao: `${s.codigo} devolvida para ajuste — ${motivo}`, usuarioId: usuario.id });
    await notificar(tx, {
      usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
      tipo: "SOLICITACAO_DEVOLVIDA",
      titulo: `${s.codigo} devolvida para ajuste`,
      mensagem: `${s.area.nome} · ${motivo}`,
      link: `/solicitacoes/${id}`,
    });
  });
}

/* ------------------------------------------------------------------ */
/* Resposta por item (RN-03..RN-07)                                     */
/* ------------------------------------------------------------------ */

type Resposta = { status: ItemStatus; quantidadeAtendida?: number | null; observacaoLogistica?: string | null; pendenciaCompra?: boolean };

/** Aplica o efeito de uma resposta nas linhas da ata. */
async function aplicarEfeito(
  tx: Executor,
  usuario: UsuarioAtual,
  s: { id: string; eventoId: string; areaId: string },
  item: typeof solicitacaoItens.$inferSelect,
  resp: { status: ItemStatus; quantidadeAtendida: number },
): Promise<{ eventoItemGeradoId: string | null; quantidadeAnterior: number | null }> {
  if (item.operacao === "ADICIONAR") {
    if (item.eventoItemGeradoId) {
      if (resp.quantidadeAtendida > 0) {
        await tx.update(eventoItens).set({ quantidade: resp.quantidadeAtendida, ativo: true, removidoEm: null, removidoPorId: null }).where(eq(eventoItens.id, item.eventoItemGeradoId));
      } else {
        await tx.update(eventoItens).set({ ativo: false, removidoEm: new Date(), removidoPorId: usuario.id }).where(eq(eventoItens.id, item.eventoItemGeradoId));
      }
      return { eventoItemGeradoId: item.eventoItemGeradoId, quantidadeAnterior: null };
    }
    if (resp.quantidadeAtendida <= 0) return { eventoItemGeradoId: null, quantidadeAnterior: null };
    let valores: typeof eventoItens.$inferInsert;
    const base = { eventoId: s.eventoId, quantidade: resp.quantidadeAtendida, destino: item.destino, areaId: s.areaId, origem: "SOLICITACAO" as const, solicitacaoItemId: item.id, criadoPorId: usuario.id };
    if (item.projetoId) {
      const snap = await snapshotBom(tx, item.projetoId);
      valores = { ...base, tipo: "PROJETO", projetoId: item.projetoId, projetoVersaoId: snap.versaoId, bomSnapshot: snap.bom };
    } else if (item.pecaId) {
      valores = { ...base, tipo: "PECA", pecaId: item.pecaId };
    } else {
      valores = { ...base, tipo: "AVULSO", descricaoLivre: item.descricaoLivre };
    }
    const [linha] = await tx.insert(eventoItens).values(valores).returning({ id: eventoItens.id });
    return { eventoItemGeradoId: linha.id, quantidadeAnterior: null };
  }

  const alvo = await tx.query.eventoItens.findFirst({ where: eq(eventoItens.id, item.eventoItemId!) });
  if (!alvo) throw new DomainError("A linha da ata referenciada não existe mais.");
  const anterior = item.quantidadeAnterior ?? alvo.quantidade;

  if (item.operacao === "ALTERAR_QUANTIDADE") {
    const nova = resp.status === "NAO_ATENDIDO" ? anterior : resp.quantidadeAtendida;
    await tx.update(eventoItens).set({ quantidade: nova }).where(eq(eventoItens.id, alvo.id));
    return { eventoItemGeradoId: alvo.id, quantidadeAnterior: anterior };
  }
  // REMOVER
  if (resp.status === "ATENDIDO") {
    await tx.update(eventoItens).set({ ativo: false, removidoEm: new Date(), removidoPorId: usuario.id }).where(eq(eventoItens.id, alvo.id));
  } else {
    await tx.update(eventoItens).set({ ativo: true, removidoEm: null, removidoPorId: null }).where(eq(eventoItens.id, alvo.id));
  }
  return { eventoItemGeradoId: alvo.id, quantidadeAnterior: anterior };
}

function verificarFaseResposta(s: { tipo: "PRE_REUNIAO" | "ALTERACAO"; evento: { status: string } }) {
  const estadoEv = s.evento.status;
  if (s.tipo === "PRE_REUNIAO" && !(estadoEv === "PREPARACAO" || estadoEv === "EM_REUNIAO")) throw new DomainError("Necessidades pré-reunião só podem ser respondidas antes de fechar a ata.");
  if (s.tipo === "ALTERACAO" && estadoEv !== "ABERTO") throw new DomainError("O evento não está aberto a alterações.");
}

export async function responderItem(usuario: UsuarioAtual, itemId: string, resposta: Resposta, justificativaCorrecao?: string | null) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const item = await tx.query.solicitacaoItens.findFirst({
      where: eq(solicitacaoItens.id, itemId),
      with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } } },
    });
    if (!item) throw new NaoEncontradoError("Item");
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, item.solicitacaoId), with: { evento: true, itens: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");

    const correcao = item.status !== "EM_ANALISE";
    if (correcao) {
      if (!podeCorrigirResposta(s.status) && s.status !== "EM_ANALISE") throw new DomainError("Este item não pode ser corrigido.");
      if (!justificativaCorrecao?.trim()) throw new ValidacaoError("Informe a justificativa da correção.", { justificativa: "Obrigatória para corrigir uma resposta." });
    } else if (!podeResponder(s.status)) {
      throw new DomainError("A solicitação não está aguardando resposta.");
    }
    verificarFaseResposta(s);

    const r = validarResposta(item, resposta);
    const efeito = await aplicarEfeito(tx, usuario, s, item, r);
    await tx
      .update(solicitacaoItens)
      .set({
        status: r.status,
        quantidadeAtendida: r.quantidadeAtendida,
        observacaoLogistica: r.observacaoLogistica,
        pendenciaCompra: r.pendenciaCompra,
        respondidoPorId: usuario.id,
        respondidoEm: new Date(),
        eventoItemGeradoId: efeito.eventoItemGeradoId,
        quantidadeAnterior: efeito.quantidadeAnterior ?? item.quantidadeAnterior,
      })
      .where(eq(solicitacaoItens.id, itemId));

    const novoStatus = statusAposResposta(s.itens.map((i) => (i.id === itemId ? { status: r.status } : { status: i.status })));
    await tx
      .update(solicitacoes)
      .set({ status: novoStatus, respondidaEm: novoStatus === "RESPONDIDA" ? new Date() : null, atualizadoPorId: usuario.id })
      .where(eq(solicitacoes.id, s.id));

    const desc = descricaoItem(item);
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao_item",
      entidadeId: itemId,
      acao: correcao ? "RESPOSTA_CORRIGIDA" : "RESPONDIDO",
      descricao: `${s.codigo} · ${desc}: ${ITEM_STATUS_LABEL[r.status].toLowerCase()} (${r.quantidadeAtendida} de ${item.quantidadeSolicitada})${
        r.observacaoLogistica || correcao ? ` — ${[r.observacaoLogistica, correcao ? `correção: ${justificativaCorrecao}` : null].filter(Boolean).join(" · ")}` : ""
      }`,
      usuarioId: usuario.id,
      dadosAntes: correcao ? { status: item.status, quantidadeAtendida: item.quantidadeAtendida, observacaoLogistica: item.observacaoLogistica } : null,
      dadosDepois: r,
    });

    if (s.tipo === "ALTERACAO") {
      await gerarOsVersao(tx, s.eventoId, correcao ? "CORRECAO_RESPOSTA" : "RESPOSTA_SOLICITACAO", usuario.id, `${s.codigo} · ${desc} — ${ITEM_STATUS_LABEL[r.status].toLowerCase()}`);
    }
    // RN-07: solicitante notificado item a item
    await notificar(tx, {
      usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
      tipo: "ITEM_RESPONDIDO",
      titulo: `${s.codigo}: ${desc} — ${ITEM_STATUS_LABEL[r.status].toLowerCase()}`,
      mensagem:
        r.status === "ATENDIDO"
          ? `Atendido integralmente (${r.quantidadeAtendida}).`
          : `${r.quantidadeAtendida} de ${item.quantidadeSolicitada}. ${r.observacaoLogistica}${correcao ? " (resposta corrigida)" : ""}`,
      link: `/solicitacoes/${s.id}`,
    });
    return { status: novoStatus, codigo: s.codigo, descricao: desc, podeDesfazer: !correcao, solicitacaoId: s.id, eventoId: s.eventoId };
  });
}

/** "Atender tudo": responde como atendido todos os itens ainda em análise. */
export async function atenderTudo(usuario: UsuarioAtual, solicitacaoId: string) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  const pendentes = await db
    .select({ id: solicitacaoItens.id })
    .from(solicitacaoItens)
    .where(and(eq(solicitacaoItens.solicitacaoId, solicitacaoId), eq(solicitacaoItens.status, "EM_ANALISE")))
    .orderBy(asc(solicitacaoItens.ordem));
  if (!pendentes.length) throw new DomainError("Todos os itens já foram respondidos.");
  for (const i of pendentes) await responderItem(usuario, i.id, { status: "ATENDIDO" });
  return pendentes.length;
}

/**
 * Desfaz a primeira resposta a um item (toast "Desfazer"): só o autor, dentro da janela,
 * e só quando a última ação sobre o item foi essa resposta. Correções não são desfeitas
 * por aqui — use "Corrigir".
 */
export async function desfazerResposta(usuario: UsuarioAtual, itemId: string) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const item = await tx.query.solicitacaoItens.findFirst({
      where: eq(solicitacaoItens.id, itemId),
      with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } } },
    });
    if (!item) throw new NaoEncontradoError("Item");
    const [ultimo] = await tx
      .select({ acao: historico.acao, usuarioId: historico.usuarioId, criadoEm: historico.criadoEm })
      .from(historico)
      .where(and(eq(historico.entidade, "solicitacao_item"), eq(historico.entidadeId, itemId)))
      .orderBy(desc(historico.criadoEm))
      .limit(1);
    if (item.status === "EM_ANALISE" || !ultimo || ultimo.acao !== "RESPONDIDO" || ultimo.usuarioId !== usuario.id || Date.now() - ultimo.criadoEm.getTime() > JANELA_DESFAZER_MS) {
      throw new DomainError("Esta resposta não pode mais ser desfeita. Use “Corrigir”.");
    }
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, item.solicitacaoId), with: { evento: true, itens: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    verificarFaseResposta(s);

    if (item.operacao === "ADICIONAR" && item.eventoItemGeradoId) {
      await tx.update(eventoItens).set({ ativo: false, removidoEm: new Date(), removidoPorId: usuario.id }).where(eq(eventoItens.id, item.eventoItemGeradoId));
    } else if (item.operacao === "ALTERAR_QUANTIDADE" && item.eventoItemId && item.quantidadeAnterior != null) {
      await tx.update(eventoItens).set({ quantidade: item.quantidadeAnterior }).where(eq(eventoItens.id, item.eventoItemId));
    } else if (item.operacao === "REMOVER" && item.eventoItemId) {
      await tx.update(eventoItens).set({ ativo: true, removidoEm: null, removidoPorId: null }).where(eq(eventoItens.id, item.eventoItemId));
    }
    await tx
      .update(solicitacaoItens)
      .set({ status: "EM_ANALISE", quantidadeAtendida: null, observacaoLogistica: null, pendenciaCompra: false, respondidoPorId: null, respondidoEm: null })
      .where(eq(solicitacaoItens.id, itemId));
    const novoStatus = statusAposResposta(s.itens.map((i) => (i.id === itemId ? { status: "EM_ANALISE" as const } : { status: i.status })));
    await tx.update(solicitacoes).set({ status: novoStatus, respondidaEm: null, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, s.id));

    const descricao = descricaoItem(item);
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao_item",
      entidadeId: itemId,
      acao: "RESPOSTA_DESFEITA",
      descricao: `${s.codigo} · ${descricao}: resposta desfeita — voltou para análise`,
      usuarioId: usuario.id,
    });
    if (s.tipo === "ALTERACAO") await gerarOsVersao(tx, s.eventoId, "CORRECAO_RESPOSTA", usuario.id, `${s.codigo} · ${descricao} — resposta desfeita`);
    await notificar(tx, {
      usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
      tipo: "ITEM_RESPONDIDO",
      titulo: `${s.codigo}: ${descricao} voltou para análise`,
      mensagem: "A logística desfez a resposta anterior. Uma nova resposta será enviada.",
      link: `/solicitacoes/${s.id}`,
    });
    return { codigo: s.codigo, descricao };
  });
}

/* ------------------------------------------------------------------ */
/* Pendências de compra/locação (RV-11)                                 */
/* ------------------------------------------------------------------ */

export async function listarPendenciasCompra(usuario: UsuarioAtual) {
  exigir(usuario, "pendencias.ver");
  const db = await getDb();
  const rows = await db.query.solicitacaoItens.findMany({
    where: eq(solicitacaoItens.pendenciaCompra, true),
    with: {
      solicitacao: { with: { evento: { columns: { id: true, codigo: true, nome: true, status: true, dataMontagem: true } }, area: true } },
      projeto: true,
      peca: true,
      eventoItem: { with: { projeto: true, peca: true } },
    },
    orderBy: [desc(solicitacaoItens.respondidoEm)],
  });
  return rows.map((r) => ({ ...r, descricao: descricaoItem(r), faltante: r.quantidadeSolicitada - (r.quantidadeAtendida ?? 0) }));
}
