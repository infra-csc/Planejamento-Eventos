import { and, asc, eq, inArray, or, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, historico, solicitacaoItens, solicitacoes, usuarios, type Perfil } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { NaoEncontradoError } from "@/domain/errors";
import { pode, PERFIL_LABEL } from "@/domain/permissions";
import { ITEM_STATUS_LABEL } from "@/domain/solicitacao";
import { resumirAjustes } from "@/domain/os";
import { obterLinhasAta } from "./eventos";
import { descricaoItem, obterSolicitacao } from "./solicitacoes";

export type TomLinhaTempo = "neutro" | "ok" | "atencao" | "perigo" | "info";

export type EntradaLinhaTempo = {
  id: string;
  em: string;
  acao: string;
  titulo: string;
  descricao: string;
  tom: TomLinhaTempo;
  por: { nome: string; perfil: string } | null;
  /** Item da solicitação a que a entrada se refere (para marcar na lista). */
  itemId: string | null;
};

const PERFIS_LOGISTICA: Perfil[] = ["LOGISTICA", "ADMIN"];

/** Rótulo e cor de cada ação registrada no histórico, do ponto de vista de quem pede e de quem responde. */
function rotular(acao: string, dadosDepois: unknown, perfil: Perfil | null): { titulo: string; tom: TomLinhaTempo } {
  const d = (dadosDepois ?? {}) as Record<string, unknown>;
  switch (acao) {
    case "RASCUNHO_CRIADO":
      return { titulo: "Rascunho criado", tom: "neutro" };
    case "ENVIADA":
      return { titulo: "Solicitação enviada", tom: "info" };
    case "DEVOLVIDA":
      return { titulo: "Devolvida para ajuste", tom: "atencao" };
    case "CANCELADA":
      return { titulo: "Solicitação cancelada", tom: "perigo" };
    case "REGISTRADO_NA_ATA":
      return { titulo: "Entrou na ata (sem avaliação)", tom: "info" };
    case "RESPONDIDO": {
      // Dados antigos: registro automático na ata ficou com o nome de quem enviou.
      if (perfil && !PERFIS_LOGISTICA.includes(perfil) && d.status === "ATENDIDO") return { titulo: "Entrou na ata (sem avaliação)", tom: "info" };
      const st = typeof d.status === "string" ? d.status : null;
      return { titulo: `Respondido: ${st ? ITEM_STATUS_LABEL[st as keyof typeof ITEM_STATUS_LABEL].toLowerCase() : "resposta"}`, tom: st === "ATENDIDO" ? "ok" : st === "NAO_ATENDIDO" ? "perigo" : "atencao" };
    }
    case "RESPOSTA_CORRIGIDA": {
      const st = typeof d.status === "string" ? d.status : null;
      return { titulo: `Resposta corrigida${st ? `: ${ITEM_STATUS_LABEL[st as keyof typeof ITEM_STATUS_LABEL].toLowerCase()}` : ""}`, tom: "atencao" };
    }
    case "RESPOSTA_DESFEITA":
      return { titulo: "Resposta desfeita", tom: "neutro" };
    case "CONFERIDO":
      return { titulo: "Conferido na reunião", tom: "ok" };
    case "CONFERENCIA_DESFEITA":
      return { titulo: "Conferência desfeita", tom: "neutro" };
    case "CONFERENCIA_AJUSTE":
      return { titulo: "Quantidade ajustada na reunião", tom: "atencao" };
    case "ATA_INCLUSAO":
      return { titulo: "Incluído na ata durante a reunião", tom: "info" };
    case "AJUSTE_INCLUSAO":
      return { titulo: "Incluído na OS pela logística", tom: "info" };
    case "ATA_QUANTIDADE":
      return { titulo: "Quantidade ajustada pela logística", tom: "atencao" };
    case "ATA_REMOCAO":
      return { titulo: "Retirado da ata/OS", tom: "perigo" };
    case "PECA_PROJETO_AJUSTADA":
      return { titulo: "Peça do projeto ajustada", tom: "atencao" };
    case "ITEM_VINCULADO":
      return { titulo: "Vinculado ao catálogo", tom: "info" };
    case "ATUALIZACAO_VERSAO":
      return { titulo: "Projeto atualizado para nova versão", tom: "info" };
    default:
      return { titulo: acao.replace(/_/g, " ").toLowerCase(), tom: "neutro" };
  }
}

