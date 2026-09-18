import { and, asc, count, desc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventoItens, eventos, historico, solicitacaoItens, solicitacoes, usuarios, type EventoStatus, type ItemOperacao, type SolicitacaoStatus, type SolicitacaoTipo } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { ehRequisitante, pode } from "@/domain/permissions";
import { addDiasISO, diaMesHora, diaMesISO, diaSemanaCurto, hojeISO, hora, isoSP } from "@/lib/format";
import { aguardaReuniao } from "@/domain/solicitacao";
import { descricaoItem } from "./solicitacoes";

/**
 * Painel orientado à próxima ação (handoff §5.2). Todo contador é derivado dos itens
 * e das solicitações — nada lido de campos agregados.
 */

export type ItemFila = {
  id: string;
  codigo: string;
  titulo: string | null;
  tipo: SolicitacaoTipo;
  status: SolicitacaoStatus;
  areaNome: string;
  eventoNome: string;
  total: number;
  respondidos: number;
  prazoRespostaEm: Date | null;
  /** Alteração enviada depois da janela: destaque para a logística decidir. */
  foraDaJanela: boolean;
  pendenteUnico: { id: string; descricao: string; quantidade: number; destino: string | null; operacao: ItemOperacao } | null;
};

export type ItemAgenda = { chave: string; ordem: number; dia: string; titulo: string; sub: string; tipo: "reuniao" | "carga" | "montagem"; href: string };

type SolicitacaoComItens = {
  id: string;
  codigo: string;
  titulo: string | null;
  tipo: SolicitacaoTipo;
  status: SolicitacaoStatus;
  prazoRespostaEm: Date | null;
  foraDaJanela?: boolean;
  area: { nome: string };
  evento: { nome: string };
  itens: Array<Parameters<typeof descricaoItem>[0] & { id: string; status: string; quantidadeSolicitada: number; destino: string | null; operacao: ItemOperacao }>;
};

function paraFila(s: SolicitacaoComItens): ItemFila {
  const pendentes = s.itens.filter((i) => i.status === "EM_ANALISE");
  const aberta = s.status === "ENVIADA" || s.status === "EM_ANALISE";
  const p = pendentes[0];
  return {
    id: s.id,
    codigo: s.codigo,
    titulo: s.titulo,
    tipo: s.tipo,
    status: s.status,
    areaNome: s.area.nome,
    eventoNome: s.evento.nome,
    total: s.itens.length,
    respondidos: s.itens.length - pendentes.length,
    prazoRespostaEm: s.prazoRespostaEm,
    foraDaJanela: Boolean(s.foraDaJanela),
    pendenteUnico: aberta && pendentes.length === 1 ? { id: p.id, descricao: descricaoItem(p), quantidade: p.quantidadeSolicitada, destino: p.destino, operacao: p.operacao } : null,
  };
}

const porPrazo = (a: { prazoRespostaEm: Date | null }, b: { prazoRespostaEm: Date | null }) =>
  (a.prazoRespostaEm?.getTime() ?? Infinity) - (b.prazoRespostaEm?.getTime() ?? Infinity);

