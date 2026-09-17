import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventoItens, eventos, historico, pecas, solicitacaoItens, solicitacoes, usuarios } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { descricaoLinha, resumirAjustes } from "@/domain/os";
import { obterLinhasAta } from "./eventos";
import { gerarOsVersao, montarLinhasAta } from "./os";
import { responderNaTransacao } from "./solicitacoes";
import { bloquearEvento, notificar, registrarHistorico, usuariosDaArea } from "./support";

/** Ações do histórico que contam como "ajuste de quantidade" de uma linha, para o log da conferência. */
const ACOES_AJUSTE = ["CONFERENCIA_AJUSTE", "ATA_QUANTIDADE"];

type Registro = { acao: string; dadosAntes: unknown; dadosDepois: unknown; descricao: string; criadoEm: Date; por: string | null };

/** Texto curto do ajuste ("3 → 2 · motivo"), sem repetir o nome do item que já está na linha. */
function textoAjuste(r: Registro): string {
  const a = (r.dadosAntes ?? {}) as Record<string, unknown>;
  const d = (r.dadosDepois ?? {}) as Record<string, unknown>;
  if (r.acao === "CONFERENCIA_AJUSTE") return `${a.quantidade} → ${Number(d.quantidade) === 0 ? "retirado da ata" : d.quantidade}${d.motivo ? ` · ${d.motivo}` : ""}`;
  if (r.acao === "RESPOSTA_CORRIGIDA") return `${a.quantidadeAtendida ?? "?"} → ${Number(d.quantidadeAtendida) === 0 ? "retirado da ata" : d.quantidadeAtendida}${d.observacaoLogistica ? ` · ${d.observacaoLogistica}` : ""}`;
  if (r.acao === "ATA_QUANTIDADE") return `${a.quantidade} → ${d.quantidade}`;
  return r.descricao;
}

/**
 * Tudo que a tela de conferência da reunião mostra: cada linha da ata com quem pediu
 * (solicitação, pessoa, data, observação e peças ajustadas), situação da conferência
 * e o último ajuste de quantidade (quem, quando, de quanto para quanto e o motivo).
 */
export async function obterConferencia(eventoId: string) {
  const db = await getDb();
  const linhas = await obterLinhasAta(eventoId);
  const itemIds = linhas.map((l) => l.registro.solicitacaoItemId).filter((x): x is string => Boolean(x));
  const linhaIds = linhas.map((l) => l.id);

  const [origens, ajustes, correcoes, criadores] = await Promise.all([
    itemIds.length
      ? db
          .select({
            itemId: solicitacaoItens.id,
            quantidadeSolicitada: solicitacaoItens.quantidadeSolicitada,
            justificativa: solicitacaoItens.justificativa,
            ajustesBom: solicitacaoItens.ajustesBom,
            solicitacaoId: solicitacoes.id,
            codigo: solicitacoes.codigo,
            titulo: solicitacoes.titulo,
            enviadaEm: solicitacoes.enviadaEm,
            solicitante: usuarios.nome,
          })
          .from(solicitacaoItens)
          .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
          .innerJoin(usuarios, eq(solicitacoes.criadoPorId, usuarios.id))
          .where(inArray(solicitacaoItens.id, itemIds))
      : Promise.resolve([]),
    linhaIds.length
      ? db
          .select({ entidadeId: historico.entidadeId, acao: historico.acao, dadosAntes: historico.dadosAntes, dadosDepois: historico.dadosDepois, descricao: historico.descricao, criadoEm: historico.criadoEm, por: usuarios.nome })
          .from(historico)
          .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
          .where(and(eq(historico.entidade, "evento_item"), inArray(historico.entidadeId, linhaIds), inArray(historico.acao, ACOES_AJUSTE)))
          .orderBy(desc(historico.criadoEm))
      : Promise.resolve([]),
    // Correções feitas pela tela da solicitação também mudam a linha: entram no mesmo log.
    itemIds.length
      ? db
          .select({ entidadeId: historico.entidadeId, acao: historico.acao, dadosAntes: historico.dadosAntes, dadosDepois: historico.dadosDepois, descricao: historico.descricao, criadoEm: historico.criadoEm, por: usuarios.nome })
          .from(historico)
          .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
          .where(and(eq(historico.entidade, "solicitacao_item"), inArray(historico.entidadeId, itemIds), eq(historico.acao, "RESPOSTA_CORRIGIDA")))
          .orderBy(desc(historico.criadoEm))
      : Promise.resolve([]),
    linhaIds.length
      ? db.select({ id: eventoItens.id, por: usuarios.nome }).from(eventoItens).leftJoin(usuarios, eq(eventoItens.criadoPorId, usuarios.id)).where(inArray(eventoItens.id, linhaIds))
      : Promise.resolve([]),
  ]);

  const origemDe = new Map(origens.map((o) => [o.itemId, o]));
  const ultimoAjuste = new Map<string, Registro>();
  for (const a of ajustes) if (!ultimoAjuste.has(a.entidadeId)) ultimoAjuste.set(a.entidadeId, a);
  const ultimaCorrecao = new Map<string, Registro>();
  for (const c of correcoes) if (!ultimaCorrecao.has(c.entidadeId)) ultimaCorrecao.set(c.entidadeId, c);
  const criadorDe = new Map(criadores.map((c) => [c.id, c.por]));

  return linhas.map((l) => {
    const o = l.registro.solicitacaoItemId ? origemDe.get(l.registro.solicitacaoItemId) : undefined;
    // O ajuste da conferência grava os dois registros juntos; a correção só vale se for mais recente.
    const daLinha = ultimoAjuste.get(l.id);
    const doItem = l.registro.solicitacaoItemId ? ultimaCorrecao.get(l.registro.solicitacaoItemId) : undefined;
    const aj = doItem && (!daLinha || doItem.criadoEm.getTime() - daLinha.criadoEm.getTime() > 2000) ? doItem : daLinha;
    return {
      id: l.id,
      tipo: l.tipo,
      nome: l.nome,
      codigo: l.tipo === "PROJETO" ? (l.projeto?.codigo ?? null) : l.tipo === "PECA" ? (l.peca?.codigo ?? null) : null,
      versao: l.versao,
      quantidade: l.quantidade,
      destino: l.destino,
      areaNome: l.areaNome,
      capaId: l.capaId ?? null,
      conferidoEm: l.conferidoEm ? l.conferidoEm.toISOString() : null,
      conferidoPor: l.conferidoPor ?? null,
      origem: o
        ? {
            solicitacaoId: o.solicitacaoId,
            codigo: o.codigo,
            titulo: o.titulo,
            solicitante: o.solicitante,
            enviadaEm: o.enviadaEm ? o.enviadaEm.toISOString() : null,
            quantidadeSolicitada: o.quantidadeSolicitada,
            observacao: o.justificativa,
            ajustes: resumirAjustes(o.ajustesBom),
          }
        : null,
      incluidaPor: o ? null : (criadorDe.get(l.id) ?? null),
      ultimoAjuste: aj ? { por: aj.por ?? "—", em: aj.criadoEm.toISOString(), descricao: textoAjuste(aj) } : null,
    };
  });
}

