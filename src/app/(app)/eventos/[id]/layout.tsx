import { notFound } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { obterEvento, resumoSolicitacoesEvento, solicitacoesPendentes } from "@/server/services/eventos";
import { getDb } from "@/server/db";
import { pode } from "@/domain/permissions";
import { EVENTO_STATUS_DESCRICAO, acoesDisponiveis, aceitaSolicitacao, statusExibicao } from "@/domain/evento";
import { NaoEncontradoError } from "@/domain/errors";
import { PageHeader } from "@/components/ui/layout";
import { EventoStatusBadge } from "@/components/ui/badge";
import { TabsNav } from "@/components/ui/tabs-nav";
import { AcoesEvento } from "@/components/eventos/acoes-evento";
import { formatarDataHora, formatarPeriodo, hojeISO } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const ev = await obterEvento(usuario, id).catch(() => null);
  return { title: ev ? `${ev.codigo} ${ev.nome}` : "Evento" };
}

export default async function EventoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const ev = await obterEvento(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  const [resumo, pendentes] = await Promise.all([resumoSolicitacoesEvento(id), solicitacoesPendentes(await getDb(), id)]);
  const abertas = resumo.filter((r) => r.status === "ENVIADA" || r.status === "EM_ANALISE").reduce((a, r) => a + r.n, 0);
  const acoes = acoesDisponiveis(ev.status, usuario.perfil);
  const podeSolicitar = pode(usuario, "solicitacao.criar") && (aceitaSolicitacao(ev.status, "PRE_REUNIAO") || aceitaSolicitacao(ev.status, "ALTERACAO"));
  const podeConsolidar = pode(usuario, "ata.consolidar") && (ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO");
  const base = `/eventos/${ev.id}`;

  const tabs = [
    { href: base, label: "Visão geral", exact: true },
    { href: `${base}/ata`, label: "Ata" },
    { href: `${base}/solicitacoes`, label: "Solicitações", count: abertas },
    ...(pode(usuario, "os.ver") ? [{ href: `${base}/os`, label: "OS" }] : []),
    { href: `${base}/historico`, label: "Histórico" },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Eventos", href: "/eventos" }, { label: ev.codigo }]}
        title={
          <>
            {ev.nome}
            <EventoStatusBadge status={statusExibicao(ev.status, ev.dataFim, hojeISO())} />
            {ev.reabertoVezes > 0 && <span className="text-xs font-normal text-warning">reaberto {ev.reabertoVezes}×</span>}
          </>
        }
        description={EVENTO_STATUS_DESCRICAO[ev.status]}
        meta={
          <>
            <span>
              <span className="text-ink-muted">Evento:</span> {formatarPeriodo(ev.dataInicio, ev.dataFim)}
            </span>
            <span>
              <span className="text-ink-muted">Reunião de OS:</span> {formatarDataHora(ev.dataReuniao)}
            </span>
            {ev.local && (
              <span>
                <span className="text-ink-muted">Local:</span> {ev.local}
              </span>
            )}
            <span>
              <span className="text-ink-muted">Logística:</span> {ev.responsavel.nome}
            </span>
          </>
        }
        actions={
          <AcoesEvento
            evento={{ id: ev.id, nome: ev.nome, status: ev.status, codigo: ev.codigo }}
            acoes={acoes}
            podeEditar={pode(usuario, "evento.editar") && ev.status !== "CANCELADO"}
            podeSolicitar={podeSolicitar}
            podeConsolidar={podeConsolidar}
            pendentes={pendentes.map((p) => p.codigo)}
          />
        }
      />
      <TabsNav tabs={tabs} className="mb-5" />
      {children}
    </>
  );
}
