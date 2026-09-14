import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  ataVersoes,
  eventoItens,
  eventos,
  historico,
  pecas,
  projetoItens,
  projetoVersoes,
  projetos,
  solicitacaoItens,
  solicitacoes,
  type AtaConteudo,
  type BomSnapshotLinha,
  type EventoStatus,
} from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { TRANSICOES_EVENTO, transicaoPermitida, type AcaoEvento } from "@/domain/evento";
import { descricaoLinha } from "@/domain/os";
import { formatarData } from "@/lib/format";
import { gerarOsVersao, montarLinhasAta } from "./os";
import { notificar, obterConfiguracoes, proximoCodigo, registrarHistorico, usuariosDaArea, usuariosLogistica, usuariosRequisitantes, type Executor } from "./support";

/* ------------------------------------------------------------------ */
/* Consultas                                                            */
/* ------------------------------------------------------------------ */

export type FiltroEventos = { status?: EventoStatus | "TODOS"; busca?: string; deData?: string; ateData?: string };

export async function listarEventos(usuario: UsuarioAtual, filtro: FiltroEventos = {}) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const conds = [];
  if (filtro.status && filtro.status !== "TODOS") conds.push(eq(eventos.status, filtro.status));
  if (filtro.busca) {
    const b = `%${filtro.busca.trim()}%`;
    conds.push(or(ilike(eventos.nome, b), ilike(eventos.codigo, b), ilike(eventos.cliente, b), ilike(eventos.local, b)));
  }
  if (filtro.deData) conds.push(sql`${eventos.dataFim} >= ${filtro.deData}`);
  if (filtro.ateData) conds.push(sql`${eventos.dataInicio} <= ${filtro.ateData}`);

  const rows = await db.query.eventos.findMany({
    where: conds.length ? and(...conds) : undefined,
    with: { responsavel: { columns: { id: true, nome: true } } },
    orderBy: [desc(eventos.dataInicio)],
  });

  // Contagem de solicitações abertas por evento (uma query)
  const abertas = await db
    .select({ eventoId: solicitacoes.eventoId, n: count() })
    .from(solicitacoes)
    .where(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]))
    .groupBy(solicitacoes.eventoId);
  const mapa = new Map(abertas.map((a) => [a.eventoId, Number(a.n)]));
  return rows.map((r) => ({ ...r, solicitacoesAbertas: mapa.get(r.id) ?? 0 }));
}

export async function obterEvento(usuario: UsuarioAtual, id: string) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const ev = await db.query.eventos.findFirst({
    where: eq(eventos.id, id),
    with: { responsavel: { columns: { id: true, nome: true, email: true } } },
  });
  if (!ev) throw new NaoEncontradoError("Evento");
  return ev;
}

export async function obterLinhasAta(eventoId: string) {
  const db = await getDb();
  const linhas = await montarLinhasAta(db, eventoId);
  // Marca linhas de projeto cuja versão ficou defasada (MEL-02)
  return linhas.map((l) => ({
    ...l,
    descricao: descricaoLinha(l),
    versaoDefasada: l.tipo === "PROJETO" && l.registro.projeto ? (l.registro.projetoVersao?.numero ?? 0) < l.registro.projeto.versaoAtual : false,
  }));
}

export async function obterHistoricoEvento(usuario: UsuarioAtual, eventoId: string) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  return db.query.historico.findMany({
    where: eq(historico.eventoId, eventoId),
    with: { usuario: { columns: { id: true, nome: true } } },
    orderBy: [desc(historico.criadoEm)],
    limit: 300,
  });
}

export async function listarAtaVersoes(eventoId: string) {
  const db = await getDb();
  return db.query.ataVersoes.findMany({
    where: eq(ataVersoes.eventoId, eventoId),
    with: { fechadaPor: { columns: { id: true, nome: true } } },
    orderBy: [desc(ataVersoes.numero)],
  });
}

