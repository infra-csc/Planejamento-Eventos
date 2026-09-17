import { and, asc, count, desc, eq, inArray, lt } from "drizzle-orm";
import { buscaSemAcento } from "./support";
import { getDb } from "@/server/db";
import { eventos, pecas, projetos, solicitacoes } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { pode } from "@/domain/permissions";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { SETOR_LABEL } from "@/domain/os";
import { hojeISO, hora, isoSP } from "@/lib/format";
import { combinaBusca } from "@/lib/busca";

export type ResultadoBusca = {
  grupo: "Ações" | "Eventos" | "Solicitações" | "Biblioteca";
  tag: "ação" | "evento" | "solic." | "projeto" | "peça";
  titulo: string;
  sub: string;
  href: string;
  atalho?: string;
};

/**
 * Busca global ⌘K (handoff §5.16). Respeita permissões: requisitante só encontra
 * solicitações da própria área; ações só aparecem para quem pode executá-las.
 * As consultas independentes rodam em paralelo.
 */
export async function buscar(usuario: UsuarioAtual, termoBruto: string): Promise<ResultadoBusca[]> {
  const termo = termoBruto.trim().slice(0, 80);
  const t = termo.toLowerCase();
  const limite = t ? 12 : 8;
  const db = await getDb();
  const agora = new Date();
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  const escopoSolicitacoes = veTodas ? [] : [eq(solicitacoes.areaId, usuario.areaId ?? "__nenhuma__")];

  const [reunioes, atrasadas, evs, sols, projs, pcs] = await Promise.all([
    pode(usuario, "ata.consolidar")
      ? db.query.eventos.findMany({ where: inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO"]), columns: { id: true, nome: true, dataReuniao: true }, orderBy: [asc(eventos.dataReuniao)] })
      : Promise.resolve([]),
    veTodas || usuario.areaId
      ? db
          .select({ n: count() })
          .from(solicitacoes)
          .where(and(eq(solicitacoes.excluida, false), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), lt(solicitacoes.prazoRespostaEm, agora), ...escopoSolicitacoes))
      : Promise.resolve(null),
    db.query.eventos.findMany({
      where: t ? buscaSemAcento([eventos.nome, eventos.codigo, eventos.cliente, eventos.local], t) : undefined,
      columns: { id: true, codigo: true, nome: true, status: true },
      orderBy: [desc(eventos.dataInicio)],
      limit: limite,
    }),
    t
      ? db.query.solicitacoes.findMany({
          where: and(eq(solicitacoes.excluida, false), buscaSemAcento([solicitacoes.codigo, solicitacoes.titulo], t), ...escopoSolicitacoes),
          with: { area: true, evento: { columns: { nome: true } } },
          orderBy: [desc(solicitacoes.atualizadoEm)],
          limit: limite,
        })
      : Promise.resolve([]),
    t
      ? db.query.projetos.findMany({
          where: and(eq(projetos.ativo, true), buscaSemAcento([projetos.nome, projetos.codigo, projetos.categoria], t)),
          columns: { id: true, codigo: true, nome: true, versaoAtual: true },
          limit: limite,
        })
      : Promise.resolve([]),
    t
      ? db.query.pecas.findMany({
          where: and(eq(pecas.ativo, true), buscaSemAcento([pecas.codigo, pecas.nome, pecas.familia], t)),
          columns: { id: true, codigo: true, nome: true, setor: true, estoqueProprio: true },
          limit: limite,
        })
      : Promise.resolve([]),
  ]);

  const acoes: ResultadoBusca[] = [];
  if (pode(usuario, "solicitacao.criar")) {
    acoes.push({ grupo: "Ações", tag: "ação", titulo: "Nova solicitação", sub: "Abrir rascunho para um evento", href: "/solicitacoes/nova", atalho: "N" });
  }
  const deHoje = reunioes.find((e) => isoSP(e.dataReuniao) === hojeISO());
  if (deHoje) acoes.push({ grupo: "Ações", tag: "ação", titulo: "Consolidar ata da reunião de hoje", sub: `${deHoje.nome} · ${hora(deHoje.dataReuniao)}`, href: `/eventos/${deHoje.id}/reuniao` });
  if (atrasadas) acoes.push({ grupo: "Ações", tag: "ação", titulo: "Ver solicitações atrasadas", sub: `${Number(atrasadas[0]?.n ?? 0)} em atraso`, href: "/solicitacoes?filtro=ATRASADAS" });
  const acoesFiltradas = t ? acoes.filter((a) => combinaBusca(`${a.titulo} ${a.sub}`, t)) : acoes;

  const resEventos: ResultadoBusca[] = evs.map((e) => ({ grupo: "Eventos", tag: "evento", titulo: e.nome, sub: `${e.codigo} · ${EVENTO_STATUS_LABEL[e.status]}`, href: `/eventos/${e.id}` }));
  const resSolicitacoes: ResultadoBusca[] = sols.map((s) => ({ grupo: "Solicitações", tag: "solic.", titulo: `${s.codigo}${s.titulo ? ` · ${s.titulo}` : ""}`, sub: `${s.area.nome} · ${s.evento.nome}`, href: `/solicitacoes/${s.id}` }));
  const resBiblioteca: ResultadoBusca[] = [
    ...projs.map((p): ResultadoBusca => ({ grupo: "Biblioteca", tag: "projeto", titulo: p.nome, sub: `${p.codigo} · v${p.versaoAtual}`, href: `/biblioteca?aba=projetos&p=${p.id}` })),
    ...pcs.map((p): ResultadoBusca => ({ grupo: "Biblioteca", tag: "peça", titulo: `${p.codigo} · ${p.nome}`, sub: `${SETOR_LABEL[p.setor]} · estoque ${p.estoqueProprio}`, href: `/biblioteca?aba=pecas&q=${encodeURIComponent(p.codigo)}` })),
  ];

  return [...acoesFiltradas, ...resEventos, ...resSolicitacoes, ...resBiblioteca].slice(0, limite);
}
