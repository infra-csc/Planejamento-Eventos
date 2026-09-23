import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  anexos,
  areas,
  ataVersoes,
  eventoItens,
  eventos,
  historico,
  pecas,
  projetoVersoes,
  projetos,
  solicitacaoItens,
  solicitacoes,
  type AtaConteudo,
  type BomSnapshotLinha,
  type EventoStatus,
} from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { DomainError, NaoEncontradoError, ValidacaoError } from "@/domain/errors";
import { aplicarAjustesBom, descricaoLinha } from "@/domain/os";
import { gerarOsVersao, montarLinhasAta } from "../os";
import { bloquearEvento, notificarAjusteLinha, registrarHistorico, type Executor } from "../support";
import { nomeLinha, nomesUsuarios } from "./comum";

/* ------------------------------------------------------------------ */
/* Linhas da ata (leitura, conteúdo congelado e versões)                */
/* ------------------------------------------------------------------ */

/**
 * Linhas ativas da ata com a origem legível (handoff §5.6): "SOL-0001", "SOL-0001 (parcial)",
 * "Incluída na reunião" (antes do fechamento) ou "Ajuste da logística" (depois).
 */
export async function obterLinhasAta(eventoId: string, opcoes: { linhaId?: string } = {}) {
  const db = await getDb();
  const [linhas, ev] = await Promise.all([
    // Com `linhaId`, só aquela linha ativa: cada campo abaixo depende apenas da própria linha e do evento.
    montarLinhasAta(db, eventoId, opcoes.linhaId ? { linhaId: opcoes.linhaId } : {}),
    db.query.eventos.findFirst({ where: eq(eventos.id, eventoId), columns: { ataFechadaEm: true } }),
  ]);
  const ids = linhas.map((l) => l.registro.solicitacaoItemId).filter((x): x is string => Boolean(x));
  // Miniatura do projeto padrão na linha da ata (primeira imagem anexada).
  const projetoIds = [...new Set(linhas.map((l) => l.registro.projetoId).filter((x): x is string => Boolean(x)))];
  // Origens, capas e nomes de quem conferiu não dependem uns dos outros: uma ida ao banco em paralelo.
  const [origens, capas, nomesConferiu] = await Promise.all([
    ids.length
      ? db
          .select({ id: solicitacaoItens.id, status: solicitacaoItens.status, codigo: solicitacoes.codigo, solicitacaoId: solicitacoes.id })
          .from(solicitacaoItens)
          .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
          .where(inArray(solicitacaoItens.id, ids))
      : Promise.resolve([]),
    projetoIds.length
      ? db.select({ projetoId: anexos.projetoId, id: anexos.id }).from(anexos).where(and(inArray(anexos.projetoId, projetoIds), eq(anexos.tipo, "IMAGEM"))).orderBy(asc(anexos.criadoEm))
      : Promise.resolve([]),
    nomesUsuarios(db, linhas.map((l) => l.registro.conferidoPorId)),
  ]);
  const mapa = new Map(origens.map((o) => [o.id, o]));
  const capaDe = new Map<string, string>();
  for (const c of capas) if (!capaDe.has(c.projetoId)) capaDe.set(c.projetoId, c.id);
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
      /** Entrou depois do fechamento da ata (alteração atendida ou ajuste da logística). */
      posAta: Boolean(ev?.ataFechadaEm && l.registro.criadoEm > ev.ataFechadaEm),
      conferidoPor: l.registro.conferidoPorId ? (nomesConferiu.get(l.registro.conferidoPorId) ?? null) : null,
    };
  });
}

export type LinhaAtaDetalhe = Awaited<ReturnType<typeof obterLinhasAta>>[number];

export async function listarAtaVersoes(eventoId: string) {
  const db = await getDb();
  return db.query.ataVersoes.findMany({
    where: eq(ataVersoes.eventoId, eventoId),
    with: { fechadaPor: { columns: { id: true, nome: true } } },
    orderBy: [desc(ataVersoes.numero)],
  });
}

