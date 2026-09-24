import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { calcularOsAoVivo, complementoOs, listarOsResumo, obterConteudosOs } from "@/server/services/os";
import { EnvioOs } from "@/components/eventos/envio-os";
import { obterEventoCache } from "@/server/cache";
import { diffOS, resumoVersaoOs, type DiffLinha } from "@/domain/os";
import { diaMesHora } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { Codigo } from "@/components/ui/numero";
import { Aviso, EmptyState, Section } from "@/components/ui/layout";
import { OsVisoes, visaoDe } from "@/components/eventos/os-visoes";
import { AtaLista } from "@/components/eventos/ata-lista";
import { paraView } from "@/components/eventos/ata-view";
import { DiffOs } from "@/components/eventos/diff-os";
import { Exportacoes, type Exportacao } from "@/components/eventos/exportacoes";
import { obterLinhasAta, opcoesReferenciasResumidas } from "@/server/services/eventos";
import { pode } from "@/domain/permissions";
import { VersoesOs, type VersaoOsView } from "@/components/eventos/versoes-os";
import type { OsGatilho } from "@/server/db/schema";
import { listarAreasCache } from "@/server/cache";

const GATILHO_LABEL: Record<OsGatilho, string> = {
  ATA_FECHADA: "ata fechada",
  RESPOSTA_SOLICITACAO: "alteração",
  CORRECAO_RESPOSTA: "correção",
  AJUSTE_LOGISTICA: "ajuste",
  ATUALIZACAO_PROJETO: "projeto",
  REABERTURA: "reabertura",
  ENCERRAMENTO: "OS final",
};

export const metadata: Metadata = { title: "Ordem de serviço" };

