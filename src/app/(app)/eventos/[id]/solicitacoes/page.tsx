import { requireUsuario } from "@/server/auth/session";
import { listarSolicitacoes } from "@/server/services/solicitacoes";
import { obterEvento } from "@/server/services/eventos";
import { pode } from "@/domain/permissions";
import { aceitaSolicitacao } from "@/domain/evento";
import { EmptyState, Panel } from "@/components/ui/layout";
import { SolicitacoesTable } from "@/components/solicitacoes/solicitacoes-table";

export default async function SolicitacoesEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const [ev, lista] = await Promise.all([obterEvento(usuario, id), listarSolicitacoes(usuario, { eventoId: id })]);
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  const aceita = aceitaSolicitacao(ev.status, "PRE_REUNIAO") || aceitaSolicitacao(ev.status, "ALTERACAO");
  return (
    <Panel title={veTodas ? "Solicitações de todas as áreas" : `Solicitações da área ${usuario.areaNome ?? ""}`} padded={false}>
      {lista.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação neste evento"
          description={
            pode(usuario, "solicitacao.criar")
              ? aceita
                ? "Use “Nova solicitação” no topo da página para registrar as necessidades da sua área."
                : "O evento não está aceitando solicitações neste momento."
              : "As solicitações enviadas pelas áreas aparecerão aqui."
          }
          compact
        />
      ) : (
        <SolicitacoesTable lista={lista} ocultarEvento />
      )}
    </Panel>
  );
}
