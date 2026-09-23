import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioAtual, requirePermissao } from "@/server/auth/session";
import { historicoProjeto } from "@/server/services/projetos";
import { obterProjetoCache } from "@/server/cache";
import { pode } from "@/domain/permissions";
import { SETOR_LABEL } from "@/domain/os";
import { NaoEncontradoError } from "@/domain/errors";
import { SETORES } from "@/domain/constantes";
import { cn } from "@/lib/cn";
import { Aviso, EmptyState, ListaDados, Meta, PageHeader, RodapeTabela, Section } from "@/components/ui/layout";
import { Badge, ChipMono, Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Codigo, Data, Numero } from "@/components/ui/numero";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { AnexosManager } from "@/components/projetos/anexos-manager";
import { AtivoToggle } from "@/components/projetos/ativo-toggle";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const p = await obterProjetoCache(usuario, id).catch(() => null);
  return { title: p ? p.nome : "Projeto padrão" };
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("projeto.ver");
  const { id } = await params;
  const [p, historico] = await Promise.all([
    obterProjetoCache(usuario, id).catch((e) => {
      if (e instanceof NaoEncontradoError) notFound();
      throw e;
    }),
    historicoProjeto(id),
  ]);
  const gerencia = pode(usuario, "projeto.gerenciar");
  const itens = p.versaoAtualObj?.itens ?? [];
  const total = itens.reduce((a, i) => a + i.quantidade, 0);
  const imagens = p.anexos.filter((a) => a.tipo === "IMAGEM");
  const capa = imagens[0];
  // Lista de peças agrupada por setor (ordem de execução) e, dentro do setor, por código.
  const grupos = SETORES.map((setor) => ({
    setor,
    itens: itens.filter((i) => i.peca.setor === setor).sort((a, b) => a.peca.codigo.localeCompare(b.peca.codigo)),
  })).filter((g) => g.itens.length > 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca" }, { label: p.codigo }]}
        eyebrow={
          <>
            <Codigo>{p.codigo}</Codigo>
            <ChipMono tom="control">v{p.versaoAtual}</ChipMono>
            {!p.ativo && <Badge tom="muted">Inativo</Badge>}
          </>
        }
        title={p.nome}
        description={p.descricao || undefined}
        meta={
          <>
            {p.categoria && <Meta rotulo="Categoria" valor={p.categoria} />}
            <Meta rotulo="Tipos de peça" valor={<Numero valor={itens.length} />} />
            <Meta rotulo="Unidades por projeto" valor={<Numero valor={total} />} />
          </>
        }
        actions={
          gerencia && (
            <>
              <AtivoToggle id={p.id} ativo={p.ativo} />
              <ButtonLink href={`/projetos/${p.id}/editar`} variant="primary" size="lg" className="no-underline">
                Editar
              </ButtonLink>
            </>
          )
        }
      />

      {p.usosDefasados.length > 0 && (
        <Aviso tom="warning" titulo="Eventos usando versões anteriores" className="mb-5">
          {p.usosDefasados.map((u, i) => (
            <span key={u.eventoId}>
              {i > 0 && " · "}
              <Link href={`/eventos/${u.eventoId}/ata`} className="link">
                <Codigo>{u.codigo}</Codigo> {u.nome}
              </Link>{" "}
              (<Codigo>v{u.versao}</Codigo>)
            </span>
          ))}
          . A logística decide na ata de cada evento se atualiza para a <Codigo>v{p.versaoAtual}</Codigo>.
        </Aviso>
      )}

      {/* No celular: capa, peças, anexos e só então o painel lateral. No desktop a capa abre a coluna da direita. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] lg:items-start">
        {capa && (
          <figure className="m-0 overflow-hidden rounded-cartao border border-line bg-surface lg:col-start-2 lg:row-start-1">
            <ImagemZoom src={`/api/anexos/${capa.id}`} alt={capa.nomeArquivo} legenda={`${p.nome} · ${capa.nomeArquivo}`} className="aspect-[4/3] w-full" />
            <figcaption className="flex items-center justify-between gap-3 border-t border-line-soft px-cartao py-2.5 text-pequeno text-muted">
              <span className="min-w-0 truncate" title={capa.nomeArquivo}>
                Capa · {capa.nomeArquivo}
              </span>
              {p.anexos.length > 1 && (
                <a href="#anexos" className="link shrink-0 whitespace-nowrap">
                  <Numero valor={p.anexos.length} /> anexos
                </a>
              )}
            </figcaption>
          </figure>
        )}

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Section
            titulo="Lista de peças"
            sub={
              <>
                <Codigo>v{p.versaoAtual}</Codigo> · <Numero valor={itens.length} /> {plural(itens.length, "tipo de peça", "tipos de peça")} · <Numero valor={total} /> {plural(total, "unidade", "unidades")} por projeto
              </>
            }
          >
            {grupos.length === 0 ? (
              <EmptyState compact title="Nenhuma peça nesta versão" description={gerencia ? "Edite o projeto para montar a lista de peças." : "A cenografia ainda não montou a lista de peças deste projeto."} />
            ) : (
              <>
                {/* Desktop e tablet: tabela agrupada por setor. */}
                <table className="hidden w-full border-collapse md:table">
                  <CaptionOculta>{`Lista de peças do projeto ${p.codigo}, versão ${p.versaoAtual}, agrupada por setor`}</CaptionOculta>
                  <thead>
                    <tr>
                      <Th largura={140}>Código</Th>
                      <Th>Peça</Th>
                      <Th largura={120} alinhar="right">
                        Qtd.
                      </Th>
                    </tr>
                  </thead>
                  {grupos.map((g) => (
                    <tbody key={g.setor}>
                      <tr>
                        <th scope="colgroup" colSpan={3} className="border-b border-line-soft bg-subtle px-cartao py-2 text-left text-micro font-semibold uppercase tracking-[0.06em] text-muted">
                          {SETOR_LABEL[g.setor]} <span className="numero font-medium normal-case tracking-normal text-meta">· {g.itens.length}</span>
                        </th>
                      </tr>
                      {g.itens.map((i) => (
                        <tr key={i.id} className="hover:bg-subtle">
                          <td className="border-b border-line-row py-2.5 pl-cartao pr-3 text-pequeno text-ink-2">
                            <Codigo>{i.peca.codigo}</Codigo>
                          </td>
                          <th scope="row" className="border-b border-line-row px-3 py-2.5 text-left text-corpo font-normal text-ink">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {i.peca.nome}
                              {!i.peca.ativo && <Tag tom="warning">peça inativa</Tag>}
                            </span>
                          </th>
                          <td className="border-b border-line-row py-2.5 pl-3 pr-cartao text-right text-corpo font-medium text-ink">
                            <Numero valor={i.quantidade} unidade={i.peca.unidade} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>

                {/* Celular: linhas empilhadas, código acima do nome e quantidade à direita. */}
                <ul className="m-0 list-none p-0 md:hidden" aria-label={`Lista de peças do projeto ${p.codigo}`}>
                  {grupos.map((g) => (
                    <li key={g.setor}>
                      <p className="m-0 border-b border-line-soft bg-subtle px-cartao py-2 text-micro font-semibold uppercase tracking-[0.06em] text-muted">
                        {SETOR_LABEL[g.setor]} <span className="numero font-medium normal-case tracking-normal text-meta">· {g.itens.length}</span>
                      </p>
                      <ul className="m-0 list-none p-0">
                        {g.itens.map((i) => (
                          <li key={i.id} className="flex items-start justify-between gap-3 border-b border-line-row px-cartao py-3">
                            <span className="min-w-0">
                              <Codigo className="block text-pequeno text-ink-2">{i.peca.codigo}</Codigo>
                              <span className="mt-0.5 block text-corpo text-ink">{i.peca.nome}</span>
                              {!i.peca.ativo && (
                                <Tag tom="warning" className="mt-1">
                                  peça inativa
                                </Tag>
                              )}
                            </span>
                            <Numero valor={i.quantidade} unidade={i.peca.unidade} className="shrink-0 text-corpo font-medium text-ink" />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                <RodapeTabela direita={<Numero valor={total} unidade={plural(total, "unidade", "unidades")} />} className="-mt-px">
                  <Numero valor={itens.length} /> {plural(itens.length, "tipo de peça", "tipos de peça")}
                </RodapeTabela>
              </>
            )}
          </Section>

          <div id="anexos" className="alvo-ancora">
            <Section titulo="Fotos e desenhos" sub="Render, modulação e PDF técnico do projeto. Até 8 MB por arquivo.">
              <AnexosManager projetoId={p.id} anexos={p.anexos.map((a) => ({ id: a.id, tipo: a.tipo, nomeArquivo: a.nomeArquivo, tamanho: a.tamanho }))} podeGerenciar={gerencia} />
            </Section>
          </div>
        </div>

        <aside aria-label="Versões, dados e histórico" className="flex min-w-0 flex-col gap-5 lg:col-start-2">
          <Section titulo="Versões" sub={<><Numero valor={p.versoes.length} /> {plural(p.versoes.length, "versão", "versões")}</>}>
            <ol className="m-0 list-none p-0">
              {p.versoes.map((v) => {
                const atual = v.numero === p.versaoAtual;
                const unidades = v.itens.reduce((a, i) => a + i.quantidade, 0);
                return (
                  <li key={v.id} aria-current={atual ? "true" : undefined} className={cn("relative border-b border-line-row px-cartao py-3 last:border-b-0", atual && "bg-subtle")}>
                    {atual && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ink-3" />}
                    <div className="flex items-center gap-2">
                      <Codigo className="text-corpo font-semibold text-ink">v{v.numero}</Codigo>
                      {atual && <Tag tom="neutral">atual</Tag>}
                      <Data valor={v.criadoEm} hora className="ml-auto text-rotulo text-muted" />
                    </div>
                    {v.observacao && <p className="mb-0 mt-1 text-pequeno text-ink-2">{v.observacao}</p>}
                    <p className="mb-0 mt-0.5 text-rotulo text-muted">
                      <Numero valor={v.itens.length} /> {plural(v.itens.length, "tipo", "tipos")} · <Numero valor={unidades} /> {plural(unidades, "unidade", "unidades")} · {v.criadoPor?.nome ?? "—"}
                    </p>
                  </li>
                );
              })}
            </ol>
          </Section>
          <Section titulo="Dados">
            <ListaDados
              itens={[
                { label: "Criado por", valor: p.criadoPor?.nome ?? "—" },
                { label: "Criado em", valor: <Data valor={p.criadoEm} hora /> },
                { label: "Última alteração", valor: <Data valor={p.atualizadoEm} hora /> },
              ]}
            />
          </Section>
          <Section titulo="Histórico">
            {historico.length === 0 ? (
              <EmptyState compact title="Sem registros" description="As alterações do projeto aparecem aqui." />
            ) : (
              <ol className="m-0 list-none px-cartao py-2">
                {historico.slice(0, 8).map((h) => (
                  <li key={h.id} className="py-1.5">
                    <p className="m-0 text-pequeno text-ink">{h.descricao}</p>
                    <p className="m-0 text-rotulo text-meta">
                      {h.usuario?.nome ?? "Sistema"} · <Data valor={h.criadoEm} hora />
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </aside>
      </div>
    </>
  );
}