export async function resumoSolicitacoesEvento(eventoId: string) {
  const db = await getDb();
  const rows = await db
    .select({ status: solicitacoes.status, tipo: solicitacoes.tipo, n: count() })
    .from(solicitacoes)
    .where(and(eq(solicitacoes.eventoId, eventoId), eq(solicitacoes.excluida, false)))
    .groupBy(solicitacoes.status, solicitacoes.tipo);
  return rows.map((r) => ({ ...r, n: Number(r.n) }));
}

/* ------------------------------------------------------------------ */
/* Criar / editar                                                       */
/* ------------------------------------------------------------------ */

export type DadosEvento = {
  nome: string;
  cliente: string | null;
  local: string | null;
  dataMontagem: string;
  dataInicio: string;
  dataFim: string;
  dataDesmontagem: string;
  dataReuniao: Date;
  dataCarga: string | null;
  responsavelId: string;
};

export async function criarEvento(usuario: UsuarioAtual, dados: DadosEvento) {
  exigir(usuario, "evento.criar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const codigo = await proximoCodigo(tx, "evento");
    const [ev] = await tx
      .insert(eventos)
      .values({ ...dados, cliente: dados.cliente ?? "", local: dados.local ?? "", codigo, criadoPorId: usuario.id })
      .returning();
    await registrarHistorico(tx, {
      eventoId: ev.id,
      entidade: "evento",
      entidadeId: ev.id,
      acao: "CRIADO",
      descricao: `Evento ${ev.codigo} criado em preparação.`,
      usuarioId: usuario.id,
      dadosDepois: dados,
    });
    await notificar(tx, {
      usuarioIds: await usuariosRequisitantes(tx),
      tipo: "EVENTO_CRIADO",
      titulo: `Novo evento: ${ev.nome}`,
      mensagem: `Registre as necessidades da sua área até a reunião de OS (${formatarData(dados.dataReuniao.toISOString().slice(0, 10))}).`,
      link: `/eventos/${ev.id}`,
    });
    return ev;
  });
}

export async function editarEvento(usuario: UsuarioAtual, id: string, dados: DadosEvento) {
  exigir(usuario, "evento.editar");
  const db = await getDb();
  const atual = await db.query.eventos.findFirst({ where: eq(eventos.id, id) });
  if (!atual) throw new NaoEncontradoError("Evento");
  if (atual.status === "CANCELADO") throw new DomainError("Evento cancelado não pode ser editado.");
  return db.transaction(async (tx) => {
    const [ev] = await tx
      .update(eventos)
      .set({ ...dados, cliente: dados.cliente ?? "", local: dados.local ?? "" })
      .where(eq(eventos.id, id))
      .returning();
    const antes = {
      nome: atual.nome,
      cliente: atual.cliente,
      local: atual.local,
      dataMontagem: atual.dataMontagem,
      dataInicio: atual.dataInicio,
      dataFim: atual.dataFim,
      dataDesmontagem: atual.dataDesmontagem,
      dataReuniao: atual.dataReuniao,
      dataCarga: atual.dataCarga,
      responsavelId: atual.responsavelId,
    };
    await registrarHistorico(tx, {
      eventoId: id,
      entidade: "evento",
      entidadeId: id,
      acao: "EDITADO",
      descricao: "Dados do evento alterados.",
      usuarioId: usuario.id,
      dadosAntes: antes,
      dadosDepois: dados,
    });
    return ev;
  });
}

/* ------------------------------------------------------------------ */
/* Máquina de estados                                                   */
/* ------------------------------------------------------------------ */

