import { and, asc, count, desc, eq, ilike, inArray, lt, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, pecas, projetos, solicitacoes } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { pode } from "@/domain/permissions";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { SETOR_LABEL } from "@/domain/os";
import { hojeISO, hora, isoSP } from "@/lib/format";

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
 */
export async function buscar(usuario: UsuarioAtual, termoBruto: string): Promise<ResultadoBusca[]> {
  const termo = termoBruto.trim().slice(0, 80);
  const t = termo.toLowerCase();
  const limite = t ? 12 : 8;
  const like = `%${termo}%`;
  const db = await getDb();
  const agora = new Date();
  const veTodas = pode(usuario, "solicitacao.ver_todas");

  const acoes: ResultadoBusca[] = [];
  if (pode(usuario, "solicitacao.criar")) {
    acoes.push({ grupo: "Ações", tag: "ação", titulo: "Nova solicitação", sub: "Abrir rascunho para um evento", href: "/solicitacoes/nova", atalho: "N" });
  }
  if (pode(usuario, "ata.consolidar")) {
    const hoje = hojeISO();
    const candidatos = await db.query.eventos.findMany({
      where: inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO"]),
      columns: { id: true, nome: true, dataReuniao: true },
      orderBy: [asc(eventos.dataReuniao)],
    });
    const deHoje = candidatos.find((e) => isoSP(e.dataReuniao) === hoje);
    if (deHoje) acoes.push({ grupo: "Ações", tag: "ação", titulo: "Consolidar ata da reunião de hoje", sub: `${deHoje.nome} · ${hora(deHoje.dataReuniao)}`, href: `/eventos/${deHoje.id}/reuniao` });
  }
  if (veTodas || usuario.areaId) {
    const conds = [eq(solicitacoes.excluida, false), inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), lt(solicitacoes.prazoRespostaEm, agora)];
    if (!veTodas && usuario.areaId) conds.push(eq(solicitacoes.areaId, usuario.areaId));
    const [{ n }] = await db.select({ n: count() }).from(solicitacoes).where(and(...conds));
    acoes.push({ grupo: "Ações", tag: "ação", titulo: "Ver solicitações atrasadas", sub: `${Number(n)} em atraso`, href: "/solicitacoes?filtro=ATRASADAS" });
  }
  const acoesFiltradas = t ? acoes.filter((a) => `${a.titulo} ${a.sub}`.toLowerCase().includes(t)) : acoes;

  const evs = await db.query.eventos.findMany({
    where: t ? or(ilike(eventos.nome, like), ilike(eventos.codigo, like), ilike(eventos.cliente, like), ilike(eventos.local, like)) : undefined,
    columns: { id: true, codigo: true, nome: true, status: true },
    orderBy: [desc(eventos.dataInicio)],
    limit: limite,
  });
  const resEventos: ResultadoBusca[] = evs.map((e) => ({ grupo: "Eventos", tag: "evento", titulo: e.nome, sub: `${e.codigo} · ${EVENTO_STATUS_LABEL[e.status]}`, href: `/eventos/${e.id}` }));

  let resSolicitacoes: ResultadoBusca[] = [];
  let resBiblioteca: ResultadoBusca[] = [];
  if (t) {
    const condsSol = [eq(solicitacoes.excluida, false), or(ilike(solicitacoes.codigo, like), ilike(solicitacoes.titulo, like))];
    if (!veTodas) {
      if (usuario.areaId) condsSol.push(eq(solicitacoes.areaId, usuario.areaId));
      else condsSol.push(eq(solicitacoes.id, "__nenhuma__"));
    }
    const sols = await db.query.solicitacoes.findMany({
      where: and(...condsSol),
      with: { area: true, evento: { columns: { nome: true } } },
      orderBy: [desc(solicitacoes.atualizadoEm)],
      limit: limite,
    });
    resSolicitacoes = sols.map((s) => ({ grupo: "Solicitações", tag: "solic.", titulo: `${s.codigo}${s.titulo ? ` · ${s.titulo}` : ""}`, sub: `${s.area.nome} · ${s.evento.nome}`, href: `/solicitacoes/${s.id}` }));

    const [projs, pcs] = await Promise.all([
      db.query.projetos.findMany({
        where: and(eq(projetos.ativo, true), or(ilike(projetos.nome, like), ilike(projetos.codigo, like), ilike(projetos.categoria, like))),
        columns: { id: true, codigo: true, nome: true, versaoAtual: true },
        limit: limite,
      }),
      db.query.pecas.findMany({
        where: and(eq(pecas.ativo, true), or(ilike(pecas.codigo, like), ilike(pecas.nome, like), ilike(pecas.familia, like))),
        columns: { id: true, codigo: true, nome: true, setor: true, estoqueProprio: true },
        limit: limite,
      }),
    ]);
    resBiblioteca = [
      ...projs.map((p): ResultadoBusca => ({ grupo: "Biblioteca", tag: "projeto", titulo: p.nome, sub: `${p.codigo} · v${p.versaoAtual}`, href: `/biblioteca?aba=projetos&p=${p.id}` })),
      ...pcs.map((p): ResultadoBusca => ({ grupo: "Biblioteca", tag: "peça", titulo: `${p.codigo} · ${p.nome}`, sub: `${SETOR_LABEL[p.setor]} · estoque ${p.estoqueProprio}`, href: `/biblioteca?aba=pecas&q=${encodeURIComponent(p.codigo)}` })),
    ];
  }

  return [...acoesFiltradas, ...resEventos, ...resSolicitacoes, ...resBiblioteca].slice(0, limite);
}
