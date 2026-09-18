import { and, eq, gte, inArray, lte, ne, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { areas, eventos, solicitacoes } from "@/server/db/schema";
import { exigir, type UsuarioAtual } from "@/server/auth/autorizacao";
import { pode } from "@/domain/permissions";
import type { EventoStatus } from "@/server/db/schema";
import { hora, isoSP } from "@/lib/format";

export type TipoCalendario = "reuniao" | "evento" | "janela" | "montagem" | "carga" | "prazo";

export type ItemCalendario = {
  chave: string;
  tipo: TipoCalendario;
  /** Dia "YYYY-MM-DD" (fuso de São Paulo). Em eventos de vários dias, cada dia vira um item. */
  dia: string;
  hora: string | null;
  titulo: string;
  detalhe: string | null;
  href: string;
  evento: { id: string; codigo: string; nome: string; status: EventoStatus; cliente: string; local: string };
  /** Evento de vários dias: posição deste dia no intervalo (para desenhar a faixa contínua). */
  faixa?: { inicio: boolean; fim: boolean; dia: number; total: number };
};

/**
 * Tudo que tem data no período: reuniões de OS, dias de evento, fim da janela de alterações,
 * montagem e carga (só quando diferem do dia do evento) e, para a logística,
 * prazos de resposta de alterações pendentes.
 */
export async function listarCalendario(usuario: UsuarioAtual, inicio: string, fim: string, opcoes: { incluirCancelados?: boolean } = {}): Promise<ItemCalendario[]> {
  exigir(usuario, "evento.ver");
  const db = await getDb();
  const ini = new Date(`${inicio}T00:00:00-03:00`);
  const fimD = new Date(`${fim}T23:59:59-03:00`);

  // Eventos do período e prazos de resposta (para quem responde/vê todas) são independentes: em paralelo.
  const verPrazos = pode(usuario, "solicitacao.responder") || pode(usuario, "solicitacao.ver_todas");
  const [evs, prazos] = await Promise.all([
    db.query.eventos.findMany({
      where: and(
        opcoes.incluirCancelados ? undefined : ne(eventos.status, "CANCELADO"),
        or(
          and(gte(eventos.dataReuniao, ini), lte(eventos.dataReuniao, fimD)),
          and(lte(eventos.dataMontagem, fim), gte(eventos.dataDesmontagem, inicio)),
          and(gte(eventos.janelaAlteracoesAte, inicio), lte(eventos.janelaAlteracoesAte, fim)),
          and(gte(eventos.dataCarga, inicio), lte(eventos.dataCarga, fim)),
        ),
      ),
      columns: { id: true, codigo: true, nome: true, status: true, cliente: true, local: true, dataReuniao: true, dataInicio: true, dataFim: true, dataMontagem: true, dataDesmontagem: true, dataCarga: true, janelaAlteracoesAte: true },
    }),
    verPrazos
      ? db
          .select({ id: solicitacoes.id, codigo: solicitacoes.codigo, titulo: solicitacoes.titulo, prazo: solicitacoes.prazoRespostaEm, area: areas.nome, eventoId: eventos.id, eventoCodigo: eventos.codigo, eventoNome: eventos.nome, eventoStatus: eventos.status, cliente: eventos.cliente, local: eventos.local })
          .from(solicitacoes)
          .innerJoin(eventos, eq(solicitacoes.eventoId, eventos.id))
          .innerJoin(areas, eq(solicitacoes.areaId, areas.id))
          .where(and(eq(solicitacoes.excluida, false), eq(solicitacoes.tipo, "ALTERACAO"), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), gte(solicitacoes.prazoRespostaEm, ini), lte(solicitacoes.prazoRespostaEm, fimD)))
      : Promise.resolve([]),
  ]);

  const itens: ItemCalendario[] = [];
  const noPeriodo = (d: string) => d >= inicio && d <= fim;
  const conferir = pode(usuario, "ata.consolidar");

  for (const e of evs) {
    const evento = { id: e.id, codigo: e.codigo, nome: e.nome, status: e.status, cliente: e.cliente, local: e.local };
    const diaReuniao = isoSP(e.dataReuniao);
    if (noPeriodo(diaReuniao)) {
      const aberta = e.status === "PREPARACAO" || e.status === "EM_REUNIAO";
      itens.push({
        chave: `r-${e.id}`,
        tipo: "reuniao",
        dia: diaReuniao,
        hora: hora(e.dataReuniao),
        titulo: `Reunião de OS · ${e.nome}`,
        detalhe: e.status === "EM_REUNIAO" ? "acontecendo agora" : aberta ? "áreas enviam necessidades até aqui" : "ata fechada",
        href: conferir && aberta ? `/conferencia/${e.id}` : `/eventos/${e.id}/ata`,
        evento,
      });
    }

    // Dias do evento, um item por dia com a posição na faixa.
    const total = Math.round((Date.parse(`${e.dataFim}T00:00:00Z`) - Date.parse(`${e.dataInicio}T00:00:00Z`)) / 86_400_000) + 1;
    for (let i = 0; i < Math.max(1, total); i++) {
      const d = new Date(`${e.dataInicio}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const dia = d.toISOString().slice(0, 10);
      if (!noPeriodo(dia)) continue;
      itens.push({
        chave: `e-${e.id}-${dia}`,
        tipo: "evento",
        dia,
        hora: null,
        titulo: e.nome,
        detalhe: [e.cliente, e.local].filter(Boolean).join(" · ") || null,
        href: `/eventos/${e.id}`,
        evento,
        faixa: { inicio: i === 0, fim: i === total - 1, dia: i + 1, total },
      });
    }

    if (e.janelaAlteracoesAte && noPeriodo(e.janelaAlteracoesAte)) {
      itens.push({ chave: `j-${e.id}`, tipo: "janela", dia: e.janelaAlteracoesAte, hora: null, titulo: `Fim da janela de alterações · ${e.nome}`, detalhe: "depois disso, alterações chegam marcadas “fora da janela”", href: `/eventos/${e.id}`, evento });
    }
    // Montagem e carga só aparecem quando foram informadas diferentes do dia do evento.
    if (e.dataMontagem !== e.dataInicio && noPeriodo(e.dataMontagem)) itens.push({ chave: `m-${e.id}`, tipo: "montagem", dia: e.dataMontagem, hora: null, titulo: `Montagem · ${e.nome}`, detalhe: e.local || null, href: `/eventos/${e.id}`, evento });
    if (e.dataCarga && noPeriodo(e.dataCarga)) itens.push({ chave: `c-${e.id}`, tipo: "carga", dia: e.dataCarga, hora: null, titulo: `Carga do caminhão · ${e.nome}`, detalhe: "OS final precisa estar estável", href: `/eventos/${e.id}/os`, evento });
  }

  if (verPrazos) {
    for (const p of prazos) {
      if (!p.prazo) continue;
      itens.push({
        chave: `p-${p.id}`,
        tipo: "prazo",
        dia: isoSP(p.prazo),
        hora: hora(p.prazo),
        titulo: `Prazo de resposta · ${p.codigo}`,
        detalhe: `${p.area} · ${p.titulo || "sem título"}`,
        href: `/solicitacoes/${p.id}`,
        evento: { id: p.eventoId, codigo: p.eventoCodigo, nome: p.eventoNome, status: p.eventoStatus, cliente: p.cliente, local: p.local },
      });
    }
  }

  const ordemTipo: Record<TipoCalendario, number> = { evento: 0, reuniao: 1, prazo: 2, janela: 3, montagem: 4, carga: 5 };
  return itens.sort((a, b) => a.dia.localeCompare(b.dia) || ordemTipo[a.tipo] - ordemTipo[b.tipo] || (a.hora ?? "").localeCompare(b.hora ?? "") || a.titulo.localeCompare(b.titulo, "pt-BR"));
}