export type LinhaConferencia = Awaited<ReturnType<typeof obterConferencia>>[number];

/**
 * Canetinha da conferência: muda a quantidade de uma linha na reunião, sempre com motivo e log.
 * Se a linha veio de uma necessidade da área e a nova quantidade não passa do pedido, a mudança
 * vira a resposta do item (atendido, parcial ou não atendido), e quem pediu é avisado com o motivo.
 * Acima do pedido, ou em linha incluída pela logística, ajusta direto na ata.
 * A linha ajustada fica conferida (a decisão foi tomada na reunião).
 */
export async function ajustarLinhaNaConferencia(usuario: UsuarioAtual, eventoId: string, linhaId: string, quantidade: number, motivo: string) {
  exigir(usuario, "ata.consolidar");
  const razao = motivo?.trim();
  if (!razao) throw new ValidacaoError("Informe o motivo do ajuste.", { motivo: "Fica registrado no histórico e é enviado a quem pediu." });
  if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > 1_000_000) {
    throw new ValidacaoError("Quantidade deve ser um inteiro entre 0 e 1.000.000.", { quantidade: "Use um número inteiro." });
  }
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("A conferência acontece antes de fechar a ata. Depois disso, use o ajuste com justificativa na aba Ata.");

    const [linha] = await montarLinhasAta(tx, eventoId, { linhaId });
    if (!linha) throw new NaoEncontradoError("Linha da ata");
    const antes = linha.quantidade;
    if (quantidade === antes) throw new ValidacaoError("A quantidade informada é a mesma que já está na ata.", { quantidade: "Informe outro valor." });
    const desc = descricaoLinha(linha);
    const agora = new Date();

    const item = linha.registro.solicitacaoItemId ? await tx.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, linha.registro.solicitacaoItemId) }) : null;
    if (item && item.operacao === "ADICIONAR" && quantidade <= item.quantidadeSolicitada) {
      const status = quantidade === 0 ? "NAO_ATENDIDO" : quantidade < item.quantidadeSolicitada ? "PARCIAL" : "ATENDIDO";
      await responderNaTransacao(tx, usuario, item.id, { status, quantidadeAtendida: quantidade, observacaoLogistica: razao }, razao, { gerarOs: false, notificar: true });
    } else {
      await tx
        .update(eventoItens)
        .set(quantidade === 0 ? { ativo: false, removidoEm: agora, removidoPorId: usuario.id, justificativaAjuste: razao } : { quantidade, justificativaAjuste: razao })
        .where(eq(eventoItens.id, linhaId));
    }
    if (quantidade > 0) await tx.update(eventoItens).set({ conferidoEm: agora, conferidoPorId: usuario.id }).where(and(eq(eventoItens.id, linhaId), eq(eventoItens.ativo, true)));

    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linhaId,
      acao: "CONFERENCIA_AJUSTE",
      descricao: quantidade === 0 ? `${desc}: retirado da ata na reunião (era ${antes}) — ${razao}` : `${desc}: ${antes} → ${quantidade} na reunião — ${razao}`,
      usuarioId: usuario.id,
      dadosAntes: { quantidade: antes },
      dadosDepois: { quantidade, motivo: razao },
    });
    return { removida: quantidade === 0 };
  });
}

