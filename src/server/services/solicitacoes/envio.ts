import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, historico, solicitacaoItens, solicitacoes, usuarios } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, SemPermissaoError, ValidacaoError } from "@/domain/errors";
import { aceitaSolicitacao } from "@/domain/evento";
import { podeEditarSolicitacao } from "@/domain/permissions";
import { podeCancelar, podeDevolver } from "@/domain/solicitacao";
import { diaMesISO, formatarDataHora, hojeISO } from "@/lib/format";
import { bloquearEvento, notificar, obterConfiguracoes, registrarHistorico, usuariosDaArea, usuariosLogistica, type Executor } from "../support";
import { faltamDescricoes } from "@/domain/descricoes-itens";
import { carregarEditavel, MSG_DESCRICOES, MSG_TITULO_OBRIGATORIO, verificarFaseResposta, verificarJanelaPreReuniao } from "./comum";
import { atenderPendentesNaTransacao } from "./resposta";
import { STATUS_ABERTOS } from "@/domain/solicitacao";

/* ------------------------------------------------------------------ */
/* Enviar / cancelar / devolver                                         */
/* ------------------------------------------------------------------ */

/**
 * Necessidade pré-reunião não passa por avaliação: cada item ainda em análise entra na ata como pedido,
 * e a logística confere e ajusta na reunião de OS. Usado no envio e na correção de dados antigos.
 * Retorna quantos itens entraram.
 */
export async function registrarPreReuniaoNaAta(tx: Executor, usuario: UsuarioAtual, solicitacaoId: string) {
  // Em lote: mesmo resultado de responder "atendido" item a item.
  const { pendentes } = await atenderPendentesNaTransacao(tx, usuario, solicitacaoId);
  if (pendentes.length) {
    const ids = pendentes.map((p) => p.id);
    await tx
      .update(solicitacaoItens)
      .set({ respondidoPorId: null, observacaoLogistica: "Registrado na ata automaticamente; conferido pela logística na reunião de OS." })
      .where(inArray(solicitacaoItens.id, ids));
    await tx
      .update(historico)
      .set({ acao: "REGISTRADO_NA_ATA" })
      .where(and(eq(historico.entidade, "solicitacao_item"), inArray(historico.entidadeId, ids), eq(historico.acao, "RESPONDIDO")));
  }
  return pendentes.length;
}

/**
 * Correção de dados de antes da regra atual: pré-reuniões ainda "aguardando resposta" em eventos com a
 * ata aberta entram na ata do mesmo jeito que um envio novo. Idempotente (só pega itens em análise).
 */
export async function registrarPreReunioesPendentes() {
  const db = await getDb();
  const pendentes = await db
    .select({ id: solicitacoes.id, eventoId: solicitacoes.eventoId, responsavelId: eventos.responsavelId })
    .from(solicitacoes)
    .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
    .where(
      and(
        eq(solicitacoes.excluida, false),
        eq(solicitacoes.tipo, "PRE_REUNIAO"),
        inArray(solicitacoes.status, STATUS_ABERTOS),
        inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO"]),
      ),
    );
  let itens = 0;
  for (const p of pendentes) {
    const resp = await db.query.usuarios.findFirst({ where: eq(usuarios.id, p.responsavelId), with: { area: true } });
    if (!resp) continue;
    const usuario: UsuarioAtual = { id: resp.id, nome: resp.nome, email: resp.email, perfil: resp.perfil, areaId: resp.areaId, areaNome: resp.area?.nome ?? null };
    itens += await db.transaction(async (tx) => {
      await bloquearEvento(tx, p.eventoId);
      return registrarPreReuniaoNaAta(tx, usuario, p.id);
    });
  }
  return { solicitacoes: pendentes.length, itens };
}

