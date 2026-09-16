import { and, asc, count, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  anexos,
  areas,
  ataVersoes,
  eventoItens,
  eventos,
  historico,
  osVersoes,
  pecas,
  projetoItens,
  projetoVersoes,
  projetos,
  solicitacaoItens,
  solicitacoes,
  type AtaConteudo,
  type BomSnapshotLinha,
  type EventoStatus,
  usuarios,
} from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { TRANSICOES_EVENTO, transicaoPermitida, type AcaoEvento } from "@/domain/evento";
import { pode } from "@/domain/permissions";
import { aplicarAjustesBom, descricaoLinha } from "@/domain/os";
import { formatarDataHora } from "@/lib/format";
import { gerarOsVersao, montarLinhasAta, montarLinhasAtaDeEventos, numeroOsAtual } from "./os";
import { bloquearEvento, notificar, obterConfiguracoes, proximoCodigo, registrarHistorico, usuariosDaArea, usuariosLogistica, usuariosRequisitantes, type Executor } from "./support";

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
  // Datas fora do calendário são ignoradas em vez de derrubar a consulta.
  const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  if (filtro.deData && dataValida(filtro.deData)) conds.push(sql`${eventos.dataFim} >= ${filtro.deData}`);
  if (filtro.ateData && dataValida(filtro.ateData)) conds.push(sql`${eventos.dataInicio} <= ${filtro.ateData}`);

  const [rows, abertas, versoes] = await Promise.all([
    db.query.eventos.findMany({
      where: conds.length ? and(...conds) : undefined,
      with: { responsavel: { columns: { id: true, nome: true } } },
      orderBy: [asc(eventos.dataInicio)],
    }),
    db
      .select({ eventoId: solicitacoes.eventoId, n: count() })
      .from(solicitacoes)
      .where(and(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), eq(solicitacoes.excluida, false)))
      .groupBy(solicitacoes.eventoId),
    db
      .select({ eventoId: osVersoes.eventoId, v: sql<number>`max(${osVersoes.numero})` })
      .from(osVersoes)
      .groupBy(osVersoes.eventoId),
  ]);
  const mapaAbertas = new Map(abertas.map((a) => [a.eventoId, Number(a.n)]));
  const mapaVersoes = new Map(versoes.map((v) => [v.eventoId, Number(v.v)]));
  return rows.map((r) => ({ ...r, solicitacoesAbertas: mapaAbertas.get(r.id) ?? 0, versaoOs: mapaVersoes.get(r.id) ?? 0 }));
}

export type EventoLista = Awaited<ReturnType<typeof listarEventos>>[number];

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

function nomeLinha(l: { tipo: string; projeto?: { nome: string } | null; peca?: { codigo: string; nome: string } | null; descricaoLivre?: string | null }) {
  if (l.tipo === "PROJETO" && l.projeto) return l.projeto.nome;
  if (l.tipo === "PECA" && l.peca) return `${l.peca.codigo} · ${l.peca.nome}`;
  return l.descricaoLivre ?? "Item avulso";
}

/**
 * Linhas ativas da ata com a origem legível (handoff §5.6): "SOL-0001", "SOL-0001 (parcial)",
 * "Incluída na reunião" (antes do fechamento) ou "Ajuste da logística" (depois).
 */
