import Link from "next/link";
import { SolicitacaoStatusBadge } from "@/components/ui/badge";
import { TableWrap } from "@/components/ui/layout";
import { estaAtrasada, SOLICITACAO_TIPO_LABEL } from "@/domain/solicitacao";
import { formatarDataHora, tempoRelativo } from "@/lib/format";
import type { listarSolicitacoes } from "@/server/services/solicitacoes";

type Lista = Awaited<ReturnType<typeof listarSolicitacoes>>;

export function SolicitacoesTable({ lista, ocultarEvento }: { lista: Lista; ocultarEvento?: boolean }) {
  const agora = new Date();
  return (
    <TableWrap>
      <table className="table-base">
        <thead>
          <tr>
            <th>Solicitação</th>
            {!ocultarEvento && <th className="hidden md:table-cell">Evento</th>}
            <th>Área</th>
            <th className="hidden sm:table-cell">Tipo</th>
            <th className="num">Itens</th>
            <th>Status</th>
            <th className="hidden lg:table-cell">Prazo de resposta</th>
            <th className="hidden xl:table-cell">Atualizada</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((s) => {
            const atrasada = estaAtrasada(s.status, s.prazoRespostaEm, agora);
            return (
              <tr key={s.id} className="is-link">
                <td>
                  <Link href={`/solicitacoes/${s.id}`} className="block">
                    <span className="block font-medium text-ink">{s.codigo}</span>
                    <span className="block text-xs text-ink-muted">{s.titulo || `por ${s.criadoPor.nome}`}</span>
                  </Link>
                </td>
                {!ocultarEvento && (
                  <td className="hidden md:table-cell">
                    <span className="block">{s.evento.nome}</span>
                    <span className="block text-xs text-ink-muted">{s.evento.codigo}</span>
                  </td>
                )}
                <td>{s.area.nome}</td>
                <td className="hidden sm:table-cell text-ink-secondary">{SOLICITACAO_TIPO_LABEL[s.tipo]}</td>
                <td className="num tabular">
                  {s.status === "RASCUNHO" || s.status === "DEVOLVIDA" ? s.totalItens : `${s.itensRespondidos}/${s.totalItens}`}
                </td>
                <td>
                  <SolicitacaoStatusBadge status={s.status} atrasada={atrasada} />
                </td>
                <td className={`hidden lg:table-cell tabular ${atrasada ? "text-danger font-medium" : ""}`}>
                  {s.prazoRespostaEm && (s.status === "ENVIADA" || s.status === "EM_ANALISE") ? `${formatarDataHora(s.prazoRespostaEm)} (${tempoRelativo(s.prazoRespostaEm, agora)})` : "—"}
                </td>
                <td className="hidden xl:table-cell text-ink-muted">{tempoRelativo(s.atualizadoEm, agora)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}