export async function solicitacoesPendentes(ex: Executor, eventoId: string) {
  return ex.query.solicitacoes.findMany({
    where: and(eq(solicitacoes.eventoId, eventoId), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"])),
    with: { area: true },
    columns: { id: true, codigo: true, tipo: true, status: true, titulo: true },
  });
}

async function montarAtaConteudo(ex: Executor, eventoId: string, observacoes: string | null): Promise<AtaConteudo> {
  const linhas = await montarLinhasAta(ex, eventoId);
  const sols = await ex.query.solicitacoes.findMany({
    where: and(eq(solicitacoes.eventoId, eventoId), eq(solicitacoes.tipo, "PRE_REUNIAO"), inArray(solicitacoes.status, ["RESPONDIDA"])),
    with: { area: true, itens: { with: { projeto: true, peca: true } } },
  });
  return {
    observacoes,
    linhas: linhas.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      descricao: descricaoLinha(l),
      codigo: l.projeto?.codigo ?? l.peca?.codigo ?? null,
      versao: l.projeto?.versao ?? null,
      quantidade: l.quantidade,
      destino: l.destino,
      area: l.areaNome,
      origem: l.registro.origem,
    })),
    solicitacoesPreReuniao: sols.map((s) => ({
      codigo: s.codigo,
      area: s.area.nome,
      itens: s.itens.map((i) => ({
        descricao: i.projeto?.nome ?? (i.peca ? `${i.peca.codigo} · ${i.peca.nome}` : i.descricaoLivre ?? ""),
        solicitada: i.quantidadeSolicitada,
        atendida: i.quantidadeAtendida ?? 0,
        status: i.status,
        observacao: i.observacaoLogistica,
      })),
    })),
  };
}

export async function transicionarEvento(usuario: UsuarioAtual, id: string, acao: AcaoEvento, justificativa?: string | null) {
  const t = TRANSICOES_EVENTO[acao];
  if (!t.perfis.includes(usuario.perfil)) throw new SemPermissaoError();
  if (acao === "REABRIR") exigir(usuario, "evento.reabrir");
  else exigir(usuario, "evento.transicionar");
  const just = justificativa?.trim() || null;
  if (t.exigeJustificativa && !just) throw new ValidacaoError("Informe a justificativa.", { justificativa: "Obrigatória para esta ação." });

  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, id) });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (!transicaoPermitida(ev.status, acao)) {
      throw new DomainError(`Ação "${t.label}" não é possível no estado atual do evento.`);
    }
    const cfg = await obterConfiguracoes(tx);
    const agora = new Date();
    const patch: Partial<typeof eventos.$inferInsert> = { status: t.para };

    if (acao === "FECHAR_ATA") {
      const pend = await tx
        .select({ n: count() })
        .from(solicitacaoItens)
        .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
        .where(and(eq(solicitacoes.eventoId, id), eq(solicitacoes.tipo, "PRE_REUNIAO"), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"])));
      if (Number(pend[0].n) > 0) {
        throw new DomainError("Ainda existem itens de necessidades pré-reunião sem resposta. Responda todos antes de fechar a ata.");
      }
      const [ultima] = await tx.select({ numero: ataVersoes.numero }).from(ataVersoes).where(eq(ataVersoes.eventoId, id)).orderBy(desc(ataVersoes.numero)).limit(1);
      const conteudo = await montarAtaConteudo(tx, id, ev.observacoesReuniao);
      await tx.insert(ataVersoes).values({ eventoId: id, numero: (ultima?.numero ?? 0) + 1, conteudo, fechadaPorId: usuario.id });
      await gerarOsVersao(tx, id, "ATA_FECHADA", usuario.id, "Ata fechada");
      patch.ataFechadaEm = agora;
      patch.ataFechadaPorId = usuario.id;
    }

    if (acao === "ENCERRAR") {
      if (cfg.bloquear_encerramento_com_pendentes === "true") {
        const pend = await solicitacoesPendentes(tx, id);
        if (pend.length > 0) {
          throw new DomainError(
            `Existem ${pend.length} solicitação(ões) sem resposta (${pend.map((p) => p.codigo).join(", ")}). Responda ou devolva todas antes de encerrar.`,
          );
        }
      }
      await gerarOsVersao(tx, id, "ENCERRAMENTO", usuario.id, "OS final — evento encerrado para alterações");
      patch.encerradoEm = agora;
      patch.encerradoPorId = usuario.id;
    }

    if (acao === "REABRIR") {
      patch.reabertoVezes = ev.reabertoVezes + 1;
      patch.encerradoEm = null;
      patch.encerradoPorId = null;
      await gerarOsVersao(tx, id, "REABERTURA", usuario.id, `Reaberto em exceção: ${just}`);
    }

    if (acao === "CANCELAR") {
      patch.canceladoEm = agora;
      patch.canceladoPorId = usuario.id;
      patch.canceladoMotivo = just;
      await tx
        .update(solicitacoes)
        .set({ status: "CANCELADA", canceladaEm: agora, canceladaMotivo: "Evento cancelado" })
        .where(and(eq(solicitacoes.eventoId, id), inArray(solicitacoes.status, ["RASCUNHO", "ENVIADA", "EM_ANALISE", "DEVOLVIDA"])));
    }

    await tx.update(eventos).set(patch).where(eq(eventos.id, id));
    await registrarHistorico(tx, {
      eventoId: id,
      entidade: "evento",
      entidadeId: id,
      acao,
      descricao: `${t.label}${just ? ` — ${just}` : ""}`,
      usuarioId: usuario.id,
      dadosAntes: { status: ev.status },
      dadosDepois: { status: t.para },
    });

    const destinatarios = [...(await usuariosRequisitantes(tx)), ...(acao === "REABRIR" ? await usuariosLogistica(tx) : [])];
    const mensagens: Record<AcaoEvento, [string, string]> = {
      INICIAR_REUNIAO: [`Reunião de OS iniciada: ${ev.nome}`, "Envios de necessidades pausados enquanto a logística consolida a ata."],
      VOLTAR_PREPARACAO: [`Reunião adiada: ${ev.nome}`, `${just}. As áreas voltam a poder enviar necessidades.`],
      FECHAR_ATA: [`Ata fechada: ${ev.nome}`, "A OS foi gerada. Alterações agora entram como solicitações respondidas por item."],
      ENCERRAR: [`Evento encerrado para alterações: ${ev.nome}`, "Nenhuma solicitação nova é aceita a partir de agora."],
      REABRIR: [`Evento reaberto em exceção: ${ev.nome}`, `Gestão reabriu o evento: ${just}`],
      CANCELAR: [`Evento cancelado: ${ev.nome}`, `${just}`],
    };
    await notificar(tx, {
      usuarioIds: destinatarios,
      tipo: `EVENTO_${acao}`,
      titulo: mensagens[acao][0],
      mensagem: mensagens[acao][1],
      link: `/eventos/${id}`,
      excetoUsuarioId: usuario.id,
    });
    return { ...ev, ...patch };
  });
}