export async function obterLinhasAta(eventoId: string) {
  const db = await getDb();
  const [linhas, ev] = await Promise.all([
    montarLinhasAta(db, eventoId),
    db.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { ataFechadaEm: true } }),
  ]);
  const ids = linhas.map((l) => l.registro.solicitacaoItemId).filter((x): x is string => Boolean(x));
  const origens = ids.length
    ? await db
        .select({ id: solicitacaoItens.id, status: solicitacaoItens.status, codigo: solicitacoes.codigo, solicitacaoId: solicitacoes.id })
        .from(solicitacaoItens)
        .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
        .where(inArray(solicitacaoItens.id, ids))
    : [];
  const mapa = new Map(origens.map((o) => [o.id, o]));
  // Miniatura do projeto padrão na linha da ata (primeira imagem anexada).
  const projetoIds = [...new Set(linhas.map((l) => l.registro.projetoId).filter((x): x is string => Boolean(x)))];
  const capas = projetoIds.length
    ? await db.select({ projetoId: anexos.projetoId, id: anexos.id }).from(anexos).where(and(inArray(anexos.projetoId, projetoIds), eq(anexos.tipo, "IMAGEM"))).orderBy(asc(anexos.criadoEm))
    : [];
  const capaDe = new Map<string, string>();
  for (const c of capas) if (!capaDe.has(c.projetoId)) capaDe.set(c.projetoId, c.id);
  const nomesConferiu = await nomesUsuarios(db, linhas.map((l) => l.registro.conferidoPorId));
  return linhas.map((l) => {
    const o = l.registro.solicitacaoItemId ? mapa.get(l.registro.solicitacaoItemId) : undefined;
    const origemLabel = o
      ? `${o.codigo}${o.status === "PARCIAL" ? " (parcial)" : ""}`
      : !ev?.ataFechadaEm || l.registro.criadoEm <= ev.ataFechadaEm
        ? "Incluída na reunião"
        : "Ajuste da logística";
    const versao = l.registro.projetoVersao?.numero ?? null;
    const versaoAtual = l.registro.projeto?.versaoAtual ?? null;
    return {
      ...l,
      nome: nomeLinha(l),
      descricao: descricaoLinha(l),
      origemLabel,
      origemSolicitacaoId: o?.solicitacaoId ?? null,
      versao,
      versaoAtual,
      versaoDefasada: l.tipo === "PROJETO" && versao != null && versaoAtual != null ? versao < versaoAtual : false,
      capaId: l.registro.projetoId ? (capaDe.get(l.registro.projetoId) ?? null) : null,
      conferidoEm: l.registro.conferidoEm,
      conferidoPor: l.registro.conferidoPorId ? (nomesConferiu.get(l.registro.conferidoPorId) ?? null) : null,
    };
  });
}

export type LinhaAtaDetalhe = Awaited<ReturnType<typeof obterLinhasAta>>[number];

/**
 * Histórico do evento. Quem não tem `historico.ver_tudo` (requisitante, cenografia) vê o que é do evento
 * e da ata, mais o que diz respeito às solicitações da própria área — não motivos e observações de outras áreas.
 */
export async function obterHistoricoEvento(usuario: UsuarioAtual, eventoId: string, limite = 300) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const areaId = usuario.areaId ?? "";
  const escopo = pode(usuario, "historico.ver_tudo")
    ? eq(historico.eventoId, eventoId)
    : and(
        eq(historico.eventoId, eventoId),
        or(
          inArray(historico.entidade, ["evento", "evento_item"]),
          and(eq(historico.entidade, "solicitacao"), sql`${historico.entidadeId} in (select id from solicitacoes where area_id = ${areaId})`),
          and(
            eq(historico.entidade, "solicitacao_item"),
            sql`${historico.entidadeId} in (select si.id from solicitacao_itens si join solicitacoes s on s.id = si.solicitacao_id where s.area_id = ${areaId})`,
          ),
        ),
      );
  return db.query.historico.findMany({
    where: escopo,
    with: { usuario: { columns: { id: true, nome: true } } },
    orderBy: [desc(historico.criadoEm)],
    limit: limite,
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

/**
 * Contadores das abas do evento (layout de todas as abas): só contagens, sem carregar a ata,
 * as solicitações com itens nem o JSON das OS. Respeita a área de quem não vê todas as solicitações.
 */
export async function resumoAbasEvento(usuario: UsuarioAtual, eventoId: string) {
  const db = await getDb();
  const escopoArea = pode(usuario, "solicitacao.ver_todas") ? undefined : eq(solicitacoes.areaId, usuario.areaId ?? "");
  const [[linhas], sols, versaoOs] = await Promise.all([
    db
      .select({ n: count() })
      .from(eventoItens)
      .where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true))),
    db
      .select({ tipo: solicitacoes.tipo, status: solicitacoes.status, n: count() })
      .from(solicitacoes)
      .where(and(eq(solicitacoes.eventoId, eventoId), eq(solicitacoes.excluida, false), escopoArea))
      .groupBy(solicitacoes.tipo, solicitacoes.status),
    numeroOsAtual(db, eventoId),
  ]);
  const soma = (xs: typeof sols) => xs.reduce((a, s) => a + Number(s.n), 0);
  return {
    linhas: Number(linhas?.n ?? 0),
    solicitacoes: soma(sols),
    preEnviadas: soma(sols.filter((s) => s.tipo === "PRE_REUNIAO" && s.status !== "RASCUNHO" && s.status !== "CANCELADA")),
    versaoOs,
  };
}

