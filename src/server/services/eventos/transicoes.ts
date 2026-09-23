import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Tx } from "@/server/db";
import { ataVersoes, eventoItens, eventos, solicitacaoItens, solicitacoes } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { motivoBloqueioEncerramento, TRANSICOES_EVENTO, transicaoPermitida, type AcaoEvento } from "@/domain/evento";
import { gerarOsVersao } from "../os";
import { bloquearEvento, notificar, obterConfiguracoes, registrarHistorico, usuariosDaArea, usuariosLogistica, usuariosRequisitantes } from "../support";
import { montarAtaConteudo } from "./ata";
import { solicitacoesPendentes } from "./consultas";
import { STATUS_ABERTOS } from "@/domain/solicitacao";

/* ------------------------------------------------------------------ */
/* Máquina de estados                                                   */
/* ------------------------------------------------------------------ */

type SolicitacaoCanceladaAuto = { id: string; codigo: string; areaId: string; criadoPorId: string; motivo: string };

/** Tudo o que o efeito de uma ação precisa: o evento já travado, o patch que será gravado e as solicitações canceladas. */
type ContextoTransicao = {
  tx: Tx;
  usuario: UsuarioAtual;
  id: string;
  ev: typeof eventos.$inferSelect;
  cfg: Awaited<ReturnType<typeof obterConfiguracoes>>;
  agora: Date;
  just: string | null;
  patch: Partial<typeof eventos.$inferInsert>;
  /* Solicitações que a transição deixa sem saída (nunca mais poderiam ser enviadas ou respondidas). */
  canceladasAuto: SolicitacaoCanceladaAuto[];
};

/** Efeito próprio de cada ação sobre o evento; devolve o número da OS gerada, quando gera. */
type EfeitoTransicao = (ctx: ContextoTransicao) => Promise<number | null>;

async function cancelarOrfas(ctx: ContextoTransicao, status: Array<"RASCUNHO" | "DEVOLVIDA" | "ENVIADA" | "EM_ANALISE">, motivo: string, tipo?: "PRE_REUNIAO" | "ALTERACAO") {
  const { tx, usuario, id, agora } = ctx;
  const rows = await tx
    .update(solicitacoes)
    .set({ status: "CANCELADA", canceladaEm: agora, canceladaMotivo: motivo, atualizadoPorId: usuario.id })
    .where(and(eq(solicitacoes.eventoId, id), eq(solicitacoes.excluida, false), inArray(solicitacoes.status, status), tipo ? eq(solicitacoes.tipo, tipo) : undefined))
    .returning({ id: solicitacoes.id, codigo: solicitacoes.codigo, areaId: solicitacoes.areaId, criadoPorId: solicitacoes.criadoPorId });
  ctx.canceladasAuto.push(...rows.map((r) => ({ ...r, motivo })));
}

/*
 * Solicitações já respondidas em parte (EM_ANALISE) quando o evento fecha: o que falta vira "não atendido"
 * e a solicitação fica respondida — a área nunca vê "cancelada" numa solicitação que entrou em parte na OS.
 */
async function fecharParciais(ctx: ContextoTransicao, observacao: string, aviso: string) {
  const { tx, usuario, id, agora } = ctx;
  const parciais = await tx.query.solicitacoes.findMany({
    where: and(eq(solicitacoes.eventoId, id), eq(solicitacoes.status, "EM_ANALISE"), eq(solicitacoes.excluida, false)),
    columns: { id: true, codigo: true, areaId: true, criadoPorId: true },
  });
  for (const s of parciais) {
    await tx
      .update(solicitacaoItens)
      .set({ status: "NAO_ATENDIDO", quantidadeAtendida: 0, observacaoLogistica: observacao, respondidoPorId: usuario.id, respondidoEm: agora })
      .where(and(eq(solicitacaoItens.solicitacaoId, s.id), eq(solicitacaoItens.status, "EM_ANALISE")));
    await tx.update(solicitacoes).set({ status: "RESPONDIDA", respondidaEm: agora, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, s.id));
    await registrarHistorico(tx, { eventoId: id, entidade: "solicitacao", entidadeId: s.id, acao: "RESPONDIDO", descricao: `${s.codigo}: itens pendentes marcados como não atendidos — ${observacao}`, usuarioId: usuario.id });
    await notificar(tx, {
      usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
      tipo: "SOLICITACAO_RESPONDIDA",
      titulo: `${s.codigo}: itens pendentes não atendidos`,
      mensagem: aviso,
      link: `/solicitacoes/${s.id}`,
    });
  }
}

