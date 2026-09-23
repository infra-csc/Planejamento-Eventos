import { SETOR_LABEL } from "@/domain/os";
import type { OsConteudo, Setor } from "@/server/db/schema";
import { buttonClasses } from "@/components/ui/button-classes";
import { ChipMono } from "@/components/ui/badge";
import { Aviso, EmptyState, Section } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { CaptionOculta, Th } from "@/components/ui/tabela";

export type VisaoOs = "totais" | "projetos" | "individuais" | "composicao";

export function visaoDe(v?: string): VisaoOs {
  return v === "projetos" || v === "individuais" || v === "composicao" ? v : "totais";
}

/**
 * Três leituras da mesma OS: total por peça (carregar o caminhão), por projeto (montar) e peças soltas.
 * Serve tanto para uma versão gravada quanto para a prévia calculada da ata em construção.
 */
export function OsVisoes({
  os,
  visao,
  hrefVisao,
  csvHref,
  titulo,
  composicao,
  semNavegacao = false,
}: {
  os: OsConteudo;
  visao: VisaoOs;
  hrefVisao: (v: VisaoOs) => string;
  csvHref?: (setor: Setor) => string;
  titulo: string;
  /** Quarta aba: os itens que compõem a OS (onde a logística ajusta depois da ata fechada). */
  composicao?: { n: number; conteudo: React.ReactNode; ajustavel?: boolean };
  /** Quem embute estas leituras com a própria navegação (visão geral do evento). */
  semNavegacao?: boolean;
}) {
  return (
    <>
      {!semNavegacao && (
      <Pills
        rotulo="Visão da OS"
        itens={(
          [
            ["totais", "Totais por peça", os.setores.reduce((a, s) => a + s.linhas.length, 0)],
            ["projetos", "Por projeto", os.projetos?.length ?? 0],
            ["individuais", "Peças e itens soltos", (os.individuais?.length ?? 0) + os.semSetor.length],
            ...(composicao ? ([["composicao", composicao.ajustavel ? "Itens da OS · ajustar" : "Itens da OS", composicao.n]] as const) : []),
          ] as const
        ).map(([chave, rotulo, n]) => ({ label: rotulo, n: n >= 0 ? n : undefined, ativo: visao === chave, href: hrefVisao(chave) }))}
      />
      )}

      {visao === "projetos" && (
        <>
          {!os.projetos && <Aviso tom="neutro">Esta versão da OS é anterior à visão por projeto. Abra a versão atual para ver.</Aviso>}
          {os.projetos?.length === 0 && (
            <Section>
              <EmptyState compact title="Nenhum projeto padrão nesta OS" description="Só peças soltas e itens fora do catálogo." />
            </Section>
          )}
          {os.projetos?.map((p, i) => (
            <Section
              key={`${p.codigo}-${i}`}
              titulo={
                <span className="flex flex-wrap items-baseline gap-2">
                  <span>{p.nome}</span>
                  <span className="font-mono text-pequeno font-normal text-muted">
                    {p.codigo} · v{p.versao}
                  </span>
                  <ChipMono tom="dark">× {p.quantidade}</ChipMono>
                </span>
              }
              sub={[p.destino ? `Destino: ${p.destino}` : null, p.area, `${p.pecas.length} ${p.pecas.length === 1 ? "tipo de peça" : "tipos de peça"} · ${p.pecas.reduce((a, x) => a + x.total, 0)} unidades no total`].filter(Boolean).join(" · ")}
            >
              {/* Rolagem própria no celular: sem ela, colunas como Total ficavam cortadas pelo cartão. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <CaptionOculta>{`Peças de ${p.nome} × ${p.quantidade}`}</CaptionOculta>
                  <thead>
                    <tr className="bg-subtle">
                      <Th largura={108}>Código</Th>
                      <Th>Peça</Th>
                      <Th largura={150}>Setor</Th>
                      <Th largura={110} alinhar="right">
                        Por unidade
                      </Th>
                      <Th largura={90} alinhar="right">
                        Total
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.pecas.map((x) => (
                      <tr key={x.codigo} className="hover:bg-subtle">
                        <td className="border-b border-line-row px-cartao py-2 font-mono text-pequeno text-ink">{x.codigo}</td>
                        <th scope="row" className="border-b border-line-row px-2.5 py-2 text-left text-corpo font-normal text-ink">
                          {x.nome}
                        </th>
                        <td className="border-b border-line-row px-2.5 py-2 text-pequeno text-muted">{SETOR_LABEL[x.setor]}</td>
                        <td className="border-b border-line-row px-2.5 py-2 text-right font-mono text-pequeno text-ink-2">{x.porUnidade}</td>
                        <td className="border-b border-line-row py-2 pl-2.5 pr-cartao text-right font-mono text-corpo font-semibold">
                          {x.total} <span className="text-rotulo font-normal text-muted">{x.unidade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ))}
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
            <Section titulo="Peças do catálogo pedidas soltas" sub="Fora de projeto padrão. Também estão somadas nos totais por peça.">
              {/* Rolagem própria no celular: sem ela, colunas como Total ficavam cortadas pelo cartão. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <CaptionOculta>Peças soltas</CaptionOculta>
                  <thead>
                    <tr className="bg-subtle">
                      <Th largura={108}>Código</Th>
                      <Th>Peça</Th>
                      <Th largura={150}>Setor</Th>
                      <Th largura={200}>Destino · área</Th>
                      <Th largura={90} alinhar="right">
                        Qtd.
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {os.individuais.map((x, i) => (
                      <tr key={`${x.codigo}-${i}`} className="hover:bg-subtle">
                        <td className="border-b border-line-row px-cartao py-2 font-mono text-pequeno text-ink">{x.codigo}</td>
                        <th scope="row" className="border-b border-line-row px-2.5 py-2 text-left text-corpo font-normal text-ink">
                          {x.nome}
                        </th>
                        <td className="border-b border-line-row px-2.5 py-2 text-pequeno text-muted">{SETOR_LABEL[x.setor]}</td>
                        <td className="border-b border-line-row px-2.5 py-2 text-pequeno text-muted">{[x.destino, x.area].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="border-b border-line-row py-2 pl-2.5 pr-cartao text-right font-mono text-corpo font-semibold">
                          {x.quantidade} <span className="text-rotulo font-normal text-muted">{x.unidade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}

      {visao === "totais" && os.setores.map((s) => {
        const unidades = s.linhas.reduce((a, l) => a + l.total, 0);
        return (
          <Section
            key={s.setor}
            titulo={SETOR_LABEL[s.setor]}
            sub={`${s.linhas.length} ${s.linhas.length === 1 ? "tipo de peça" : "tipos de peça"} · ${unidades} unidades`}
            acoes={
              csvHref && (
                <a href={csvHref(s.setor)} className={buttonClasses({ variant: "secondary", size: "sm", className: "no-underline" })}>
                CSV
              </a>
              )
            }
          >
            {/* Rolagem própria no celular: sem ela, colunas como Total ficavam cortadas pelo cartão. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <CaptionOculta>{`${titulo} · ${SETOR_LABEL[s.setor]}`}</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    <Th largura={108}>Código</Th>
                    <Th>Peça</Th>
                    <Th largura={260}>Origens</Th>
                    <Th largura={90} alinhar="right">
                      Total
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {s.linhas.map((l) => (
                    <tr key={l.pecaId} className="hover:bg-subtle">
                      <td className="border-b border-line-row px-cartao py-2.5 font-mono text-pequeno text-ink">{l.codigo}</td>
                      <th scope="row" className="border-b border-line-row px-2.5 py-2.5 text-left text-corpo font-normal text-ink">
                        {l.nome}
                      </th>
                      <td className="border-b border-line-row px-2.5 py-2.5 text-rotulo leading-[1.45] text-muted">{l.origens.map((o) => `${o.descricao} → ${o.quantidade}`).join(" · ")}</td>
                      <td className="border-b border-line-row py-2.5 pl-2.5 pr-cartao text-right font-mono text-corpo font-semibold">
                        {l.total} <span className="text-rotulo font-normal text-muted">{l.unidade}</span>
                      </td>
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
        <Section titulo="Itens fora do catálogo" sub="Sem peça de catálogo. Separação manual; não entram na soma por peça.">
          {os.semSetor.map((a, i) => (
            <div key={i} className="flex items-baseline gap-3 border-b border-line-row px-cartao py-2.5 last:border-b-0">
              <span className="min-w-0 flex-1 text-corpo text-ink">{a.descricao}</span>
              <span className="text-pequeno text-muted">{[a.destino, a.area].filter(Boolean).join(" · ")}</span>
              <span className="w-[60px] text-right font-mono text-corpo font-semibold">{a.quantidade}</span>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