export async function salvarObservacoesReuniao(usuario: UsuarioAtual, id: string, observacoes: string | null) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, id) });
  if (!ev) throw new NaoEncontradoError("Evento");
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("Observações só podem ser editadas antes de fechar a ata.");
  await db.update(eventos).set({ observacoesReuniao: observacoes }).where(eq(eventos.id, id));
}

/* ------------------------------------------------------------------ */
/* Linhas da ata (inclusão direta / ajuste da logística)                */
/* ------------------------------------------------------------------ */

export async function snapshotBom(ex: Executor, projetoId: string): Promise<{ versaoId: string; numero: number; bom: BomSnapshotLinha[] }> {
  const p = await ex.query.projetos.findFirst({ where: eq(projetos.id, projetoId) });
  if (!p) throw new NaoEncontradoError("Projeto padrão");
  const v = await ex.query.projetoVersoes.findFirst({
    where: and(eq(projetoVersoes.projetoId, projetoId), eq(projetoVersoes.numero, p.versaoAtual)),
    with: { itens: { with: { peca: true } } },
  });
  if (!v) throw new NaoEncontradoError("Versão do projeto");
  return {
    versaoId: v.id,
    numero: v.numero,
    bom: v.itens.map((i) => ({ pecaId: i.peca.id, codigo: i.peca.codigo, nome: i.peca.nome, setor: i.peca.setor, unidade: i.peca.unidade, quantidade: i.quantidade })),
  };
}

export type DadosLinhaAta = {
  referenciaTipo: "PROJETO" | "PECA" | "AVULSO";
  projetoId: string | null;
  pecaId: string | null;
  descricaoLivre: string | null;
  quantidade: number;
  destino: string | null;
  areaId: string | null;
  justificativa: string | null;
};

