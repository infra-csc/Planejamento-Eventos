import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento } from "@/server/services/eventos";
import { EmptyState, Panel } from "@/components/ui/layout";
import { formatarDataHora } from "@/lib/format";

export default async function HistoricoEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const historico = await obterHistoricoEvento(usuario, id);
  return (
    <Panel title="Histórico do evento" description="Toda transição de estado, resposta e ajuste fica registrada com autor, data e justificativa." padded={false}>
      {historico.length === 0 ? (
        <EmptyState title="Nenhum registro" compact />
      ) : (
        <ol className="divide-y divide-line">
          {historico.map((h) => (
            <li key={h.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4">
              <div className="text-xs text-ink-muted tabular">
                {formatarDataHora(h.criadoEm)}
                <span className="block text-ink-secondary">{h.usuario?.nome ?? "Sistema"}</span>
              </div>
              <div className="text-[13px]">
                <span className="mr-2 rounded-sm bg-black/5 px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">{h.entidade.replace("_", " ")}</span>
                <span className="text-ink">{h.descricao}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
