import { and, asc, count, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { eventos, projetos, solicitacoes } from "@/server/db/schema";
import type { UsuarioAtual } from "@/server/auth/autorizacao";
import { pode } from "@/domain/permissions";
import { listarSolicitacoes } from "./solicitacoes";

/**
 * Dados do painel, orientados à "próxima ação" de cada perfil (MEL-10).
 */
export async function dadosPainel(usuario: UsuarioAtual) {
  const db = await getDb();
  const agora = new Date();

  const porStatus = await db.select({ status: eventos.status, n: count() }).from(eventos).groupBy(eventos.status);
  const contagem = Object.fromEntries(porStatus.map((r) => [r.status, Number(r.n)])) as Record<string, number>;

  const eventosAtivos = await db.query.eventos.findMany({
    where: inArray(eventos.status, ["PREPARACAO", "EM_REUNIAO", "ABERTO"]),
    with: { responsavel: { columns: { nome: true } } },
    orderBy: [asc(eventos.dataMontagem)],
    limit: 12,
  });

  const [abertas] = await db
    .select({ n: count() })
    .from(solicitacoes)
    .where(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]));
  const [atrasadas] = await db
    .select({ n: count() })
    .from(solicitacoes)
    .where(and(inArray(solicitacoes.status, ["ENVIADA", "EM_ANALISE"]), lt(solicitacoes.prazoRespostaEm, agora)));

  const filaLogistica = pode(usuario, "solicitacao.responder")
    ? await listarSolicitacoes(usuario, { status: "ABERTAS" }).then((l) => l.sort((a, b) => (a.prazoRespostaEm?.getTime() ?? 0) - (b.prazoRespostaEm?.getTime() ?? 0)).slice(0, 8))
    : [];

  const minhas = pode(usuario, "solicitacao.criar") ? await listarSolicitacoes(usuario, { somenteMinhaArea: true }) : [];
  const meusRascunhos = minhas.filter((s) => s.status === "RASCUNHO" || s.status === "DEVOLVIDA");
  const minhasAbertas = minhas.filter((s) => s.status === "ENVIADA" || s.status === "EM_ANALISE");
  const minhasRespondidas = minhas.filter((s) => s.status === "RESPONDIDA").slice(0, 5);

  const reabertos = await db.query.eventos.findMany({ where: and(eq(eventos.status, "ABERTO"), inArray(eventos.status, ["ABERTO"])), columns: { id: true, nome: true, reabertoVezes: true } }).then((l) => l.filter((e) => e.reabertoVezes > 0));

  const [projetosAtivos] = await db.select({ n: count() }).from(projetos).where(eq(projetos.ativo, true));

  const ultimasRespostas = pode(usuario, "solicitacao.ver_todas")
    ? await db.query.solicitacoes.findMany({ where: eq(solicitacoes.status, "RESPONDIDA"), with: { evento: { columns: { nome: true } }, area: true }, orderBy: [desc(solicitacoes.respondidaEm)], limit: 5 })
    : [];

  return {
    contagem,
    eventosAtivos,
    solicitacoesAbertas: Number(abertas.n),
    solicitacoesAtrasadas: Number(atrasadas.n),
    filaLogistica,
    meusRascunhos,
    minhasAbertas,
    minhasRespondidas,
    reabertos,
    projetosAtivos: Number(projetosAtivos.n),
    ultimasRespostas,
  };
}
