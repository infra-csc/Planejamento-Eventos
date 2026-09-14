import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { listarPendenciasCompra } from "@/server/services/solicitacoes";
import { EmptyState, PageHeader, Panel, TableWrap } from "@/components/ui/layout";
import { TabsNav } from "@/components/ui/tabs-nav";
import { ItemStatusBadge } from "@/components/ui/badge";
import { formatarData, formatarDataHora } from "@/lib/format";

export const metadata: Metadata = { title: "Pendências de compra/locação" };

export default async function PendenciasPage() {
  const usuario = await requirePermissao("pendencias.ver");
  const lista = await listarPendenciasCompra(usuario);
  return (
    <>
      <PageHeader title="Pendências de compra/locação" description="Itens que a logística marcou como pendência ao responder parcial ou não atendido (RV-11). Sem integração com Compras: esta lista alimenta o briefing daquele módulo." />
      <TabsNav className="mb-4" tabs={[{ href: "/consolidacao", label: "Demanda × estoque", exact: true }, { href: "/consolidacao/pendencias", label: "Pendências de compra/locação" }]} />
      <Panel padded={false}>
        {lista.length === 0 ? (
          <EmptyState title="Nenhuma pendência" description="Ao responder um item como parcial ou não atendido, a logística pode marcar “gerar pendência de compra/locação”." compact />
        ) : (
          <TableWrap>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Evento</th>
                  <th className="hidden md:table-cell">Montagem</th>
                  <th className="hidden sm:table-cell">Área</th>
                  <th className="num">Faltam</th>
                  <th>Resposta</th>
                  <th className="hidden lg:table-cell">Observação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/solicitacoes/${p.solicitacaoId}`} className="font-medium text-ink hover:underline">
                        {p.descricao}
                      </Link>
                      <span className="block text-xs text-ink-muted">{p.solicitacao.codigo}</span>
                    </td>
                    <td>
                      <Link href={`/eventos/${p.solicitacao.evento.id}`} className="hover:underline">
                        {p.solicitacao.evento.nome}
                      </Link>
                    </td>
                    <td className="hidden md:table-cell tabular">{formatarData(p.solicitacao.evento.dataMontagem)}</td>
                    <td className="hidden sm:table-cell">{p.solicitacao.area.nome}</td>
                    <td className="num tabular font-medium text-danger">{p.faltante}</td>
                    <td>
                      <ItemStatusBadge status={p.status} />
                      <span className="block text-xs text-ink-muted">{formatarDataHora(p.respondidoEm)}</span>
                    </td>
                    <td className="hidden lg:table-cell text-ink-secondary">{p.observacaoLogistica}</td>
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
