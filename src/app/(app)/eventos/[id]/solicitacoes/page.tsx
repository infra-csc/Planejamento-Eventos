import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { listarSolicitacoes } from "@/server/services/solicitacoes";
import { pode } from "@/domain/permissions";
import { aguardaReuniao, podeResponder, podeResponderNaFase } from "@/domain/solicitacao";
import { ButtonLink } from "@/components/ui/button";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { ForaJanelaTag, SolicitacaoStatusTexto } from "@/components/ui/badge";
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
  const todas = (await listarSolicitacoes(usuario, { eventoId: id })).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  // Quem responde (logística, admin) vê primeiro o que espera resposta agora, com o atalho para responder em sequência.
  const responde = pode(usuario, "solicitacao.responder");
  const aguardando = (x: (typeof todas)[number]) => responde && podeResponder(x.status) && !aguardaReuniao(x.tipo, x.evento.status) && podeResponderNaFase(x.tipo, x.evento.status);
  const pendentes = todas.filter(aguardando);
  const lista = [...pendentes, ...todas.filter((x) => !aguardando(x))];
  const agora = new Date();
  // Na ata: conta itens (a reunião é a do evento, no topo); alteração: quantos a logística já respondeu.
  const textoItens = (x: (typeof lista)[number]) =>
    aguardaReuniao(x.tipo, x.evento.status) ? `${x.totalItens} ${x.totalItens === 1 ? "item" : "itens"}` : `${x.itensRespondidos}/${x.totalItens} respondidos`;
  return (
    <Section
      titulo="Solicitações deste evento"
      sub={
        pendentes.length > 0
          ? `${pendentes.length} ${pendentes.length === 1 ? "aguarda" : "aguardam"} resposta (no topo). Responder, corrigir uma resposta ou devolver: abra a solicitação.`
          : veTodas
            ? "Necessidades pré-reunião e alterações pós-ata, de todas as áreas."
            : `Necessidades e alterações enviadas pela área ${usuario.areaNome ?? ""}.`
      }
      acoes={
        pendentes.length > 0 ? (
          <ButtonLink href={`/solicitacoes/${pendentes[0].id}?fila=1`} variant="secondary" size="sm" className="no-underline">
            Responder em sequência
          </ButtonLink>
        ) : undefined
      }
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
                <Th className="hidden xl:table-cell" largura={128} alinhar="right">
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
                      {/* Mesmo desenho da lista geral: uma informação por coluna, estado em ponto + texto, tipo e autor no title
                          (antes selos cheios, Tag de tipo e "por fulano" embaixo do nome; auditoria 28/10, nº 36). */}
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:min-w-[220px]">
                        <Codigo className="text-rotulo text-ink-3 sm:hidden">{s.codigo}</Codigo>
                        <span className="text-corpo font-medium text-ink" title={`${s.titulo || "sem título"} · ${s.tipo === "PRE_REUNIAO" ? "pré-reunião" : "alteração"} · por ${s.criadoPor.nome}`}>
                          {s.titulo || "sem título"}
                        </span>
                        {s.foraDaJanela && <ForaJanelaTag />}
                      </span>
                      {/* Colunas que somem na lista estreita descem para cá. */}
                      <span className="mt-0.5 block text-pequeno text-muted xl:hidden">
                        <span className="lg:hidden">{s.area.nome} · </span>
                        <span className="numero">{textoItens(s)}</span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:hidden">
                        <SolicitacaoStatusTexto status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
                        {/* Sem prazo a mostrar ("—" das respondidas): no cartão do celular o traço solto só fazia ruído. */}
                        {(aguardaReuniao(s.tipo, s.evento.status) || pi.label !== "—") && (
                          <span className="numero inline-flex items-center gap-1.5 text-pequeno font-medium" style={{ color: COR_TOM[pi.tom] }}>
                            {aguardaReuniao(s.tipo, s.evento.status) ? "confere na reunião" : pi.vencido ? "atrasada" : pi.label}
                          </span>
                        )}
                      </span>
                    </th>
                    <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 lg:table-cell">{s.area.nome}</td>
                    <td className="numero hidden border-b border-line-row px-3 py-3 text-right text-pequeno text-ink-3 xl:table-cell">
                      {textoItens(s)}
                    </td>
                    <td className="hidden border-b border-line-row px-3 py-3 sm:table-cell">
                      <SolicitacaoStatusTexto status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
                    </td>
                    <td className="hidden border-b border-line-row px-3 py-3 text-right sm:table-cell">
                      {aguardaReuniao(s.tipo, s.evento.status) ? (
                        <span className="block text-pequeno text-ink-3">confere na reunião</span>
                      ) : (
                        <>
                      <span className="numero flex items-center justify-end gap-1.5 text-pequeno font-medium" style={{ color: COR_TOM[pi.tom] }}>
                        {pi.vencido && <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full" style={{ background: COR_TOM[pi.tom] }} />}
                        {pi.vencido ? "atrasada" : pi.label}
                      </span>
                      <span className="block text-rotulo text-meta">{pi.sub}</span>
                        </>
                      )}
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
