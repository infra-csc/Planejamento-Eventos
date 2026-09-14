import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { listarEventos } from "@/server/services/eventos";
import { criarRascunho } from "@/server/services/solicitacoes";
import { criarRascunhoAction } from "@/app/(app)/eventos/actions";
import { tipoSolicitacaoParaStatus } from "@/domain/evento";
import { SOLICITACAO_TIPO_LABEL } from "@/domain/solicitacao";
import { EmptyState, PageHeader, Panel } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { EventoStatusBadge } from "@/components/ui/badge";
import { formatarDataHora, formatarPeriodo } from "@/lib/format";

export const metadata: Metadata = { title: "Nova solicitação" };

export default async function NovaSolicitacaoPage({ searchParams }: { searchParams: Promise<{ evento?: string }> }) {
  const usuario = await requirePermissao("solicitacao.criar");
  const { evento } = await searchParams;
  if (evento) {
    const s = await criarRascunho(usuario, evento);
    redirect(`/solicitacoes/${s.id}`);
  }
  const eventos = (await listarEventos(usuario)).filter((e) => tipoSolicitacaoParaStatus(e.status) !== null);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nova solicitação" description="Escolha o evento. O tipo da solicitação depende do estado dele: necessidades antes da reunião, alterações depois da ata." breadcrumbs={[{ label: "Solicitações", href: "/solicitacoes" }, { label: "Nova" }]} />
      <Panel padded={false}>
        {eventos.length === 0 ? (
          <EmptyState title="Nenhum evento aceitando solicitações" description="Eventos em preparação aceitam necessidades; eventos com ata fechada aceitam alterações. Nenhum está nesses estados agora." compact />
        ) : (
          <ul className="divide-y divide-line">
            {eventos.map((ev) => {
              const tipo = tipoSolicitacaoParaStatus(ev.status)!;
              return (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {ev.nome} <span className="text-ink-muted font-normal">· {ev.codigo}</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatarPeriodo(ev.dataInicio, ev.dataFim)} · {ev.status === "PREPARACAO" ? `reunião ${formatarDataHora(ev.dataReuniao)}` : `ata fechada ${formatarDataHora(ev.ataFechadaEm)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <EventoStatusBadge status={ev.status} />
                    <form action={criarRascunhoAction}>
                      <input type="hidden" name="eventoId" value={ev.id} />
                      <Button type="submit" variant="primary" size="sm">
                        {SOLICITACAO_TIPO_LABEL[tipo]}
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