export async function montarAtaConteudo(ex: Executor, ev: typeof eventos.$inferSelect, fechadaPor: UsuarioAtual, agora: Date): Promise<AtaConteudo> {
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
      areaId: s.areaId,
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

/* ------------------------------------------------------------------ */
/* Linhas da ata (inclusão direta / ajuste da logística)                */
/* ------------------------------------------------------------------ */

/** Lista de peças do projeto: a versão atual ou, quando informada, a versão que a área pediu. */
export async function snapshotBom(ex: Executor, projetoId: string, versaoId?: string | null): Promise<{ versaoId: string; numero: number; bom: BomSnapshotLinha[] }> {
  const p = await ex.query.projetos.findFirst({ where: eq(projetos.id, projetoId) });
  // Com a versão informada (pedido já feito), o projeto inativado depois continua valendo: a versão é imutável.
  // Sem versão (pedido novo, "usar a versão atual"), só projeto ativo.
  if (!p || (!p.ativo && !versaoId)) throw new NaoEncontradoError("Projeto padrão");
  const v = await ex.query.projetoVersoes.findFirst({
    where: versaoId ? and(eq(projetoVersoes.projetoId, projetoId), eq(projetoVersoes.id, versaoId)) : and(eq(projetoVersoes.projetoId, projetoId), eq(projetoVersoes.numero, p.versaoAtual)),
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

    if (dados.areaId) {
      const area = await tx.query.areas.findFirst({ where: and(eq(areas.id, dados.areaId), eq(areas.ativo, true)), columns: { id: true } });
      if (!area) throw new ValidacaoError("Área inativa ou inexistente.", { areaId: "Escolha outra área." });
    }
    let valores: typeof eventoItens.$inferInsert;
    // Linha incluída pela própria logística durante a reunião já nasce conferida; antes dela, é conferida na reunião.
    const base = { eventoId, quantidade: dados.quantidade, destino: dados.destino, areaId: dados.areaId, origem: "AJUSTE_LOGISTICA" as const, justificativaAjuste: dados.justificativa, criadoPorId: usuario.id, ...(ev.status === "EM_REUNIAO" ? { conferidoEm: new Date(), conferidoPorId: usuario.id } : {}) };
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
      await notificarAjusteLinha(tx, {
        eventoId,
        areaId: dados.areaId ?? null,
        tipo: "ATA_AJUSTE",
        titulo: `Item novo na OS: ${ev.nome}`,
        mensagem: `A logística incluiu ${desc} × ${dados.quantidade}. Motivo: ${dados.justificativa}`,
        mensagemSemMotivo: `A logística incluiu ${desc} × ${dados.quantidade}.`,
        link: `/eventos/${eventoId}/itens/${linha.id}`,
        excetoUsuarioId: usuario.id,
      });
    }
    return linha;
  });
}

/**
 * Ajuste de quantidade pela aba Ata/OS (canetinha com justificativa). Mesmo caminho da conferência
 * (`ajustarQuantidadeLinha` em conferencia.ts): linha que veio de um pedido vira resposta/correção do item;
 * linha sem origem ajusta direto. Motivo sempre obrigatório. `quantidadeEsperada` é a quantidade que a tela
 * mostrava: se a linha mudou nesse meio-tempo, o ajuste é recusado.
 */
export async function alterarQuantidadeLinha(usuario: UsuarioAtual, eventoId: string, linhaId: string, quantidade: number, justificativa: string | null, opcoes: { quantidadeEsperada?: number | null } = {}) {
  // Import tardio: conferencia.ts importa este módulo.
  const { ajustarQuantidadeLinha } = await import("../conferencia");
  return ajustarQuantidadeLinha(usuario, eventoId, linhaId, quantidade, justificativa ?? "", { contexto: "ata", quantidadeEsperada: opcoes.quantidadeEsperada });
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
    // Peças editadas uma a uma nesta linha seriam perdidas: quem atualiza precisa refazer os ajustes de propósito.
    const [ajustePeca] = await tx
      .select({ id: historico.id })
      .from(historico)
      .where(and(eq(historico.entidade, "evento_item"), eq(historico.entidadeId, linhaId), eq(historico.acao, "PECA_PROJETO_AJUSTADA")))
      .limit(1);
    if (ajustePeca) throw new DomainError("Este projeto teve peças ajustadas uma a uma neste evento. Atualizar a versão apagaria esses ajustes; se quiser mesmo, ajuste as peças de novo depois de incluir a nova versão.");
    // A linha veio de uma solicitação com peças ajustadas? Os ajustes valem também na versão nova.
    const origem = linha.solicitacaoItemId ? await tx.query.solicitacaoItens.findFirst({ where: eq(solicitacaoItens.id, linha.solicitacaoItemId), columns: { ajustesBom: true } }) : null;
    const antesDaAta = ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO";
    await tx.update(eventoItens).set({ projetoVersaoId: snap.versaoId, bomSnapshot: aplicarAjustesBom(snap.bom, origem?.ajustesBom), ...(antesDaAta ? { conferidoEm: null, conferidoPorId: null } : {}) }).where(eq(eventoItens.id, linhaId));
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