export async function enviarSolicitacao(usuario: UsuarioAtual, id: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const previa = await carregarEditavel(tx, usuario, id);
    // Trava o evento: um envio pré-reunião não pode entrar no meio do "Iniciar reunião"/"Fechar ata".
    await bloquearEvento(tx, previa.eventoId);
    // Depois do evento, a própria solicitação: um autosave em andamento termina antes e o envio lê os itens finais.
    const s = await carregarEditavel(tx, usuario, id, { travar: true });
    if (s.itens.length === 0) throw new DomainError("Adicione ao menos um item antes de enviar.");
    const semDescricao = s.itens.filter((i) => faltamDescricoes(i) > 0).length;
    // Rascunho antigo (de antes das descrições) enviado pela página de detalhe: diz onde preencher.
    if (semDescricao) throw new ValidacaoError(`${MSG_DESCRICOES(semDescricao)} Abra o rascunho em “Editar” para preencher.`, { descricoes: MSG_DESCRICOES(semDescricao) });
    if (!s.titulo?.trim()) throw new ValidacaoError(MSG_TITULO_OBRIGATORIO, { titulo: MSG_TITULO_OBRIGATORIO });
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
    // Alteração enviada depois da janela que a logística definiu: entra, mas marcada para decisão.
    const foraDaJanela = s.tipo === "ALTERACAO" && Boolean(s.evento.janelaAlteracoesAte) && hojeISO() > String(s.evento.janelaAlteracoesAte);
    // Recalculado a cada envio: uma devolvida reenviada dentro de uma janela estendida deixa de estar "fora".
    await tx.update(solicitacoes).set({ foraDaJanela }).where(eq(solicitacoes.id, id));
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao",
      entidadeId: id,
      acao: "ENVIADA",
      descricao: `${s.codigo} enviada pela ${s.area.nome}${usuario.perfil === "ADMIN" ? " (pelo administrador)" : ""} — ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}${foraDaJanela ? " · FORA DA JANELA de alterações" : ` · prazo ${formatarDataHora(prazo)}`}`,
      usuarioId: usuario.id,
    });

    // "Outro item (descrever)": a logística precisa cadastrar a peça ou vincular a algo do catálogo.
    const foraCatalogo = s.itens.filter((i) => i.operacao === "ADICIONAR" && !i.projetoId && !i.pecaId && i.descricaoLivre);
    if (foraCatalogo.length) {
      await notificar(tx, {
        usuarioIds: await usuariosLogistica(tx),
        tipo: "ITEM_FORA_CATALOGO",
        titulo: `Fora do catálogo: ${s.codigo} · ${s.area.nome}`,
        mensagem: `${foraCatalogo.map((i) => `“${i.descricaoLivre}” × ${i.quantidadeSolicitada}`).join(", ")}. Cadastre a peça ou vincule a um item que já existe (quem pediu pode não ter achado).`,
        link: `/solicitacoes/${id}`,
      });
    }

    // Antes da reunião não há avaliação: tudo entra na ata e a logística confere (e corrige) na reunião de OS.
    if (s.tipo === "PRE_REUNIAO") {
      await registrarPreReuniaoNaAta(tx, usuario, id);
      await notificar(tx, {
        usuarioIds: await usuariosLogistica(tx),
        tipo: "SOLICITACAO_ENVIADA",
        titulo: `Registrado na ata: ${s.codigo} · ${s.area.nome}`,
        mensagem: `${s.evento.nome} · ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}. Confira e ajuste na reunião de OS.`,
        link: `/solicitacoes/${id}`,
      });
      return { codigo: s.codigo, prazo, registradaNaAta: true, foraDaJanela: false };
    }

    await notificar(tx, {
      usuarioIds: await usuariosLogistica(tx),
      tipo: foraDaJanela ? "SOLICITACAO_FORA_JANELA" : "SOLICITACAO_ENVIADA",
      titulo: foraDaJanela ? `FORA DA JANELA: ${s.codigo} · ${s.area.nome}` : "Nova solicitação de alteração",
      mensagem: foraDaJanela
        ? `${s.evento.nome} · ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}. A janela de alterações terminou em ${diaMesISO(String(s.evento.janelaAlteracoesAte))}; a logística decide se atende.`
        : `${s.codigo} · ${s.area.nome} · ${s.evento.nome} · ${s.itens.length} ${s.itens.length === 1 ? "item" : "itens"}`,
      link: `/solicitacoes/${id}`,
    });
    return { codigo: s.codigo, prazo, registradaNaAta: false, foraDaJanela };
  });
}

export async function cancelarSolicitacao(usuario: UsuarioAtual, id: string, motivo: string | null) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const previa = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, id), eq(solicitacoes.excluida, false)), columns: { eventoId: true, areaId: true } });
    if (!previa) throw new NaoEncontradoError("Solicitação");
    if (!podeEditarSolicitacao(usuario, previa)) throw new SemPermissaoError();
    // Status lido depois da trava: uma resposta ou devolução em andamento termina antes.
    await bloquearEvento(tx, previa.eventoId);
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, id), with: { itens: { columns: { status: true } }, evento: { columns: { status: true, nome: true } }, area: { columns: { nome: true } } } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    if (s.evento.status === "ENCERRADO" || s.evento.status === "CANCELADO") throw new DomainError("O evento já foi encerrado; a solicitação não muda mais.");
    const algumRespondido = s.itens.some((i) => i.status !== "EM_ANALISE");
    if (!podeCancelar(s.status, algumRespondido, s.evento.status)) throw new DomainError("A solicitação já começou a ser respondida e não pode mais ser cancelada.");
    await tx.update(solicitacoes).set({ status: "CANCELADA", canceladaEm: new Date(), canceladaMotivo: motivo, atualizadoPorId: usuario.id }).where(eq(solicitacoes.id, id));
    await registrarHistorico(tx, {
      eventoId: s.eventoId,
      entidade: "solicitacao",
      entidadeId: id,
      acao: "CANCELADA",
      descricao: `${s.codigo} cancelada pelo solicitante${motivo ? ` — ${motivo}` : ""}`,
      usuarioId: usuario.id,
    });
    // Já estava na fila da logística (enviada, ou devolvida esperando o reenvio): ela precisa saber que saiu.
    if (s.status === "ENVIADA" || s.status === "DEVOLVIDA") {
      await notificar(tx, {
        usuarioIds: await usuariosLogistica(tx),
        tipo: "SOLICITACAO_CANCELADA",
        titulo: `${s.codigo} cancelada pela ${s.area.nome}`,
        mensagem: `${s.evento.nome}${s.titulo ? ` · ${s.titulo}` : ""}. ${motivo ? `Motivo: ${motivo}` : "Cancelada pela área antes da resposta."} Saiu da fila de resposta.`,
        link: `/solicitacoes/${id}`,
        excetoUsuarioId: usuario.id,
      });
    }
  });
}

export async function devolverSolicitacao(usuario: UsuarioAtual, id: string, motivo: string) {
  exigir(usuario, "solicitacao.responder");
  if (!motivo.trim()) throw new ValidacaoError("Informe o motivo da devolução.", { justificativa: "Obrigatório." });
  const db = await getDb();
  return db.transaction(async (tx) => {
    const previa = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, id), eq(solicitacoes.excluida, false)), columns: { eventoId: true } });
    if (!previa) throw new NaoEncontradoError("Solicitação");
    await bloquearEvento(tx, previa.eventoId);
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, id), with: { itens: true, evento: true, area: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    verificarFaseResposta(s);
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
