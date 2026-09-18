import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarAtaVersoes, obterLinhasAta } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { pode } from "@/domain/permissions";
import { diaMesHora, formatarDataHora } from "@/lib/format";
import { Aviso, EmptyState, ListaDados, RodapeTabela, Section } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { Tag } from "@/components/ui/badge";
import { Pills } from "@/components/ui/pills";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { AtaLista } from "@/components/eventos/ata-lista";
import { paraView } from "@/components/eventos/ata-view";

const TIPO = { PROJETO: "projeto", PECA: "peça", AVULSO: "fora do catálogo" } as const;
const ORIGEM = { SOLICITACAO: "Pedido da área", AJUSTE_LOGISTICA: "Incluída na reunião" } as const;

export const metadata: Metadata = { title: "Ata" };

/** A ata em construção aqui é só leitura (inclusões e ajustes ficam na conferência): sem opções de referência. */
const SEM_OPCOES = { projetos: [], pecas: [] };

/**
 * Aba Ata. Fechada, é o registro do que aconteceu na reunião: congelada, só leitura.
 * Mudanças depois disso (alterações e ajustes) entram na OS, não na ata.
 * Antes do fechamento, mostra a ata em construção e leva para a conferência.
 */
export default async function AtaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const [ev, versoes] = await Promise.all([obterEventoCache(usuario, id), listarAtaVersoes(id)]);
  const fechada = versoes.length > 0;
  const emConstrucao = ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO";
  // A ata da reunião é uma só: o que muda depois vai para a OS. Versões antigas (reunião refeita) ficam no histórico.
  const congelada = versoes[0];
  const linhas = emConstrucao || !fechada ? await obterLinhasAta(id) : [];
  const podeConferir = pode(usuario, "ata.consolidar") && emConstrucao;
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  // Código e link da solicitação são de quem pediu: outra área vê só "Pedido de área".
  const esconderOrigemAlheia = (v: ReturnType<typeof paraView>, areaDaLinha: string | null) =>
    veTodas || areaDaLinha == null || areaDaLinha === usuario.areaId ? v : { ...v, origemSolicitacaoId: null, origemLabel: v.origemSolicitacaoId ? "Pedido de área" : v.origemLabel };
  const veObservacoes = pode(usuario, "historico.ver_tudo") || pode(usuario, "ata.consolidar");
  const podeAjustarOs = pode(usuario, "ata.ajustar") && ev.status === "ABERTO";

  const reu = fechada && !emConstrucao ? congelada?.conteudo.reuniao : undefined;
  const dadosReuniao = [
    { label: "Reunião marcada", valor: formatarDataHora(ev.dataReuniao) },
    { label: "Iniciada", valor: reu ? (reu.iniciadaEm ? formatarDataHora(reu.iniciadaEm) : "—") : ev.reuniaoIniciadaEm ? formatarDataHora(ev.reuniaoIniciadaEm) : "ainda não" },
    { label: "Ata fechada", valor: reu ? formatarDataHora(reu.fechadaEm) : congelada && !emConstrucao ? formatarDataHora(congelada.fechadaEm) : "ainda não", forte: true },
    { label: "Fechada por", valor: reu?.fechadaPor ?? (!emConstrucao ? congelada?.fechadaPor?.nome : null) ?? "—" },
    { label: "Conduzida por", valor: reu?.conduzidaPor || ev.responsavel.nome },
    { label: "Público esperado", valor: (reu ? reu.publicoEsperado : ev.publicoEsperado)?.toLocaleString("pt-BR") ?? "—" },
    { label: "Caminhão carrega", valor: (reu ? reu.caminhaoCarrega : ev.caminhaoCarrega) || "—" },
    { label: "Caminhão sai", valor: (reu ? reu.caminhaoSai : ev.caminhaoSai) || "—" },
    { label: "Arena descarrega", valor: (reu ? reu.arenaDescarrega : ev.arenaDescarrega) || "—" },
    { label: "Kit descarrega", valor: (reu ? reu.kitDescarrega : ev.kitDescarrega) || "—" },
  ];
  const presentes = reu ? reu.presentes : ev.reuniaoPresentes;
  const observacoes = !emConstrucao && congelada ? congelada.conteudo.observacoes : ev.observacoesReuniao;
  const linhasCongeladas = !emConstrucao && congelada ? congelada.conteudo.linhas : [];
  const totalLinhas = emConstrucao || !fechada ? linhas.length : linhasCongeladas.length;
  const conferidas = emConstrucao || !fechada ? linhas.filter((l) => l.conferidoEm).length : linhasCongeladas.filter((l) => l.conferidoPor).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-3.5">

        {emConstrucao || !fechada ? (
          <Section titulo="Ata em construção" sub="As necessidades das áreas entram aqui automaticamente. A conferência e os ajustes acontecem na reunião.">
            <AtaLista eventoId={id} status={ev.status} editavel={false} opcoes={SEM_OPCOES} areas={[]} linhas={linhas.map((l) => esconderOrigemAlheia(paraView(l), l.registro.areaId))} dataReuniao={diaMesHora(ev.dataReuniao)} />
          </Section>
        ) : (
          <Section
            titulo="Ata da reunião"
            sub={`Registro do que foi decidido na reunião, fechado em ${congelada ? formatarDataHora(congelada.fechadaEm) : "—"}. Não muda: alterações e ajustes posteriores entram na OS.`}
          >
            {linhasCongeladas.length === 0 ? (
              <EmptyState compact title="A ata foi fechada sem linhas" />
            ) : (
              <table className="w-full border-collapse">
                <CaptionOculta>Linhas da ata congelada</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    <Th>Item</Th>
                    <Th largura={70} alinhar="right">
                      Qtd.
                    </Th>
                    <Th largura={140}>Destino</Th>
                    <Th largura={120}>Área</Th>
                    <Th largura={150}>Origem</Th>
                    <Th largura={140}>Conferido por</Th>
                  </tr>
                </thead>
                <tbody>
                  {linhasCongeladas.map((l) => (
                    <tr key={l.id}>
                      <th scope="row" className="border-b border-line-row px-cartao py-[11px] text-left font-normal">
                        <span className="text-corpo text-ink">{l.descricao.replace(/\s*\(v\d+\)$/, "")}</span>
                        <Tag className="ml-2" tom="muted">
                          {TIPO[l.tipo]}
                        </Tag>
                        {l.codigo && (
                          <span className="mt-px block font-mono text-rotulo text-muted">
                            {l.codigo}
                            {l.versao ? ` · v${l.versao}` : ""}
                          </span>
                        )}
                      </th>
                      <td className="border-b border-line-row px-2.5 py-[11px] text-right font-mono text-corpo font-medium">{l.quantidade}</td>
                      <td className="border-b border-line-row px-2.5 py-[11px] text-pequeno text-ink-2">{l.destino ?? <span className="text-meta">—</span>}</td>
                      <td className="border-b border-line-row px-2.5 py-[11px] text-pequeno text-ink-2">{l.area ?? "Logística"}</td>
                      <td className="border-b border-line-row px-2.5 py-[11px] text-pequeno text-ink-3">{ORIGEM[l.origem]}</td>
                      <td className="border-b border-line-row px-2.5 py-[11px] text-pequeno text-success">{l.conferidoPor ? `✓ ${l.conferidoPor}` : <span className="text-meta">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <RodapeTabela direita="somente leitura">
              {linhasCongeladas.length} {linhasCongeladas.length === 1 ? "linha" : "linhas"} · <span className="font-mono">{linhasCongeladas.reduce((a, l) => a + l.quantidade, 0)}</span> unidades
            </RodapeTabela>
          </Section>
        )}

        {!emConstrucao && fechada && (
          <Aviso tom="neutro" titulo="Precisa mudar algo depois da reunião?">
            A ata não é editada. Alterações das áreas entram como solicitação{podeAjustarOs ? ", e a logística ajusta direto na OS com justificativa" : ""}. Cada mudança gera uma nova versão da OS.
            {podeAjustarOs && (
              <>
                {" "}
                <Link href={`/eventos/${id}/os?visao=composicao`} className="link">
                  Ajustar itens da OS
                </Link>
                .
              </>
            )}
          </Aviso>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {podeConferir && (
          <Section titulo="Conferência da reunião" sub={`${conferidas} de ${totalLinhas} linhas conferidas`}>
            <div className="px-cartao py-3.5">
              <ButtonLink href={`/conferencia/${id}`} variant="primary" size="md" className="w-full no-underline">
                Abrir conferência da ata
              </ButtonLink>
              <p className="mb-0 mt-2 text-pequeno leading-[1.5] text-muted">A ata inteira por área: quem pediu, check de conferido e ajuste com motivo.</p>
            </div>
          </Section>
        )}

        {pode(usuario, "os.exportar") && (
        <Section titulo="Exportar ata" sub={!emConstrucao && congelada ? `Fechada em ${formatarDataHora(congelada.fechadaEm)}` : "Ata em construção (prévia)"}>
          <div className="flex flex-col gap-2 px-cartao py-3.5">
            <a href={`/api/eventos/${id}/ata/excel${sp.v ? `?v=${sp.v}` : ""}`} className={buttonClasses({ variant: podeConferir ? "secondary" : "primary", size: "md", className: "w-full no-underline" })}>
              Excel da ata (.xlsx)
            </a>
            <ButtonLink href={`/impressao/ata/${id}${sp.v ? `?v=${sp.v}` : ""}`} target="_blank" variant="secondary" size="md" className="w-full no-underline">
              Imprimir / PDF
            </ButtonLink>
          </div>
        </Section>
        )}

        <Section titulo="Reunião de OS" sub={!emConstrucao && congelada ? "Registro congelado no fechamento da ata" : "Preenchido pela logística na reunião"}>
          <ListaDados itens={dadosReuniao} />
          <div className="border-t border-line-faint px-cartao py-3">
            <p className="m-0 text-pequeno text-muted">Pessoas presentes</p>
            <p className="mb-0 mt-1 whitespace-pre-wrap text-corpo leading-[1.5] text-ink-2">{presentes?.trim() || <span className="text-meta">ainda não registrado</span>}</p>
          </div>
          <div className="border-t border-line-faint px-cartao py-3 text-pequeno text-ink-3">
            <span className="font-mono text-ink-2">{conferidas}</span>/{totalLinhas} linhas conferidas na reunião
          </div>
        </Section>

        {/* Nota de condução da reunião (combinados com o cliente): fica com logística e gestão. */}
        {veObservacoes && (
          <Section titulo="Observações da reunião" sub="Registro interno da condução">
            <div className="px-cartao py-3.5">{observacoes ? <p className="m-0 whitespace-pre-wrap text-corpo leading-[1.55] text-ink-2">{observacoes}</p> : <p className="m-0 text-pequeno text-muted">Nenhuma observação registrada</p>}</div>
          </Section>
        )}
      </div>
    </div>
  );
}
