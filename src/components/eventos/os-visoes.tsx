import Link from "next/link";
import { cn } from "@/lib/cn";
import { SETOR_LABEL } from "@/domain/os";
import type { OsConteudo, Setor } from "@/server/db/schema";
import { buttonClasses } from "@/components/ui/button-classes";
import { Aviso, Section } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";

export type VisaoOs = "totais" | "projetos" | "individuais";

export function visaoDe(v?: string): VisaoOs {
  return v === "projetos" || v === "individuais" ? v : "totais";
}

/**
 * Três leituras da mesma OS: total por peça (carregar o caminhão), por projeto (montar) e peças soltas.
 * Serve tanto para uma versão gravada quanto para a prévia calculada da ata em construção.
 */
export function OsVisoes({ os, visao, hrefVisao, csvHref, titulo }: { os: OsConteudo; visao: VisaoOs; hrefVisao: (v: VisaoOs) => string; csvHref?: (setor: Setor) => string; titulo: string }) {
  return (
    <>
      <nav aria-label="Visão da OS" className="flex flex-wrap gap-1 rounded-[10px] border border-line bg-surface p-1">
        {(
          [
            ["totais", "Totais por peça", os.setores.reduce((a, s) => a + s.linhas.length, 0)],
            ["projetos", "Por projeto", os.projetos?.length ?? 0],
            ["individuais", "Peças e itens soltos", (os.individuais?.length ?? 0) + os.semSetor.length],
          ] as const
        ).map(([chave, rotulo, n]) => (
          <Link
            key={chave}
            href={hrefVisao(chave)}
            scroll={false}
            aria-current={visao === chave ? "page" : undefined}
            className={cn("flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] no-underline", visao === chave ? "bg-dark font-medium text-white" : "text-ink-2 hover:bg-subtle")}
          >
            {rotulo}
            <span className={cn("rounded-[4px] px-1.5 font-mono text-[11px]", visao === chave ? "bg-dark-3 text-on-dark-2" : "bg-control text-ink-3")}>{n}</span>
          </Link>
        ))}
      </nav>

      {visao === "projetos" && (
        <>
          {!os.projetos && <Aviso tom="neutro">Esta versão da OS é anterior à visão por projeto. Abra a versão atual para ver.</Aviso>}
          {os.projetos?.length === 0 && (
            <div className="rounded-[10px] border border-line bg-surface px-[18px] py-10 text-center">
              <p className="m-0 text-[13.5px] font-medium">Nenhum projeto padrão nesta OS</p>
              <p className="mt-1 text-[12.5px] text-muted">Só peças soltas e itens avulsos.</p>
            </div>
          )}
          {os.projetos?.map((p, i) => (
            <Section
              key={`${p.codigo}-${i}`}
              titulo={
                <span className="flex flex-wrap items-baseline gap-2">
                  <span>{p.nome}</span>
                  <span className="font-mono text-[12.5px] font-normal text-muted">
                    {p.codigo} · v{p.versao}
                  </span>
                  <span className="rounded-[5px] bg-dark px-2 py-px font-mono text-[12px] text-accent-light">× {p.quantidade}</span>
                </span>
              }
              sub={[p.destino ? `Destino: ${p.destino}` : null, p.area, `${p.pecas.length} ${p.pecas.length === 1 ? "tipo de peça" : "tipos de peça"} · ${p.pecas.reduce((a, x) => a + x.total, 0)} unidades no total`].filter(Boolean).join(" · ")}
            >
              <table className="w-full border-collapse">
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
                      <td className="border-b border-line-row px-[18px] py-2 font-mono text-[12.5px] text-ink">{x.codigo}</td>
                      <th scope="row" className="border-b border-line-row px-2.5 py-2 text-left text-[13px] font-normal text-ink">
                        {x.nome}
                      </th>
                      <td className="border-b border-line-row px-2.5 py-2 text-[12px] text-muted">{SETOR_LABEL[x.setor]}</td>
                      <td className="border-b border-line-row px-2.5 py-2 text-right font-mono text-[12.5px] text-ink-2">{x.porUnidade}</td>
                      <td className="border-b border-line-row py-2 pl-2.5 pr-[18px] text-right font-mono text-[13.5px] font-semibold">
                        {x.total} <span className="text-[11px] font-normal text-muted">{x.unidade}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ))}
        </>
      )}

      {visao === "individuais" && (
        <>
          {!os.individuais && <Aviso tom="neutro">Esta versão da OS é anterior à visão de peças soltas. Abra a versão atual para ver.</Aviso>}
          {os.individuais && os.individuais.length === 0 && os.semSetor.length === 0 && (
            <div className="rounded-[10px] border border-line bg-surface px-[18px] py-10 text-center">
              <p className="m-0 text-[13.5px] font-medium">Nenhuma peça pedida fora de projeto</p>
              <p className="mt-1 text-[12.5px] text-muted">Tudo nesta OS vem de projetos padrão.</p>
            </div>
          )}
          {os.individuais && os.individuais.length > 0 && (
            <Section titulo="Peças do catálogo pedidas soltas" sub="Fora de projeto padrão. Também estão somadas nos totais por peça.">
              <table className="w-full border-collapse">
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
                      <td className="border-b border-line-row px-[18px] py-2 font-mono text-[12.5px] text-ink">{x.codigo}</td>
                      <th scope="row" className="border-b border-line-row px-2.5 py-2 text-left text-[13px] font-normal text-ink">
                        {x.nome}
                      </th>
                      <td className="border-b border-line-row px-2.5 py-2 text-[12px] text-muted">{SETOR_LABEL[x.setor]}</td>
                      <td className="border-b border-line-row px-2.5 py-2 text-[12px] text-muted">{[x.destino, x.area].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="border-b border-line-row py-2 pl-2.5 pr-[18px] text-right font-mono text-[13.5px] font-semibold">
                        {x.quantidade} <span className="text-[11px] font-normal text-muted">{x.unidade}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <table className="w-full border-collapse">
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
                    <td className="border-b border-line-row px-[18px] py-2.5 font-mono text-[12.5px] text-ink">{l.codigo}</td>
                    <th scope="row" className="border-b border-line-row px-2.5 py-2.5 text-left text-[13.5px] font-normal text-ink">
                      {l.nome}
                    </th>
                    <td className="border-b border-line-row px-2.5 py-2.5 text-[11.5px] leading-[1.45] text-muted">{l.origens.map((o) => `${o.descricao} → ${o.quantidade}`).join(" · ")}</td>
                    <td className="border-b border-line-row py-2.5 pl-2.5 pr-[18px] text-right font-mono text-[13.5px] font-semibold">
                      {l.total} <span className="text-[11px] font-normal text-muted">{l.unidade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        );
      })}

      {visao === "totais" && os.setores.length === 0 && (
        <div className="rounded-[10px] border border-line bg-surface px-[18px] py-10 text-center">
          <p className="m-0 text-[13.5px] font-medium">Nenhuma peça nesta versão</p>
          <p className="mt-1 text-[12.5px] text-muted">A ata não tem linhas que somem peças do catálogo.</p>
        </div>
      )}

      {visao !== "projetos" && os.semSetor.length > 0 && (
        <Section titulo="Itens avulsos" sub="Sem peça de catálogo. Separação manual; não entram na soma por peça.">
          {os.semSetor.map((a, i) => (
            <div key={i} className="flex items-baseline gap-3 border-b border-line-row px-[18px] py-2.5 last:border-b-0">
              <span className="min-w-0 flex-1 text-[13.5px] text-ink">{a.descricao}</span>
              <span className="text-[12px] text-muted">{[a.destino, a.area].filter(Boolean).join(" · ")}</span>
              <span className="w-[60px] text-right font-mono text-[13px] font-semibold">{a.quantidade}</span>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