/** Linhas ativas (id, nome, quantidade, destino, área) de vários eventos numa consulta só. */
export async function linhasAtaResumidas(eventoIds: string[]) {
  const db = await getDb();
  const mapa = await montarLinhasAtaDeEventos(db, eventoIds);
  return Object.fromEntries([...mapa].map(([id, ls]) => [id, ls.map((l) => ({ id: l.id, nome: nomeLinha(l), quantidade: l.quantidade, destino: l.destino, areaNome: l.areaNome }))]));
}

/** "Onde está cada área" (handoff §5.5): enviados × respondidos por área. */
export async function progressoAreas(eventoId: string) {
  const db = await getDb();
  const [todasAreas, sols] = await Promise.all([
    db.query.areas.findMany({ where: eq(areas.ativo, true), orderBy: [asc(areas.criadoEm)] }),
    db.query.solicitacoes.findMany({
      where: and(eq(solicitacoes.eventoId, eventoId), eq(solicitacoes.excluida, false), notInArray(solicitacoes.status, ["RASCUNHO", "CANCELADA"])),
      columns: { id: true, areaId: true },
      with: { itens: { columns: { status: true } } },
    }),
  ]);
  return todasAreas
    .filter((a) => a.nome !== "Logística")
    .map((a) => {
      const minhas = sols.filter((s) => s.areaId === a.id);
      const itens = minhas.reduce((n, s) => n + s.itens.length, 0);
      const respondidos = minhas.reduce((n, s) => n + s.itens.filter((i) => i.status !== "EM_ANALISE").length, 0);
      return { id: a.id, nome: a.nome, solicitacoes: minhas.length, itens, respondidos };
    });
}

/** Itens de necessidades pré-reunião ainda sem resposta (bloqueiam o fechamento da ata). */
export async function contarItensPendentesPreReuniao(eventoId: string) {
  const db = await getDb();
  const [r] = await db
    .select({ n: count() })
    .from(solicitacaoItens)
    .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
    .where(
      and(
        eq(solicitacoes.eventoId, eventoId),
        eq(solicitacoes.tipo, "PRE_REUNIAO"),
        inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]),
        eq(solicitacaoItens.status, "EM_ANALISE"),
      ),
    );
  return Number(r.n);
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
  /** Fim da janela de alterações pós-ata (opcional; sem data = até encerrar). */
  janelaAlteracoesAte?: string | null;
  responsavelId: string;
};

function validarOrdemDatas(dados: DadosEvento) {
  if (dados.dataInicio < dados.dataMontagem || dados.dataFim < dados.dataInicio || dados.dataDesmontagem < dados.dataFim) {
    throw new ValidacaoError("As datas precisam seguir a ordem: montagem, início, fim e desmontagem.");
  }
}

export async function criarEvento(usuario: UsuarioAtual, dados: DadosEvento) {
  exigir(usuario, "evento.criar");
  validarOrdemDatas(dados);
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
      descricao: `Evento criado — ${ev.nome}${ev.cliente ? ` · ${ev.cliente}` : ""}`,
      usuarioId: usuario.id,
      dadosDepois: dados,
    });
    await notificar(tx, {
      usuarioIds: await usuariosRequisitantes(tx),
      tipo: "EVENTO_CRIADO",
      titulo: `Novo evento em preparação: ${ev.nome}`,
      mensagem: `Envie as necessidades da sua área até a reunião de OS (${formatarDataHora(dados.dataReuniao)}).`,
      link: `/eventos/${ev.id}`,
    });
    return ev;
  });
}

export async function editarEvento(usuario: UsuarioAtual, id: string, dados: DadosEvento) {
  exigir(usuario, "evento.editar");
  validarOrdemDatas(dados);
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, id);
    const atual = await tx.query.eventos.findFirst({ where: eq(eventos.id, id) });
    if (!atual) throw new NaoEncontradoError("Evento");
    if (atual.status === "CANCELADO") throw new DomainError("Evento cancelado não pode ser editado.");
    if (atual.status === "ENCERRADO") throw new DomainError("Evento encerrado não pode ser editado. Se precisar, a gestão reabre em exceção.");
    if (atual.status !== "PREPARACAO" && Math.abs(atual.dataReuniao.getTime() - dados.dataReuniao.getTime()) >= 60_000) {
      throw new ValidacaoError("A reunião de OS já começou ou aconteceu; a data dela não muda mais.", { dataReuniao: "Reunião já iniciada ou realizada." });
    }
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
      descricao: "Dados do evento alterados",
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
    where: and(eq(solicitacoes.eventoId, eventoId), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), eq(solicitacoes.excluida, false)),
    columns: { id: true, codigo: true, tipo: true, status: true, titulo: true },
  });
}

