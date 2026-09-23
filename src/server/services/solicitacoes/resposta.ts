import { and, asc, desc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, historico, solicitacaoItens, solicitacoes, type ItemStatus } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import {
  calcularEfeitoLinha,
  ITEM_STATUS_LABEL,
  podeCorrigirResposta,
  podeResponder,
  statusAposResposta,
  validarResposta,
  type RespostaItem,
} from "@/domain/solicitacao";
import { aplicarAjustesBom } from "@/domain/os";
import { gerarOsVersao } from "../os";
import { snapshotBom } from "../eventos";
import { bloquearEvento, notificar, registrarHistorico, registrarHistoricos, usuariosDaArea, type Executor } from "../support";
import { eventoDoItem, verificarFaseResposta } from "./comum";
import { descricaoItem } from "./consultas";

/* ------------------------------------------------------------------ */
/* Resposta por item (RN-03..RN-07)                                     */
/* ------------------------------------------------------------------ */

/** Uma resposta a item pode ser desfeita pelo próprio autor por este tempo (toast "Desfazer"). */
export const JANELA_DESFAZER_MS = 10 * 60_000;

type Resposta = { status: ItemStatus; quantidadeAtendida?: number | null; observacaoLogistica?: string | null; pendenciaCompra?: boolean };
type ItemComStatus = typeof solicitacaoItens.$inferSelect;
type Snapshot = Awaited<ReturnType<typeof snapshotBom>>;
type ObterSnapshot = (projetoId: string, versaoId: string | null) => Promise<Snapshot>;

/** Ações do histórico da linha que não mudam o que ela é (a conferência só marca). */
const ACOES_SO_CONFERENCIA = ["CONFERIDO", "CONFERENCIA_DESFEITA"];

/** Valores da linha da ata que a resposta a um item "adicionar" cria. */
async function valoresLinhaNova(usuario: UsuarioAtual, s: { eventoId: string; areaId: string }, item: ItemComStatus, quantidade: number, snap: ObterSnapshot): Promise<typeof eventoItens.$inferInsert> {
  const base = { eventoId: s.eventoId, quantidade, destino: item.destino, areaId: s.areaId, origem: "SOLICITACAO" as const, solicitacaoItemId: item.id, criadoPorId: usuario.id };
  if (item.projetoId) {
    // A versão pedida pela área (MEL-02 atualiza depois, de propósito).
    const sn = await snap(item.projetoId, item.projetoVersaoId);
    return { ...base, tipo: "PROJETO", projetoId: item.projetoId, projetoVersaoId: sn.versaoId, bomSnapshot: aplicarAjustesBom(sn.bom, item.ajustesBom) };
  }
  if (item.pecaId) return { ...base, tipo: "PECA", pecaId: item.pecaId };
  return { ...base, tipo: "AVULSO", descricaoLivre: item.descricaoLivre };
}

/** Linha descrita à mão que foi vinculada ao catálogo enquanto estava fora da ata volta já com a referência. */
async function referenciaAoVoltar(item: ItemComStatus, linha: { tipo: string }, ativa: boolean, snap: ObterSnapshot): Promise<Partial<typeof eventoItens.$inferInsert>> {
  if (!ativa || linha.tipo !== "AVULSO" || item.operacao !== "ADICIONAR" || !(item.projetoId || item.pecaId)) return {};
  if (item.projetoId) {
    const sn = await snap(item.projetoId, item.projetoVersaoId);
    return { tipo: "PROJETO", projetoId: item.projetoId, projetoVersaoId: sn.versaoId, bomSnapshot: aplicarAjustesBom(sn.bom, item.ajustesBom) };
  }
  return { tipo: "PECA", pecaId: item.pecaId };
}

/**
 * Aplica na linha da ata a mudança de estado de um item (resposta, correção ou desfazer = EM_ANALISE).
 * A regra está em `calcularEfeitoLinha` (domínio): só a diferença é aplicada, e linha removida por
 * outra ação não volta.
 */