/** As exportações da OS, na mesma ordem em todo lugar. `qs` escolhe a versão (vazio = atual). */
function exportacoesOs(id: string, qs: string, previa = false): Exportacao[] {
  return [
    { tipo: "xlsx", href: `/api/os/${id}/excel${qs}`, rotulo: previa ? "Excel da prévia" : "Excel completo", descricao: "Resumo, totais por peça, por projeto, soltas e avulsos, com coluna de separação." },
    { tipo: "xlsx", href: `/api/os/${id}/estrutura${qs}`, rotulo: "OS de estrutura", descricao: "Igual à planilha da cenografia: TOTAL, SOMATORIA e uma aba por projeto." },
    { tipo: "xlsx", href: `/api/os/${id}/marcenaria${qs}`, rotulo: "OS de marcenaria", descricao: "Igual à planilha da cenografia: seções, item, peças e quantidade." },
    { tipo: "imprimir", href: `/impressao/os/${id}${qs}`, rotulo: previa ? "Imprimir prévia" : "Imprimir", descricao: "Folha de separação com assinaturas, pronta para PDF." },
  ];
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Aviso tom="warning" titulo="Prévia: a OS ainda não foi gerada">
            Leitura atual da ata em construção. A v1 nasce no fechamento da ata; até lá, tudo pode mudar na reunião.
          </Aviso>
          {temAlgo ? (
            <OsVisoes os={previa} visao={visao} titulo="Prévia da OS" hrefVisao={(v) => hrefCom(`/eventos/${id}/os`, { visao: sp.visao }, { visao: v === "totais" ? null : v })} />
          ) : (
            <Section>
              <EmptyState title="A ata ainda não tem linhas" description="As solicitações pré-reunião entram na ata automaticamente e aparecem aqui como prévia da OS." />
            </Section>
          )}
        </div>
        {temAlgo && pode(usuario, "os.exportar") && (
          <div className="flex flex-col gap-5 lg:sticky lg:top-topo-fixo">
            <Exportacoes sub="Prévia da ata em construção" itens={exportacoesOs(id, "", true)} />
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
  // Itens que compõem a OS: é aqui, e não na ata, que a logística ajusta depois da reunião.
  const podeAjustar = pode(usuario, "ata.ajustar") && ev.status === "ABERTO";
  let composicao: { n: number; conteudo: React.ReactNode; ajustavel?: boolean } | undefined;
  if (visao === "composicao") {
    const [linhasOs, opcoes, areas] = await Promise.all([obterLinhasAta(id), podeAjustar ? opcoesReferenciasResumidas() : Promise.resolve({ projetos: [], pecas: [] }), podeAjustar ? listarAreasCache() : Promise.resolve([])]);
    composicao = {
      n: linhasOs.length,
      ajustavel: podeAjustar,
      conteudo: (
        <Section titulo="Itens que compõem a OS" sub={podeAjustar ? "Ata + alterações atendidas + ajustes. Ajustar ou incluir pede justificativa, avisa a área e gera nova versão. A ata não muda." : "Ata da reunião + alterações atendidas + ajustes da logística."}>
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
      <div className="flex min-w-0 flex-col gap-4">
        {exibida.numero !== atual.numero && (
          <Aviso
            tom="neutro"
            titulo={
              <>
                Você está vendo a <Codigo>v{exibida.numero}</Codigo>, de {diaMesHora(exibida.geradaEm)}
              </>
            }
            acoes={
              <ButtonLink href={hrefCom(`/eventos/${id}/os`, paramsAtuais, { v: null, base: null })} variant="secondary" size="sm" className="no-underline" scroll={false}>
                Ver a atual (v{atual.numero})
              </ButtonLink>
            }
          />
        )}

        <DiffOs
          titulo={tituloDiff}
          sub={subDiff}
          diff={diff}
          vazio={existe(exibida.numero - 1) || base ? "Nenhuma quantidade de peça mudou." : "Base inicial, gerada no fechamento da ata."}
          acoes={
            base && (
              <ButtonLink href={hrefCom(`/eventos/${id}/os`, paramsAtuais, { base: null })} variant="ghost" size="sm" className="no-underline" scroll={false}>
                Sair da comparação
              </ButtonLink>
            )
          }
        />

        <OsVisoes
          os={os}
          visao={visao}
          titulo={`OS v${exibida.numero}`}
          hrefVisao={(v) => hrefCom(`/eventos/${id}/os`, paramsAtuais, { visao: v === "totais" ? null : v })}
          csvHref={(setor) => `/api/os/${id}/${setor}${qsExport}`}
          composicao={composicao}
        />
      </div>

      <div className="flex flex-col gap-5 lg:sticky lg:top-topo-fixo">
        <Section
          titulo="Envio ao carregamento"
          sub={
            complemento ? (
              <>
                Enviada: <Codigo>v{complemento.numero}</Codigo>
              </>
            ) : (
              "Ainda não enviada"
            )
          }
        >
          <EnvioOs
            eventoId={id}
            versaoAtual={atual.numero}
            podeEnviar={pode(usuario, "ata.ajustar") && (ev.status === "ABERTO" || ev.status === "ENCERRADO")}
            enviada={complemento ? { numero: complemento.numero, enviadaEm: diaMesHora(complemento.enviadaEm), enviadaPor: complemento.enviadaPor, diff: complemento.diff.map((d) => ({ codigo: d.codigo, nome: d.nome, antes: d.antes, depois: d.depois })), avulsosNovos: complemento.avulsosNovos.length } : null}
          />
        </Section>
        {pode(usuario, "os.exportar") && (
          <Exportacoes
            sub={
              <>
                <Codigo>v{exibida.numero}</Codigo>
                {exibida.numero === atual.numero ? " · versão atual" : ` · de ${diaMesHora(exibida.geradaEm)}`}
              </>
            }
            itens={exportacoesOs(id, qsExport)}
          />
        )}
        <Section titulo="Versões" sub={`${versoes.length} ${versoes.length === 1 ? "versão" : "versões"} · nunca editadas à mão`}>
          <VersoesOs versoes={lista} />
        </Section>
      </div>
    </div>
  );
}