async function nomesUsuarios(ex: Executor, ids: Array<string | null | undefined>) {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const rows = unicos.length ? await ex.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, unicos)) : [];
  return new Map(rows.map((r) => [r.id, r.nome]));
}

async function montarAtaConteudo(ex: Executor, ev: typeof eventos.$inferSelect, fechadaPor: UsuarioAtual, agora: Date): Promise<AtaConteudo> {
  const eventoId = ev.id;
  const observacoes = ev.observacoesReuniao;
  const linhas = await montarLinhasAta(ex, eventoId);
  const nomesPor = await nomesUsuarios(ex, [ev.responsavelId, ...linhas.map((l) => l.registro.conferidoPorId)]);
  const sols = await ex.query.solicitacoes.findMany({
    where: and(eq(solicitacoes.eventoId, eventoId), eq(solicitacoes.tipo, "PRE_REUNIAO"), inArray(solicitacoes.status, ["RESPONDIDA"])),
    with: { area: true, itens: { with: { projeto: true, peca: true } } },
  });
  return {
    observacoes,
    reuniao: {
      iniciadaEm: ev.reuniaoIniciadaEm?.toISOString() ?? null,
      fechadaEm: agora.toISOString(),
      fechadaPor: fechadaPor.nome,
      conduzidaPor: nomesPor.get(ev.responsavelId) ?? "",
      presentes: ev.reuniaoPresentes,
      publicoEsperado: ev.publicoEsperado,
      caminhaoCarrega: ev.caminhaoCarrega,
      caminhaoSai: ev.caminhaoSai,
      arenaDescarrega: ev.arenaDescarrega,
      kitDescarrega: ev.kitDescarrega,
    },
    linhas: linhas.map((l) => ({
      id: l.id,
      conferidoPor: l.registro.conferidoPorId ? (nomesPor.get(l.registro.conferidoPorId) ?? null) : null,
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
    await bloquearEvento(tx, id);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, id) });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (!transicaoPermitida(ev.status, acao)) {
      throw new DomainError(`Ação "${t.label}" não é possível no estado atual do evento.`);
    }
    const cfg = await obterConfiguracoes(tx);
    const agora = new Date();
    const patch: Partial<typeof eventos.$inferInsert> = { status: t.para };
    let osNumero: number | null = null;
    /* Solicitações que a transição deixa sem saída (nunca mais poderiam ser enviadas ou respondidas). */
    let canceladasAuto: Array<{ id: string; codigo: string; areaId: string; criadoPorId: string; motivo: string }> = [];
    const cancelarOrfas = async (status: Array<"RASCUNHO" | "DEVOLVIDA" | "ENVIADA" | "EM_ANALISE">, motivo: string, tipo?: "PRE_REUNIAO") => {
      const rows = await tx
        .update(solicitacoes)
        .set({ status: "CANCELADA", canceladaEm: agora, canceladaMotivo: motivo, atualizadoPorId: usuario.id })
        .where(and(eq(solicitacoes.eventoId, id), eq(solicitacoes.excluida, false), inArray(solicitacoes.status, status), tipo ? eq(solicitacoes.tipo, tipo) : undefined))
        .returning({ id: solicitacoes.id, codigo: solicitacoes.codigo, areaId: solicitacoes.areaId, criadoPorId: solicitacoes.criadoPorId });
      canceladasAuto = rows.map((r) => ({ ...r, motivo }));
    };

    if (acao === "INICIAR_REUNIAO") {
      patch.reuniaoIniciadaEm = agora;
    }

    if (acao === "FECHAR_ATA") {
      const pend = await tx
        .select({ n: count() })
        .from(solicitacaoItens)
        .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
        .where(
          and(
            eq(solicitacoes.eventoId, id),
            eq(solicitacoes.tipo, "PRE_REUNIAO"),
            inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]),
            eq(solicitacaoItens.status, "EM_ANALISE"),
          ),
        );
      if (Number(pend[0].n) > 0) {
        throw new DomainError(`Ainda há ${Number(pend[0].n)} item(ns) de necessidades pré-reunião sem resposta. Responda todos antes de fechar a ata.`);
      }
      // A ata só fecha depois de a logística conferir cada linha na reunião e registrar quem estava presente.
      const [naoConferidas] = await tx
        .select({ n: count() })
        .from(eventoItens)
        .where(and(eq(eventoItens.eventoId, id), eq(eventoItens.ativo, true), sql`${eventoItens.conferidoEm} is null`));
      const nc = Number(naoConferidas.n);
      if (nc > 0) {
        throw new DomainError(`Ainda há ${nc} ${nc === 1 ? "linha da ata sem conferência" : "linhas da ata sem conferência"}. Marque cada item ou projeto como conferido na reunião antes de fechar.`);
      }
      if (!ev.reuniaoPresentes?.trim()) {
        throw new DomainError("Registre quem estava presente na reunião antes de fechar a ata.");
      }
      const [ultima] = await tx.select({ numero: ataVersoes.numero }).from(ataVersoes).where(eq(ataVersoes.eventoId, id)).orderBy(desc(ataVersoes.numero)).limit(1);
      const conteudo = await montarAtaConteudo(tx, ev, usuario, agora);
      await tx.insert(ataVersoes).values({ eventoId: id, numero: (ultima?.numero ?? 0) + 1, conteudo, fechadaPorId: usuario.id });
      osNumero = (await gerarOsVersao(tx, id, "ATA_FECHADA", usuario.id, "OS inicial gerada no fechamento da ata")).numero;
      patch.ataFechadaEm = agora;
      patch.ataFechadaPorId = usuario.id;
      await cancelarOrfas(["RASCUNHO", "DEVOLVIDA"], "Ata fechada antes do envio desta necessidade. Mudanças agora entram como alteração pós-ata.", "PRE_REUNIAO");
    }

    if (acao === "ENCERRAR") {
      if (cfg.bloquear_encerramento_com_pendentes === "true") {
        const pend = await solicitacoesPendentes(tx, id);
        if (pend.length > 0) {
          throw new DomainError(`Existem ${pend.length} solicitação(ões) sem resposta (${pend.map((p) => p.codigo).join(", ")}). Responda ou devolva todas antes de encerrar.`);
        }
      } else {
        // Sem nenhuma resposta: cancela. Já com item atendido na OS: os itens restantes viram "não atendido",
        // para a área não ver "cancelada" numa solicitação que entrou parcialmente na OS final.
        await cancelarOrfas(["ENVIADA"], "Evento encerrado para alterações antes da resposta desta solicitação.");
        const parciais = await tx.query.solicitacoes.findMany({
          where: and(eq(solicitacoes.eventoId, id), eq(solicitacoes.status, "EM_ANALISE"), eq(solicitacoes.excluida, false)),
          columns: { id: true, codigo: true, areaId: true, criadoPorId: true },
        });
        for (const s of parciais) {
          await tx
            .update(solicitacaoItens)
            .set({ status: "NAO_ATENDIDO", quantidadeAtendida: 0, observacaoLogistica: "Evento encerrado para alterações antes da resposta.", respondidoPorId: usuario.id, respondidoEm: agora })
            .where(and(eq(solicitacaoItens.solicitacaoId, s.id), eq(solicitacaoItens.status, "EM_ANALISE")));
          await tx.update(solicitacoes).set({ status: "RESPONDIDA", respondidaEm: agora, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, s.id));
          await registrarHistorico(tx, { eventoId: id, entidade: "solicitacao", entidadeId: s.id, acao: "RESPONDIDO", descricao: `${s.codigo}: itens pendentes marcados como não atendidos no encerramento do evento`, usuarioId: usuario.id });
          await notificar(tx, {
            usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
            tipo: "SOLICITACAO_RESPONDIDA",
            titulo: `${s.codigo}: itens pendentes não atendidos`,
            mensagem: "O evento foi encerrado para alterações; o que ainda estava em análise ficou como não atendido.",
            link: `/solicitacoes/${s.id}`,
          });
        }
      }
      osNumero = (await gerarOsVersao(tx, id, "ENCERRAMENTO", usuario.id, "OS final — evento encerrado para alterações")).numero;
      patch.encerradoEm = agora;
      patch.encerradoPorId = usuario.id;
    }

    if (acao === "REABRIR") {
      patch.reabertoVezes = ev.reabertoVezes + 1;
      patch.encerradoEm = null;
      patch.encerradoPorId = null;
      osNumero = (await gerarOsVersao(tx, id, "REABERTURA", usuario.id, `Reaberto em exceção: ${just}`)).numero;
    }

    if (acao === "CANCELAR") {
      patch.canceladoEm = agora;
      patch.canceladoPorId = usuario.id;
      patch.canceladoMotivo = just;
      await cancelarOrfas(["RASCUNHO", "DEVOLVIDA", "ENVIADA", "EM_ANALISE"], "Evento cancelado");
    }

    await tx.update(eventos).set(patch).where(eq(eventos.id, id));
    const descricoes: Record<AcaoEvento, string> = {
      INICIAR_REUNIAO: "Reunião de OS iniciada — envios de necessidades bloqueados",
      VOLTAR_PREPARACAO: `Reunião adiada, evento voltou para preparação — ${just}`,
      FECHAR_ATA: `Ata fechada — OS v${osNumero} gerada`,
      ENCERRAR: `Evento encerrado para alterações — OS final v${osNumero}`,
      REABRIR: `Evento reaberto em exceção — ${just}`,
      CANCELAR: `Evento cancelado — ${just}`,
    };
    await registrarHistorico(tx, {
      eventoId: id,
      entidade: "evento",
      entidadeId: id,
      acao,
      descricao: descricoes[acao],
      usuarioId: usuario.id,
      dadosAntes: { status: ev.status },
      dadosDepois: { status: t.para },
    });

    const destinatarios = [...(await usuariosRequisitantes(tx)), ...(acao === "REABRIR" ? await usuariosLogistica(tx) : [])];
    const mensagens: Record<AcaoEvento, [string, string]> = {
      INICIAR_REUNIAO: [`Reunião de OS iniciada: ${ev.nome}`, "Envios de necessidades pausados enquanto a logística consolida a ata."],
      VOLTAR_PREPARACAO: [`Reunião adiada: ${ev.nome}`, `${just?.replace(/[.!]+$/, "")}. As áreas voltam a poder enviar necessidades.`],
      FECHAR_ATA: [`Ata fechada: ${ev.nome}`, `OS v${osNumero} gerada. Alterações agora entram como solicitações respondidas por item.`],
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
    for (const c of canceladasAuto) {
      await registrarHistorico(tx, { eventoId: id, entidade: "solicitacao", entidadeId: c.id, acao: "CANCELADA", descricao: `${c.codigo} cancelada automaticamente — ${c.motivo}`, usuarioId: usuario.id });
      await notificar(tx, {
        usuarioIds: [c.criadoPorId, ...(await usuariosDaArea(tx, c.areaId))],
        tipo: "SOLICITACAO_CANCELADA",
        titulo: `${c.codigo} cancelada: ${ev.nome}`,
        mensagem: c.motivo,
        link: `/solicitacoes/${c.id}`,
      });
    }
    return { ...ev, ...patch, osNumero, canceladasAuto: canceladasAuto.length };
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

export type DadosReuniao = {
  reuniaoPresentes: string | null;
  publicoEsperado: number | null;
  caminhaoCarrega: string | null;
  caminhaoSai: string | null;
  arenaDescarrega: string | null;
  kitDescarrega: string | null;
};

/** Campos da ata preenchidos pela logística na reunião (presentes, público, carga). Congelam no fechamento. */
export async function salvarDadosReuniao(usuario: UsuarioAtual, id: string, dados: DadosReuniao) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, id) });
  if (!ev) throw new NaoEncontradoError("Evento");
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("Os dados da reunião só podem ser editados antes de fechar a ata.");
  await db.update(eventos).set(dados).where(eq(eventos.id, id));
}