async function aplicarEfeito(tx: Executor, usuario: UsuarioAtual, s: { eventoId: string; areaId: string }, item: ItemComStatus, novo: { status: ItemStatus; quantidadeAtendida: number | null }) {
  const idLinha = item.operacao === "ADICIONAR" ? item.eventoItemGeradoId : item.eventoItemId;
  const linha = idLinha ? await tx.query.eventoItens.findFirst({ where: eq(eventoItens.id, idLinha) }) : null;
  const efeito = calcularEfeitoLinha(item, novo, linha ? { ativo: linha.ativo, quantidade: linha.quantidade } : null);
  const snap: ObterSnapshot = (projetoId, versaoId) => snapshotBom(tx, projetoId, versaoId);

  if (efeito.acao === "criar") {
    const [nova] = await tx
      .insert(eventoItens)
      .values(await valoresLinhaNova(usuario, s, item, efeito.quantidade, snap))
      .returning({ id: eventoItens.id });
    return { eventoItemGeradoId: nova.id, quantidadeAnterior: null };
  }
  if (efeito.acao === "atualizar" && linha) {
    const referencia = await referenciaAoVoltar(item, linha, efeito.ativo, snap);
    // Quantidade mudou: a conferência da reunião precisa ser refeita (depois da ata, o campo não importa).
    await tx
      .update(eventoItens)
      .set(efeito.ativo ? { ativo: true, quantidade: efeito.quantidade, removidoEm: null, removidoPorId: null, conferidoEm: null, conferidoPorId: null, ...referencia } : { ativo: false, removidoEm: new Date(), removidoPorId: usuario.id, conferidoEm: null, conferidoPorId: null })
      .where(eq(eventoItens.id, linha.id));
  }
  return { eventoItemGeradoId: item.operacao === "ADICIONAR" ? item.eventoItemGeradoId : (item.eventoItemId ?? null), quantidadeAnterior: efeito.quantidadeAnterior };
}

/** Texto do histórico de uma resposta: o mesmo na resposta item a item e no "atender tudo". */
function descricaoResposta(codigo: string, desc: string, r: RespostaItem, quantidadeSolicitada: number, justificativaCorrecao: string | null) {
  const extras = [r.observacaoLogistica, justificativaCorrecao ? `correção: ${justificativaCorrecao}` : null].filter(Boolean);
  return `${codigo} · ${desc}: ${ITEM_STATUS_LABEL[r.status].toLowerCase()} (${r.quantidadeAtendida} de ${quantidadeSolicitada})${extras.length ? ` — ${extras.join(" · ")}` : ""}`;
}

/**
 * Responde um item dentro de uma transação que já travou o evento.
 * `ignorarFase`: só para o ajuste de linha da ata (conferencia.ts), que já conferiu a fase do evento —
 * depois do fechamento, a linha de uma necessidade pré-reunião também é corrigida por aqui.
 */
export async function responderNaTransacao(
  tx: Executor,
  usuario: UsuarioAtual,
  itemId: string,
  resposta: Resposta,
  justificativaCorrecao: string | null | undefined,
  opcoes: { gerarOs: boolean; notificar: boolean; ignorarFase?: boolean },
) {
  const item = await tx.query.solicitacaoItens.findFirst({
    where: eq(solicitacaoItens.id, itemId),
    with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } } },
  });
  if (!item) throw new NaoEncontradoError("Item");
  const s = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, item.solicitacaoId), eq(solicitacoes.excluida, false)), with: { evento: true, itens: true } });
  if (!s) throw new NaoEncontradoError("Solicitação");

  const correcao = item.status !== "EM_ANALISE";
  if (correcao) {
    if (!podeCorrigirResposta(s.status) && s.status !== "EM_ANALISE") throw new DomainError("Este item não pode ser corrigido.");
    if (!justificativaCorrecao?.trim()) throw new ValidacaoError("Este item já foi respondido. Para corrigir, informe a justificativa.", { justificativa: "Obrigatória para corrigir uma resposta." });
  } else if (!podeResponder(s.status)) {
    throw new DomainError("A solicitação não está aguardando resposta.");
  }
  if (!opcoes.ignorarFase) verificarFaseResposta(s);

  const linhaAtual = item.operacao === "ALTERAR_QUANTIDADE" && item.eventoItemId ? await tx.query.eventoItens.findFirst({ where: eq(eventoItens.id, item.eventoItemId), columns: { quantidade: true } }) : null;
  const r = validarResposta(item, resposta, linhaAtual?.quantidade ?? null);
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
      quantidadeAnterior: efeito.quantidadeAnterior,
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
    descricao: descricaoResposta(s.codigo, desc, r, item.quantidadeSolicitada, correcao ? (justificativaCorrecao ?? null) : null),
    usuarioId: usuario.id,
    dadosAntes: correcao ? { status: item.status, quantidadeAtendida: item.quantidadeAtendida, observacaoLogistica: item.observacaoLogistica } : null,
    dadosDepois: r,
  });

  if (opcoes.gerarOs && s.tipo === "ALTERACAO") {
    await gerarOsVersao(tx, s.eventoId, correcao ? "CORRECAO_RESPOSTA" : "RESPOSTA_SOLICITACAO", usuario.id, `${s.codigo} · ${desc} — ${ITEM_STATUS_LABEL[r.status].toLowerCase()}`);
  }
  if (opcoes.notificar) {
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
  }
  return { status: novoStatus, codigo: s.codigo, descricao: desc, podeDesfazer: !correcao, solicitacaoId: s.id, eventoId: s.eventoId, tipo: s.tipo, criadoPorId: s.criadoPorId, areaId: s.areaId };
}

