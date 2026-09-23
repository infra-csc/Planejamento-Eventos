import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { obterHistoricoEvento, obterLinhasAta } from "@/server/services/eventos";
import { calcularOsAoVivo, listarOsResumo, totalPecasOs } from "@/server/services/os";
import { slugArenaDoEvento } from "@/server/services/arenas";
import { OsVisoes, type VisaoOs } from "@/components/eventos/os-visoes";
import { Pills } from "@/components/ui/pills";
import { obterEventoCache } from "@/server/cache";
import { pode } from "@/domain/permissions";
import { classificarHistorico } from "@/domain/historico";
import { diaMes, diaMesHora, diaMesISO, hojeISO, isoSP, periodoCurto } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ChipMono, Tag } from "@/components/ui/badge";
import { Icone, type NomeIcone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { EmptyState, Metric, MetricStrip, Section, type TomSemantico } from "@/components/ui/layout";
import { CaptionOculta, Th } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { iconeHistorico, LinhaTempoAgrupada } from "@/components/eventos/linha-tempo-agrupada";

const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hojeISO()}T00:00:00Z`)) / 86_400_000);
const contagem = (n: number, hoje: string, passado: string) => (n === 0 ? hoje : n > 0 ? `em ${n} ${n === 1 ? "dia" : "dias"}` : `${passado} há ${-n} ${-n === 1 ? "dia" : "dias"}`);

type Grupo = { nome: string; codigo: string | null; capaId: string | null; quantidade: number; destinos: Set<string>; areas: Set<string>; ids: string[] };

/**
 * Visão geral do evento: resumo no topo (o que falta, prazos, versão da OS), o que mudou depois
 * da ata em destaque discreto, os itens agrupados por tipo (projetos, peças, fora do catálogo) e a
 * galeria dos projetos. Na coluna lateral: datas, quem está envolvido, ajustes e atividade.
 */
const LEITURAS = [
  { chave: "lista", rotulo: "Lista" },
  { chave: "projetos", rotulo: "Peças por projeto" },
  { chave: "totais", rotulo: "Totais por peça" },
  { chave: "individuais", rotulo: "Soltas e fora do catálogo" },
] as const;
type Leitura = (typeof LEITURAS)[number]["chave"];

const GRUPOS_TIPO = [
  { tipo: "PROJETO", rotulo: "Projetos" },
  { tipo: "PECA", rotulo: "Peças do catálogo" },
  { tipo: "AVULSO", rotulo: "Fora do catálogo" },
] as const;

/** Linha de atalho da coluna lateral: ícone + texto, a linha inteira é o link. */
function Atalho({ href, icone, children, novaAba }: { href: string; icone: NomeIcone; children: React.ReactNode; novaAba?: boolean }) {
  return (
    <Link
      href={href}
      target={novaAba ? "_blank" : undefined}
      className="flex items-center gap-2.5 border-b border-line-row px-cartao py-2.5 text-corpo text-ink no-underline transition-colors duration-150 last:border-b-0 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent max-md:min-h-11"
    >
      <Icone nome={icone} className="shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1">{children}</span>
      <Icone nome={novaAba ? "link-externo" : "chevron-direita"} className="shrink-0 text-ink-3" />
    </Link>
  );
}

export default async function EventoVisaoGeralPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ itens?: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const leitura: Leitura = LEITURAS.some((l) => l.chave === sp.itens) ? (sp.itens as Leitura) : "lista";
  const [ev, linhas, historico, versoes] = await Promise.all([obterEventoCache(usuario, id), obterLinhasAta(id), obterHistoricoEvento(usuario, id, 6), listarOsResumo(id)]);
  // O total de peças é conteúdo da OS: quem não tem a aba também não vê o número.
  const veOs = pode(usuario, "os.ver");
  const veTodasAsAreas = pode(usuario, "solicitacao.ver_todas");
  const veArena = pode(usuario, "arena.ver");
  // Leituras independentes em paralelo. As leituras por peça vêm do estado de agora (ata + o que
  // entrou depois), igual à OS em vigor.
  const [osAgora, totalOs, slugArena] = await Promise.all([
    leitura === "lista" ? null : calcularOsAoVivo(id),
    veOs && versoes[0] ? totalPecasOs(id, versoes[0].numero) : 0,
    veArena ? slugArenaDoEvento(id) : null,
  ]);

  const projetos = linhas.filter((l) => l.tipo === "PROJETO");
  const posAta = linhas.filter((l) => l.posAta);
  const conferidas = linhas.filter((l) => l.conferidoEm).length;
  const unidades = linhas.reduce((a, l) => a + l.quantidade, 0);
  const porArea = new Map<string, number>();
  for (const l of linhas) porArea.set(l.areaNome ?? "Logística", (porArea.get(l.areaNome ?? "Logística") ?? 0) + 1);
  const areasEnvolvidas = [...porArea.entries()].sort((a, b) => b[1] - a[1]);
  const minhaArea = usuario.areaId;
  const deOutraArea = (l: (typeof linhas)[number]) => Boolean(minhaArea) && l.registro.areaId !== minhaArea;
  // Quem pediu é assunto da área que pediu: fora dela, a origem aparece sem o código da solicitação.
  const origemVisivel = (l: (typeof linhas)[number]) => (veTodasAsAreas || !l.origemSolicitacaoId || l.registro.areaId === minhaArea ? l.origemLabel : "Pedido de área");
  const AJUSTES = new Set(["ATA_QUANTIDADE", "ATA_REMOCAO", "AJUSTE_INCLUSAO", "CONFERENCIA_AJUSTE", "PECA_PROJETO_AJUSTADA", "ITEM_VINCULADO", "ATUALIZACAO_VERSAO"]);
  const ajustes = historico.filter((h) => h.entidade === "evento_item" && AJUSTES.has(h.acao));

  // Projetos agrupados (o mesmo projeto pode aparecer em várias linhas/destinos).
  const grupos = new Map<string, Grupo>();
  for (const l of projetos) {
    const k = l.projeto?.codigo ?? l.nome;
    const g = grupos.get(k) ?? { nome: l.nome, codigo: l.projeto?.codigo ?? null, capaId: null, quantidade: 0, destinos: new Set<string>(), areas: new Set<string>(), ids: [] };
    g.quantidade += l.quantidade;
    if (l.destino) g.destinos.add(l.destino);
    g.areas.add(l.areaNome ?? "Logística");
    g.ids.push(l.id);
    if (!g.capaId && l.capaId) g.capaId = l.capaId;
    grupos.set(k, g);
  }
  const galeria = [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade);

  const dEvento = diasAte(ev.dataInicio);
  const dReuniao = diasAte(isoSP(ev.dataReuniao));
  // O que falta: o próximo marco da fase, com o prazo.
  const falta: { rotulo: string; valor: React.ReactNode; hint?: string; tom: TomSemantico; href?: string } =
    ev.status === "PREPARACAO"
      ? { rotulo: "Próximo passo: reunião de OS", valor: contagem(dReuniao, "hoje", "foi"), hint: `${diaMesHora(ev.dataReuniao)} · as áreas enviam necessidades até lá`, tom: dReuniao < 0 ? "warning" : "neutro" }
      : ev.status === "EM_REUNIAO"
        ? {
            rotulo: "Conferência da ata",
            valor: (
              <>
                {conferidas}
                <span className="text-destaque font-normal text-muted"> de {linhas.length}</span>
              </>
            ),
            hint: linhas.length - conferidas > 0 ? `faltam ${linhas.length - conferidas} para fechar a ata` : "tudo conferido; falta fechar a ata",
            tom: "warning",
            href: pode(usuario, "ata.consolidar") ? `/conferencia/${id}` : undefined,
          }
        : ev.status === "ABERTO"
          ? { rotulo: "Alterações", valor: ev.janelaAlteracoesAte ? `até ${diaMesISO(ev.janelaAlteracoesAte)}` : "abertas", hint: `Ata fechada em ${diaMes(ev.ataFechadaEm)}. Mudanças entram como solicitação.`, tom: "neutro" }
          : ev.status === "ENCERRADO"
            ? { rotulo: "Encerrado", valor: "nada falta", hint: "Nada entra mais. O caminhão carrega o que está na OS.", tom: "success" }
            : { rotulo: "Cancelado", valor: "—", hint: ev.canceladoMotivo ?? undefined, tom: "neutro" };

  const porTipo = GRUPOS_TIPO.map((g) => ({ ...g, linhas: linhas.filter((l) => l.tipo === g.tipo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) })).filter((g) => g.linhas.length > 0);

  const datas = [
    { rotulo: "Reunião de OS", quando: diaMesHora(ev.dataReuniao), feito: Boolean(ev.ataFechadaEm) || ev.status === "EM_REUNIAO", atual: ev.status === "EM_REUNIAO" },
    { rotulo: "Ata fechada", quando: ev.ataFechadaEm ? diaMesHora(ev.ataFechadaEm) : "—", feito: Boolean(ev.ataFechadaEm), atual: false },
    ...(ev.janelaAlteracoesAte ? [{ rotulo: "Alterações até", quando: diaMesISO(ev.janelaAlteracoesAte), feito: hojeISO() > ev.janelaAlteracoesAte, atual: false }] : []),
    { rotulo: "Evento", quando: periodoCurto(ev.dataInicio, ev.dataFim), feito: dEvento < 0, atual: dEvento === 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo: o que falta, quando é, o tamanho do evento e a versão da OS. */}
      <MetricStrip className="mb-0">
        <Metric label={falta.rotulo} valor={falta.valor} hint={falta.hint} tom={falta.tom} href={falta.href} />
        <Metric label="Evento" valor={periodoCurto(ev.dataInicio, ev.dataFim)} hint={contagem(dEvento, "é hoje", "aconteceu")} />
        <Metric
          label="Itens"
          valor={<Numero valor={linhas.length} />}
          hint={`${projetos.length} ${projetos.length === 1 ? "projeto" : "projetos"} · ${unidades} un. · ${areasEnvolvidas.length} ${areasEnvolvidas.length === 1 ? "área" : "áreas"}`}
          href="#itens"
        />
        <Metric
          label="Ordem de serviço"
          valor={versoes.length ? <Codigo>v{versoes[0].numero}</Codigo> : "—"}
          hint={versoes.length ? `${veOs ? `${totalOs} peças · ` : ""}atualizada ${diaMes(versoes[0].geradaEm)}` : "gerada ao fechar a ata"}
          href={veOs ? `/eventos/${id}/os` : undefined}
        />
      </MetricStrip>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Depois da ata: destaque discreto (borda informativa), só quando há o que mostrar. */}
          {ev.ataFechadaEm && posAta.length > 0 && (
            <section aria-labelledby="pos-ata" className="overflow-hidden rounded-cartao border border-info-border bg-surface">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line-soft px-cartao py-3">
                <Icone nome="info" className="shrink-0 text-info" />
                <h2 id="pos-ata" className="m-0 text-secao font-semibold">
                  Mudou depois da ata
                </h2>
                <ChipMono tom="info">{posAta.length}</ChipMono>
                <span className="text-pequeno text-muted max-sm:basis-full">alterações atendidas e ajustes da logística</span>
                {veOs && (
                  <Link href={`/eventos/${id}/os?visao=composicao`} className="link ml-auto text-pequeno">
                    Ver na OS
                  </Link>
                )}
              </div>
              <ul className="m-0 list-none p-0">
                {posAta.slice(0, 5).map((l) => (
                  <li key={l.id}>
                    <Link href={`/eventos/${id}/itens/${l.id}`} className="flex items-center gap-3 border-b border-line-row px-cartao py-2.5 no-underline transition-colors duration-150 hover:bg-subtle">
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-corpo text-ink" title={l.nome}>
                          {l.nome}
                        </span>
                        <span className="block truncate text-pequeno text-muted">
                          {deOutraArea(l) ? `${l.areaNome ?? "Logística"} · ` : ""}
                          {origemVisivel(l)}
                        </span>
                      </span>
                      <Numero valor={l.quantidade} className="shrink-0 text-corpo font-medium text-ink" />
                    </Link>
                  </li>
                ))}
              </ul>
              {posAta.length > 5 && (
                <p className="m-0 border-t border-line-row px-cartao py-2.5 text-pequeno text-muted">
                  E mais {posAta.length - 5} {posAta.length - 5 === 1 ? "item" : "itens"} na lista abaixo.
                </p>
              )}
            </section>
          )}

          {/* Itens por tipo: projetos, peças do catálogo e fora do catálogo — com quem pediu e para onde vai. */}
          <div id="itens" className="scroll-mt-20">
            <Section titulo="Itens do evento" sub={ev.ataFechadaEm ? "Ata da reunião mais o que entrou depois." : "O que as áreas pediram até agora. Ajustes acontecem na reunião."}>
              {linhas.length > 0 && (
                <div className="overflow-x-auto border-b border-line-soft px-cartao py-2.5">
                  <Pills rotulo="Como ver os itens" itens={LEITURAS.map((l) => ({ label: l.rotulo, ativo: leitura === l.chave, href: l.chave === "lista" ? `/eventos/${id}#itens` : `/eventos/${id}?itens=${l.chave}#itens` }))} />
                </div>
              )}
              {linhas.length === 0 ? (
                <EmptyState compact title="Nenhum item ainda" description="Quando as áreas enviarem necessidades, os itens aparecem aqui." />
              ) : osAgora ? (
                <div className="flex flex-col gap-4 bg-subtle p-3 sm:p-4">
                  <OsVisoes os={osAgora} visao={leitura as VisaoOs} semNavegacao titulo="Itens do evento" hrefVisao={(v) => `/eventos/${id}?itens=${v}#itens`} />
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <CaptionOculta>Itens do evento por tipo</CaptionOculta>
                  <thead>
                    <tr>
                      <Th>Item</Th>
                      <Th className="hidden sm:table-cell" largura="30%">
                        Área · destino
                      </Th>
                      <Th className="hidden xl:table-cell" largura="20%">
                        Origem
                      </Th>
                      <Th largura={72} alinhar="right">
                        Qtd.
                      </Th>
                    </tr>
                  </thead>
                  {porTipo.map((g) => (
                    <tbody key={g.tipo}>
                      <tr>
                        <th colSpan={4} scope="colgroup" className="border-b border-line-soft bg-subtle px-cartao py-1.5 text-left text-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
                          {g.rotulo}
                          <span className="numero ml-2 font-normal tracking-normal text-muted">{g.linhas.length}</span>
                        </th>
                      </tr>
                      {g.linhas.map((l) => (
                        <LinhaLink key={l.id} href={`/eventos/${id}/itens/${l.id}`} rotulo={`Abrir ${l.nome}`}>
                          <th scope="row" className="border-b border-line-row py-2.5 pl-cartao pr-3 text-left font-normal">
                            <span className="flex min-w-0 items-center gap-2.5">
                              {g.tipo === "PROJETO" &&
                                (l.capaId ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={`/api/anexos/${l.capaId}?w=96`} alt="" loading="lazy" decoding="async" className="h-8 w-11 shrink-0 rounded-chip border border-line bg-white object-contain" />
                                ) : (
                                  <span aria-hidden className="grid h-8 w-11 shrink-0 place-items-center rounded-chip border border-line bg-subtle text-meta">
                                    <Icone nome="camadas" className="size-3.5" />
                                  </span>
                                ))}
                              <span className="min-w-0">
                                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="line-clamp-2 text-corpo text-ink" title={l.nome}>
                                    {l.nome}
                                  </span>
                                  {l.posAta ? <Tag tom="info">depois da ata</Tag> : l.registro.justificativaAjuste ? <Tag tom="warning">ajustado</Tag> : null}
                                </span>
                                <span className="block truncate text-pequeno text-muted xl:hidden">
                                  <span className="sm:hidden">
                                    {l.areaNome ?? "Logística"}
                                    {l.destino ? ` · ${l.destino}` : ""} ·{" "}
                                  </span>
                                  {origemVisivel(l)}
                                </span>
                              </span>
                            </span>
                          </th>
                          <td className="hidden border-b border-line-row px-3 py-2.5 text-pequeno text-ink-2 sm:table-cell">
                            {l.areaNome ?? "Logística"}
                            {l.destino && <span className="text-muted"> · {l.destino}</span>}
                          </td>
                          <td className="hidden border-b border-line-row px-3 py-2.5 text-pequeno text-ink-3 xl:table-cell">{origemVisivel(l)}</td>
                          <td className="numero border-b border-line-row py-2.5 pl-3 pr-cartao text-right text-corpo font-medium text-ink">{l.quantidade}</td>
                        </LinhaLink>
                      ))}
                    </tbody>
                  ))}
                </table>
              )}
            </Section>
          </div>

          {galeria.length > 0 && (
            <Section titulo="Galeria dos projetos" sub="O que vai ser montado. Abra um projeto para ver as peças e quem pediu.">
              <ul className="m-0 grid list-none grid-cols-2 gap-3 px-cartao py-4 sm:grid-cols-3 xl:grid-cols-4">
                {galeria.map((g) => (
                  <li key={g.codigo ?? g.nome} className="overflow-hidden rounded-cartao border border-line bg-surface transition-colors duration-150 hover:border-line-strong">
                    <Link href={`/eventos/${id}/itens/${g.ids[0]}`} className="block no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      {/* Dentro do link a capa é só imagem (sem botão de zoom); o zoom fica na tela do item. */}
                      {g.capaId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/anexos/${g.capaId}?w=320`} alt={g.nome} loading="lazy" decoding="async" className="block aspect-[4/3] w-full border-b border-line-soft bg-white object-contain" />
                      ) : (
                        <div className="grid aspect-[4/3] w-full place-items-center border-b border-line-soft bg-subtle text-meta">
                          <Icone nome="camadas" tamanho={20} />
                        </div>
                      )}
                      <div className="px-3 py-2.5">
                        <p className="m-0 flex items-start justify-between gap-2">
                          <span className="line-clamp-2 min-w-0 text-corpo font-medium text-ink" title={g.nome}>
                            {g.nome}
                          </span>
                          <ChipMono className="shrink-0">× {g.quantidade}</ChipMono>
                        </p>
                        <p className="mb-0 mt-0.5 truncate text-rotulo text-muted" title={[...g.destinos].join(" · ")}>
                          {[...g.destinos].join(" · ") || [...g.areas].join(" · ")}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Section titulo="Datas">
            <ol className="m-0 list-none px-cartao py-3.5">
              {datas.map((d, i) => (
                <li key={d.rotulo} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < datas.length - 1 && <span aria-hidden className="absolute left-[4px] top-3 h-full w-px bg-line" />}
                  <span aria-hidden className={cn("relative mt-1.5 block size-[9px] shrink-0 rounded-full ring-2 ring-surface", d.atual ? "bg-accent" : d.feito ? "bg-ink-3" : "bg-line-strong")} />
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <span className={cn("text-corpo", d.atual ? "font-medium text-ink" : d.feito ? "text-ink-2" : "text-ink-3")}>{d.rotulo}</span>
                    <span className="numero shrink-0 text-pequeno text-ink-2">{d.quando}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section titulo="Quem está envolvido">
            <div className="flex items-center gap-2.5 border-b border-line-row px-cartao py-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-bg text-pequeno font-semibold text-ink-2">
                {ev.responsavel.nome.slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-corpo text-ink">{ev.responsavel.nome}</span>
                <span className="block text-rotulo text-muted">responsável na logística</span>
              </span>
            </div>
            {areasEnvolvidas.length > 0 ? (
              <ul className="m-0 list-none px-cartao py-2">
                {areasEnvolvidas.map(([nome, n]) => (
                  <li key={nome} className="flex items-baseline justify-between gap-3 py-1 text-pequeno">
                    <span className="truncate text-ink-2">{nome}</span>
                    <span className="numero shrink-0 text-muted">
                      {n} {n === 1 ? "item" : "itens"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 px-cartao py-3 text-pequeno text-muted">Nenhuma área enviou necessidades ainda.</p>
            )}
          </Section>

          {ajustes.length > 0 && (
            <Section titulo="Ajustes recentes" sub="Quantidades, peças de projeto, retiradas e vínculos">
              <ul className="m-0 list-none p-0">
                {ajustes.slice(0, 5).map((h) => (
                  <li key={h.id}>
                    <Link href={`/eventos/${id}/itens/${h.entidadeId}`} className="block border-b border-line-row px-cartao py-2.5 no-underline transition-colors duration-150 hover:bg-subtle">
                      <span className="line-clamp-2 text-pequeno text-ink-2" title={h.descricao}>
                        {h.descricao}
                      </span>
                      <span className="mt-0.5 block text-rotulo text-muted">
                        {h.usuario?.nome ?? "Sistema"} · <span className="numero">{diaMesHora(h.criadoEm)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            titulo="Atividade"
            acoes={
              <Link href={`/eventos/${id}/historico`} className="link text-pequeno">
                Ver tudo
              </Link>
            }
          >
            <LinhaTempoAgrupada
              compacta
              vazio={<EmptyState compact title="Sem registros" />}
              entradas={historico.map((h) => {
                const c = classificarHistorico(h);
                return { id: h.id, em: h.criadoEm, titulo: c.titulo, detalhe: c.detalhe || null, autor: h.usuario?.nome ?? null, ...iconeHistorico(h.entidade, h.acao) };
              })}
            />
          </Section>

          <Section titulo="Atalhos">
            {veOs && versoes.length > 0 && (
              <Atalho href={`/impressao/os/${id}`} icone="imprimir" novaAba>
                Imprimir OS <Codigo className="text-ink-3">v{versoes[0].numero}</Codigo>
              </Atalho>
            )}
            <Atalho href={`/eventos/${id}/solicitacoes`} icone="solicitacoes">
              Solicitações do evento
            </Atalho>
            {veArena && (
              <Atalho href={slugArena ? `/arena/${slugArena}` : `/arena/nova?evento=${id}`} icone="arena">
                {slugArena ? "Mapa da arena" : "Criar mapa da arena"}
              </Atalho>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