/** Marca (ou desmarca) uma linha da ata como conferida na reunião. Pré-requisito para fechar a ata. */
export async function conferirLinha(usuario: UsuarioAtual, eventoId: string, linhaId: string, conferida: boolean) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("A conferência acontece antes de fechar a ata.");
    const [linha] = await tx
      .update(eventoItens)
      .set(conferida ? { conferidoEm: new Date(), conferidoPorId: usuario.id } : { conferidoEm: null, conferidoPorId: null })
      .where(and(eq(eventoItens.id, linhaId), eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)))
      .returning({ id: eventoItens.id });
    if (!linha) throw new NaoEncontradoError("Linha da ata");
    const [{ total, conferidas }] = await tx
      .select({ total: count(), conferidas: sql<number>`count(${eventoItens.conferidoEm})` })
      .from(eventoItens)
      .where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)));
    return { total: Number(total), conferidas: Number(conferidas) };
  });
}

/** Conferência em lote (seed, testes, "conferir todas as restantes"). */
export async function conferirTodasLinhas(usuario: UsuarioAtual, eventoId: string) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  const ev = await db.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
  if (!ev) throw new NaoEncontradoError("Evento");
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("A conferência acontece antes de fechar a ata.");
  await db
    .update(eventoItens)
    .set({ conferidoEm: new Date(), conferidoPorId: usuario.id })
    .where(and(eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true), sql`${eventoItens.conferidoEm} is null`));
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
    if (!justificativa) throw new ValidacaoError("Ajustes diretos após a ata fechada exigem justificativa.", { justificativa: "Obrigatória." });
    return true; // gera nova OS
  }
  throw new DomainError("O evento não aceita ajustes na ata neste estado.");
}