/**
 * Responde como atendidos, de uma vez, todos os itens ainda em análise de uma solicitação, numa
 * transação que já travou o evento. Mesmo resultado de chamar `responderNaTransacao(…ATENDIDO…)` item a
 * item, na ordem dos itens (mesmo efeito na ata, mesmo histórico, mesmo status), mas em poucas idas ao
 * banco com o evento travado: linhas novas num insert, linhas existentes em dois updates, itens num
 * update e o histórico num insert. A versão da OS e o aviso à área ficam com quem chama (uma vez só).
 */
export async function atenderPendentesNaTransacao(tx: Executor, usuario: UsuarioAtual, solicitacaoId: string) {
  const s = await tx.query.solicitacoes.findFirst({
    where: and(eq(solicitacoes.id, solicitacaoId), eq(solicitacoes.excluida, false)),
    with: {
      evento: { columns: { status: true } },
      itens: { with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } } }, orderBy: [asc(solicitacaoItens.ordem), asc(solicitacaoItens.criadoEm)] },
    },
  });
  if (!s) throw new NaoEncontradoError("Solicitação");
  const pendentes = s.itens.filter((i) => i.status === "EM_ANALISE");
  if (pendentes.length === 0) return { s, pendentes };
  if (!podeResponder(s.status)) throw new DomainError("A solicitação não está aguardando resposta.");
  verificarFaseResposta(s);

  // Estado das linhas afetadas, lido uma vez e atualizado em memória item a item (como a sequência faria no banco).
  const idLinha = (i: ItemComStatus) => (i.operacao === "ADICIONAR" ? i.eventoItemGeradoId : i.eventoItemId);
  const ids = [...new Set(pendentes.map(idLinha).filter((x): x is string => Boolean(x)))];
  const lidas = ids.length ? await tx.query.eventoItens.findMany({ where: inArray(eventoItens.id, ids), columns: { id: true, ativo: true, quantidade: true, tipo: true } }) : [];
  const linhas = new Map(lidas.map((l) => [l.id, { ativo: l.ativo, quantidade: l.quantidade, tipo: l.tipo as string }]));
  const mudadas = new Map<string, { ativo: boolean; quantidade: number; referencia: Partial<typeof eventoItens.$inferInsert> }>();
  const cacheSnap = new Map<string, Promise<Snapshot>>();
  const snap: ObterSnapshot = (projetoId, versaoId) => {
    const k = `${projetoId}:${versaoId ?? ""}`;
    if (!cacheSnap.has(k)) cacheSnap.set(k, snapshotBom(tx, projetoId, versaoId));
    return cacheSnap.get(k)!;
  };

  const respostas = new Map<string, RespostaItem>();
  const vinculo = new Map<string, { eventoItemGeradoId: string | null; quantidadeAnterior: number | null }>();
  const novas: Array<typeof eventoItens.$inferInsert> = [];
  for (const item of pendentes) {
    const lid = idLinha(item);
    const atual = lid ? (linhas.get(lid) ?? null) : null;
    const r = validarResposta(item, { status: "ATENDIDO" }, item.operacao === "ALTERAR_QUANTIDADE" ? (atual?.quantidade ?? null) : null);
    respostas.set(item.id, r);
    const efeito = calcularEfeitoLinha(item, r, atual ? { ativo: atual.ativo, quantidade: atual.quantidade } : null);
    if (efeito.acao === "criar") {
      novas.push(await valoresLinhaNova(usuario, s, item, efeito.quantidade, snap));
      vinculo.set(item.id, { eventoItemGeradoId: null, quantidadeAnterior: null });
      continue;
    }
    if (efeito.acao === "atualizar" && lid && atual) {
      const referencia = await referenciaAoVoltar(item, atual, efeito.ativo, snap);
      linhas.set(lid, { ativo: efeito.ativo, quantidade: efeito.quantidade, tipo: (referencia.tipo as string | undefined) ?? atual.tipo });
      mudadas.set(lid, { ativo: efeito.ativo, quantidade: efeito.quantidade, referencia: { ...(mudadas.get(lid)?.referencia ?? {}), ...referencia } });
    }
    vinculo.set(item.id, { eventoItemGeradoId: item.operacao === "ADICIONAR" ? item.eventoItemGeradoId : (item.eventoItemId ?? null), quantidadeAnterior: efeito.quantidadeAnterior });
  }

  // Linhas da ata: novas num insert; existentes num update para as que saem e noutro para as que ficam.
  if (novas.length) {
    const criadas = await tx.insert(eventoItens).values(novas).returning({ id: eventoItens.id, solicitacaoItemId: eventoItens.solicitacaoItemId });
    for (const c of criadas) if (c.solicitacaoItemId) vinculo.set(c.solicitacaoItemId, { eventoItemGeradoId: c.id, quantidadeAnterior: null });
  }
  const agora = new Date();
  const saem = [...mudadas].filter(([, m]) => !m.ativo).map(([id]) => id);
  const ficam = [...mudadas].filter(([, m]) => m.ativo);
  if (saem.length) {
    await tx.update(eventoItens).set({ ativo: false, removidoEm: agora, removidoPorId: usuario.id, conferidoEm: null, conferidoPorId: null }).where(inArray(eventoItens.id, saem));
  }
  if (ficam.length) {
    const quantidade = sql`case ${eventoItens.id} ${sql.join(
      ficam.map(([id, m]) => sql`when ${id} then ${m.quantidade}::integer`),
      sql` `,
    )} else ${eventoItens.quantidade} end`;
    await tx
      .update(eventoItens)
      .set({ ativo: true, quantidade, removidoEm: null, removidoPorId: null, conferidoEm: null, conferidoPorId: null })
      .where(
        inArray(
          eventoItens.id,
          ficam.map(([id]) => id),
        ),
      );
    // Raro: linha descrita à mão vinculada ao catálogo enquanto estava fora da ata.
    for (const [id, m] of ficam) if (Object.keys(m.referencia).length) await tx.update(eventoItens).set(m.referencia).where(eq(eventoItens.id, id));
  }

  // Itens: um update só (a quantidade atendida de "atendido" é a solicitada).
  const porItem = (valor: (v: { eventoItemGeradoId: string | null; quantidadeAnterior: number | null }) => string | number | null, tipo: "text" | "integer", coluna: typeof solicitacaoItens.eventoItemGeradoId | typeof solicitacaoItens.quantidadeAnterior) =>
    sql`case ${solicitacaoItens.id} ${sql.join(
      pendentes.map((i) => sql`when ${i.id} then ${valor(vinculo.get(i.id)!)}::${sql.raw(tipo)}`),
      sql` `,
    )} else ${coluna} end`;
  await tx
    .update(solicitacaoItens)
    .set({
      status: "ATENDIDO",
      quantidadeAtendida: sql`${solicitacaoItens.quantidadeSolicitada}`,
      observacaoLogistica: null,
      pendenciaCompra: false,
      respondidoPorId: usuario.id,
      respondidoEm: agora,
      eventoItemGeradoId: porItem((v) => v.eventoItemGeradoId, "text", solicitacaoItens.eventoItemGeradoId),
      quantidadeAnterior: porItem((v) => v.quantidadeAnterior, "integer", solicitacaoItens.quantidadeAnterior),
    })
    .where(
      and(
        inArray(
          solicitacaoItens.id,
          pendentes.map((i) => i.id),
        ),
        eq(solicitacaoItens.status, "EM_ANALISE"),
      ),
    );

  const novoStatus = statusAposResposta(s.itens.map((i) => ({ status: respostas.get(i.id)?.status ?? i.status })));
  await tx
    .update(solicitacoes)
    .set({ status: novoStatus, respondidaEm: novoStatus === "RESPONDIDA" ? agora : null, atualizadoPorId: usuario.id })
    .where(eq(solicitacoes.id, s.id));

  await registrarHistoricos(
    tx,
    pendentes.map((i) => {
      const r = respostas.get(i.id)!;
      return {
        eventoId: s.eventoId,
        entidade: "solicitacao_item",
        entidadeId: i.id,
        acao: "RESPONDIDO",
        descricao: descricaoResposta(s.codigo, descricaoItem(i), r, i.quantidadeSolicitada, null),
        usuarioId: usuario.id,
        dadosAntes: null,
        dadosDepois: r,
      };
    }),
  );
  return { s, pendentes, status: novoStatus };
}

