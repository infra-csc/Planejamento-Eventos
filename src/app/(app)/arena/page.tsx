import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { listarArenasResumo } from "@/server/services/arenas";
import { diaMesHora } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { EmptyState, PageHeader, RodapeTabela, Section, TableWrap } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { ArenaAcoes } from "./arena-acoes";

export const metadata: Metadata = { title: "Arena 3D" };

export default async function ArenaIndicePage() {
  await requirePermissao("arena.ver");
  const lista = await listarArenasResumo();
  const deEvento = lista.filter((a) => a.origem === "evento").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Arena 3D"
        divisor
        breadcrumbs={[{ label: "Arena 3D" }]}
        actions={
          <ButtonLink href="/arena/nova" variant="primary" size="md" className="no-underline">
            Nova arena
          </ButtonLink>
        }
      />
      <Section titulo="Arenas" sub="A arena da Eco Run é fixa no sistema; as demais são criadas aqui, uma por evento.">
        {lista.length === 0 ? (
          <EmptyState
            compact
            title="Nenhuma arena ainda."
            description="Crie o mapa da arena de um evento: comece de uma área em branco ou copie o layout de outra arena."
            action={
              <ButtonLink href="/arena/nova" variant="primary" size="md" className="no-underline">
                Nova arena
              </ButtonLink>
            }
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full border-collapse [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
                <CaptionOculta>Arenas cadastradas</CaptionOculta>
                <thead>
                  <tr>
                    <Th>Arena</Th>
                    <Th>Evento</Th>
                    <Th largura={80} alinhar="right">
                      Pontos
                    </Th>
                    <Th largura={90}>Planta</Th>
                    <Th largura={140}>Atualizada</Th>
                    <Th largura={56}>
                      <span className="sr-only">Ações</span>
                    </Th>
                    <Th largura={44}>
                      <span className="sr-only">Abrir</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    // A linha inteira abre a arena; o link do evento e as ações continuam clicáveis por conta própria.
                    <LinhaLink key={a.slug} href={`/arena/${a.slug}`} rotulo={`Abrir arena ${a.nome}`}>
                      <th scope="row" className="border-b border-line-row px-[18px] py-3 text-left font-normal">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-corpo font-medium text-ink">{a.nome}</span>
                          {a.origem === "fixa" && <Tag tom="muted">fixa</Tag>}
                        </span>
                        <span className="mt-[3px] block font-mono text-rotulo text-muted">/arena/{a.slug}</span>
                      </th>
                      <td className="border-b border-line-row px-3 py-3 text-pequeno text-ink-2">
                        {a.evento ? (
                          <Link href={`/eventos/${a.evento.id}`} className="link">
                            <span className="font-mono">{a.evento.codigo}</span> · {a.evento.nome}
                          </Link>
                        ) : a.origem === "fixa" ? (
                          <span className="text-muted">Dados da planta e ata importadas</span>
                        ) : (
                          <span className="text-muted">Evento excluído</span>
                        )}
                      </td>
                      <td className="border-b border-line-row px-3 py-3 text-right font-mono text-corpo text-ink">{a.pontos}</td>
                      <td className="border-b border-line-row px-3 py-3 text-pequeno">{a.temPlanta ? <Tag tom="accent">com planta</Tag> : <span className="text-muted">sem</span>}</td>
                      <td className="border-b border-line-row px-3 py-3 font-mono text-pequeno text-ink-2">{a.atualizadoEm ? diaMesHora(a.atualizadoEm) : "—"}</td>
                      <td className="border-b border-line-row py-2 pl-2 pr-1 text-right">{a.origem === "evento" && <ArenaAcoes slug={a.slug} nome={a.nome} temPlanta={a.temPlanta} />}</td>
                      <td className="border-b border-line-row py-3 pl-1 pr-[18px] text-right text-ink-3">
                        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </td>
                    </LinhaLink>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <RodapeTabela>
              {lista.length} {lista.length === 1 ? "arena" : "arenas"} · {deEvento} de evento
            </RodapeTabela>
          </>
        )}
      </Section>
    </div>
  );
}
