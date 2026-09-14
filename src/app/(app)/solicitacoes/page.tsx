import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireUsuario } from "@/server/auth/session";
import { listarSolicitacoes } from "@/server/services/solicitacoes";
import { listarAreas } from "@/server/services/admin";
import { pode } from "@/domain/permissions";
import { SOLICITACAO_STATUS_LABEL } from "@/domain/solicitacao";
import { SOLICITACAO_STATUS, type SolicitacaoStatus } from "@/server/db/schema";
import { EmptyState, PageHeader, Panel } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { FiltersBar } from "@/components/ui/filters";
import { SolicitacoesTable } from "@/components/solicitacoes/solicitacoes-table";

export const metadata: Metadata = { title: "Solicitações" };

export default async function SolicitacoesPage({ searchParams }: { searchParams: Promise<{ status?: string; area?: string; atrasadas?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  const status = sp.status === "ABERTAS" ? "ABERTAS" : (SOLICITACAO_STATUS as readonly string[]).includes(sp.status ?? "") ? (sp.status as SolicitacaoStatus) : undefined;
  const [lista, areas] = await Promise.all([listarSolicitacoes(usuario, { status, areaId: sp.area, atrasadas: sp.atrasadas === "1" }), veTodas ? listarAreas() : Promise.resolve([])]);
  const podeCriar = pode(usuario, "solicitacao.criar");

  return (
    <>
      <PageHeader
        title={veTodas ? "Solicitações" : `Solicitações · ${usuario.areaNome ?? "minha área"}`}
        description={
          veTodas
            ? "Necessidades pré-reunião e alterações pós-ata de todas as áreas. Responda item a item dentro do prazo."
            : "Rascunhos, envios e respostas da sua área. Cada item é respondido separadamente pela logística."
        }
        actions={
          podeCriar && (
            <ButtonLink href="/solicitacoes/nova" variant="primary">
              <Plus className="size-4" /> Nova solicitação
            </ButtonLink>
          )
        }
      />
      <FiltersBar
        className="mb-4"
        selects={[
          {
            name: "status",
            label: "Status",
            options: [{ value: "ABERTAS", label: "Aguardando resposta" }, ...SOLICITACAO_STATUS.map((s) => ({ value: s, label: SOLICITACAO_STATUS_LABEL[s] }))],
          },
          ...(veTodas ? [{ name: "area", label: "Área", options: areas.map((a) => ({ value: a.id, label: a.nome })) }] : []),
          { name: "atrasadas", label: "Prazo", options: [{ value: "1", label: "Somente atrasadas" }], all: "Prazo: todos" },
        ]}
      />
      <Panel padded={false}>
        {lista.length === 0 ? (
          <EmptyState
            title={sp.status || sp.area || sp.atrasadas ? "Nenhuma solicitação corresponde aos filtros" : "Nenhuma solicitação"}
            description={podeCriar ? "Abra uma solicitação a partir de um evento em preparação (necessidades) ou aberto a alterações." : "As solicitações enviadas pelas áreas aparecerão aqui."}
            action={podeCriar && !sp.status ? <ButtonLink href="/solicitacoes/nova" variant="primary">Nova solicitação</ButtonLink> : undefined}
          />
        ) : (
          <SolicitacoesTable lista={lista} />
        )}
      </Panel>
    </>
  );
}
