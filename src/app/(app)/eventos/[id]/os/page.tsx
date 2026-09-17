import { requirePermissao } from "@/server/auth/session";
import { calcularOsAoVivo, complementoOs, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { EnvioOs } from "@/components/eventos/envio-os";
import { obterEventoCache } from "@/server/cache";
import { diffOS, resumoVersaoOs, type DiffLinha } from "@/domain/os";
import { diaMesHora } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { ChipMono } from "@/components/ui/badge";
import { Aviso, BannerEscuro, EmptyState, Section } from "@/components/ui/layout";
import { buttonClasses } from "@/components/ui/button-classes";
import { OsVisoes, visaoDe } from "@/components/eventos/os-visoes";
import { AtaLista } from "@/components/eventos/ata-lista";
import { paraView } from "@/components/eventos/ata-view";
import { obterLinhasAta, opcoesReferenciasResumidas } from "@/server/services/eventos";
import { listarAreas } from "@/server/services/admin";
import { pode } from "@/domain/permissions";
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
    <ChipMono tom="dark" className="gap-1.5 bg-dark-3 px-2.5 py-1">
      <span className="text-on-dark-2" title={d.nome}>
        {d.codigo}
      </span>
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
    </ChipMono>
  );
}

export default async function OsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; base?: string; visao?: string }> }) {
  const usuario = await requirePermissao("os.ver");
  const { id } = await params;
  const sp = await searchParams;
  const [ev, versoes, complemento] = await Promise.all([obterEventoCache(usuario, id), listarOsResumo(id), complementoOs(id)]);

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
        {temAlgo && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/os/${id}/excel`} className={buttonClasses({ variant: "secondary", size: "sm", className: "no-underline" })}>
              Excel da prévia (.xlsx)
            </a>
            <ButtonLink href={`/impressao/os/${id}`} target="_blank" variant="secondary" size="sm" className="no-underline">
              Imprimir prévia
            </ButtonLink>
          </div>
        )}
        {temAlgo ? (
          <OsVisoes os={previa} visao={visao} titulo="Prévia da OS" hrefVisao={(v) => hrefCom(`/eventos/${id}/os`, { visao: sp.visao }, { visao: v === "totais" ? null : v })} />
        ) : (
          <Section>
            <EmptyState title="A ata ainda não tem linhas" description="As solicitações pré-reunião entram na ata automaticamente e aparecem aqui como prévia da OS." />
          </Section>
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
  // Itens que compõem a OS: é aqui, e não na ata, que a logística ajusta depois da reunião.
  const podeAjustar = pode(usuario, "ata.ajustar") && ev.status === "ABERTO";
  let composicao: { n: number; conteudo: React.ReactNode; ajustavel?: boolean } | undefined;
  if (visao === "composicao") {
    const [linhasOs, opcoes, areas] = await Promise.all([obterLinhasAta(id), podeAjustar ? opcoesReferenciasResumidas() : Promise.resolve({ projetos: [], pecas: [] }), podeAjustar ? listarAreas() : Promise.resolve([])]);
    composicao = {
      n: linhasOs.length,
      ajustavel: podeAjustar,
      conteudo: (
        <Section
          titulo="Itens que compõem a OS"
          sub={podeAjustar ? "Ata da reunião + alterações atendidas + ajustes. Ajustar ou incluir exige justificativa, avisa a área e gera nova versão da OS. A ata não muda." : "Ata da reunião + alterações atendidas + ajustes da logística."}
        >
          <AtaLista eventoId={id} status={ev.status} editavel={podeAjustar} contexto="os" podeCadastrar={pode(usuario, "catalogo.gerenciar")} opcoes={opcoes} areas={areas.map((a) => ({ id: a.id, nome: a.nome }))} linhas={linhasOs.map(paraView)} dataReuniao={diaMesHora(ev.dataReuniao)} />
        </Section>
      ),
    };
  } else {
    // Fora desta aba não carrega a lista: a contagem aparece só quando a aba está aberta.
    composicao = { n: -1, conteudo: null };
  }
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
        <BannerEscuro
          aria-label="Diferenças da OS"
          className="items-start"
          titulo={tituloDiff}
          acoes={
            base && (
              <ButtonLink href={hrefCom(`/eventos/${id}/os`, paramsAtuais, { base: null })} variant="onDark" size="sm" className="no-underline" scroll={false}>
                Sair da comparação
              </ButtonLink>
            )
          }
        >
          <p className="m-0 text-pequeno">{subDiff}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {diff.length === 0 ? <span className="text-pequeno text-on-dark-4">{existe(exibida.numero - 1) || base ? "Nenhuma quantidade de peça mudou." : "Base inicial gerada no fechamento da ata."}</span> : diff.map((d) => <ChipDiff key={d.codigo} d={d} />)}
          </div>
        </BannerEscuro>

        <OsVisoes
          os={os}
          visao={visao}
          titulo={`OS v${exibida.numero}`}
          hrefVisao={(v) => hrefCom(`/eventos/${id}/os`, paramsAtuais, { visao: v === "totais" ? null : v })}
          csvHref={(setor) => `/api/os/${id}/${setor}${qsExport}`}
          composicao={composicao}
        />
      </div>

      <div className="lg:sticky lg:top-[76px] flex flex-col gap-5">
        <Section titulo="Envio ao carregamento" sub={complemento ? `Enviada: v${complemento.numero}` : "Ainda não enviada"}>
          <EnvioOs
            eventoId={id}
            versaoAtual={atual.numero}
            podeEnviar={pode(usuario, "ata.ajustar") && (ev.status === "ABERTO" || ev.status === "ENCERRADO")}
            enviada={complemento ? { numero: complemento.numero, enviadaEm: diaMesHora(complemento.enviadaEm), enviadaPor: complemento.enviadaPor, diff: complemento.diff.map((d) => ({ codigo: d.codigo, nome: d.nome, antes: d.antes, depois: d.depois })), avulsosNovos: complemento.avulsosNovos.length } : null}
          />
        </Section>
        <Section titulo="Exportar">
          <div className="px-[18px] py-3.5">
            <a href={`/api/os/${id}/excel${qsExport}`} className={buttonClasses({ variant: "primary", size: "md", className: "w-full no-underline" })}>
              Excel completo (.xlsx)
            </a>
            <p className="mb-2.5 mt-1.5 text-rotulo leading-[1.45] text-muted">Abas: resumo, totais por peça, por projeto, peças soltas e itens avulsos, com coluna de separação.</p>
            <ButtonLink href={`/impressao/os/${id}${qsExport}`} target="_blank" variant="secondary" size="md" className="w-full no-underline">
              Imprimir / PDF
            </ButtonLink>
            <p className="mb-0 mt-2.5 text-pequeno leading-[1.5] text-muted">A OS nunca é editada à mão. Toda mudança vem de uma resposta a item ou de um ajuste registrado com justificativa.</p>
          </div>
        </Section>
        <Section titulo="Versões" sub={`${versoes.length} ${versoes.length === 1 ? "versão" : "versões"} · ${ev.codigo}`}>
          <VersoesOs versoes={lista} />
        </Section>
      </div>
    </div>
  );
}
