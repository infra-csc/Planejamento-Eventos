import { requirePermissao } from "@/server/auth/session";
import { listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { obterEventoCache } from "@/server/cache";
import { diffOS, resumoVersaoOs, SETOR_LABEL, type DiffLinha } from "@/domain/os";
import { diaMesHora } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Section } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { VersoesOs, type VersaoOsView } from "@/components/eventos/versoes-os";
import type { OsGatilho } from "@/server/db/schema";

const GATILHO_LABEL: Record<OsGatilho, string> = {
  ATA_FECHADA: "ata fechada",
  RESPOSTA_SOLICITACAO: "alteração",
  CORRECAO_RESPOSTA: "correção",
  AJUSTE_LOGISTICA: "ajuste",
  ATUALIZACAO_PROJETO: "projeto",
  REABERTURA: "reabertura",
  ENCERRAMENTO: "OS final",
};

function ChipDiff({ d }: { d: DiffLinha }) {
  const delta = d.depois - d.antes;
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-[6px] bg-dark-3 px-2.5 py-1 font-mono text-[12px]" title={d.nome}>
      <span className="text-on-dark-2">{d.codigo}</span>
      <span className="text-on-dark-4">{d.antes}</span>
      <span className="text-on-dark-4" aria-hidden>
        →
      </span>
      <span className="sr-only">para</span>
      <span className="font-semibold text-white">{d.depois}</span>
      <span className="text-accent-light">
        {delta > 0 ? "+" : "−"}
        {Math.abs(delta)}
      </span>
    </span>
  );
}

