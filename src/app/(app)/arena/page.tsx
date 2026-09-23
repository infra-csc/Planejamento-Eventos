import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { listarArenasResumo } from "@/server/services/arenas";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { Icone } from "@/components/ui/icons";
import { Codigo, Data, Numero } from "@/components/ui/numero";
import { EmptyState, PageHeader, RodapeTabela, Section } from "@/components/ui/layout";
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
          <ButtonLink href="/arena/nova" variant="primary" size="lg" className="no-underline">
            <Icone nome="mais" />
            Nova arena
          </ButtonLink>
        }
      />
      <Section titulo="Arenas" sub="A arena da Eco Run é fixa no sistema; as demais são criadas aqui, uma por evento.">
        {lista.length === 0 ? (
          <EmptyState
            icone="arena"
            title="Nenhuma arena ainda"
            description="Crie o mapa da arena de um evento: comece de uma área em branco ou copie o layout de outra arena."
            action={
              <ButtonLink href="/arena/nova" variant="secondary" size="md" className="no-underline">
                Criar a primeira arena
              </ButtonLink>
            }
          />
        ) : (
          <>
            {/* Tablet e desktop: tabela com a linha inteira clicável. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0">
                <CaptionOculta>Arenas cadastradas</CaptionOculta>
                <thead>
                  <tr>
                    <Th>Arena</Th>
                    <Th>Evento</Th>
                    <Th largura={80} alinhar="right">
                      Pontos
                    </Th>
                    <Th largura={110}>Planta</Th>
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
                      <th scope="row" className="border-b border-line-row px-cartao py-3 text-left font-normal">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-corpo font-medium text-ink">{a.nome}</span>
                          {a.origem === "fixa" && <Tag tom="muted">fixa</Tag>}
                        </span>
                        <Codigo className="mt-0.5 block text-rotulo text-muted">/arena/{a.slug}</Codigo>
                      </th>
                      <td className="border-b border-line-row px-3 py-3 text-pequeno text-ink-2">
                        {a.evento ? (
                          <Link href={`/eventos/${a.evento.id}`} className="link">
                            <Codigo>{a.evento.codigo}</Codigo> · {a.evento.nome}
                          </Link>
                        ) : a.origem === "fixa" ? (
                          <span className="text-muted">Dados da planta e ata importadas</span>
                        ) : (
                          <span className="text-muted">Evento excluído</span>
                        )}
                      </td>
                      <td className="border-b border-line-row px-3 py-3 text-right text-corpo text-ink">
                        <Numero valor={a.pontos} />
                      </td>
                      <td className="border-b border-line-row px-3 py-3 text-pequeno">{a.temPlanta ? <Tag tom="neutral">com planta</Tag> : <span className="text-muted">sem planta</span>}</td>
                      <td className="border-b border-line-row px-3 py-3 text-pequeno text-ink-2">
                        <Data valor={a.atualizadoEm} hora />
                      </td>
                      <td className="border-b border-line-row py-2 pl-2 pr-1 text-right">{a.origem === "evento" && <ArenaAcoes slug={a.slug} nome={a.nome} temPlanta={a.temPlanta} />}</td>
                      <td className="border-b border-line-row py-3 pl-1 pr-cartao text-right text-ink-3">
                        <Icone nome="chevron-direita" className="inline-block align-middle" />
                      </td>
                    </LinhaLink>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: um cartão por arena. O link abre a arena; as ações ficam ao lado, fora do link. */}
            <ul aria-label="Arenas cadastradas" className="m-0 list-none p-0 md:hidden">
              {lista.map((a) => (
                <li key={a.slug} className="flex items-start gap-1 border-b border-line-row pr-2 last:border-b-0">
                  <Link
                    href={`/arena/${a.slug}`}
                    aria-label={`Abrir arena ${a.nome}`}
                    className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pl-cartao text-ink no-underline transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-corpo font-medium">{a.nome}</span>
                        {a.origem === "fixa" && <Tag tom="muted">fixa</Tag>}
                        {a.temPlanta && <Tag tom="neutral">com planta</Tag>}
                      </span>
                      <span className="mt-0.5 block text-pequeno text-ink-2">
                        {a.evento ? (
                          <>
                            <Codigo>{a.evento.codigo}</Codigo> · {a.evento.nome}
                          </>
                        ) : a.origem === "fixa" ? (
                          <span className="text-muted">Dados da planta e ata importadas</span>
                        ) : (
                          <span className="text-muted">Evento excluído</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-pequeno text-muted">
                        <Numero valor={a.pontos} /> {a.pontos === 1 ? "ponto" : "pontos"} · atualizada <Data valor={a.atualizadoEm} hora />
                      </span>
                    </span>
                    <Icone nome="chevron-direita" className="mt-0.5 text-ink-3" />
                  </Link>
                  {a.origem === "evento" && (
                    <span className="shrink-0 pt-2.5">
                      <ArenaAcoes slug={a.slug} nome={a.nome} temPlanta={a.temPlanta} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <RodapeTabela>
              <Numero valor={lista.length} /> {lista.length === 1 ? "arena" : "arenas"} · <Numero valor={deEvento} /> de evento
            </RodapeTabela>
          </>
        )}
      </Section>
    </div>
  );
}