async function carregarEntradas(filtro: SQL, itemDaEntidade: (entidade: string, entidadeId: string) => string | null): Promise<EntradaLinhaTempo[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: historico.id, em: historico.criadoEm, acao: historico.acao, descricao: historico.descricao, dadosDepois: historico.dadosDepois, entidade: historico.entidade, entidadeId: historico.entidadeId, nome: usuarios.nome, perfil: usuarios.perfil })
    .from(historico)
    .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
    .where(filtro)
    .orderBy(asc(historico.criadoEm));
  return rows.map((r) => {
    const { titulo, tom } = rotular(r.acao, r.dadosDepois, r.perfil);
    return {
      id: r.id,
      em: r.em.toISOString(),
      acao: r.acao,
      titulo,
      // Registro automático na ata foi gravado como "atendido": o texto passa a dizer o que aconteceu.
      descricao: titulo.startsWith("Entrou na ata") ? r.descricao.replace(/: atendido \((\d+) de \d+\)/, ": entrou na ata × $1") : r.descricao,
      tom,
      por: r.nome ? { nome: r.nome, perfil: r.perfil ? PERFIL_LABEL[r.perfil] : "" } : null,
      itemId: itemDaEntidade(r.entidade, r.entidadeId),
    };
  });
}

/** Tudo o que aconteceu com uma solicitação e seus itens, inclusive nas linhas da ata/OS que ela gerou. */
export async function linhaDoTempoSolicitacao(usuario: UsuarioAtual, solicitacaoId: string) {
  const s = await obterSolicitacao(usuario, solicitacaoId); // valida acesso (área)
  const db = await getDb();
  const itemIds = s.itens.map((i) => i.id);
  const linhas = itemIds.length ? await db.select({ id: eventoItens.id, itemId: eventoItens.solicitacaoItemId }).from(eventoItens).where(inArray(eventoItens.solicitacaoItemId, itemIds)) : [];
  const itemDaLinha = new Map(linhas.map((l) => [l.id, l.itemId]));
  const conds: SQL[] = [and(eq(historico.entidade, "solicitacao"), eq(historico.entidadeId, s.id))!];
  if (itemIds.length) conds.push(and(eq(historico.entidade, "solicitacao_item"), inArray(historico.entidadeId, itemIds))!);
  if (linhas.length) conds.push(and(eq(historico.entidade, "evento_item"), inArray(historico.entidadeId, linhas.map((l) => l.id)))!);
  return carregarEntradas(or(...conds)!, (entidade, id) => (entidade === "solicitacao_item" ? id : entidade === "evento_item" ? (itemDaLinha.get(id) ?? null) : null));
}

/**
 * Detalhe de uma linha da ata/OS: o que é, quem pediu (e o que pediu), a resposta da logística
 * e a linha do tempo completa do item, do rascunho até a OS.
 */