export async function incluirLinhaAta(usuario: UsuarioAtual, eventoId: string, dados: DadosLinhaAta) {
  exigir(usuario, "ata.consolidar");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
    if (!ev) throw new NaoEncontradoError("Evento");
    const geraOs = exigirEstadoAjuste(ev.status, dados.justificativa);
    if (geraOs) exigir(usuario, "ata.ajustar");
    if (!Number.isInteger(dados.quantidade) || dados.quantidade <= 0 || dados.quantidade > 1_000_000) {
      throw new ValidacaoError("Quantidade deve ser um inteiro entre 1 e 1.000.000.", { quantidade: "Informe um valor maior que zero." });
    }

    let valores: typeof eventoItens.$inferInsert;
    // Linha incluída pela própria logística na reunião já nasce conferida.
    const base = { eventoId, quantidade: dados.quantidade, destino: dados.destino, areaId: dados.areaId, origem: "AJUSTE_LOGISTICA" as const, justificativaAjuste: dados.justificativa, criadoPorId: usuario.id, ...(geraOs ? {} : { conferidoEm: new Date(), conferidoPorId: usuario.id }) };
    if (dados.referenciaTipo === "PROJETO") {
      if (!dados.projetoId) throw new ValidacaoError("Escolha o projeto padrão.");
      const snap = await snapshotBom(tx, dados.projetoId);
      valores = { ...base, tipo: "PROJETO", projetoId: dados.projetoId, projetoVersaoId: snap.versaoId, bomSnapshot: snap.bom };
    } else if (dados.referenciaTipo === "PECA") {
      if (!dados.pecaId) throw new ValidacaoError("Escolha a peça.");
      const peca = await tx.query.pecas.findFirst({ where: eq(pecas.id, dados.pecaId) });
      if (!peca || !peca.ativo) throw new NaoEncontradoError("Peça");
      valores = { ...base, tipo: "PECA", pecaId: peca.id };
    } else {
      if (!dados.descricaoLivre) throw new ValidacaoError("Descreva o item avulso.");
      valores = { ...base, tipo: "AVULSO", descricaoLivre: dados.descricaoLivre };
    }
    const [linha] = await tx.insert(eventoItens).values(valores).returning();
    const [l] = await montarLinhasAta(tx, eventoId, { linhaId: linha.id });
    const desc = descricaoLinha(l);
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linha.id,
      acao: geraOs ? "AJUSTE_INCLUSAO" : "ATA_INCLUSAO",
      descricao: `${geraOs ? "Ajuste da logística" : "Incluída na reunião"}: ${desc} × ${dados.quantidade}${dados.justificativa ? ` — ${dados.justificativa}` : ""}`,
      usuarioId: usuario.id,
      dadosDepois: valores,
    });
    if (geraOs) {
      await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, `${desc} × ${dados.quantidade} incluído — ${dados.justificativa}`);
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
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
    if (!ev) throw new NaoEncontradoError("Evento");
    const geraOs = exigirEstadoAjuste(ev.status, justificativa);
    if (geraOs) exigir(usuario, "ata.ajustar");
    if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > 1_000_000) {
      throw new ValidacaoError("Quantidade deve ser um inteiro entre 0 e 1.000.000.", { quantidade: "Use um número inteiro." });
    }
    const [linha] = await montarLinhasAta(tx, eventoId, { linhaId });
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
      descricao: `${remover ? `${desc}: removido da ata (era ${linha.quantidade})` : `${desc}: quantidade alterada de ${linha.quantidade} para ${quantidade}`}${justificativa ? ` — ${justificativa}` : ""}`,
      usuarioId: usuario.id,
      dadosAntes: { quantidade: linha.quantidade, ativo: true },
      dadosDepois: { quantidade: remover ? 0 : quantidade, ativo: !remover },
    });
    if (geraOs) {
      await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, justificativa ?? `${desc} ${remover ? "removido" : `${linha.quantidade} → ${quantidade}`}`);
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
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId) });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status === "ENCERRADO" || ev.status === "CANCELADO") throw new DomainError("Evento encerrado ou cancelado não aceita atualização de versão.");
    const linha = await tx.query.eventoItens.findFirst({ where: and(eq(eventoItens.id, linhaId), eq(eventoItens.eventoId, eventoId)), with: { projeto: true, projetoVersao: true } });
    if (!linha || linha.tipo !== "PROJETO" || !linha.projetoId) throw new NaoEncontradoError("Linha de projeto");
    const snap = await snapshotBom(tx, linha.projetoId);
    if (snap.versaoId === linha.projetoVersaoId) return;
    // A linha veio de uma solicitação com peças ajustadas? Os ajustes valem também na versão nova.
    const origem = linha.solicitacaoItemId ? await tx.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, linha.solicitacaoItemId), columns: { ajustesBom: true } }) : null;
    await tx.update(eventoItens).set({ projetoVersaoId: snap.versaoId, bomSnapshot: aplicarAjustesBom(snap.bom, origem?.ajustesBom) }).where(eq(eventoItens.id, linhaId));
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linhaId,
      acao: "ATUALIZACAO_VERSAO",
      descricao: `${linha.projeto?.nome}: atualizado de v${linha.projetoVersao?.numero} para v${snap.numero}`,
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
  const [proj, pcs, versoes] = await Promise.all([
    db
      .select({ id: projetos.id, codigo: projetos.codigo, nome: projetos.nome, categoria: projetos.categoria, versaoAtual: projetos.versaoAtual })
      .from(projetos)
      .where(eq(projetos.ativo, true))
      .orderBy(asc(projetos.nome)),
    db
      .select({ id: pecas.id, codigo: pecas.codigo, nome: pecas.nome, setor: pecas.setor, unidade: pecas.unidade, familia: pecas.familia, estoqueProprio: pecas.estoqueProprio })
      .from(pecas)
      .where(eq(pecas.ativo, true))
      .orderBy(asc(pecas.codigo)),
    db
      .select({ projetoId: projetoVersoes.projetoId, numero: projetoVersoes.numero, total: sql<number>`coalesce(sum(${projetoItens.quantidade}), 0)` })
      .from(projetoVersoes)
      .leftJoin(projetoItens, eq(projetoItens.versaoId, projetoVersoes.id))
      .groupBy(projetoVersoes.projetoId, projetoVersoes.numero),
  ]);
  // Lista de peças da versão atual de cada projeto: o solicitante pode ajustar unidades por peça.
  const linhasBom = await db
    .select({ projetoId: projetoVersoes.projetoId, numero: projetoVersoes.numero, pecaId: pecas.id, codigo: pecas.codigo, nome: pecas.nome, unidade: pecas.unidade, quantidade: projetoItens.quantidade })
    .from(projetoItens)
    .innerJoin(projetoVersoes, eq(projetoItens.versaoId, projetoVersoes.id))
    .innerJoin(pecas, eq(projetoItens.pecaId, pecas.id))
    .orderBy(asc(pecas.codigo));
  // Primeira imagem de cada projeto (miniatura na escolha do requisitante).
  const capas = await db.select({ projetoId: anexos.projetoId, id: anexos.id }).from(anexos).where(eq(anexos.tipo, "IMAGEM")).orderBy(asc(anexos.criadoEm));
  const capaDe = new Map<string, string>();
  for (const c of capas) if (!capaDe.has(c.projetoId)) capaDe.set(c.projetoId, c.id);
  return {
    projetos: proj.map((p) => ({
      ...p,
      capaId: capaDe.get(p.id) ?? null,
      totalPecas: Number(versoes.find((v) => v.projetoId === p.id && v.numero === p.versaoAtual)?.total ?? 0),
      bom: linhasBom.filter((l) => l.projetoId === p.id && l.numero === p.versaoAtual).map(({ pecaId, codigo, nome, unidade, quantidade }) => ({ pecaId, codigo, nome, unidade, quantidade })),
    })),
    pecas: pcs,
  };
}

export type OpcoesReferencias = Awaited<ReturnType<typeof opcoesReferencias>>;