async function iniciarReuniao({ patch, agora }: ContextoTransicao) {
  patch.reuniaoIniciadaEm = agora;
  return null;
}

async function voltarPreparacao({ tx, id, patch }: ContextoTransicao) {
  // Reunião adiada: início, presentes e conferências valem para a próxima reunião, do zero.
  patch.reuniaoIniciadaEm = null;
  patch.reuniaoPresentes = null;
  await tx.update(eventoItens).set({ conferidoEm: null, conferidoPorId: null }).where(and(eq(eventoItens.eventoId, id), eq(eventoItens.ativo, true)));
  return null;
}

async function fecharAta(ctx: ContextoTransicao) {
  const { tx, usuario, id, ev, agora, patch } = ctx;
  const pend = await tx
    .select({ n: count() })
    .from(solicitacaoItens)
    .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
    .where(
      and(
        eq(solicitacoes.eventoId, id),
        eq(solicitacoes.tipo, "PRE_REUNIAO"),
        inArray(solicitacoes.status, STATUS_ABERTOS),
        eq(solicitacaoItens.status, "EM_ANALISE"),
      ),
    );
  if (Number(pend[0].n) > 0) {
    throw new DomainError(`Ainda há ${Number(pend[0].n)} item(ns) de necessidades pré-reunião sem resposta. Responda todos antes de fechar a ata.`);
  }
  // A ata só fecha depois de a logística conferir cada linha na reunião e registrar quem estava presente.
  const [naoConferidas] = await tx
    .select({ n: count(), total: sql<number>`count(*)` })
    .from(eventoItens)
    .where(and(eq(eventoItens.eventoId, id), eq(eventoItens.ativo, true), sql`${eventoItens.conferidoEm} is null`));
  const [ativas] = await tx.select({ n: count() }).from(eventoItens).where(and(eq(eventoItens.eventoId, id), eq(eventoItens.ativo, true)));
  if (Number(ativas.n) === 0) throw new DomainError("A ata não tem nenhuma linha. Inclua os itens do evento antes de fechar.");
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
  const osNumero = (await gerarOsVersao(tx, id, "ATA_FECHADA", usuario.id, "OS inicial gerada no fechamento da ata")).numero;
  patch.ataFechadaEm = agora;
  patch.ataFechadaPorId = usuario.id;
  await cancelarOrfas(ctx, ["RASCUNHO", "DEVOLVIDA"], "Ata fechada antes do envio desta necessidade. Mudanças agora entram como alteração pós-ata.", "PRE_REUNIAO");
  return osNumero;
}

async function encerrar(ctx: ContextoTransicao) {
  const { tx, usuario, id, cfg, agora, patch } = ctx;
  const bloqueio = motivoBloqueioEncerramento(
    (await solicitacoesPendentes(tx, id)).map((p) => p.codigo),
    cfg.bloquear_encerramento_com_pendentes === "true",
  );
  if (bloqueio) throw new DomainError(bloqueio);
  // Sem nenhuma resposta: cancela. Já com item atendido na OS: os itens restantes viram "não atendido",
  // para a área não ver "cancelada" numa solicitação que entrou parcialmente na OS final.
  // (Com o bloqueio ligado, não sobra nenhuma: a checagem acima já recusou.)
  await cancelarOrfas(ctx, ["ENVIADA"], "Evento encerrado para alterações antes da resposta desta solicitação.");
  await fecharParciais(ctx, "Evento encerrado para alterações antes da resposta.", "O evento foi encerrado para alterações; o que ainda estava em análise ficou como não atendido.");
  // Devolvida à área e rascunho de alteração nunca mais poderiam ser enviados: não ficam presos.
  await cancelarOrfas(ctx, ["DEVOLVIDA"], "Evento encerrado antes do reenvio");
  await cancelarOrfas(ctx, ["RASCUNHO"], "Evento encerrado antes do reenvio", "ALTERACAO");
  const osNumero = (await gerarOsVersao(tx, id, "ENCERRAMENTO", usuario.id, "OS final — evento encerrado para alterações")).numero;
  patch.encerradoEm = agora;
  patch.encerradoPorId = usuario.id;
  return osNumero;
}