export async function detalheLinha(usuario: UsuarioAtual, eventoId: string, linhaId: string) {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const linha = (await obterLinhasAta(eventoId)).find((l) => l.id === linhaId);
  if (!linha) throw new NaoEncontradoError("Linha");

  const itemId = linha.registro.solicitacaoItemId;
  const origem = itemId
    ? (
        await db
          .select({
            itemId: solicitacaoItens.id,
            quantidadeSolicitada: solicitacaoItens.quantidadeSolicitada,
            quantidadeAtendida: solicitacaoItens.quantidadeAtendida,
            status: solicitacaoItens.status,
            justificativa: solicitacaoItens.justificativa,
            observacaoLogistica: solicitacaoItens.observacaoLogistica,
            ajustesBom: solicitacaoItens.ajustesBom,
            respondidoEm: solicitacaoItens.respondidoEm,
            respondidoPorId: solicitacaoItens.respondidoPorId,
            solicitacaoId: solicitacoes.id,
            codigo: solicitacoes.codigo,
            titulo: solicitacoes.titulo,
            tipo: solicitacoes.tipo,
            observacao: solicitacoes.observacao,
            criadoEm: solicitacoes.criadoEm,
            enviadaEm: solicitacoes.enviadaEm,
            areaId: solicitacoes.areaId,
            area: areas.nome,
            solicitante: usuarios.nome,
            solicitanteEmail: usuarios.email,
          })
          .from(solicitacaoItens)
          .innerJoin(solicitacoes, eq(solicitacaoItens.solicitacaoId, solicitacoes.id))
          .innerJoin(areas, eq(solicitacoes.areaId, areas.id))
          .innerJoin(usuarios, eq(solicitacoes.criadoPorId, usuarios.id))
          .where(eq(solicitacaoItens.id, itemId))
      )[0]
    : undefined;

  // Quem não vê todas as áreas enxerga o detalhe completo só das linhas da própria área.
  const veTudo = pode(usuario, "solicitacao.ver_todas") || (origem ? origem.areaId === usuario.areaId : linha.registro.areaId === usuario.areaId);
  const respondidoPor = origem?.respondidoPorId ? (await db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, origem.respondidoPorId)))[0]?.nome ?? null : null;

  const conds: SQL[] = [and(eq(historico.entidade, "evento_item"), eq(historico.entidadeId, linhaId))!];
  if (origem && veTudo) {
    conds.push(and(eq(historico.entidade, "solicitacao_item"), eq(historico.entidadeId, origem.itemId))!);
    conds.push(and(eq(historico.entidade, "solicitacao"), eq(historico.entidadeId, origem.solicitacaoId), inArray(historico.acao, ["RASCUNHO_CRIADO", "ENVIADA", "DEVOLVIDA"]))!);
  }
  const linhaDoTempo = await carregarEntradas(or(...conds)!, () => null);

  return {
    id: linha.id,
    nome: linha.nome,
    tipo: linha.tipo,
    codigo: linha.tipo === "PROJETO" ? (linha.projeto?.codigo ?? null) : linha.tipo === "PECA" ? (linha.peca?.codigo ?? null) : null,
    versao: linha.versao,
    quantidade: linha.quantidade,
    destino: linha.destino,
    area: linha.areaNome,
    capaId: linha.capaId ?? null,
    origemLabel: linha.origemLabel,
    conferidoEm: linha.conferidoEm ? linha.conferidoEm.toISOString() : null,
    conferidoPor: linha.conferidoPor ?? null,
    descricaoOriginal: linha.registro.descricaoLivre,
    pecasDoProjeto: linha.tipo === "PROJETO" ? (linha.projeto?.bom ?? []).map((b) => ({ pecaId: b.pecaId, codigo: b.codigo, nome: b.nome, unidade: b.unidade, porUnidade: b.quantidade, total: b.quantidade * linha.quantidade })) : [],
    posAta: linha.posAta,
    areaId: linha.registro.areaId,
    origem: origem
      ? {
          solicitacaoId: origem.solicitacaoId,
          codigo: origem.codigo,
          titulo: origem.titulo,
          tipo: origem.tipo,
          area: origem.area,
          solicitante: origem.solicitante,
          criadoEm: origem.criadoEm.toISOString(),
          enviadaEm: origem.enviadaEm ? origem.enviadaEm.toISOString() : null,
          quantidadeSolicitada: origem.quantidadeSolicitada,
          quantidadeAtendida: origem.quantidadeAtendida,
          status: origem.status,
          observacaoSolicitante: veTudo ? origem.justificativa : null,
          observacaoSolicitacao: veTudo ? origem.observacao : null,
          ajustes: resumirAjustes(origem.ajustesBom),
          respostaLogistica: veTudo ? origem.observacaoLogistica : null,
          respondidoPor,
          respondidoEm: origem.respondidoEm ? origem.respondidoEm.toISOString() : null,
        }
      : null,
    linhaDoTempo,
    restrito: !veTudo,
  };
}

export type DetalheLinha = Awaited<ReturnType<typeof detalheLinha>>;
export { descricaoItem };
