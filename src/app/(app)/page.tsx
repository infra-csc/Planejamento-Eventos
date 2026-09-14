import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { dadosPainel } from "@/server/services/dashboard";
import { pode } from "@/domain/permissions";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { estaAtrasada } from "@/domain/solicitacao";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { EventoStatusBadge, SolicitacaoStatusBadge } from "@/components/ui/badge";
import { SolicitacoesTable } from "@/components/solicitacoes/solicitacoes-table";
import { formatarDataHora, formatarPeriodo, tempoRelativo } from "@/lib/format";

export default async function PainelPage() {
  const usuario = await requireUsuario();
  const d = await dadosPainel(usuario);
  const agora = new Date();
  const ehLogistica = pode(usuario, "solicitacao.responder");
  const ehRequisitante = pode(usuario, "solicitacao.criar");
  const ehGestao = usuario.perfil === "GESTAO";
  const saudacao = `Olá, ${usuario.nome.split(" ")[0]}`;

  return (
    <>
      <PageHeader
        title={saudacao}
        description={
          ehLogistica
            ? "Sua fila: solicitações a responder por item, eventos em andamento e o que está perto do prazo."
            : ehRequisitante
              ? `Área ${usuario.areaNome ?? ""}: eventos aceitando necessidades ou alterações, seus rascunhos e respostas recebidas.`
              : ehGestao
                ? "Visão consolidada entre eventos: andamento, atrasos e exceções."
                : "Visão geral do sistema."
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Eventos em preparação" value={d.contagem.PREPARACAO ?? 0} />
        <Stat label="Em reunião" value={d.contagem.EM_REUNIAO ?? 0} tone={(d.contagem.EM_REUNIAO ?? 0) > 0 ? "warning" : undefined} />
        <Stat label="Abertos a alterações" value={d.contagem.ABERTO ?? 0} />
        {ehLogistica || ehGestao ? (
          <Stat label="Solicitações atrasadas" value={d.solicitacoesAtrasadas} tone={d.solicitacoesAtrasadas > 0 ? "danger" : "success"} hint={`${d.solicitacoesAbertas} aguardando resposta`} />
        ) : (
          <Stat label="Minhas aguardando resposta" value={d.minhasAbertas.length} hint={`${d.meusRascunhos.length} rascunho(s)`} />
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {ehLogistica && (
            <Panel title="Fila de resposta" description="Ordenada pelo prazo. Responda item a item." actions={<Link href="/solicitacoes?status=ABERTAS" className="text-xs text-info hover:underline">Ver todas</Link>} padded={false}>
              {d.filaLogistica.length === 0 ? <EmptyState title="Nenhuma solicitação aguardando resposta" compact /> : <SolicitacoesTable lista={d.filaLogistica} />}
            </Panel>
          )}

          {ehRequisitante && (
            <>
              {d.meusRascunhos.length > 0 && (
                <Panel title="Rascunhos e devolvidas" description="Complete e envie." padded={false}>
                  <ul className="divide-y divide-line">
                    {d.meusRascunhos.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <div className="min-w-0">
                          <Link href={`/solicitacoes/${s.id}`} className="font-medium text-ink hover:underline">
                            {s.codigo}
                          </Link>{" "}
                          <span className="text-ink-muted">· {s.evento.nome}</span>
                          <span className="block text-xs text-ink-muted">
                            {s.totalItens} item(ns) · {tempoRelativo(s.atualizadoEm, agora)}
                          </span>
                        </div>
                        <SolicitacaoStatusBadge status={s.status} />
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              <Panel title="Aguardando resposta da logística" padded={false} actions={<Link href="/solicitacoes" className="text-xs text-info hover:underline">Todas da área</Link>}>
                {d.minhasAbertas.length === 0 ? <EmptyState title="Nada aguardando resposta" compact /> : <SolicitacoesTable lista={d.minhasAbertas} />}
              </Panel>
              {d.minhasRespondidas.length > 0 && (
                <Panel title="Respondidas recentemente" padded={false}>
                  <SolicitacoesTable lista={d.minhasRespondidas} />
                </Panel>
              )}
            </>
          )}

          {ehGestao && (
            <Panel title="Últimas solicitações respondidas" padded={false}>
              {d.ultimasRespostas.length === 0 ? (
                <EmptyState title="Nenhuma resposta ainda" compact />
              ) : (
                <ul className="divide-y divide-line">
                  {d.ultimasRespostas.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div>
                        <Link href={`/solicitacoes/${s.id}`} className="font-medium hover:underline">
                          {s.codigo}
                        </Link>{" "}
                        <span className="text-ink-muted">
                          · {s.area.nome} · {s.evento.nome}
                        </span>
                      </div>
                      <span className="text-xs text-ink-muted">{tempoRelativo(s.respondidaEm ?? s.atualizadoEm, agora)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Eventos em andamento" actions={<Link href="/eventos" className="text-xs text-info hover:underline">Todos</Link>} padded={false}>
            {d.eventosAtivos.length === 0 ? (
              <EmptyState title="Nenhum evento em andamento" compact action={pode(usuario, "evento.criar") ? <ButtonLink href="/eventos/novo" variant="primary" size="sm">Novo evento</ButtonLink> : undefined} />
            ) : (
              <ul className="divide-y divide-line">
                {d.eventosAtivos.map((ev) => (
                  <li key={ev.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/eventos/${ev.id}`} className="truncate text-sm font-medium text-ink hover:underline">
                        {ev.nome}
                      </Link>
                      <EventoStatusBadge status={ev.status} />
                    </div>
                    <p className="text-xs text-ink-muted">
                      {formatarPeriodo(ev.dataInicio, ev.dataFim)}
                      {ev.status === "PREPARACAO" ? ` · reunião ${formatarDataHora(ev.dataReuniao)}` : ` · ${EVENTO_STATUS_LABEL[ev.status]}`}
                      {ev.reabertoVezes > 0 ? " · reaberto" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {(ehLogistica || ehGestao) && d.reabertos.length > 0 && (
            <Panel title="Reabertos em exceção">
              <ul className="space-y-1 text-sm">
                {d.reabertos.map((e) => (
                  <li key={e.id}>
                    <Link href={`/eventos/${e.id}/historico`} className="hover:underline">
                      {e.nome}
                    </Link>{" "}
                    <span className="text-xs text-ink-muted">({e.reabertoVezes}×)</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {ehRequisitante && (
            <Panel title="Como funciona">
              <ol className="list-decimal space-y-1 pl-4 text-[13px] text-ink-secondary">
                <li>Evento em preparação: envie as necessidades da área antes da reunião.</li>
                <li>Ata fechada: mudanças entram como solicitação de alteração.</li>
                <li>Cada item recebe resposta separada: atendido, parcial ou não atendido, sempre com motivo.</li>
                <li>Encerrado: nada mais entra; só a Gestão reabre em exceção.</li>
              </ol>
            </Panel>
          )}
          {ehLogistica && d.filaLogistica.some((s) => estaAtrasada(s.status, s.prazoRespostaEm, agora)) && (
            <Panel title="Atenção">
              <p className="text-[13px] text-danger">Há solicitações com prazo vencido na fila.</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