function exigirEstadoAjuste(status: EventoStatus, justificativa: string | null) {
  if (status === "PREPARACAO" || status === "EM_REUNIAO") return false; // consolidação, sem justificativa
  if (status === "ABERTO") {
    if (!justificativa) throw new ValidacaoError("Ajustes diretos após a ata fechada exigem justificativa (RV-12).", { justificativa: "Obrigatória." });
    return true; // gera nova OS
  }
  throw new DomainError("O evento não aceita ajustes na ata neste estado.");
}

export async function incluirLinhaAta(usuario: UsuarioAtual, eventoId: string, dados: DadosLinhaAta) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
    if (!ev) throw new NaoEncontradoError("Evento");
    const geraOs = exigirEstadoAjuste(ev.status, dados.justificativa);
    if (geraOs) exigir(usuario, "ata.ajustar");

    let valores: typeof eventoItens.$inferInsert;
    if (dados.referenciaTipo === "PROJETO") {
      if (!dados.projetoId) throw new ValidacaoError("Escolha o projeto padrão.");
      const snap = await snapshotBom(tx, dados.projetoId);
      valores = { eventoId, tipo: "PROJETO", projetoId: dados.projetoId, projetoVersaoId: snap.versaoId, bomSnapshot: snap.bom, quantidade: dados.quantidade, destino: dados.destino, areaId: dados.areaId, origem: "AJUSTE_LOGISTICA", justificativaAjuste: dados.justificativa, criadoPorId: usuario.id };
    } else if (dados.referenciaTipo === "PECA") {
      if (!dados.pecaId) throw new ValidacaoError("Escolha a peça.");
      const peca = await tx.query.pecas.findFirst({ where: eq(pecas.id, dados.pecaId) });
      if (!peca || !peca.ativo) throw new NaoEncontradoError("Peça");
      valores = { eventoId, tipo: "PECA", pecaId: peca.id, quantidade: dados.quantidade, destino: dados.destino, areaId: dados.areaId, origem: "AJUSTE_LOGISTICA", justificativaAjuste: dados.justificativa, criadoPorId: usuario.id };
    } else {
      if (!dados.descricaoLivre) throw new ValidacaoError("Descreva o item avulso.");
      valores = { eventoId, tipo: "AVULSO", descricaoLivre: dados.descricaoLivre, quantidade: dados.quantidade, destino: dados.destino, areaId: dados.areaId, origem: "AJUSTE_LOGISTICA", justificativaAjuste: dados.justificativa, criadoPorId: usuario.id };
    }
    const [linha] = await tx.insert(eventoItens).values(valores).returning();
    const [l] = await montarLinhasAta(tx, eventoId).then((ls) => ls.filter((x) => x.id === linha.id));
    const desc = descricaoLinha(l);
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linha.id,
      acao: geraOs ? "AJUSTE_INCLUSAO" : "ATA_INCLUSAO",
      descricao: `${geraOs ? "Ajuste da logística" : "Incluído na ata"}: ${desc} × ${dados.quantidade}${dados.justificativa ? ` — ${dados.justificativa}` : ""}`,
      usuarioId: usuario.id,
      dadosDepois: valores,
    });
    if (geraOs) {
      await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, `Ajuste: incluído ${desc} × ${dados.quantidade}`);
      if (dados.areaId) {
        await notificar(tx, {
          usuarioIds: await usuariosDaArea(tx, dados.areaId),
          tipo: "ATA_AJUSTE",
          titulo: `Ajuste na ata: ${ev.nome}`,
          mensagem: `A logística incluiu ${desc} × ${dados.quantidade}. Motivo: ${dados.justificativa}`,
          link: `/eventos/${eventoId}/ata`,
        });
      }
    }
    return linha;
  });
}

