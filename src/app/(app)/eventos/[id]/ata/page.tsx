import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarAtaVersoes, obterLinhasAta } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { daMinhaArea, pode } from "@/domain/permissions";
import { diaMesHora, formatarDataHora } from "@/lib/format";
import { Aviso, BarraProgresso, EmptyState, ListaDados, RodapeTabela, Section } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { AtaLista } from "@/components/eventos/ata-lista";
import { paraView } from "@/components/eventos/ata-view";
import { Exportacoes } from "@/components/eventos/exportacoes";

const TIPO = { PROJETO: "projeto", PECA: "peça", AVULSO: "fora do catálogo" } as const;
const ORIGEM = { SOLICITACAO: "Pedido da área", AJUSTE_LOGISTICA: "Incluída na reunião" } as const;

export const metadata: Metadata = { title: "Ata" };

/** A ata em construção aqui é só leitura (inclusões e ajustes ficam na conferência): sem opções de referência. */
const SEM_OPCOES = { projetos: [], pecas: [] };

/**
 * Aba Ata. Fechada, é o registro do que aconteceu na reunião: congelada, só leitura, agrupada por área.
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
    veTodas || areaDaLinha == null || daMinhaArea(usuario, areaDaLinha) ? v : { ...v, origemSolicitacaoId: null, origemLabel: v.origemSolicitacaoId ? "Pedido de área" : v.origemLabel };
  const veObservacoes = pode(usuario, "historico.ver_tudo") || pode(usuario, "ata.consolidar");
  const podeAjustarOs = pode(usuario, "ata.ajustar") && ev.status === "ABERTO";

  const reu = fechada && !emConstrucao ? congelada?.conteudo.reuniao : undefined;
  const dadosReuniao = [
    { label: "Marcada", valor: formatarDataHora(ev.dataReuniao) },
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

  // Ata fechada: leitura por área, como a reunião conferiu.
  const porArea = new Map<string, typeof linhasCongeladas>();
  for (const l of linhasCongeladas) porArea.set(l.area ?? "Logística", [...(porArea.get(l.area ?? "Logística") ?? []), l]);
  const areas = [...porArea.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  const qsV = sp.v ? `?v=${sp.v}` : "";
  // Uma pessoa só conferiu todas as linhas: o nome vai uma vez no rodapé e a coluna mostra só o check.
  const conferentes = new Set(linhasCongeladas.map((l) => l.conferidoPor).filter(Boolean));
  const conferenteUnico = conferentes.size === 1 && linhasCongeladas.every((l) => l.conferidoPor) ? [...conferentes][0] : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {emConstrucao || !fechada ? (
          <Section titulo="Ata em construção" sub="As necessidades das áreas entram aqui sozinhas. Conferência e ajustes acontecem na reunião.">
            <AtaLista eventoId={id} status={ev.status} editavel={false} opcoes={SEM_OPCOES} areas={[]} linhas={linhas.map((l) => esconderOrigemAlheia(paraView(l), l.registro.areaId))} dataReuniao={diaMesHora(ev.dataReuniao)} />
          </Section>
        ) : (
          <Section
            titulo="Ata da reunião"
            sub={
              <>
                Fechada em <span className="numero">{congelada ? formatarDataHora(congelada.fechadaEm) : "—"}</span> · somente leitura
              </>
            }
          >
            {linhasCongeladas.length === 0 ? (
              <EmptyState compact title="A ata foi fechada sem linhas" description="Tudo o que entrou depois está na OS." />
            ) : (
              <div className="overflow-x-auto">
                <table data-responsiva className="w-full border-collapse sm:min-w-[520px]">
                  <CaptionOculta>Linhas da ata congelada, por área</CaptionOculta>
                  <thead>
                    <tr>
                      <Th>Item</Th>
                      <Th className="hidden md:table-cell md:w-[22%]">
                        Destino
                      </Th>
                      <Th largura={72} alinhar="right">
                        Qtd.
                      </Th>
                      <Th className={conferenteUnico ? "hidden sm:table-cell sm:w-[96px]" : "hidden sm:table-cell sm:w-[24%]"}>
                        Conferido
                      </Th>
                    </tr>
                  </thead>
                  {areas.map(([area, ls]) => (
                    <tbody key={area}>
                      <tr>
                        <th colSpan={4} scope="colgroup" className="border-b border-line-soft bg-subtle px-cartao py-1.5 text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
                          {area}
                          <span className="numero ml-2 font-normal tracking-normal text-muted">{ls.length}</span>
                        </th>
                      </tr>
                      {agruparAta(ls).map(({ chave, nome, l0, linhas: doItem }) => {
                        const conferido = (l: (typeof ls)[number]) =>
                          l.conferidoPor ? (
                            <span className="inline-flex items-center gap-1.5 text-ink-2" title={`Conferida por ${l.conferidoPor}`}>
                              <Icone nome="check-circulo" className="shrink-0 text-success" />
                              {conferenteUnico ? <span className="sr-only">conferida por {l.conferidoPor}</span> : <span className="truncate">{l.conferidoPor}</span>}
                            </span>
                          ) : (
                            <span className="text-meta">—</span>
                          );
                        const sub = (
                          <span className="mt-0.5 block text-rotulo text-muted">
                            {l0.codigo && (
                              <Codigo>
                                {l0.codigo}
                                {l0.versao ? ` · v${l0.versao}` : ""}
                              </Codigo>
                            )}
                            {l0.codigo ? " · " : ""}
                            {ORIGEM[l0.origem]}
                          </span>
                        );
                        const titulo = (
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-corpo text-ink">{nome}</span>
                            {l0.tipo === "AVULSO" && <Tag tom="warning">{TIPO[l0.tipo]}</Tag>}
                          </span>
                        );
                        if (doItem.length === 1)
                          return (
                            <tr key={chave} className="hover:bg-subtle">
                              <th scope="row" className="border-b border-line-row py-2.5 pl-cartao pr-3 text-left font-normal">
                                {titulo}
                                {sub}
                                <span className="text-rotulo text-muted md:hidden">{l0.destino ? `${l0.destino}` : ""}</span>
                                {!conferenteUnico && <span className="mt-0.5 block text-rotulo sm:hidden">{conferido(l0)}</span>}
                              </th>
                              <td className="hidden border-b border-line-row px-3 py-2.5 text-pequeno text-ink-2 md:table-cell">{l0.destino ?? <span className="text-meta">—</span>}</td>
                              <td className="numero border-b border-line-row px-3 py-2.5 text-right text-corpo font-medium text-ink">{l0.quantidade}</td>
                              <td className="hidden border-b border-line-row py-2.5 pl-3 pr-cartao text-pequeno sm:table-cell">{conferido(l0)}</td>
                            </tr>
                          );
                        // O mesmo item em vários locais: cabeçalho com o total e uma sub-linha por local (o registro continua linha a linha).
                        const total = doItem.reduce((a, x) => a + x.quantidade, 0);
                        return (
                          <Fragment key={chave}>
                            <tr>
                              <th scope="rowgroup" className="border-b border-line-row pb-1.5 pl-cartao pr-3 pt-2.5 text-left font-normal">
                                {titulo}
                                {sub}
                              </th>
                              <td className="hidden border-b border-line-row px-3 pb-1.5 pt-2.5 text-rotulo text-muted md:table-cell">{doItem.length} locais</td>
                              <td className="numero border-b border-line-row px-3 pb-1.5 pt-2.5 text-right text-corpo font-semibold text-ink">{total}</td>
                              <td className="hidden border-b border-line-row pb-1.5 pl-3 pr-cartao pt-2.5 sm:table-cell" />
                            </tr>
                            {doItem.map((l) => (
                              <tr key={l.id} className="hover:bg-subtle">
                                <th scope="row" className="border-b border-line-faint py-1.5 pl-[42px] pr-3 text-left text-pequeno font-normal text-ink-2">
                                  <span className="md:hidden">{l.destino ?? "sem local"}</span>
                                  {!conferenteUnico && <span className="mt-0.5 block text-rotulo sm:hidden">{conferido(l)}</span>}
                                  <span className="hidden text-meta md:inline">↳</span>
                                </th>
                                <td className="hidden border-b border-line-faint px-3 py-1.5 text-pequeno text-ink-2 md:table-cell">{l.destino ?? <span className="text-meta">—</span>}</td>
                                <td className="numero border-b border-line-faint px-3 py-1.5 text-right text-pequeno text-ink-2">{l.quantidade}</td>
                                <td className="hidden border-b border-line-faint py-1.5 pl-3 pr-cartao text-pequeno sm:table-cell">{conferido(l)}</td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
            )}
            <RodapeTabela>
              {linhasCongeladas.length} {linhasCongeladas.length === 1 ? "linha" : "linhas"} · <span className="numero">{linhasCongeladas.reduce((a, l) => a + l.quantidade, 0).toLocaleString("pt-BR")}</span> unidades
              {conferenteUnico && <> · todas conferidas por {conferenteUnico}</>}
            </RodapeTabela>
          </Section>
        )}

        {!emConstrucao && fechada && (
          <Aviso
            tom="neutro"
            titulo="Precisa mudar algo depois da reunião?"
            acoes={
              podeAjustarOs ? (
                <Link href={`/eventos/${id}/os?visao=composicao`} className="link whitespace-nowrap text-pequeno">
                  Ajustar na OS
                </Link>
              ) : undefined
            }
          >
            A ata não é editada. Alterações das áreas entram como solicitação{podeAjustarOs ? " e a logística ajusta direto na OS, com justificativa" : ""}. Cada mudança gera uma nova versão da OS.
          </Aviso>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {podeConferir && (
          <Section titulo="Conferência da reunião">
            <div className="px-cartao py-3.5">
              <p className="m-0 flex items-baseline justify-between gap-3 text-pequeno text-ink-2">
                <span>
                  <span className="numero font-medium text-ink">{conferidas}</span> de <span className="numero">{totalLinhas}</span> conferidas
                </span>
                <span className="numero text-muted">{totalLinhas ? Math.round((conferidas / totalLinhas) * 100) : 0}%</span>
              </p>
              <BarraProgresso pct={totalLinhas ? (conferidas / totalLinhas) * 100 : 0} tom={totalLinhas > 0 && conferidas === totalLinhas ? "success" : "neutro"} className="mt-2" />
              <ButtonLink href={`/conferencia/${id}`} variant="primary" size="md" className="mt-3.5 w-full no-underline">
                Abrir conferência
              </ButtonLink>
            </div>
          </Section>
        )}

        {pode(usuario, "os.exportar") && (
          <Exportacoes
            sub={!emConstrucao && congelada ? "Ata fechada" : "Prévia da ata em construção"}
            itens={[
              { tipo: "xlsx", href: `/api/eventos/${id}/ata/lista${qsV}`, rotulo: "Ata (lista de materiais)", descricao: "Igual à planilha da cenografia: percurso, tendas por local, box truss, ativação e arena." },
              { tipo: "xlsx", href: `/api/eventos/${id}/ata/excel${qsV}`, rotulo: "Excel da ata", descricao: "Cabeçalho da reunião, linhas conferidas e pedidos por área." },
              { tipo: "imprimir", href: `/impressao/ata/${id}${qsV}`, rotulo: "Imprimir", descricao: "Ata com presentes, observações e assinaturas." },
            ]}
          />
        )}

        <Section titulo="Reunião de OS" sub={!emConstrucao && congelada ? "Registro congelado no fechamento" : "Preenchido pela logística na reunião"}>
          <ListaDados itens={dadosReuniao} />
          <div className="border-t border-line-faint px-cartao py-3">
            <p className="m-0 text-pequeno text-muted">Pessoas presentes</p>
            <p className="mb-0 mt-1 whitespace-pre-wrap text-corpo leading-relaxed text-ink-2">{presentes?.trim() || <span className="text-meta">ainda não registrado</span>}</p>
          </div>
          {!podeConferir && (
            <p className="m-0 border-t border-line-faint px-cartao py-3 text-pequeno text-ink-3">
              <span className="numero font-medium text-ink-2">{conferidas}</span> de <span className="numero">{totalLinhas}</span> linhas conferidas na reunião
            </p>
          )}
        </Section>

        {/* Nota de condução da reunião (combinados com o cliente): fica com logística e gestão. */}
        {veObservacoes && (
          <Section titulo="Observações da reunião" sub="Registro interno da condução">
            <div className="px-cartao py-3.5">{observacoes ? <p className="m-0 whitespace-pre-wrap text-corpo leading-relaxed text-ink-2">{observacoes}</p> : <p className="m-0 text-pequeno text-muted">Nenhuma observação registrada.</p>}</div>
          </Section>
        )}
      </div>
    </div>
  );
}

/** Linhas da ata congelada juntas por item (em ordem alfabética), com o nome sem o código repetido na frente. */
function agruparAta<L extends { id: string; tipo: string; codigo: string | null; descricao: string; destino: string | null }>(ls: readonly L[]) {
  const nomeDe = (l: L) => l.descricao.replace(/\s*\(v\d+\)$/, "").replace(l.codigo ? new RegExp(`^${l.codigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*·\\s*`) : /^$/, "");
  const m = new Map<string, L[]>();
  for (const l of ls) {
    const k = `${l.tipo}|${l.codigo ?? nomeDe(l)}`;
    m.set(k, [...(m.get(k) ?? []), l]);
  }
  return [...m.entries()]
    .map(([chave, linhas]) => ({ chave, nome: nomeDe(linhas[0]), l0: linhas[0], linhas: [...linhas].sort((a, b) => (a.destino ?? "").localeCompare(b.destino ?? "", "pt-BR")) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
