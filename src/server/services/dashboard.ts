import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, solicitacaoItens, solicitacoes, type ItemOperacao, type SolicitacaoStatus, type SolicitacaoTipo } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { ehRequisitante, pode } from "@/domain/permissions";
import { addDiasISO, diaMesHora, diaMesISO, diaSemanaCurto, hojeISO, hora, isoSP } from "@/lib/format";
import { calcularConsolidacao } from "./consolidacao";
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

  const evs = await db.query.eventos.findMany({
    where: ne(eventos.status, "CANCELADO"),
    columns: { id: true, codigo: true, nome: true, cliente: true, local: true, status: true, dataReuniao: true, dataCarga: true, dataMontagem: true },
  });

  // Agenda dos próximos 14 dias
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
        href: pode(usuario, "ata.consolidar") ? `/eventos/${e.id}/reuniao` : `/eventos/${e.id}`,
      });
    }
    if (e.dataCarga && e.dataCarga >= hoje && e.dataCarga <= limite14) {
      agenda.push({ chave: `c-${e.id}`, ordem: new Date(`${e.dataCarga}T09:00:00Z`).getTime(), dia: diaMesISO(e.dataCarga), titulo: `Carga do caminhão · ${e.nome}`, sub: "OS final precisa estar estável", tipo: "carga", href: `/eventos/${e.id}` });
    }
    if (e.dataMontagem >= hoje && e.dataMontagem <= limite14) {
      agenda.push({ chave: `m-${e.id}`, ordem: new Date(`${e.dataMontagem}T10:00:00Z`).getTime(), dia: diaMesISO(e.dataMontagem), titulo: `Montagem · ${e.nome}`, sub: e.local || "—", tipo: "montagem", href: `/eventos/${e.id}` });
    }
  }
  agenda.sort((a, b) => a.ordem - b.ordem);

  const reunioesAtivas = evs
    .filter((e) => e.status === "PREPARACAO" || e.status === "EM_REUNIAO")
    .sort((a, b) => a.dataReuniao.getTime() - b.dataReuniao.getTime());
  const reuniaoHoje = reunioesAtivas.find((e) => isoSP(e.dataReuniao) === hoje) ?? null;



  if (req) {
    const minhas = usuario.areaId
      ? await db.query.solicitacoes.findMany({
          where: and(eq(solicitacoes.excluida, false), eq(solicitacoes.areaId, usuario.areaId)),
          with: {
            evento: { columns: { id: true, nome: true } },
            area: true,
            itens: {
              with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } }, respondidoPor: { columns: { nome: true } } },
              orderBy: [asc(solicitacaoItens.ordem)],
            },
          },
          orderBy: [desc(solicitacoes.atualizadoEm)],
        })
      : [];
    const ordemStatus: Partial<Record<SolicitacaoStatus, number>> = { DEVOLVIDA: 0, RASCUNHO: 1, EM_ANALISE: 2, ENVIADA: 2 };
    const fila = minhas
      .filter((s) => ["RASCUNHO", "DEVOLVIDA", "ENVIADA", "EM_ANALISE"].includes(s.status))
      .map(paraFila)
      .sort((a, b) => (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9) || porPrazo(a, b));
    const aguardando = minhas.filter((s) => s.status === "ENVIADA" || s.status === "EM_ANALISE").length;
    const rascunhos = minhas.filter((s) => s.status === "RASCUNHO" || s.status === "DEVOLVIDA");
    const respondidas = minhas.filter((s) => s.status === "RESPONDIDA").sort((a, b) => (b.respondidaEm?.getTime() ?? 0) - (a.respondidaEm?.getTime() ?? 0));
    const ressalvas = (s: (typeof minhas)[number]) => s.itens.filter((i) => i.status === "PARCIAL" || i.status === "NAO_ATENDIDO").length;
    const recentes7 = respondidas.filter((s) => s.respondidaEm && agora.getTime() - s.respondidaEm.getTime() <= 7 * 86_400_000);
    const comRessalva7 = recentes7.filter((s) => ressalvas(s) > 0).length;
    const nPrep = evs.filter((e) => e.status === "PREPARACAO").length;
    const nAberto = evs.filter((e) => e.status === "ABERTO").length;
    return {
      tipo: "requisitante" as const,
      agenda: agenda.slice(0, 6),
      fila,
      metricas: {
        aguardando,
        rascunhos: rascunhos.length,
        temDevolvida: rascunhos.some((s) => s.status === "DEVOLVIDA"),
        respondidas7: recentes7.length,
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
        respondidoPor: s.itens.find((i) => i.respondidoPor)?.respondidoPor?.nome ?? "logística",
      })),
    };
  }

  // Logística, Gestão e Administrador (acesso total: vê a operação; usuários ficam em /admin)
  const abertas = await db.query.solicitacoes.findMany({
    where: and(eq(solicitacoes.excluida, false), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"])),
    with: {
            evento: { columns: { id: true, nome: true } },
            area: true,
            itens: {
              with: { projeto: true, peca: true, eventoItem: { with: { projeto: true, peca: true } }, respondidoPor: { columns: { nome: true } } },
              orderBy: [asc(solicitacaoItens.ordem)],
            },
          },
  });
  const fila = abertas.map(paraFila).sort(porPrazo);
  const atrasadas = fila.filter((f) => f.prazoRespostaEm && f.prazoRespostaEm.getTime() < agora.getTime());

  const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  const segunda = addDiasISO(hoje, -((dow + 6) % 7));
  const domingo = addDiasISO(segunda, 6);
  // Só reuniões que ainda vão acontecer: com a ata fechada, o horário deixa de ser compromisso.
  const semana = evs
    .filter((e) => (e.status === "PREPARACAO" || e.status === "EM_REUNIAO") && isoSP(e.dataReuniao) >= segunda && isoSP(e.dataReuniao) <= domingo)
    .sort((a, b) => a.dataReuniao.getTime() - b.dataReuniao.getTime());

  const cons = await calcularConsolidacao({ inicio: hoje, fim: addDiasISO(hoje, 30) });
  const deficit = cons.pecas.filter((p) => p.saldo < 0);

  return {
    tipo: "operacao" as const,
    agenda: agenda.slice(0, 6),
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
      deficit: deficit.length,
      hintDeficit: deficit[0]?.diaPico ? `pico em ${diaMesISO(deficit[0].diaPico)}` : "estoque cobre tudo",
    },
    riscos: deficit.slice(0, 4).map((p) => ({ pecaId: p.pecaId, codigo: p.codigo, nome: p.nome, falta: Math.abs(p.saldo), pico: p.pico, estoque: p.estoque })),
  };
}

export type DadosPainel = Awaited<ReturnType<typeof dadosPainel>>;