export default async function OsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; base?: string }> }) {
  const usuario = await requirePermissao("os.ver");
  const { id } = await params;
  const sp = await searchParams;
  const [ev, versoes] = await Promise.all([obterEventoCache(usuario, id), listarOsResumo(id)]);

  if (versoes.length === 0) {
    return (
      <div className="rounded-[10px] border border-line bg-surface px-[18px] py-14 text-center">
        <p className="m-0 text-[14px] font-medium">OS ainda não gerada</p>
        <p className="mx-auto mt-1 max-w-[440px] text-[13px] text-muted">A OS é gerada automaticamente quando a ata for fechada. Nenhuma peça é somada antes disso.</p>
      </div>
    );
  }

  const atual = versoes[0];
  const exibida = versoes.find((x) => String(x.numero) === sp.v) ?? atual;
  const base = sp.base && sp.base !== String(exibida.numero) ? versoes.find((x) => String(x.numero) === sp.base) : undefined;
  const existe = (n: number) => versoes.some((x) => x.numero === n);

  // Só o JSON das versões exibidas; versões antigas sem resumo gravado carregam tudo uma vez.
  const legado = versoes.some((v) => v.resumo == null);
  const conteudos = await obterConteudosOs(id, legado ? versoes.map((v) => v.numero) : [exibida.numero, exibida.numero - 1, ...(base ? [base.numero] : [])]);
  const conteudo = (n: number) => conteudos.get(n) ?? null;
  const os = conteudo(exibida.numero) ?? { setores: [], semSetor: [] };

  let tituloDiff: string;
  let subDiff: string;
  let diff: DiffLinha[];
  if (base) {
    const [menor, maior] = base.numero < exibida.numero ? [base, exibida] : [exibida, base];
    const a = conteudo(menor.numero);
    const b = conteudo(maior.numero);
    diff = a && b ? diffOS(a, b) : [];
    tituloDiff = `Diferença entre v${menor.numero} e v${maior.numero}`;
    const n = maior.numero - menor.numero;
    subDiff = `Soma de ${n} ${n === 1 ? "alteração" : "alterações"} no intervalo`;
  } else {
    const ant = existe(exibida.numero - 1) ? conteudo(exibida.numero - 1) : null;
    diff = ant ? diffOS(ant, os) : [];
    tituloDiff = ant ? `O que mudou na v${exibida.numero}` : `v${exibida.numero} · primeira versão`;
    subDiff = exibida.descricao ?? GATILHO_LABEL[exibida.gatilho];
  }

  const paramsAtuais = { v: sp.v, base: sp.base };
  const qsExport = exibida.numero !== atual.numero ? `?v=${exibida.numero}` : "";

  const lista: VersaoOsView[] = versoes.map((ver) => {
    const c = conteudo(ver.numero);
    return {
      numero: ver.numero,
      gatilho: GATILHO_LABEL[ver.gatilho],
      quando: diaMesHora(ver.geradaEm),
      autor: ver.geradaPor?.nome ?? "Sistema",
      descricao: ver.descricao,
      resumo: ver.resumo ?? (c ? resumoVersaoOs(conteudo(ver.numero - 1), c) : ""),
      exibida: ver.id === exibida.id,
      base: ver.id === base?.id,
      atual: ver.id === atual.id,
      hrefVer: hrefCom(`/eventos/${id}/os`, paramsAtuais, { v: ver.numero === atual.numero ? null : ver.numero, base: sp.base === String(ver.numero) ? null : sp.base }),
      hrefComparar: hrefCom(`/eventos/${id}/os`, paramsAtuais, { base: ver.numero }),
      hrefLimpar: hrefCom(`/eventos/${id}/os`, paramsAtuais, { base: null }),
    };
  });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="flex flex-col gap-5">
        <section className="rounded-[10px] bg-dark px-5 py-4" aria-label="Diferenças da OS">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[14.5px] font-semibold text-white">{tituloDiff}</h2>
              <p className="mb-0 mt-0.5 text-[12.5px] text-on-dark-3">{subDiff}</p>
            </div>
            {base && (
              <ButtonLink href={hrefCom(`/eventos/${id}/os`, paramsAtuais, { base: null })} variant="onDark" size="sm" className="no-underline" scroll={false}>
                Sair da comparação
              </ButtonLink>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {diff.length === 0 ? <span className="text-[12.5px] text-on-dark-4">{existe(exibida.numero - 1) || base ? "Nenhuma quantidade de peça mudou." : "Base inicial gerada no fechamento da ata."}</span> : diff.map((d) => <ChipDiff key={d.codigo} d={d} />)}
          </div>
        </section>

        {os.setores.map((s) => {
          const unidades = s.linhas.reduce((a, l) => a + l.total, 0);
          return (
            <Section
              key={s.setor}
              titulo={SETOR_LABEL[s.setor]}
              sub={`${s.linhas.length} ${s.linhas.length === 1 ? "tipo de peça" : "tipos de peça"} · ${unidades} unidades`}
              acoes={
                <a href={`/api/os/${id}/${s.setor}${qsExport}`} className={buttonClasses({ variant: "secondary", size: "sm", className: "no-underline" })}>
                  CSV
                </a>
              }
            >
              <table className="w-full border-collapse">
                <CaptionOculta>{`OS ${SETOR_LABEL[s.setor]} v${exibida.numero}`}</CaptionOculta>
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

        {os.setores.length === 0 && (
          <div className="rounded-[10px] border border-line bg-surface px-[18px] py-10 text-center">
            <p className="m-0 text-[13.5px] font-medium">Nenhuma peça nesta versão</p>
            <p className="mt-1 text-[12.5px] text-muted">A ata não tem linhas que somem peças do catálogo.</p>
          </div>
        )}

        {os.semSetor.length > 0 && (
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
      </div>

      <div className="lg:sticky lg:top-[76px] flex flex-col gap-5">
        <Section titulo="Exportar">
          <div className="px-[18px] py-3.5">
            <ButtonLink href={`/impressao/os/${id}${qsExport}`} target="_blank" variant="secondary" size="md" className="w-full no-underline">
              Imprimir / PDF
            </ButtonLink>
            <p className="mb-0 mt-2.5 text-[12px] leading-[1.5] text-muted">A OS nunca é editada à mão. Toda mudança vem de uma resposta a item ou de um ajuste registrado com justificativa.</p>
          </div>
        </Section>
        <Section titulo="Versões" sub={`${versoes.length} ${versoes.length === 1 ? "versão" : "versões"} · ${ev.codigo}`}>
          <VersoesOs versoes={lista} />
        </Section>
      </div>
    </div>
  );
}
