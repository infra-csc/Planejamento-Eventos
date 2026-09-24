import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TELAS_INATIVAS } from "@/domain/telas";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { consolidarPeriodo } from "@/server/services/consolidacao";
import { listarPecas } from "@/server/services/catalogo";
import { listarPendenciasCompra } from "@/server/services/solicitacoes";
import { SETOR_LABEL } from "@/domain/os";
import type { PecaConsolidada } from "@/domain/consolidacao";
import { addDiasISO, diaMesISO, hojeISO } from "@/lib/format";
import { combinaBusca } from "@/lib/busca";
import { hrefCom, ordenar, paginar, proximaOrdem } from "@/lib/url";
import { BarraProgresso, EmptyState, Metric, MetricStrip, PageHeader } from "@/components/ui/layout";
import { Badge, Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { Pills } from "@/components/ui/pills";
import { BuscaUrl } from "@/components/ui/busca-url";
import { ContagemAoVivo } from "@/components/ui/contagem-ao-vivo";
import { TabsNav } from "@/components/ui/tabs-nav";
import { CaptionOculta, Paginacao, Th, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";

export const metadata: Metadata = { title: "Demanda de peças" };

const JANELAS = [15, 30, 60] as const;
const POR_PAGINA = 25;

type Aba = "todas" | "faltando" | "pendencias";
const ROTULO_ABA: Record<Aba, string> = { todas: "Todas", faltando: "Faltando", pendencias: "Pendências de compra" };

/** Quanto falta para cobrir o pico com o estoque próprio (0 = coberta). */
const faltaDe = (p: PecaConsolidada) => Math.max(0, p.pico - p.estoque);

/** Data curta (dd/mm) de um ISO "aaaa-mm-dd", em <time> com algarismos tabulares. */
function DiaMes({ iso, className }: { iso: string | null | undefined; className?: string }) {
  return iso ? (
    <time dateTime={iso} className={className ? `numero ${className}` : "numero"}>
      {diaMesISO(iso)}
    </time>
  ) : (
    <span className="numero">—</span>
  );
}

/** Eventos do pico: código em mono, quantidade tabular. */
function EventosDoPico({ eventos }: { eventos: PecaConsolidada["eventosNoPico"] }) {
  if (eventos.length === 0) return <>—</>;
  return (
    <>
      {eventos.map((e, i) => (
        <span key={e.codigo + i}>
          {i > 0 && " · "}
          <Codigo>{e.codigo}</Codigo> <Numero valor={e.quantidade} />
          {e.projetado ? " (projetado)" : ""}
        </span>
      ))}
    </>
  );
}

export default async function ConsolidacaoPage({ searchParams }: { searchParams: Promise<{ dias?: string; aba?: string; q?: string; ordem?: string; dir?: string; pagina?: string }> }) {
  if (TELAS_INATIVAS.consolidacao) notFound();
  const usuario = await requirePermissao("consolidacao.ver");
  const sp = await searchParams;
  const dias = JANELAS.find((d) => String(d) === sp.dias) ?? 30;
  const abaPedida: Aba = sp.aba === "faltando" || sp.aba === "pendencias" ? sp.aba : "todas";
  const busca = sp.q?.trim().slice(0, 80) || null;
  const inicio = hojeISO();
  const fim = addDiasISO(inicio, dias);
  const [{ eventos, pecas }, pendenciasTodas, catalogo] = await Promise.all([consolidarPeriodo(usuario, { inicio, fim }), listarPendenciasCompra(usuario), listarPecas(usuario)]);
  const familia = new Map(catalogo.map((p) => [p.id, p.familia]));

  const demandadas = pecas.filter((p) => p.pico > 0).sort((a, b) => b.pico - a.pico || a.codigo.localeCompare(b.codigo));
  // Estoque ainda não é cadastrado no dia a dia: sem nenhuma peça com estoque, "falta" seria tudo e só assustaria.
  // Colunas de estoque/falta e a aba "Faltando" aparecem quando o catálogo tiver estoque de verdade.
  const temEstoque = pecas.some((p) => p.estoque > 0);
  const aba: Aba = abaPedida === "faltando" && !temEstoque ? "todas" : abaPedida;
  const unidadesPico = demandadas.reduce((a, p) => a + p.pico, 0);
  const simultaneas = demandadas.filter((p) => p.eventosNoPico.length > 1).length;
  const pendencias = pendenciasTodas.filter((p) => p.solicitacao.evento.status !== "CANCELADO" && p.solicitacao.evento.status !== "ENCERRADO" && p.faltante > 0);

  // Busca em memória: o serviço devolve o período inteiro de uma vez.
  const pecasBuscadas = busca ? demandadas.filter((p) => combinaBusca(`${p.codigo} ${p.nome} ${familia.get(p.pecaId) ?? ""} ${SETOR_LABEL[p.setor]}`, busca)) : demandadas;
  const faltando = pecasBuscadas.filter((p) => faltaDe(p) > 0);
  const pendenciasBuscadas = busca
    ? pendencias.filter((p) => combinaBusca(`${p.solicitacao.codigo} ${p.descricao} ${p.observacaoLogistica ?? ""} ${p.solicitacao.evento.codigo} ${p.solicitacao.evento.nome} ${p.solicitacao.area.nome}`, busca))
    : pendencias;
  const contagens: Record<Aba, number> = { todas: pecasBuscadas.length, faltando: faltando.length, pendencias: pendenciasBuscadas.length };

  const params = { dias: sp.dias, aba: sp.aba, q: sp.q, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina };
  const hrefPagina = (n: number) => hrefCom("/consolidacao", params, { pagina: n === 1 ? null : n });

  const th = (chave: string, label: string, largura?: number, alinhar?: "left" | "right") => {
    const prox = proximaOrdem(sp.ordem, sp.dir, chave);
    return (
      <ThOrdenavel
        label={label}
        ativo={sp.ordem === chave}
        dir={sp.ordem === chave ? (sp.dir === "desc" ? "desc" : "asc") : undefined}
        href={hrefCom("/consolidacao", params, { ordem: prox.ordem, dir: prox.dir, pagina: null })}
        largura={largura}
        alinhar={alinhar}
      />
    );
  };

  // Sem ordenação escolhida: maior pico primeiro (em "Faltando", a maior falta).
  const basePecas = aba === "faltando" ? [...faltando].sort((a, b) => faltaDe(b) - faltaDe(a) || b.pico - a.pico) : pecasBuscadas;
  const pagPecas = paginar(ordenar(basePecas, { peca: (p) => p.codigo, pico: (p) => p.pico, estoque: (p) => p.estoque, falta: (p) => faltaDe(p) }, sp.ordem, sp.dir), sp.pagina, POR_PAGINA);
  const pagPendencias = paginar(pendenciasBuscadas, sp.pagina, POR_PAGINA);

  const vazio: Record<Aba, [string, string]> = {
    todas: ["Nenhuma demanda de peças no período", "Eventos entram aqui quando têm ata ou solicitações com itens."],
    faltando: ["Nenhuma peça faltando", "O estoque próprio cobre o pico de todas as peças demandadas no período."],
    pendencias: ["Nenhuma pendência aberta", "Toda resposta parcial ou não atendida aparece aqui até ser resolvida."],
  };
  const acaoVazio = busca ? (
    <ButtonLink href={hrefCom("/consolidacao", params, { q: null, pagina: null })} variant="secondary" size="md" className="no-underline">
      Limpar busca
    </ButtonLink>
  ) : aba === "todas" && dias < 60 ? (
    <ButtonLink href={hrefCom("/consolidacao", params, { dias: 60, pagina: null })} variant="secondary" size="md" className="no-underline">
      Ver os próximos 60 dias
    </ButtonLink>
  ) : aba === "faltando" ? (
    <ButtonLink href={hrefCom("/consolidacao", params, { aba: null, ordem: null, dir: null, pagina: null })} variant="secondary" size="md" className="no-underline">
      Ver todas as peças
    </ButtonLink>
  ) : undefined;
  const total = aba === "pendencias" ? pagPendencias.total : pagPecas.total;

  const seta = <Icone nome="chevron-direita" className="inline-block align-middle" />;

  return (
    <>
      <PageHeader title="Demanda de peças" divisor />

      <MetricStrip>
        <Metric label="Eventos no período" valor={eventos.length} hint={eventos.length ? eventos.map((e) => e.codigo).join(" · ") : "nenhum evento"} />
        <Metric label="Peças demandadas" valor={demandadas.length} hint="tipos com demanda no pico" />
        <Metric label="Unidades no pico" valor={<Numero valor={unidadesPico} />} hint="soma dos picos de cada peça" />
        <Metric label="Disputadas" valor={simultaneas} hint={simultaneas ? "pedidas por mais de um evento no mesmo dia" : "nenhuma peça disputada"} />
      </MetricStrip>

      {/* Barra de filtros compacta (template de pedidos): busca, janela de tempo e o que falta à direita. */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <BuscaUrl
          key={aba === "pendencias" ? "busca-pendencias" : "busca-pecas"}
          placeholder={aba === "pendencias" ? "Buscar por solicitação, item ou evento" : "Buscar peça por código ou nome"}
          ariaLabel={aba === "pendencias" ? "Buscar pendência de compra" : "Buscar peça por código ou nome"}
        />
        {aba !== "pendencias" && (
          <span className="flex flex-wrap items-center gap-2.5">
            <Pills rotulo="Janela de tempo" itens={JANELAS.map((d) => ({ label: `${d} dias`, href: hrefCom("/consolidacao", params, { dias: d === 30 ? null : d, pagina: null }), ativo: d === dias }))} />
            <span className="text-pequeno text-muted">
              <DiaMes iso={inicio} /> – <DiaMes iso={fim} />
            </span>
          </span>
        )}
        {temEstoque && contagens.faltando > 0 && aba !== "faltando" && (
          <Link href={hrefCom("/consolidacao", params, { aba: "faltando", ordem: null, dir: null, pagina: null })} className="inline-flex items-center gap-1.5 text-pequeno font-medium text-danger no-underline hover:underline sm:ml-auto">
            <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full bg-danger" />
            <Numero valor={contagens.faltando} /> {contagens.faltando === 1 ? "peça faltando" : "peças faltando"}
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <ContagemAoVivo
          oculto
          n={total}
          singular={aba === "pendencias" ? "pendência de compra" : "peça"}
          plural={aba === "pendencias" ? "pendências de compra" : "peças"}
          complemento={[aba === "pendencias" ? null : `${ROTULO_ABA[aba]} · ${dias} dias`, busca ? `busca “${busca}”` : null].filter(Boolean).join(" · ")}
        />
        <TabsNav
          rotulo="Recortes da demanda"
          className="mb-0 px-2 pt-1"
          tabs={(Object.keys(ROTULO_ABA) as Aba[]).filter((a) => temEstoque || a !== "faltando").map((a) => ({ href: hrefCom("/consolidacao", params, { aba: a === "todas" ? null : a, ordem: null, dir: null, pagina: null }), label: ROTULO_ABA[a], n: contagens[a], ativo: aba === a }))}
        />
        {total === 0 ? (
          <EmptyState
            icone={busca ? "busca" : "caixa"}
            title={busca ? `Nada encontrado para “${busca}”` : vazio[aba][0]}
            description={busca ? (aba === "pendencias" ? "Confira o código da solicitação ou tente outra palavra do item." : "Confira o código ou tente outra palavra do nome da peça.") : vazio[aba][1]}
            action={acaoVazio}
          />
        ) : aba === "pendencias" ? (
          <>
            {/* Tablet e desktop: tabela com a linha inteira clicável. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] border-collapse">
                <CaptionOculta>Pendências de compra e locação</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    <Th largura={104}>Solicitação</Th>
                    <Th>Item</Th>
                    <Th className="hidden lg:table-cell" largura="22%">
                      Evento
                    </Th>
                    <Th className="hidden xl:table-cell" largura={130}>
                      Área
                    </Th>
                    <Th className="hidden lg:table-cell" largura={100}>
                      Montagem
                    </Th>
                    <Th largura={112} alinhar="right">
                      Falta
                    </Th>
                    <Th largura={44}>
                      <span className="sr-only">Abrir</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {pagPendencias.itens.map((p) => {
                    const ev = p.solicitacao.evento;
                    return (
                      <LinhaLink key={p.id} href={`/solicitacoes/${p.solicitacaoId}`} rotulo={`Abrir ${p.solicitacao.codigo} — ${p.descricao}`}>
                        <td className="border-b border-line-row py-3 pl-cartao pr-3 align-top text-pequeno font-medium text-ink">
                          <Codigo>{p.solicitacao.codigo}</Codigo>
                        </td>
                        <th scope="row" className="border-b border-line-row px-3 py-3 text-left font-normal">
                          <span className="line-clamp-2 block min-w-[220px] text-corpo font-medium text-ink" title={p.descricao}>
                            {p.descricao}
                          </span>
                          {p.observacaoLogistica && <span className="mt-0.5 block text-pequeno text-ink-2">{p.observacaoLogistica}</span>}
                          <span className="mt-0.5 block text-pequeno text-muted xl:hidden">
                            {p.solicitacao.area.nome}
                            <span className="lg:hidden">
                              {" · "}
                              <Codigo>{ev.codigo}</Codigo> {ev.nome} · montagem <DiaMes iso={ev.dataMontagem} />
                            </span>
                          </span>
                        </th>
                        <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 lg:table-cell">
                          <Codigo className="block">{ev.codigo}</Codigo>
                          <span className="line-clamp-2 text-muted" title={ev.nome}>
                            {ev.nome}
                          </span>
                        </td>
                        <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 xl:table-cell">{p.solicitacao.area.nome}</td>
                        <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-2 lg:table-cell">
                          <DiaMes iso={ev.dataMontagem} />
                        </td>
                        <td className="border-b border-line-row px-3 py-3 text-right">
                          <Badge tom="warning">
                            faltam <Numero valor={p.faltante} />
                          </Badge>
                        </td>
                        <td className="border-b border-line-row py-3 pl-1 pr-cartao text-right text-ink-3">{seta}</td>
                      </LinhaLink>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Celular: um cartão por pendência, o cartão inteiro é o link. */}
            <ul aria-label="Pendências de compra e locação" className="m-0 list-none p-0 md:hidden">
              {pagPendencias.itens.map((p) => {
                const ev = p.solicitacao.evento;
                return (
                  <li key={p.id} className="border-b border-line-row last:border-b-0">
                    <Link
                      href={`/solicitacoes/${p.solicitacaoId}`}
                      className="flex items-start gap-3 px-cartao py-3.5 text-ink no-underline transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <Codigo className="text-pequeno font-medium text-ink-2">{p.solicitacao.codigo}</Codigo>
                          <Badge tom="warning">
                            faltam <Numero valor={p.faltante} />
                          </Badge>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-corpo font-medium">{p.descricao}</span>
                        {p.observacaoLogistica && <span className="mt-0.5 block text-pequeno text-ink-2">{p.observacaoLogistica}</span>}
                        <span className="mt-1 block text-pequeno text-muted">
                          <Codigo>{ev.codigo}</Codigo> {ev.nome}
                        </span>
                        <span className="block text-pequeno text-muted">
                          {p.solicitacao.area.nome} · montagem <DiaMes iso={ev.dataMontagem} />
                        </span>
                      </span>
                      <Icone nome="chevron-direita" className="mt-0.5 text-ink-3" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Paginacao {...pagPendencias} hrefPagina={hrefPagina} />
          </>
        ) : (
          <>
            {/* Tablet e desktop: tabela ordenável. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[600px] border-collapse">
                <CaptionOculta>{`Demanda por peça · ${ROTULO_ABA[aba]} · ${dias} dias`}</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    {th("peca", "Peça")}
                    {th("pico", "Necessidade", 124, "right")}
                    {temEstoque && th("estoque", "Estoque", 120, "right")}
                    {temEstoque && th("falta", "Falta", 110, "right")}
                    <Th className="hidden lg:table-cell" largura="30%">
                      Eventos no pico
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {pagPecas.itens.map((p) => {
                    const falta = faltaDe(p);
                    const cobertura = Math.round(Math.min(100, (p.estoque / p.pico) * 100));
                    const disputada = p.eventosNoPico.length > 1;
                    const listaEventos = p.eventosNoPico.map((e) => `${e.codigo} ${e.quantidade}${e.projetado ? " (projetado)" : ""}`).join(" · ");
                    const fam = familia.get(p.pecaId);
                    return (
                      <tr key={p.pecaId} className="hover:bg-subtle">
                        <th scope="row" className="border-b border-line-row px-3 py-3 text-left font-normal">
                          <span className="line-clamp-2 block min-w-[220px] text-corpo font-medium text-ink" title={`${p.codigo} — ${p.nome}`}>
                            <Codigo className="mr-2 text-pequeno text-ink-2">{p.codigo}</Codigo>
                            {p.nome}
                          </span>
                          <span className="mt-0.5 block text-pequeno text-muted">
                            {SETOR_LABEL[p.setor]}
                            {fam ? ` · ${fam}` : ""}
                          </span>
                          {/* Abaixo de lg a coluna de eventos some: os eventos do pico vêm aqui. */}
                          {p.eventosNoPico.length > 0 && (
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-rotulo text-meta lg:hidden">
                              {disputada && <Tag tom="warning">{p.eventosNoPico.length} eventos no mesmo dia</Tag>}
                              <span>
                                <EventosDoPico eventos={p.eventosNoPico} />
                              </span>
                            </span>
                          )}
                        </th>
                        <td className="border-b border-line-row px-3 py-3 text-right">
                          <Numero valor={p.pico} unidade={p.unidade} className="block text-corpo font-medium text-ink" />
                          {p.diaPico && (
                            <span className="block text-rotulo text-meta">
                              pico <DiaMes iso={p.diaPico} />
                            </span>
                          )}
                        </td>
                        {temEstoque && (
                          <>
                            <td className="border-b border-line-row px-3 py-3 text-right">
                              <Numero valor={p.estoque} unidade={p.unidade} className="block text-pequeno text-ink-2" />
                              <span role="img" aria-label={`Cobertura do pico: ${cobertura}%`} className="ml-auto mt-1.5 block w-[72px]">
                                <BarraProgresso pct={cobertura} tom={falta > 0 ? "danger" : "success"} altura={4} />
                              </span>
                              <span className="numero mt-0.5 block text-rotulo text-meta">{cobertura}%</span>
                            </td>
                            <td className="border-b border-line-row px-3 py-3 text-right">
                              {falta > 0 ? (
                                <Badge tom="danger">
                                  faltam <Numero valor={falta} />
                                </Badge>
                              ) : (
                                <span className="text-pequeno text-success">coberta</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="hidden border-b border-line-row py-3 pl-3 pr-cartao text-pequeno text-ink-2 lg:table-cell">
                          {disputada && (
                            <Tag tom="warning" className="mb-1">
                              {p.eventosNoPico.length} eventos no mesmo dia
                            </Tag>
                          )}
                          <span className="line-clamp-2 text-rotulo text-ink-3" title={listaEventos}>
                            <EventosDoPico eventos={p.eventosNoPico} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Celular: uma linha empilhada por peça, necessidade (e falta) à direita. */}
            <ul aria-label={`Demanda por peça · ${ROTULO_ABA[aba]} · ${dias} dias`} className="m-0 list-none p-0 md:hidden">
              {pagPecas.itens.map((p) => {
                const falta = faltaDe(p);
                const disputada = p.eventosNoPico.length > 1;
                const fam = familia.get(p.pecaId);
                return (
                  <li key={p.pecaId} className="flex items-start gap-3 border-b border-line-row px-cartao py-3.5 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <Codigo className="block text-pequeno text-ink-2">{p.codigo}</Codigo>
                      <span className="mt-0.5 line-clamp-2 block text-corpo font-medium text-ink">{p.nome}</span>
                      <span className="mt-0.5 block text-pequeno text-muted">
                        {SETOR_LABEL[p.setor]}
                        {fam ? ` · ${fam}` : ""}
                      </span>
                      {p.eventosNoPico.length > 0 && (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-rotulo text-meta">
                          {disputada && <Tag tom="warning">{p.eventosNoPico.length} eventos no mesmo dia</Tag>}
                          <span>
                            <EventosDoPico eventos={p.eventosNoPico} />
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <Numero valor={p.pico} unidade={p.unidade} className="text-corpo font-medium text-ink" />
                      {p.diaPico && (
                        <span className="text-rotulo text-meta">
                          pico <DiaMes iso={p.diaPico} />
                        </span>
                      )}
                      {temEstoque &&
                        (falta > 0 ? (
                          <Badge tom="danger">
                            faltam <Numero valor={falta} />
                          </Badge>
                        ) : (
                          <span className="text-pequeno text-success">coberta</span>
                        ))}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Paginacao {...pagPecas} hrefPagina={hrefPagina} />
          </>
        )}
      </div>
    </>
  );
}
