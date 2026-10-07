import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { listarSolicitacoes } from "@/server/services/solicitacoes";
import { pode } from "@/domain/permissions";
import { aguardaReuniao } from "@/domain/solicitacao";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { ForaJanelaTag, SolicitacaoStatusBadge, TipoSolicitacaoTag } from "@/components/ui/badge";
import { EmptyState, Section } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";

export const metadata: Metadata = { title: "Solicitações" };

export default async function SolicitacoesEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  // Quem não vê todas as áreas recebe só as da própria área (regra do serviço).
  const lista = (await listarSolicitacoes(usuario, { eventoId: id })).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  const agora = new Date();
  return (
    <Section
      titulo="Solicitações deste evento"
      sub={veTodas ? "Necessidades pré-reunião e alterações pós-ata, de todas as áreas." : `Necessidades e alterações enviadas pela área ${usuario.areaNome ?? ""}.`}
    >
      {lista.length === 0 ? (
        <EmptyState compact title="Nenhuma solicitação neste evento" description={pode(usuario, "solicitacao.criar") ? "Use o botão no topo da página para enviar as necessidades da sua área." : "As solicitações enviadas pelas áreas aparecem aqui."} />
      ) : (
        <div className="overflow-x-auto">
          {/* Mesma tabela da lista principal, sem a coluna de evento (já estamos dentro dele). */}
          <table data-responsiva className="w-full border-collapse max-sm:[overflow-wrap:anywhere] sm:min-w-[560px] [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
            <CaptionOculta>Solicitações deste evento</CaptionOculta>
            <thead>
              <tr className="bg-subtle">
                <Th className="hidden sm:table-cell" largura={100}>
                  Código
                </Th>
                <Th>Solicitação</Th>
                <Th className="hidden lg:table-cell" largura={140}>
                  Área
                </Th>
                <Th className="hidden xl:table-cell" largura={64} alinhar="right">
                  Itens
                </Th>
                <Th className="hidden sm:table-cell" largura={124}>
                  Status
                </Th>
                <Th className="hidden sm:table-cell" largura={110} alinhar="right">
                  Prazo
                </Th>
                <Th largura={44}>
                  <span className="sr-only">Abrir</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => {
                const pi = prazoInfo(s, agora);
                return (
                  <LinhaLink key={s.id} href={`/solicitacoes/${s.id}`} rotulo={`Abrir ${s.codigo} — ${s.titulo || "sem título"}`}>
                    <td className="hidden border-b border-line-row py-3 pl-cartao pr-3 text-pequeno text-ink-3 sm:table-cell">
                      <Codigo>{s.codigo}</Codigo>
                    </td>
                    <th scope="row" className="border-b border-line-row px-3 py-3 text-left font-normal">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:min-w-[220px]">
                        <Codigo className="text-rotulo text-ink-3 sm:hidden">{s.codigo}</Codigo>
                        <span className="text-corpo font-medium text-ink">{s.titulo || "sem título"}</span>
                        <TipoSolicitacaoTag tipo={s.tipo} />
                        {s.foraDaJanela && <ForaJanelaTag />}
                      </span>
                      <span className="mt-0.5 block text-pequeno text-muted">
                        <span className="lg:hidden">{s.area.nome} · </span>
                        por {s.criadoPor.nome}
                        <span className="xl:hidden">
                          {" · "}
                          <span className="numero">
                            {s.itensRespondidos}/{s.totalItens} itens
                          </span>
                        </span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:hidden">
                        <SolicitacaoStatusBadge status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
                        <span className="numero inline-flex items-center gap-1.5 text-pequeno font-medium" style={{ color: COR_TOM[pi.tom] }}>
                          {pi.vencido ? "atrasada" : pi.label}
                        </span>
                      </span>
                    </th>
                    <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 lg:table-cell">{s.area.nome}</td>
                    <td className="numero hidden border-b border-line-row px-3 py-3 text-right text-pequeno text-ink-3 xl:table-cell">
                      {s.itensRespondidos}/{s.totalItens}
                    </td>
                    <td className="hidden border-b border-line-row px-3 py-3 sm:table-cell">
                      <SolicitacaoStatusBadge status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
                    </td>
                    <td className="hidden border-b border-line-row px-3 py-3 text-right sm:table-cell">
                      <span className="numero flex items-center justify-end gap-1.5 text-pequeno font-medium" style={{ color: COR_TOM[pi.tom] }}>
                        {pi.vencido && <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full" style={{ background: COR_TOM[pi.tom] }} />}
                        {pi.vencido ? "atrasada" : pi.label}
                      </span>
                      <span className="block text-rotulo text-meta">{pi.sub}</span>
                    </td>
                    <td className="border-b border-line-row py-3 pl-1 pr-cartao text-right text-ink-3">
                      <Icone nome="chevron-direita" className="inline-block" />
                    </td>
                  </LinhaLink>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