export async function dadosPainel(usuario: UsuarioAtual) {
  const db = await getDb();
  const agora = new Date();
  const hoje = hojeISO();
  const limite14 = addDiasISO(hoje, 14);
  const req = ehRequisitante(usuario.perfil);

  // Consulta preguiçosa do Drizzle: só roda quando entra no Promise.all do ramo, junto com as demais.
  const consultaEventos = db.query.eventos.findMany({
    where: ne(eventos.status, "CANCELADO"),
    columns: { id: true, codigo: true, nome: true, cliente: true, local: true, status: true, dataReuniao: true, dataCarga: true, dataMontagem: true },
  });

  // Agenda dos próximos 14 dias
  const montarAgenda = (evs: Awaited<typeof consultaEventos>) => {
    const agenda: ItemAgenda[] = [];
    for (const e of evs) {
      const diaReuniao = isoSP(e.dataReuniao);
      if ((e.status === "PREPARACAO" || e.status === "EM_REUNIAO") && diaReuniao >= hoje && diaReuniao <= limite14) {
        agenda.push({
          chave: `r-${e.id}`,
          ordem: e.dataReuniao.getTime(),
          dia: diaMesHora(e.dataReuniao),
          titulo: `Reunião de OS · ${e.nome}`,
          sub: e.cliente || "—",
          tipo: "reuniao",
          href: pode(usuario, "ata.consolidar") ? `/conferencia/${e.id}` : `/eventos/${e.id}`,
        });
      }
      if (e.dataCarga && e.dataCarga >= hoje && e.dataCarga <= limite14) {
        agenda.push({ chave: `c-${e.id}`, ordem: new Date(`${e.dataCarga}T09:00:00Z`).getTime(), dia: diaMesISO(e.dataCarga), titulo: `Carga do caminhão · ${e.nome}`, sub: "OS final precisa estar estável", tipo: "carga", href: `/eventos/${e.id}` });
      }
      if (e.dataMontagem >= hoje && e.dataMontagem <= limite14) {
        agenda.push({ chave: `m-${e.id}`, ordem: new Date(`${e.dataMontagem}T10:00:00Z`).getTime(), dia: diaMesISO(e.dataMontagem), titulo: `Montagem · ${e.nome}`, sub: e.local || "—", tipo: "montagem", href: `/eventos/${e.id}` });
      }
    }
    return agenda.sort((a, b) => a.ordem - b.ordem);
  };

  // Só colunas que `paraFila` e o painel leem (sem lista de peças da linha nem cadastros inteiros).
  const colunasItemFila = {
    columns: { id: true, status: true, quantidadeSolicitada: true, destino: true, operacao: true, descricaoLivre: true },
    with: {
      projeto: { columns: { nome: true } },
      peca: { columns: { codigo: true, nome: true } },
      eventoItem: { columns: { descricaoLivre: true }, with: { projeto: { columns: { nome: true } }, peca: { columns: { codigo: true, nome: true } } } },
    },
  } as const;

  if (req) {
    const areaId = usuario.areaId;
    // Eventos da área → mudanças neles (dependentes); as solicitações da área correm em paralelo.
    const [evs, [meusEventos, mudancas], minhas] = await Promise.all([
      consultaEventos,
      (async () => {
        // Eventos em que a área está metida: é por evento que o solicitante pensa, não por solicitação.
        const meus = areaId ? await resumoEventosDaArea(db, areaId, hoje) : [];
        return [meus, await mudancasRecentes(db, meus.map((e) => e.id), areaId)] as const;
      })(),
      // Só o que o painel mostra: abertas/rascunhos (fila) e respondidas dos últimos 7 dias.
      // Sem isso o histórico inteiro da área viria a cada visita.
      areaId
        ? db.query.solicitacoes.findMany({
            where: and(
              eq(solicitacoes.excluida, false),
              eq(solicitacoes.areaId, areaId),
              or(
                inArray(solicitacoes.status, ["RASCUNHO", "DEVOLVIDA", "ENVIADA", "EM_ANALISE"]),
                and(eq(solicitacoes.status, "RESPONDIDA"), gt(solicitacoes.respondidaEm, new Date(agora.getTime() - 7 * 86_400_000))),
              ),
            ),
            with: {
              evento: { columns: { id: true, nome: true, status: true } },
              area: { columns: { nome: true } },
              itens: {
                ...colunasItemFila,
                with: { ...colunasItemFila.with, respondidoPor: { columns: { nome: true } } },
                orderBy: [asc(solicitacaoItens.ordem)],
              },
            },
            orderBy: [desc(solicitacoes.atualizadoEm)],
          })
        : Promise.resolve([]),
    ]);
    const agenda = montarAgenda(evs);
    const ordemStatus: Partial<Record<SolicitacaoStatus, number>> = { DEVOLVIDA: 0, RASCUNHO: 1, EM_ANALISE: 2, ENVIADA: 2 };
    const fila = minhas
      .filter((s) => ["RASCUNHO", "DEVOLVIDA", "ENVIADA", "EM_ANALISE"].includes(s.status))
      .map(paraFila)
      .sort((a, b) => (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9) || porPrazo(a, b));
    const aguardando = minhas.filter((s) => s.status === "ENVIADA" || s.status === "EM_ANALISE").length;
    const rascunhos = minhas.filter((s) => s.status === "RASCUNHO" || s.status === "DEVOLVIDA");
    // Necessidade pré-reunião com a ata ainda aberta não foi avaliada: entrou na ata e espera a reunião.
    const naAta = (s: { tipo: "PRE_REUNIAO" | "ALTERACAO"; evento: { status: EventoStatus } }) => aguardaReuniao(s.tipo, s.evento.status);
    const respondidas = minhas.filter((s) => s.status === "RESPONDIDA").sort((a, b) => (b.respondidaEm?.getTime() ?? 0) - (a.respondidaEm?.getTime() ?? 0));
    const ressalvas = (s: (typeof minhas)[number]) => s.itens.filter((i) => i.status === "PARCIAL" || i.status === "NAO_ATENDIDO").length;
    const recentes7 = respondidas.filter((s) => s.respondidaEm && agora.getTime() - s.respondidaEm.getTime() <= 7 * 86_400_000);
    const comRessalva7 = recentes7.filter((s) => ressalvas(s) > 0).length;
    const nPrep = evs.filter((e) => e.status === "PREPARACAO").length;
    const nAberto = evs.filter((e) => e.status === "ABERTO").length;
    return {
      tipo: "requisitante" as const,
      agenda: agenda.slice(0, 6),
      eventos: meusEventos,
      mudancas,
      fila,
      metricas: {
        aguardando,
        rascunhos: rascunhos.length,
        temDevolvida: rascunhos.some((s) => s.status === "DEVOLVIDA"),
        respondidas7: recentes7.filter((s) => !naAta(s)).length,
        comRessalva7,
        aceitando: nPrep + nAberto,
        nPrep,
        nAberto,
      },
      respostas: respondidas.slice(0, 5).map((s) => ({
        id: s.id,
        codigo: s.codigo,
        titulo: s.titulo,
        eventoNome: s.evento.nome,
        ressalvas: ressalvas(s),
        naAta: naAta(s),
        respondidoPor: s.itens.find((i) => i.respondidoPor)?.respondidoPor?.nome ?? "logística",
      })),
    };
  }

  // Logística, Gestão e Administrador (acesso total: vê a operação; usuários ficam em /admin)
  const [evs, abertas, contagens] = await Promise.all([
    consultaEventos,
    db.query.solicitacoes.findMany({
      where: and(eq(solicitacoes.excluida, false), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), eq(solicitacoes.tipo, "ALTERACAO")),
      with: {
        evento: { columns: { id: true, nome: true } },
        area: { columns: { nome: true } },
        itens: { ...colunasItemFila, orderBy: [asc(solicitacaoItens.ordem)] },
      },
    }),
    // Administrador: além da operação, o estado do cadastro (pessoas, áreas, o que falta vincular) — só contagens.
    usuario.perfil === "ADMIN"
      ? Promise.all([
          db.select({ n: count() }).from(usuarios).where(eq(usuarios.ativo, true)),
          db.select({ n: count() }).from(areas).where(eq(areas.ativo, true)),
          db
            .select({ n: count() })
            .from(eventoItens)
            .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
            .where(and(eq(eventoItens.tipo, "AVULSO"), eq(eventoItens.ativo, true), inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"]))),
        ])
      : Promise.resolve(null),
  ]);
  const agenda = montarAgenda(evs);
  const reunioesAtivas = evs
    .filter((e) => e.status === "PREPARACAO" || e.status === "EM_REUNIAO")
    .sort((a, b) => a.dataReuniao.getTime() - b.dataReuniao.getTime());
  const reuniaoHoje = reunioesAtivas.find((e) => isoSP(e.dataReuniao) === hoje) ?? null;
  const fila = abertas.map(paraFila).sort(porPrazo);
  const atrasadas = fila.filter((f) => f.prazoRespostaEm && f.prazoRespostaEm.getTime() < agora.getTime());
  const sistema = contagens
    ? {
        usuariosAtivos: Number(contagens[0][0]?.n ?? 0),
        areasAtivas: Number(contagens[1][0]?.n ?? 0),
        foraCatalogo: Number(contagens[2][0]?.n ?? 0),
        eventosAtivos: evs.filter((e) => e.status !== "ENCERRADO").length,
      }
    : null;

  const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  const segunda = addDiasISO(hoje, -((dow + 6) % 7));
  const domingo = addDiasISO(segunda, 6);
  // Só reuniões que ainda vão acontecer: com a ata fechada, o horário deixa de ser compromisso.
  const semana = evs
    .filter((e) => (e.status === "PREPARACAO" || e.status === "EM_REUNIAO") && isoSP(e.dataReuniao) >= segunda && isoSP(e.dataReuniao) <= domingo)
    .sort((a, b) => a.dataReuniao.getTime() - b.dataReuniao.getTime());

  // Estoque fica fora do painel por enquanto (decisão do produto): nada de déficit aqui.
  const emPreparacao = evs.filter((e) => e.status === "PREPARACAO").sort((a, b) => a.dataReuniao.getTime() - b.dataReuniao.getTime());

  return {
    tipo: "operacao" as const,
    agenda: agenda.slice(0, 6),
    sistema,
    fila,
    reuniaoHoje: reuniaoHoje ? { id: reuniaoHoje.id, nome: reuniaoHoje.nome, hora: hora(reuniaoHoje.dataReuniao) } : null,
    reunioesHoje: reunioesAtivas.filter((e) => isoSP(e.dataReuniao) === hoje).map((e) => hora(e.dataReuniao)),
    metricas: {
      aguardando: fila.length,
      atrasadas: atrasadas.length,
      piorAtraso: atrasadas[0] ?? null,
      reunioesSemana: semana.length,
      hintSemana: semana.length
        ? semana
            .slice(0, 2)
            .map((e) => `${isoSP(e.dataReuniao) === hoje ? "hoje" : diaSemanaCurto(e.dataReuniao)} ${hora(e.dataReuniao)}`)
            .join(" · ")
        : "nenhuma marcada",
      emPreparacao: emPreparacao.length,
      hintPreparacao: emPreparacao[0] ? `próxima reunião ${isoSP(emPreparacao[0].dataReuniao) === hoje ? "hoje" : diaMesISO(isoSP(emPreparacao[0].dataReuniao))}` : "nenhum aguardando reunião",
    },
    riscos: [] as Array<{ pecaId: string; codigo: string; nome: string; falta: number; pico: number; estoque: number }>,
  };
}

export type DadosPainel = Awaited<ReturnType<typeof dadosPainel>>;

/* ------------------------------------------------------------------ */
/* Painel do solicitante: os eventos da área e o que mudou neles        */
/* ------------------------------------------------------------------ */

/** Ações que mexem no que vai ser montado depois que a ata já existe. */
const ACOES_MUDANCA = ["ATA_INCLUSAO", "AJUSTE_INCLUSAO", "ATA_QUANTIDADE", "ATA_REMOCAO", "CONFERENCIA_AJUSTE", "PECA_PROJETO_AJUSTADA", "ITEM_VINCULADO", "ATUALIZACAO_VERSAO"];

/** Um cartão por evento onde a área tem item ou pedido: fase, datas, quantos itens e o que mudou. */
async function resumoEventosDaArea(db: Awaited<ReturnType<typeof getDb>>, areaId: string, hoje: string) {
  // Linhas ativas e pedidos da área nos eventos em curso: consultas independentes, em paralelo.
  const [linhas, pedidos] = await Promise.all([
    db
      .select({
        eventoId: eventoItens.eventoId,
        id: eventoItens.id,
        areaId: eventoItens.areaId,
        quantidade: eventoItens.quantidade,
        posAta: sql<boolean>`${eventoItens.criadoEm} > coalesce((select min(criado_em) from ata_versoes av where av.evento_id = ${eventoItens.eventoId}), 'infinity')`,
      })
      .from(eventoItens)
      .innerJoin(eventos, eq(eventoItens.eventoId, eventos.id))
      .where(and(eq(eventoItens.ativo, true), ne(eventos.status, "CANCELADO"), sql`${eventos.dataFim} >= ${hoje}`)),
    db
      .select({ eventoId: solicitacoes.eventoId, status: solicitacoes.status })
      .from(solicitacoes)
      .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
      .where(and(eq(solicitacoes.areaId, areaId), eq(solicitacoes.excluida, false), ne(solicitacoes.status, "CANCELADA"), ne(eventos.status, "CANCELADO"), sql`${eventos.dataFim} >= ${hoje}`)),
  ]);

  const ids = [...new Set([...linhas.filter((l) => l.areaId === areaId).map((l) => l.eventoId), ...pedidos.map((p) => p.eventoId)])];
  if (ids.length === 0) return [];
  const evs = await db.query.eventos.findMany({
    where: inArray(eventos.id, ids),
    columns: { id: true, codigo: true, nome: true, cliente: true, local: true, status: true, dataInicio: true, dataFim: true, dataReuniao: true, ataFechadaEm: true },
    orderBy: [asc(eventos.dataInicio)],
  });
  return evs.map((e) => {
    const doEvento = linhas.filter((l) => l.eventoId === e.id);
    const meus = doEvento.filter((l) => l.areaId === areaId);
    return {
      id: e.id,
      codigo: e.codigo,
      nome: e.nome,
      cliente: e.cliente,
      local: e.local,
      status: e.status,
      dataInicio: e.dataInicio,
      dataFim: e.dataFim,
      dataReuniao: e.dataReuniao.toISOString(),
      ataFechada: Boolean(e.ataFechadaEm),
      /** Itens da área e do evento inteiro: o solicitante vê o próprio pedido dentro do todo. */
      meusItens: meus.length,
      minhasUnidades: meus.reduce((a, l) => a + l.quantidade, 0),
      itensNoEvento: doEvento.length,
      depoisDaAta: doEvento.filter((l) => l.posAta).length,
      aguardando: pedidos.filter((p) => p.eventoId === e.id && (p.status === "ENVIADA" || p.status === "EM_ANALISE")).length,
      rascunhos: pedidos.filter((p) => p.eventoId === e.id && (p.status === "RASCUNHO" || p.status === "DEVOLVIDA")).length,
    };
  });
}

/** Últimas mudanças de item nos eventos da área. Motivo interno de outra área não vem junto. */
async function mudancasRecentes(db: Awaited<ReturnType<typeof getDb>>, eventoIds: string[], areaId: string | null) {
  if (eventoIds.length === 0) return [];
  const rows = await db
    .select({
      id: historico.id,
      eventoId: historico.eventoId,
      entidadeId: historico.entidadeId,
      acao: historico.acao,
      descricao: historico.descricao,
      criadoEm: historico.criadoEm,
      autor: usuarios.nome,
      eventoNome: eventos.nome,
      linhaArea: eventoItens.areaId,
      areaNome: areas.nome,
      linhaAtiva: eventoItens.ativo,
    })
    .from(historico)
    .innerJoin(eventos, eq(historico.eventoId, eventos.id))
    .leftJoin(usuarios, eq(historico.usuarioId, usuarios.id))
    .leftJoin(eventoItens, eq(historico.entidadeId, eventoItens.id))
    .leftJoin(areas, eq(eventoItens.areaId, areas.id))
    .where(and(inArray(historico.eventoId, eventoIds), eq(historico.entidade, "evento_item"), inArray(historico.acao, ACOES_MUDANCA)))
    .orderBy(desc(historico.criadoEm))
    .limit(12);
  return rows.map((r) => {
    const daArea = r.linhaArea == null || r.linhaArea === areaId;
    return {
      id: r.id,
      eventoId: r.eventoId!,
      eventoNome: r.eventoNome,
      quando: r.criadoEm.toISOString(),
      autor: r.autor,
      area: r.areaNome,
      /** Fora da própria área o texto vem sem o motivo interno da logística. */
      texto: daArea ? r.descricao : `Item de ${r.areaNome ?? "outra área"} ${r.acao === "ATA_REMOCAO" ? "saiu da OS" : r.acao === "ATA_INCLUSAO" || r.acao === "AJUSTE_INCLUSAO" ? "entrou na OS" : "foi ajustado"}`,
      href: r.linhaAtiva ? `/eventos/${r.eventoId}/itens/${r.entidadeId}` : `/eventos/${r.eventoId}/historico`,
      novo: r.acao === "ATA_INCLUSAO" || r.acao === "AJUSTE_INCLUSAO",
      saiu: r.acao === "ATA_REMOCAO",
    };
  });
}
