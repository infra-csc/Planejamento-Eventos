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
          <table className="w-full min-w-[560px] border-collapse [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
            <CaptionOculta>Solicitações deste evento</CaptionOculta>
            <thead>
              <tr className="bg-subtle">
                <Th largura={100}>Código</Th>
                <Th>Solicitação</Th>
                <Th className="hidden lg:table-cell" largura={140}>
                  Área
                </Th>
                <Th className="hidden xl:table-cell" largura={64}>
                  Itens
                </Th>
                <Th largura={124}>Status</Th>
                <Th largura={110} alinhar="right">
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
                    <td className="border-b border-line-row px-3 py-3 font-mono text-pequeno text-ink-3">{s.codigo}</td>
                    <th scope="row" className="border-b border-line-row px-3 py-3 text-left font-normal">
                      <span className="flex min-w-[220px] flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-corpo font-medium text-ink">{s.titulo || "sem título"}</span>
                        <TipoSolicitacaoTag tipo={s.tipo} />
                        {s.foraDaJanela && <ForaJanelaTag />}
                      </span>
                      <span className="mt-0.5 block text-pequeno text-muted">
                        <span className="lg:hidden">{s.area.nome} · </span>
                        por {s.criadoPor.nome}
                        <span className="xl:hidden">
                          {" · "}
                          <span className="font-mono">
                            {s.itensRespondidos}/{s.totalItens} itens
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 lg:table-cell">{s.area.nome}</td>
                    <td className="hidden border-b border-line-row px-3 py-3 font-mono text-pequeno text-ink-3 xl:table-cell">
                      {s.itensRespondidos}/{s.totalItens}
                    </td>
                    <td className="border-b border-line-row px-3 py-3">
                      <SolicitacaoStatusBadge status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
                    </td>
                    <td className="border-b border-line-row px-3 py-3 text-right">
                      <span className="flex items-center justify-end gap-1.5 font-mono text-pequeno font-medium" style={{ color: COR_TOM[pi.tom] }}>
                        {pi.vencido && <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full" style={{ background: COR_TOM[pi.tom] }} />}
                        {pi.vencido ? "atrasada" : pi.label}
                      </span>
                      <span className="block text-rotulo text-meta">{pi.sub}</span>
                    </td>
                    <td className="border-b border-line-row py-3 pl-1 pr-cartao text-right text-ink-3">
                      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
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
