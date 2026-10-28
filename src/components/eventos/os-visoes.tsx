import { SETOR_LABEL, individuaisAgrupadas, osParaLeitura, textoLocais } from "@/domain/os";
import type { OsConteudo, OsLinha } from "@/server/db/schema";
import { GRUPO_LABEL, grupoDoCodigo, totaisPorGrupo, type MapaGrupos } from "@/domain/grupos-material";
import { buttonClasses } from "@/components/ui/button-classes";
import { ChipMono } from "@/components/ui/badge";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { Aviso, EmptyState, RodapeTabela, Section } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { CaptionOculta, Th } from "@/components/ui/tabela";

export type VisaoOs = "totais" | "projetos" | "individuais" | "composicao";

/**
 * Ações de correção nas leituras (visão geral do evento, admin e logística). Só repassa os ajustes que já existem para
 * cada linha da ata; o que soma várias linhas (um total por peça) abre de onde vem o número, sem regra nova.
 */
export type EdicaoOs = {
  /** Projeto `i` (ordem de `os.projetos`): quantidade/remover, o lápis de cada peça e "Incluir peça". */
  projeto?: (i: number) => { acoes: React.ReactNode; peca: (codigo: string, porUnidade: number) => React.ReactNode; rodape?: React.ReactNode } | null;
  /** Linha dos totais por peça. */
  total?: (l: OsLinha) => React.ReactNode;
  /** Peça solta (somada por código). */
  solta?: (codigo: string) => React.ReactNode;
  /** Item fora do catálogo `i` (ordem de `os.semSetor`). */
  foraCatalogo?: (i: number) => React.ReactNode;
};

/** Coluna de ações das leituras: lápis (e lixeira) sempre no mesmo lugar, como na lista. */
const tdAcoes = "border-b border-line-row py-1.5 pl-2 pr-cartao text-right align-middle whitespace-nowrap";

export function visaoDe(v?: string): VisaoOs {
  return v === "projetos" || v === "individuais" || v === "composicao" ? v : "totais";
}

/* Células no padrão das tabelas: código mono discreto, nome no corpo, números tabulares à direita. */
const base = "border-b border-line-row py-2.5 align-top";
const td = `${base} px-3`;
const tdCodigo = `${base} hidden pl-cartao pr-3 text-pequeno text-ink-2 sm:table-cell`;
const tdNumero = `${td} numero text-right text-corpo text-ink-2`;
const tdTotal = `${base} numero pl-3 pr-cartao text-right text-corpo font-semibold text-ink`;

/** Uma origem da composição: "Tenda 3×3 m × 2: 8" (projeto × quantidade: peças). */
const origemTexto = (o: { descricao: string; quantidade: number }) => `${o.descricao}: ${o.quantidade.toLocaleString("pt-BR")}`;

