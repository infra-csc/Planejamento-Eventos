import { requireUsuario } from "@/server/auth/session";
import { listarAtaVersoes, obterEvento, obterLinhasAta, opcoesReferencias } from "@/server/services/eventos";
import { listarAreas } from "@/server/services/admin";
import { pode } from "@/domain/permissions";
import { ITEM_STATUS_LABEL } from "@/domain/solicitacao";
import { Panel, TableWrap } from "@/components/ui/layout";
import { AtaTabela } from "@/components/eventos/ata-tabela";
import { formatarDataHora } from "@/lib/format";

export default async function AtaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const [ev, linhas, versoes, opcoes, areas] = await Promise.all([obterEvento(usuario, id), obterLinhasAta(id), listarAtaVersoes(id), opcoesReferencias(), listarAreas()]);
  const podeEditar = pode(usuario, "ata.consolidar");

  return (
    <div className="space-y-4">
      <Panel
        title={ev.ataFechadaEm ? "Ata atual (com alterações aplicadas)" : "Ata em construção"}
        description={
          ev.ataFechadaEm
            ? `Ata fechada em ${formatarDataHora(ev.ataFechadaEm)}. Esta lista reflete a ata original mais os itens atendidos em solicitações e ajustes da logística.`
            : "Lista consolidada do que o evento vai usar. Cada linha vira peças na OS."
        }
        padded={false}
      >
        <AtaTabela
          eventoId={id}
          status={ev.status}
          podeEditar={podeEditar}
          opcoes={opcoes}
          areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
          linhas={linhas.map((l) => ({
            id: l.id,
            tipo: l.tipo,
            descricao: l.descricao,
            quantidade: l.quantidade,
            destino: l.destino,
            areaNome: l.areaNome,
            origem: l.registro.origem,
            versaoDefasada: l.versaoDefasada,
            versao: l.projeto?.versao ?? null,
            setor: l.peca?.setor ?? null,
          }))}
        />
      </Panel>

      {ev.observacoesReuniao && (
        <Panel title="Observações da reunião">
          <p className="whitespace-pre-wrap text-sm text-ink">{ev.observacoesReuniao}</p>
        </Panel>
      )}

      {versoes.map((v) => (
        <Panel key={v.id} title={`Ata original · versão ${v.numero}`} description={`Congelada em ${formatarDataHora(v.fechadaEm)} por ${v.fechadaPor?.nome ?? "—"}. Não muda mais; alterações posteriores estão no histórico e na lista acima.`} padded={false}>
          <details>
            <summary className="cursor-pointer px-4 py-2.5 text-[13px] text-info hover:underline">Ver conteúdo congelado ({v.conteudo.linhas.length} linhas, {v.conteudo.solicitacoesPreReuniao.length} solicitações pré-reunião)</summary>
            <div className="border-t border-line">
              <TableWrap>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Qtd.</th>
                      <th>Destino</th>
                      <th>Área</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.conteudo.linhas.map((l) => (
                      <tr key={l.id}>
                        <td>{l.descricao}</td>
                        <td className="num tabular">{l.quantidade}</td>
                        <td>{l.destino ?? "—"}</td>
                        <td>{l.area ?? "logística"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              {v.conteudo.solicitacoesPreReuniao.length > 0 && (
                <div className="border-t border-line px-4 py-3">
                  <p className="mb-2 text-xs font-medium text-ink-muted">Necessidades pré-reunião e respostas</p>
                  <ul className="space-y-2 text-[13px]">
                    {v.conteudo.solicitacoesPreReuniao.map((s) => (
                      <li key={s.codigo}>
                        <span className="font-medium">{s.codigo}</span> · {s.area}
                        <ul className="ml-4 mt-1 list-disc text-ink-secondary">
                          {s.itens.map((i, idx) => (
                            <li key={idx}>
                              {i.descricao}: {i.atendida}/{i.solicitada} — {ITEM_STATUS_LABEL[i.status]}
                              {i.observacao ? ` (${i.observacao})` : ""}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {v.conteudo.observacoes && (
                <div className="border-t border-line px-4 py-3 text-[13px]">
                  <p className="mb-1 text-xs font-medium text-ink-muted">Observações</p>
                  <p className="whitespace-pre-wrap">{v.conteudo.observacoes}</p>
                </div>
              )}
            </div>
          </details>
        </Panel>
      ))}
    </div>
  );
}