async function reabrir({ tx, usuario, id, ev, just, patch }: ContextoTransicao) {
  patch.reabertoVezes = ev.reabertoVezes + 1;
  patch.encerradoEm = null;
  patch.encerradoPorId = null;
  return (await gerarOsVersao(tx, id, "REABERTURA", usuario.id, `Reaberto em exceção: ${just}`)).numero;
}

async function cancelar(ctx: ContextoTransicao) {
  const { usuario, agora, just, patch } = ctx;
  patch.canceladoEm = agora;
  patch.canceladoPorId = usuario.id;
  patch.canceladoMotivo = just;
  // Respondida em parte não vira "cancelada": o que falta fica não atendido, como no encerramento.
  await fecharParciais(ctx, "Evento cancelado antes da resposta.", "O evento foi cancelado; o que ainda estava em análise ficou como não atendido.");
  await cancelarOrfas(ctx, ["RASCUNHO", "DEVOLVIDA", "ENVIADA"], "Evento cancelado");
  return null;
}

const EFEITOS: Record<AcaoEvento, EfeitoTransicao> = {
  INICIAR_REUNIAO: iniciarReuniao,
  VOLTAR_PREPARACAO: voltarPreparacao,
  FECHAR_ATA: fecharAta,
  ENCERRAR: encerrar,
  REABRIR: reabrir,
  CANCELAR: cancelar,
};

function descricaoHistorico(acao: AcaoEvento, just: string | null, osNumero: number | null) {
  const descricoes: Record<AcaoEvento, string> = {
    INICIAR_REUNIAO: "Reunião de OS iniciada — envios de necessidades bloqueados",
    VOLTAR_PREPARACAO: `Reunião adiada, evento voltou para preparação — ${just}`,
    FECHAR_ATA: `Ata fechada — OS v${osNumero} gerada`,
    ENCERRAR: `Evento encerrado para alterações — OS final v${osNumero}`,
    REABRIR: `Evento reaberto em exceção — ${just}`,
    CANCELAR: `Evento cancelado — ${just}`,
  };
  return descricoes[acao];
}

function mensagemNotificacao(acao: AcaoEvento, nome: string, just: string | null, osNumero: number | null) {
  const mensagens: Record<AcaoEvento, [string, string]> = {
    INICIAR_REUNIAO: [`Reunião de OS iniciada: ${nome}`, "Envios de necessidades pausados enquanto a logística consolida a ata."],
    VOLTAR_PREPARACAO: [`Reunião adiada: ${nome}`, `${just?.replace(/[.!]+$/, "")}. As áreas voltam a poder enviar necessidades.`],
    FECHAR_ATA: [`Ata fechada: ${nome}`, `OS v${osNumero} gerada. Alterações agora entram como solicitações respondidas por item.`],
    ENCERRAR: [`Evento encerrado para alterações: ${nome}`, "Nenhuma solicitação nova é aceita a partir de agora."],
    REABRIR: [`Evento reaberto em exceção: ${nome}`, `Gestão reabriu o evento: ${just}`],
    CANCELAR: [`Evento cancelado: ${nome}`, `${just}`],
  };
  return mensagens[acao];
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
    const canceladasAuto: SolicitacaoCanceladaAuto[] = [];
    const osNumero = await EFEITOS[acao]({ tx, usuario, id, ev, cfg, agora, just, patch, canceladasAuto });

    await tx.update(eventos).set(patch).where(eq(eventos.id, id));
    await registrarHistorico(tx, {
      eventoId: id,
      entidade: "evento",
      entidadeId: id,
      acao,
      descricao: descricaoHistorico(acao, just, osNumero),
      usuarioId: usuario.id,
      dadosAntes: { status: ev.status },
      dadosDepois: { status: t.para },
    });

    const destinatarios = [...(await usuariosRequisitantes(tx)), ...(acao === "REABRIR" ? await usuariosLogistica(tx) : [])];
    const [titulo, mensagem] = mensagemNotificacao(acao, ev.nome, just, osNumero);
    await notificar(tx, {
      usuarioIds: destinatarios,
      tipo: `EVENTO_${acao}`,
      titulo,
      mensagem,
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
