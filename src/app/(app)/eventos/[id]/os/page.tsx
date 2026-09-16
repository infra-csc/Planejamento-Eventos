import { requirePermissao } from "@/server/auth/session";
import { calcularOsAoVivo, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { obterEventoCache } from "@/server/cache";
import { diffOS, resumoVersaoOs, type DiffLinha } from "@/domain/os";
import { diaMesHora } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { Aviso, Section } from "@/components/ui/layout";
import { OsVisoes, visaoDe } from "@/components/eventos/os-visoes";
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

export default async function OsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; base?: string; visao?: string }> }) {
  const usuario = await requirePermissao("os.ver");
  const { id } = await params;
  const sp = await searchParams;
  const [ev, versoes] = await Promise.all([obterEventoCache(usuario, id), listarOsResumo(id)]);

  if (versoes.length === 0) {
    // Antes do fechamento da ata, a logística confere o que a OS vai conter: mesma leitura, calculada ao vivo da ata em construção.
    const previa = await calcularOsAoVivo(id);
    const visao = visaoDe(sp.visao);
    const temAlgo = previa.setores.length > 0 || previa.semSetor.length > 0;
    return (
      <div className="flex flex-col gap-5">
        <Aviso tom="warning" titulo="Prévia — a OS ainda não foi gerada">
          Esta é a leitura atual da ata em construção. A OS v1 é gerada no fechamento da ata; até lá, tudo aqui pode mudar conforme a reunião corrige as linhas.
        </Aviso>
        {temAlgo ? (
          <OsVisoes os={previa} visao={visao} titulo="Prévia da OS" hrefVisao={(v) => hrefCom(`/eventos/${id}/os`, { visao: sp.visao }, { visao: v === "totais" ? null : v })} />
        ) : (
          <div className="rounded-[10px] border border-line bg-surface px-[18px] py-14 text-center">
            <p className="m-0 text-[14px] font-medium">A ata ainda não tem linhas</p>
            <p className="mx-auto mt-1 max-w-[440px] text-[13px] text-muted">As solicitações pré-reunião entram na ata automaticamente e aparecem aqui como prévia da OS.</p>
          </div>
        )}
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
  // Versões gravadas antes das visões por projeto/peças soltas: a versão atual é recalculada ao vivo (mesmas linhas da ata).
  const gravado = conteudo(exibida.numero);
  const os = gravado && !gravado.projetos && exibida.numero === atual.numero ? await calcularOsAoVivo(id) : (gravado ?? { setores: [], semSetor: [] });

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

  const paramsAtuais = { v: sp.v, base: sp.base, visao: sp.visao };
  const visao = visaoDe(sp.visao);
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

        <OsVisoes os={os} visao={visao} titulo={`OS v${exibida.numero}`} hrefVisao={(v) => hrefCom(`/eventos/${id}/os`, paramsAtuais, { visao: v === "totais" ? null : v })} csvHref={(setor) => `/api/os/${id}/${setor}${qsExport}`} />
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