export async function alterarQuantidadeLinha(usuario: UsuarioAtual, eventoId: string, linhaId: string, quantidade: number, justificativa: string | null) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
    if (!ev) throw new NaoEncontradoError("Evento");
    const geraOs = exigirEstadoAjuste(ev.status, justificativa);
    if (geraOs) exigir(usuario, "ata.ajustar");
    const [linha] = await montarLinhasAta(tx, eventoId).then((ls) => ls.filter((x) => x.id === linhaId));
    if (!linha) throw new NaoEncontradoError("Linha da ata");
    const desc = descricaoLinha(linha);
    const remover = quantidade <= 0;
    await tx
      .update(eventoItens)
      .set(remover ? { ativo: false, removidoEm: new Date(), removidoPorId: usuario.id, justificativaAjuste: justificativa } : { quantidade, justificativaAjuste: justificativa })
      .where(eq(eventoItens.id, linhaId));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linhaId,
      acao: remover ? "ATA_REMOCAO" : "ATA_QUANTIDADE",
      descricao: `${remover ? "Removido da ata" : "Quantidade alterada"}: ${desc} ${remover ? `(era ${linha.quantidade})` : `${linha.quantidade} → ${quantidade}`}${justificativa ? ` — ${justificativa}` : ""}`,
      usuarioId: usuario.id,
      dadosAntes: { quantidade: linha.quantidade, ativo: true },
      dadosDepois: { quantidade: remover ? 0 : quantidade, ativo: !remover },
    });
    if (geraOs) {
      await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, `Ajuste: ${desc} ${remover ? "removido" : `${linha.quantidade} → ${quantidade}`}`);
      if (linha.registro.areaId) {
        await notificar(tx, {
          usuarioIds: await usuariosDaArea(tx, linha.registro.areaId),
          tipo: "ATA_AJUSTE",
          titulo: `Ajuste na ata: ${ev.nome}`,
          mensagem: `A logística ${remover ? "removeu" : "alterou"} ${desc}${remover ? "" : ` para ${quantidade}`}. Motivo: ${justificativa}`,
          link: `/eventos/${eventoId}/ata`,
        });
      }
    }
  });
}

/** MEL-02: atualiza uma linha de projeto para a versão atual do projeto padrão. */
export async function atualizarVersaoLinha(usuario: UsuarioAtual, eventoId: string, linhaId: string) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status === "ENCERRADO" || ev.status === "CANCELADO") throw new DomainError("Evento encerrado ou cancelado não aceita atualização de versão.");
    const linha = await tx.query.eventoItens.findFirst({ where: and(eq(eventoItens.id, linhaId), eq(eventoItens.eventoId, eventoId)), with: { projeto: true, projetoVersao: true } });
    if (!linha || linha.tipo !== "PROJETO" || !linha.projetoId) throw new NaoEncontradoError("Linha de projeto");
    const snap = await snapshotBom(tx, linha.projetoId);
    if (snap.versaoId === linha.projetoVersaoId) return;
    await tx.update(eventoItens).set({ projetoVersaoId: snap.versaoId, bomSnapshot: snap.bom }).where(eq(eventoItens.id, linhaId));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linhaId,
      acao: "ATUALIZACAO_VERSAO",
      descricao: `${linha.projeto?.nome}: versão v${linha.projetoVersao?.numero} → v${snap.numero}.`,
      usuarioId: usuario.id,
    });
    if (ev.status === "ABERTO") {
      await gerarOsVersao(tx, eventoId, "ATUALIZACAO_PROJETO", usuario.id, `${linha.projeto?.nome} atualizado para v${snap.numero}`);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Consultas auxiliares para formulários                                */
/* ------------------------------------------------------------------ */

export async function opcoesReferencias() {
  const db = await getDb();
  const [proj, pcs] = await Promise.all([
    db.select({ id: projetos.id, codigo: projetos.codigo, nome: projetos.nome, categoria: projetos.categoria }).from(projetos).where(eq(projetos.ativo, true)).orderBy(asc(projetos.nome)),
    db.select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome, setor: pecas.setor, unidade: pecas.unidade }).from(pecas).where(eq(pecas.ativo, true)).orderBy(asc(pecas.codigo)),
  ]);
  return { projetos: proj, pecas: pcs };
}

export async function contarItensProjetoVersao(versaoId: string) {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(projetoItens).where(eq(projetoItens.versaoId, versaoId));
  return Number(r.n);
}
