import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { listarArenasResumo } from "@/server/services/arenas";
import { diaMesHora } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { EmptyState, PageHeader, RodapeTabela, Section, TableWrap } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
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
        description="Mapas de arena por evento: planta, pontos e a ata do evento no mesmo lugar."
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
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.slug} className="hover:bg-subtle">
                      <th scope="row" className="border-b border-line-row px-[18px] py-3 text-left font-normal">
                        <span className="flex flex-wrap items-center gap-2">
                          <Link href={`/arena/${a.slug}`} className="link text-corpo font-medium">
                            {a.nome}
                          </Link>
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
                      <td className="border-b border-line-row py-2 pl-2 pr-[18px] text-right">{a.origem === "evento" && <ArenaAcoes slug={a.slug} nome={a.nome} temPlanta={a.temPlanta} />}</td>
                    </tr>
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
