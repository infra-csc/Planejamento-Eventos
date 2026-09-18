import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { listarSolicitacoes } from "@/server/services/solicitacoes";
import { pode } from "@/domain/permissions";
import { EmptyState, Section } from "@/components/ui/layout";
import { LinhaSolicitacaoEvento } from "@/components/solicitacoes/linha-solicitacao";

export const metadata: Metadata = { title: "Solicitações" };

export default async function SolicitacoesEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const lista = (await listarSolicitacoes(usuario, { eventoId: id })).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  return (
    <Section
      titulo="Solicitações deste evento"
      sub={veTodas ? "Necessidades pré-reunião e alterações pós-ata, de todas as áreas." : `Necessidades e alterações enviadas pela área ${usuario.areaNome ?? ""}.`}
    >
      {lista.length === 0 ? (
        <EmptyState compact title="Nenhuma solicitação neste evento" description={pode(usuario, "solicitacao.criar") ? "Use o botão no topo da página para enviar as necessidades da sua área." : "As solicitações enviadas pelas áreas aparecem aqui."} />
      ) : (
        lista.map((s) => <LinhaSolicitacaoEvento key={s.id} s={s} />)
      )}
    </Section>
  );
}