const unidades = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "unidade" : "unidades"}`;

/** Total com a unidade da peça em cor de apoio. */
function Total({ n, unidade }: { n: number; unidade: string }) {
  return (
    <>
      {n.toLocaleString("pt-BR")} <span className="text-rotulo font-normal text-muted">{unidade}</span>
    </>
  );
}

/**
 * Três leituras da mesma OS: total por peça (carregar o caminhão), por projeto (montar) e peças soltas.
 * Serve tanto para uma versão gravada quanto para a prévia calculada da ata em construção.
 */
export function OsVisoes({
  os: osGravada,
  visao,
  hrefVisao,
  csvHref,
  grupos,
  titulo,
  composicao,
  semNavegacao = false,
  edicao,
}: {
  edicao?: EdicaoOs;
  os: OsConteudo;
  visao: VisaoOs;
  hrefVisao: (v: VisaoOs) => string;
  /** CSV de uma seção dos totais (grupo de material, ou setor quando não há mapa de grupos). */
  csvHref?: (secao: string) => string;
  /** Código → grupo de material: separa a OS como a lista da ata (Estrutura, Tendas, Ativação, Percurso, Arena). */
  grupos?: MapaGrupos;
  titulo: string;
  /** Quarta aba: os itens que compõem a OS (onde a logística ajusta depois da ata fechada). */
  composicao?: { n: number; conteudo: React.ReactNode; ajustavel?: boolean };
  /** Quem embute estas leituras com a própria navegação (visão geral do evento). */
  semNavegacao?: boolean;
}) {
  // O prisma comum são 2 grades, já somadas na grade: não sai como item próprio.
  const os = osParaLeitura(osGravada);
  return (
    <>
      {!semNavegacao && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Pills
            rotulo="Visão da OS"
            className="!flex-nowrap"
            itens={(
              [
                ["totais", "Totais por peça", os.setores.reduce((a, s) => a + s.linhas.length, 0)],
                ["projetos", "Por projeto", os.projetos?.length ?? 0],
                ["individuais", "Soltas e avulsos", individuaisAgrupadas(os.individuais ?? []).length + os.semSetor.length],
                ...(composicao ? ([["composicao", composicao.ajustavel ? "Itens · ajustar" : "Itens da OS", composicao.n]] as const) : []),
              ] as const
            ).map(([chave, rotulo, n]) => ({ label: rotulo, n: n >= 0 ? n : undefined, ativo: visao === chave, href: hrefVisao(chave) }))}
          />
        </div>
      )}

      {visao === "projetos" && (
        <>
          {!os.projetos && <Aviso tom="neutro">Esta versão da OS é anterior à visão por projeto. Abra a versão atual para ver.</Aviso>}
          {os.projetos?.length === 0 && (
            <Section>
              <EmptyState compact title="Nenhum projeto padrão nesta OS" description="Só peças soltas e itens fora do catálogo." />
            </Section>
          )}
          {os.projetos?.map((p, i) => {
            const ed = edicao?.projeto?.(i) ?? null;
            return (
            <Section
              key={`${p.codigo}-${i}`}
              acoes={ed?.acoes}
              titulo={
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span>{p.nome}</span>
                  <ChipMono>× {p.quantidade}</ChipMono>
                  <Codigo className="text-pequeno font-normal text-muted">
                    {p.codigo} · v{p.versao}
                  </Codigo>
                </span>
              }
              sub={[p.destino ? `Destino: ${p.destino}` : null, p.area, `${p.pecas.length} ${p.pecas.length === 1 ? "tipo de peça" : "tipos de peça"} · ${unidades(p.pecas.reduce((a, x) => a + x.total, 0))}`].filter(Boolean).join(" · ")}
            >
              <div className="overflow-x-auto">
                <table data-responsiva className="w-full border-collapse sm:min-w-[480px]">
                  <CaptionOculta>{`Peças de ${p.nome} × ${p.quantidade}`}</CaptionOculta>
                  <thead>
                    <tr>
                      <Th className="hidden sm:table-cell" largura={120}>
                        Código
                      </Th>
                      <Th className="max-sm:pl-cartao">Peça</Th>
                      <Th className="hidden md:table-cell" largura={150}>
                        {grupos ? "Material" : "Setor"}
                      </Th>
                      <Th className="hidden sm:table-cell" largura={96} alinhar="right">
                        Por un.
                      </Th>
                      <Th largura={110} alinhar="right">
                        Total
                      </Th>
                      {ed && (
                        <Th largura={64}>
                          <span className="sr-only">Ações</span>
                        </Th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {p.pecas.map((x) => (
                      <tr key={x.codigo} className="hover:bg-subtle">
                        <td className={tdCodigo}>
                          <Codigo>{x.codigo}</Codigo>
                        </td>
                        <th scope="row" className={`${td} text-left text-corpo font-normal text-ink max-sm:pl-cartao`}>
                          {x.nome}
                          <span className="mt-0.5 block text-rotulo text-muted md:hidden">
                            <Codigo className="sm:hidden">{x.codigo}</Codigo>
                            <span className="sm:hidden"> · </span>
                            {grupos ? GRUPO_LABEL[grupoDoCodigo(grupos, x.codigo, x.setor)] : SETOR_LABEL[x.setor]}
                            <span className="numero sm:hidden"> · {x.porUnidade} por un.</span>
                          </span>
                        </th>
                        <td className={`${td} hidden text-pequeno text-muted md:table-cell`}>{grupos ? GRUPO_LABEL[grupoDoCodigo(grupos, x.codigo, x.setor)] : SETOR_LABEL[x.setor]}</td>
                        <td className={`${tdNumero} hidden sm:table-cell`}>{x.porUnidade}</td>
                        <td className={ed ? tdTotal.replace("pr-cartao", "pr-3") : tdTotal}>
                          <Total n={x.total} unidade={x.unidade} />
                        </td>
                        {ed && <td className={tdAcoes}>{ed.peca(x.codigo, x.porUnidade)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ed?.rodape && <RodapeTabela direita={ed.rodape}>{null}</RodapeTabela>}
            </Section>
            );
          })}
        </>
      )}

      {visao === "individuais" && (
        <>
          {!os.individuais && <Aviso tom="neutro">Esta versão da OS é anterior à visão de peças soltas. Abra a versão atual para ver.</Aviso>}
          {os.individuais && os.individuais.length === 0 && os.semSetor.length === 0 && (
            <Section>
              <EmptyState compact title="Nenhuma peça pedida fora de projeto" description="Tudo nesta OS vem de projetos padrão." />
            </Section>
          )}
          {os.individuais && os.individuais.length > 0 && (
            <Section titulo="Peças do catálogo pedidas soltas" sub="Fora de projeto padrão, somadas por peça (com cada local). Também estão nos totais por peça.">
              <div className="overflow-x-auto">
                <table data-responsiva className="w-full border-collapse sm:min-w-[480px]">
                  <CaptionOculta>Peças soltas</CaptionOculta>
                  <thead>
                    <tr>
                      <Th className="hidden sm:table-cell" largura={120}>
                        Código
                      </Th>
                      <Th className="max-sm:pl-cartao">Peça</Th>
                      <Th className="hidden md:table-cell" largura={140}>
                        {grupos ? "Material" : "Setor"}
                      </Th>
                      <Th className="hidden sm:table-cell sm:w-[38%]">
                        Destino · área
                      </Th>
                      <Th largura={110} alinhar="right">
                        Qtd.
                      </Th>
                      {edicao?.solta && (
                        <Th largura={84}>
                          <span className="sr-only">Ações</span>
                        </Th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {individuaisAgrupadas(os.individuais).map((x) => (
                      <tr key={x.codigo} className="hover:bg-subtle">
                        <td className={tdCodigo}>
                          <Codigo>{x.codigo}</Codigo>
                        </td>
                        <th scope="row" className={`${td} text-left text-corpo font-normal text-ink max-sm:pl-cartao`}>
                          {x.nome}
                          <span className="mt-0.5 block text-rotulo text-muted md:hidden">
                            <Codigo className="sm:hidden">{x.codigo}</Codigo>
                            <span className="sm:hidden"> · </span>
                            {grupos ? GRUPO_LABEL[grupoDoCodigo(grupos, x.codigo, x.setor)] : SETOR_LABEL[x.setor]}
                          </span>
                          <span className="mt-0.5 block text-rotulo text-ink-2 sm:hidden">{textoLocais(x.locais)}</span>
                        </th>
                        <td className={`${td} hidden text-pequeno text-muted md:table-cell`}>{grupos ? GRUPO_LABEL[grupoDoCodigo(grupos, x.codigo, x.setor)] : SETOR_LABEL[x.setor]}</td>
                        <td className={`${td} hidden text-pequeno text-ink-2 sm:table-cell`}>{textoLocais(x.locais)}</td>
                        <td className={edicao?.solta ? tdTotal.replace("pr-cartao", "pr-3") : tdTotal}>
                          <Total n={x.quantidade} unidade={x.unidade} />
                        </td>
                        {edicao?.solta && <td className={tdAcoes}>{edicao.solta(x.codigo)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}

      {visao === "totais" &&
        (grupos ? totaisPorGrupo(os.setores, grupos).map((g) => ({ chave: g.grupo.toLowerCase(), rotulo: GRUPO_LABEL[g.grupo], linhas: g.linhas })) : os.setores.map((x) => ({ chave: x.setor as string, rotulo: SETOR_LABEL[x.setor], linhas: x.linhas }))).map((s) => {
          const soma = s.linhas.reduce((a, l) => a + l.total, 0);
          return (
            <Section
              key={s.chave}
              titulo={s.rotulo}
              sub={`${s.linhas.length} ${s.linhas.length === 1 ? "tipo de peça" : "tipos de peça"} · ${unidades(soma)}`}
              acoes={
                csvHref && (
                  <a href={csvHref(s.chave)} className={buttonClasses({ variant: "ghost", size: "sm", className: "no-underline" })} title={`Baixar ${s.rotulo} em CSV`}>
                    <Icone nome="download" />
                    CSV
                  </a>
                )
              }
            >
              <div className="overflow-x-auto">
                <table data-responsiva className="w-full border-collapse sm:min-w-[480px]">
                  <CaptionOculta>{`${titulo} · ${s.rotulo}`}</CaptionOculta>
                  <thead>
                    <tr>
                      <Th className="hidden sm:table-cell" largura={120}>
                        Código
                      </Th>
                      <Th className="max-sm:pl-cartao">Peça</Th>
                      <Th className="hidden md:table-cell md:w-[36%]">
                        Composição
                      </Th>
                      <Th largura={110} alinhar="right">
                        Total
                      </Th>
                      {edicao?.total && (
                        <Th largura={64}>
                          <span className="sr-only">Ações</span>
                        </Th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {s.linhas.map((l) => (
                      <tr key={l.pecaId} className="hover:bg-subtle">
                        <td className={tdCodigo}>
                          <Codigo>{l.codigo}</Codigo>
                        </td>
                        <th scope="row" className={`${td} text-left text-corpo font-normal text-ink max-sm:pl-cartao sm:min-w-[180px]`}>
                          {l.nome}
                          <span className="mt-0.5 block text-rotulo text-muted md:hidden">
                            <Codigo className="block sm:hidden">{l.codigo}</Codigo>
                            <span className="line-clamp-2">{l.origens.map(origemTexto).join(" · ")}</span>
                          </span>
                        </th>
                        {/* Composição quebra em até 2 linhas (inteira no título): antes, sem quebra, espremia o nome e escondia o total. */}
                        <td className={`${td} hidden text-pequeno text-muted md:table-cell`}>
                          <span className="line-clamp-2" title={l.origens.map(origemTexto).join(" · ")}>
                            {l.origens.map((o, i) => (
                              <span key={i}>
                                {i > 0 && <span aria-hidden> · </span>}
                                {o.descricao}: <span className="numero font-medium text-ink-2">{o.quantidade.toLocaleString("pt-BR")}</span>
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className={edicao?.total ? tdTotal.replace("pr-cartao", "pr-3") : tdTotal}>
                          <Total n={l.total} unidade={l.unidade} />
                        </td>
                        {edicao?.total && <td className={tdAcoes}>{edicao.total(l)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          );
        })}

      {visao === "totais" && os.setores.length === 0 && (
        <Section>
          <EmptyState compact title="Nenhuma peça nesta versão" description="A ata não tem linhas que somem peças do catálogo." />
        </Section>
      )}

      {visao === "composicao" && composicao?.conteudo}

      {(visao === "totais" || visao === "individuais") && os.semSetor.length > 0 && (
        <Section titulo="Itens fora do catálogo" sub="Sem peça de catálogo: separação manual, fora da soma por peça.">
          <div className="overflow-x-auto">
            <table data-responsiva className="w-full border-collapse sm:min-w-[480px]">
              <CaptionOculta>Itens fora do catálogo</CaptionOculta>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th className="hidden sm:table-cell sm:w-[36%]">
                    Destino · área
                  </Th>
                  <Th largura={90} alinhar="right">
                    Qtd.
                  </Th>
                  {edicao?.foraCatalogo && (
                    <Th largura={84}>
                      <span className="sr-only">Ações</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {os.semSetor.map((a, i) => (
                  <tr key={i} className="hover:bg-subtle">
                    <th scope="row" className={`${base} pl-cartao pr-3 text-left text-corpo font-normal text-ink`}>
                      {a.descricao}
                      <span className="mt-0.5 block text-rotulo text-muted sm:hidden">{[a.destino, a.area].filter(Boolean).join(" · ")}</span>
                    </th>
                    <td className={`${td} hidden text-pequeno text-ink-2 sm:table-cell`}>{[a.destino, a.area].filter(Boolean).join(" · ") || "—"}</td>
                    <td className={edicao?.foraCatalogo ? tdTotal.replace("pr-cartao", "pr-3") : tdTotal}>{a.quantidade.toLocaleString("pt-BR")}</td>
                    {edicao?.foraCatalogo && <td className={tdAcoes}>{edicao.foraCatalogo(i)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RodapeTabela>
            {os.semSetor.length} {os.semSetor.length === 1 ? "item" : "itens"} · <span className="numero">{unidades(os.semSetor.reduce((a, x) => a + x.quantidade, 0))}</span>
          </RodapeTabela>
        </Section>
      )}
    </>
  );
}