export async function responderItem(usuario: UsuarioAtual, itemId: string, resposta: Resposta, justificativaCorrecao?: string | null) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, await eventoDoItem(tx, itemId));
    const r = await responderNaTransacao(tx, usuario, itemId, resposta, justificativaCorrecao, { gerarOs: true, notificar: true });
    return { status: r.status, codigo: r.codigo, descricao: r.descricao, podeDesfazer: r.podeDesfazer, solicitacaoId: r.solicitacaoId, eventoId: r.eventoId };
  });
}

/**
 * "Atender tudo": responde como atendido todos os itens ainda em análise, numa transação só
 * (ou todos, ou nenhum), em lote, com uma única versão de OS e um único aviso para a área.
 */
export async function atenderTudo(usuario: UsuarioAtual, solicitacaoId: string) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const previa = await tx.query.solicitacoes.findFirst({ where: and(eq(solicitacoes.id, solicitacaoId), eq(solicitacoes.excluida, false)), columns: { eventoId: true } });
    if (!previa) throw new NaoEncontradoError("Solicitação");
    await bloquearEvento(tx, previa.eventoId);
    const { s, pendentes } = await atenderPendentesNaTransacao(tx, usuario, solicitacaoId);
    const n = pendentes.length;
    if (!n) throw new DomainError("Todos os itens já foram respondidos.");
    if (s.tipo === "ALTERACAO") {
      await gerarOsVersao(tx, s.eventoId, "RESPOSTA_SOLICITACAO", usuario.id, `${s.codigo} · ${n} ${n === 1 ? "item atendido" : "itens atendidos"}`);
    }
    await notificar(tx, {
      usuarioIds: [s.criadoPorId, ...(await usuariosDaArea(tx, s.areaId))],
      tipo: "ITEM_RESPONDIDO",
      titulo: `${s.codigo}: ${n} ${n === 1 ? "item atendido" : "itens atendidos"}`,
      mensagem: "A logística atendeu integralmente os itens que estavam em análise.",
      link: `/solicitacoes/${s.id}`,
    });
    return n;
  });
}

