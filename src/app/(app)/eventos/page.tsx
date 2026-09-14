import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUsuario } from "@/server/auth/session";
import { listarEventos } from "@/server/services/eventos";
import { pode } from "@/domain/permissions";
import { EVENTO_STATUS_LABEL, statusExibicao } from "@/domain/evento";
import { EVENTO_STATUS, type EventoStatus } from "@/server/db/schema";
import { EmptyState, PageHeader, Panel, TableWrap } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { EventoStatusBadge } from "@/components/ui/badge";
import { FiltersBar } from "@/components/ui/filters";
import { formatarDataHora, formatarPeriodo, hojeISO } from "@/lib/format";

export const metadata: Metadata = { title: "Eventos" };

export default async function EventosPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const status = (EVENTO_STATUS as readonly string[]).includes(sp.status ?? "") ? (sp.status as EventoStatus) : undefined;
  const eventos = await listarEventos(usuario, { busca: sp.q, status });
  const hoje = hojeISO();
  const podeCriar = pode(usuario, "evento.criar");

  return (
    <>
      <PageHeader
        title="Eventos"
        description="Cada evento passa por preparação, reunião de OS, ata fechada (aberto a alterações) e encerramento."
        actions={
          podeCriar && (
            <ButtonLink href="/eventos/novo" variant="primary">
              <Plus className="size-4" /> Novo evento
            </ButtonLink>
          )
        }
      />
      <FiltersBar
        className="mb-4"
        search={{ name: "q", placeholder: "Buscar por nome, código, cliente ou local" }}
        selects={[{ name: "status", label: "Status", options: EVENTO_STATUS.map((s) => ({ value: s, label: EVENTO_STATUS_LABEL[s] })) }]}
      />
      <Panel padded={false}>
        {eventos.length === 0 ? (
          <EmptyState
            title={sp.q || sp.status ? "Nenhum evento corresponde aos filtros" : "Nenhum evento cadastrado"}
            description={podeCriar ? "Crie o primeiro evento para que as áreas comecem a registrar necessidades." : "Quando a logística criar um evento, ele aparecerá aqui."}
            action={podeCriar && !sp.q && !sp.status ? <ButtonLink href="/eventos/novo" variant="primary">Novo evento</ButtonLink> : undefined}
          />
        ) : (
          <TableWrap>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Período</th>
                  <th className="hidden md:table-cell">Reunião de OS</th>
                  <th>Status</th>
                  <th className="hidden lg:table-cell">Responsável</th>
                  <th className="num">Solicitações abertas</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr key={ev.id} className="is-link">
                    <td>
                      <Link href={`/eventos/${ev.id}`} className="block">
                        <span className="block font-medium text-ink">{ev.nome}</span>
                        <span className="block text-xs text-ink-muted">
                          {ev.codigo}
                          {ev.cliente ? ` · ${ev.cliente}` : ""}
                          {ev.local ? ` · ${ev.local}` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap tabular">{formatarPeriodo(ev.dataInicio, ev.dataFim)}</td>
                    <td className="hidden md:table-cell whitespace-nowrap tabular">{formatarDataHora(ev.dataReuniao)}</td>
                    <td>
                      <EventoStatusBadge status={statusExibicao(ev.status, ev.dataFim, hoje)} />
                    </td>
                    <td className="hidden lg:table-cell">{ev.responsavel.nome}</td>
                    <td className="num">{ev.solicitacoesAbertas > 0 ? <span className="font-medium text-warning">{ev.solicitacoesAbertas}</span> : <span className="text-ink-faint">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