/**
 * Edita uma peça dentro de um projeto já na ata/OS (por unidade do projeto): muda a quantidade,
 * tira a peça (0) ou inclui uma peça do catálogo que o projeto não tinha. Sempre com motivo e log.
 * Antes do fechamento é ajuste da reunião; com a ata fechada gera nova versão da OS e avisa a área.
 */
export async function ajustarPecaDoProjeto(usuario: UsuarioAtual, eventoId: string, linhaId: string, pecaId: string, quantidadePorUnidade: number, motivo: string) {
  exigir(usuario, "ata.consolidar");
  const razao = motivo?.trim();
  if (!razao) throw new ValidacaoError("Informe o motivo do ajuste.", { motivo: "Fica registrado no histórico." });
  if (!Number.isInteger(quantidadePorUnidade) || quantidadePorUnidade < 0 || quantidadePorUnidade > 100_000) {
    throw new ValidacaoError("Quantidade por unidade deve ser um inteiro entre 0 e 100.000.", { quantidade: "Use um número inteiro." });
  }
  const db = await getDb();
  return db.transaction(async (tx) => {
    await bloquearEvento(tx, eventoId);
    const ev = await tx.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { id: true, nome: true, status: true } });
    if (!ev) throw new NaoEncontradoError("Evento");
    const aberto = ev.status === "ABERTO";
    if (!aberto && ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") throw new DomainError("O evento não aceita ajustes neste estado.");
    if (aberto) exigir(usuario, "ata.ajustar");

    const linha = await tx.query.eventoItens.findFirst({ where: and(eq(eventoItens.id, linhaId), eq(eventoItens.eventoId, eventoId), eq(eventoItens.ativo, true)), with: { projeto: { columns: { nome: true, codigo: true } } } });
    if (!linha || linha.tipo !== "PROJETO") throw new NaoEncontradoError("Projeto na ata");
    const bom = [...(linha.bomSnapshot ?? [])];
    const idx = bom.findIndex((b) => b.pecaId === pecaId);
    const antes = idx >= 0 ? bom[idx].quantidade : 0;
    if (antes === quantidadePorUnidade) throw new ValidacaoError("A quantidade informada é a mesma do projeto.", { quantidade: "Informe outro valor." });

    let peca: { codigo: string; nome: string };
    if (idx >= 0) {
      peca = bom[idx];
      if (quantidadePorUnidade === 0) bom.splice(idx, 1);
      else bom[idx] = { ...bom[idx], quantidade: quantidadePorUnidade };
    } else {
      const p = await tx.query.pecas.findFirst({ where: and(eq(pecas.id, pecaId), eq(pecas.ativo, true)) });
      if (!p) throw new NaoEncontradoError("Peça");
      if (quantidadePorUnidade === 0) throw new ValidacaoError("Para incluir uma peça, informe a quantidade por unidade.", { quantidade: "Maior que zero." });
      peca = p;
      bom.push({ pecaId: p.id, codigo: p.codigo, nome: p.nome, setor: p.setor, unidade: p.unidade, quantidade: quantidadePorUnidade });
    }
    await tx.update(eventoItens).set({ bomSnapshot: bom }).where(eq(eventoItens.id, linhaId));

    const projeto = linha.projeto?.nome ?? "Projeto";
    const acaoTexto = antes === 0 ? `incluída com ${quantidadePorUnidade} por unidade` : quantidadePorUnidade === 0 ? `retirada (eram ${antes} por unidade)` : `${antes} → ${quantidadePorUnidade} por unidade`;
    const texto = `${projeto}: ${peca.codigo} · ${peca.nome} ${acaoTexto} (× ${linha.quantidade} = ${quantidadePorUnidade * linha.quantidade}) — ${razao}`;
    await registrarHistorico(tx, {
      eventoId,
      entidade: "evento_item",
      entidadeId: linhaId,
      acao: "PECA_PROJETO_AJUSTADA",
      descricao: texto,
      usuarioId: usuario.id,
      dadosAntes: { pecaId, quantidade: antes },
      dadosDepois: { pecaId, quantidade: quantidadePorUnidade, motivo: razao },
    });
    if (aberto) {
      await gerarOsVersao(tx, eventoId, "AJUSTE_LOGISTICA", usuario.id, texto);
      if (linha.areaId) {
        await notificar(tx, { usuarioIds: await usuariosDaArea(tx, linha.areaId), tipo: "ATA_AJUSTE", titulo: `Ajuste na OS: ${ev.nome}`, mensagem: texto, link: `/eventos/${eventoId}/itens/${linhaId}` });
      }
    }
    return { texto };
  });
}