/**
 * Desfaz a primeira resposta a um item (toast "Desfazer"): só o autor, dentro da janela,
 * e só quando a última ação sobre o item foi essa resposta e a linha da ata ligada a ele não foi
 * mexida depois (ajuste de quantidade, remoção, peças, versão, vínculo). Correções não são desfeitas
 * por aqui — use "Corrigir".
 */
export async function desfazerResposta(usuario: UsuarioAtual, itemId: string) {
  exigir(usuario, "solicitacao.responder");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, await eventoDoItem(tx, itemId));
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
    // A linha da ata ligada ao item mudou depois da resposta: desfazer apagaria (ou inverteria) esse ajuste.
    const idLinha = item.operacao === "ADICIONAR" ? item.eventoItemGeradoId : item.eventoItemId;
    if (idLinha) {
      const [mexida] = await tx
        .select({ id: historico.id })
        .from(historico)
        .where(and(eq(historico.entidade, "evento_item"), eq(historico.entidadeId, idLinha), gt(historico.criadoEm, ultimo.criadoEm), notInArray(historico.acao, ACOES_SO_CONFERENCIA)))
        .limit(1);
      if (mexida) throw new DomainError("A linha da ata ligada a este item foi alterada ou removida depois da resposta. Use “Corrigir”.");
    }
    const s = await tx.query.solicitacoes.findFirst({ where: eq(solicitacoes.id, item.solicitacaoId), with: { evento: true, itens: true } });
    if (!s) throw new NaoEncontradoError("Solicitação");
    verificarFaseResposta(s);

    const efeito = await aplicarEfeito(tx, usuario, s, item, { status: "EM_ANALISE", quantidadeAtendida: null });
    await tx
      .update(solicitacaoItens)
      .set({ status: "EM_ANALISE", quantidadeAtendida: null, observacaoLogistica: null, pendenciaCompra: false, respondidoPorId: null, respondidoEm: null, quantidadeAnterior: efeito.quantidadeAnterior })
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
