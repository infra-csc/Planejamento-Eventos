import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TELAS_INATIVAS } from "@/domain/telas";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { listarPendenciasCompra, listarPendenciasResolvidas } from "@/server/services/solicitacoes";
import { pode } from "@/domain/permissions";
import { combinaBusca } from "@/lib/busca";
import { diaMesHora, diaMesISO } from "@/lib/format";
import { hrefCom, paginar } from "@/lib/url";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Codigo, Numero } from "@/components/ui/numero";
import { BuscaUrl } from "@/components/ui/busca-url";
import { ContagemAoVivo } from "@/components/ui/contagem-ao-vivo";
import { FiltroEvento } from "@/components/ui/filtro-evento";
import { TabsNav } from "@/components/ui/tabs-nav";
import { CaptionOculta, Paginacao, Th } from "@/components/ui/tabela";
import { ResolverPendencia } from "./resolver-pendencia";

export const metadata: Metadata = { title: "Pendências de compra" };

const POR_PAGINA = 25;

type Aba = "abertas" | "resolvidas";
const ROTULO_ABA: Record<Aba, string> = { abertas: "Em aberto", resolvidas: "Resolvidas" };

const td = "border-b border-line-row px-3 py-3 align-top";

/**
 * Pendências de compra/locação para a operação (logística, gestão, admin): itens respondidos como
 * parcial ou não atendido com "gerar pendência de compra". A logística marca como resolvida com uma
 * observação, que fica no histórico do item e tira a pendência da lista.
 */
export default async function PendenciasPage({ searchParams }: { searchParams: Promise<{ aba?: string; evento?: string; q?: string; pagina?: string }> }) {
  if (TELAS_INATIVAS.pendencias) notFound();
  const usuario = await requirePermissao("pendencias.ver");
  const sp = await searchParams;
  const aba: Aba = sp.aba === "resolvidas" ? "resolvidas" : "abertas";
  const eventoId = sp.evento && /^[\w-]{1,64}$/.test(sp.evento) ? sp.evento : null;
  const busca = sp.q?.trim().slice(0, 80) || null;
  const podeResolver = pode(usuario, "pendencias.resolver");

  const [todasAbertas, todasResolvidas] = await Promise.all([listarPendenciasCompra(usuario), listarPendenciasResolvidas(usuario)]);
  // Só o que ainda falta de fato (uma correção pode ter atendido o item sem tirar a marca).
  const abertasSemFiltro = todasAbertas.filter((p) => p.faltante > 0);

  // Eventos do filtro: os que têm pendência (aberta ou resolvida), com a contagem das abertas.
  const eventosMapa = new Map<string, { id: string; codigo: string; nome: string; n: number }>();
  for (const p of abertasSemFiltro) {
    const ev = p.solicitacao.evento;
    const e = eventosMapa.get(ev.id) ?? { id: ev.id, codigo: ev.codigo, nome: ev.nome, n: 0 };
    e.n++;
    eventosMapa.set(ev.id, e);
  }
  for (const r of todasResolvidas) if (!eventosMapa.has(r.eventoId)) eventosMapa.set(r.eventoId, { id: r.eventoId, codigo: r.eventoCodigo, nome: r.eventoNome, n: 0 });
  const eventosFiltro = [...eventosMapa.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));

  const abertas = abertasSemFiltro.filter(
    (p) =>
      (!eventoId || p.solicitacao.evento.id === eventoId) &&
      (!busca || combinaBusca(`${p.solicitacao.codigo} ${p.descricao} ${p.observacaoLogistica ?? ""} ${p.solicitacao.evento.codigo} ${p.solicitacao.evento.nome} ${p.solicitacao.area.nome} ${p.respondidoPor?.nome ?? ""}`, busca)),
  );
  const resolvidas = todasResolvidas.filter((r) => (!eventoId || r.eventoId === eventoId) && (!busca || combinaBusca(`${r.codigo} ${r.descricao} ${r.resolucao} ${r.eventoCodigo} ${r.eventoNome} ${r.area} ${r.por ?? ""}`, busca)));
  const contagens: Record<Aba, number> = { abertas: abertas.length, resolvidas: resolvidas.length };

  const params = { aba: sp.aba, evento: sp.evento, q: sp.q, pagina: sp.pagina };
  const hrefPagina = (n: number) => hrefCom("/pendencias", params, { pagina: n === 1 ? null : n });
  const pagAbertas = paginar(abertas, sp.pagina, POR_PAGINA);
  const pagResolvidas = paginar(resolvidas, sp.pagina, POR_PAGINA);
  const total = aba === "abertas" ? pagAbertas.total : pagResolvidas.total;

  const vazio: Record<Aba, [string, string]> = {
    abertas: ["Nada para comprar ou locar", "Itens respondidos como parcial ou não atendido, com pendência de compra, aparecem aqui."],
    resolvidas: ["Nenhuma pendência resolvida", "As resolvidas ficam aqui, com quem resolveu e a observação."],
  };
  const limpar = busca || eventoId ? hrefCom("/pendencias", params, { q: null, evento: null, pagina: null }) : null;

  return (
    <>
      <PageHeader title="Pendências de compra" divisor />

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <BuscaUrl placeholder="Buscar por solicitação, item, evento ou área" ariaLabel="Buscar pendência de compra" />
        {eventosFiltro.length > 1 && <FiltroEvento eventos={eventosFiltro} rotuloOculto />}
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <ContagemAoVivo
          oculto
          n={total}
          singular="pendência"
          plural="pendências"
          complemento={[ROTULO_ABA[aba], eventoId ? eventosMapa.get(eventoId)?.codigo : null, busca ? `busca “${busca}”` : null].filter(Boolean).join(" · ")}
        />
        <TabsNav
          rotulo="Situação das pendências"
          className="mb-0 px-2 pt-1"
          tabs={(Object.keys(ROTULO_ABA) as Aba[]).map((a) => ({ href: hrefCom("/pendencias", params, { aba: a === "abertas" ? null : a, pagina: null }), label: ROTULO_ABA[a], n: contagens[a], ativo: aba === a }))}
        />
        {total === 0 ? (
          <EmptyState
            icone={busca ? "busca" : aba === "abertas" && !eventoId ? "check-circulo" : "caixa"}
            title={busca ? `Nada encontrado para “${busca}”` : eventoId ? "Nenhuma neste evento" : vazio[aba][0]}
            description={busca ? "Confira o código da solicitação ou tente outra palavra do item." : eventoId ? undefined : vazio[aba][1]}
            action={
              limpar ? (
                <Link href={limpar} className="link text-corpo">
                  Limpar filtros
                </Link>
              ) : undefined
            }
          />
        ) : aba === "abertas" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <CaptionOculta>Pendências de compra e locação em aberto</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    <Th>Item</Th>
                    <Th className="hidden lg:table-cell" largura="20%">
                      Evento
                    </Th>
                    <Th className="hidden xl:table-cell" largura={130}>
                      Área
                    </Th>
                    <Th largura={96} alinhar="right">
                      Falta
                    </Th>
                    <Th className="hidden md:table-cell" largura={150}>
                      Marcada por
                    </Th>
                    {podeResolver && (
                      <Th largura={180}>
                        <span className="sr-only">Resolver</span>
                      </Th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pagAbertas.itens.map((p) => {
                    const ev = p.solicitacao.evento;
                    return (
                      <tr key={p.id} className="hover:bg-subtle">
                        <th scope="row" className={`${td} text-left font-normal`}>
                          <span className="line-clamp-2 block min-w-[220px] text-corpo font-medium text-ink" title={p.descricao}>
                            {p.descricao}
                          </span>
                          <span className="mt-0.5 block text-pequeno text-muted">
                            <Link href={`/solicitacoes/${p.solicitacaoId}`} className="text-ink-2 no-underline hover:underline">
                              <Codigo>{p.solicitacao.codigo}</Codigo>
                            </Link>
                            {" · "}
                            <span className="numero">
                              {p.quantidadeAtendida ?? 0} de {p.quantidadeSolicitada}
                            </span>{" "}
                            atendidos
                            <span className="xl:hidden"> · {p.solicitacao.area.nome}</span>
                            <span className="lg:hidden">
                              {" · "}
                              <Codigo>{ev.codigo}</Codigo> {ev.nome}
                            </span>
                          </span>
                          {p.observacaoLogistica && <span className="mt-0.5 block text-pequeno text-ink-2">{p.observacaoLogistica}</span>}
                        </th>
                        <td className={`${td} hidden text-pequeno text-ink-2 lg:table-cell`}>
                          <Link href={`/eventos/${ev.id}`} className="block text-ink-2 no-underline hover:underline">
                            <Codigo>{ev.codigo}</Codigo>
                          </Link>
                          <span className="line-clamp-2 text-muted" title={ev.nome}>
                            {ev.nome}
                          </span>
                          <span className="block text-rotulo text-meta">
                            montagem <span className="numero">{diaMesISO(ev.dataMontagem)}</span>
                          </span>
                        </td>
                        <td className={`${td} hidden text-pequeno text-ink-2 xl:table-cell`}>{p.solicitacao.area.nome}</td>
                        <td className={`${td} text-right`}>
                          <Numero valor={p.faltante} className="block text-corpo font-semibold text-warning" />
                          <span className="block text-rotulo text-meta">{p.faltante === 1 ? "falta" : "faltam"}</span>
                        </td>
                        <td className={`${td} hidden text-pequeno text-ink-2 md:table-cell`}>
                          {p.respondidoPor?.nome ?? "—"}
                          {p.respondidoEm && <span className="numero block text-rotulo text-meta">{diaMesHora(p.respondidoEm)}</span>}
                        </td>
                        {podeResolver && (
                          <td className={`${td} pr-cartao text-right`}>
                            <ResolverPendencia itemId={p.id} codigo={p.solicitacao.codigo} descricao={p.descricao} faltante={p.faltante} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginacao {...pagAbertas} hrefPagina={hrefPagina} />
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <CaptionOculta>Pendências de compra resolvidas</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    <Th>Item</Th>
                    <Th className="hidden lg:table-cell" largura="20%">
                      Evento
                    </Th>
                    <Th className="hidden xl:table-cell" largura={130}>
                      Área
                    </Th>
                    <Th largura={170}>Resolvida por</Th>
                  </tr>
                </thead>
                <tbody>
                  {pagResolvidas.itens.map((r) => (
                    <tr key={r.id} className="hover:bg-subtle">
                      <th scope="row" className={`${td} text-left font-normal`}>
                        <span className="line-clamp-2 block min-w-[220px] text-corpo font-medium text-ink" title={r.descricao}>
                          {r.descricao}
                        </span>
                        <span className="mt-0.5 block text-pequeno text-muted">
                          <Link href={`/solicitacoes/${r.solicitacaoId}`} className="text-ink-2 no-underline hover:underline">
                            <Codigo>{r.codigo}</Codigo>
                          </Link>
                          {r.faltante != null && (
                            <>
                              {" "}
                              · faltavam <Numero valor={r.faltante} />
                            </>
                          )}
                          <span className="xl:hidden"> · {r.area}</span>
                          <span className="lg:hidden">
                            {" · "}
                            <Codigo>{r.eventoCodigo}</Codigo> {r.eventoNome}
                          </span>
                        </span>
                        {r.resolucao && <span className="mt-0.5 block text-pequeno text-ink-2">{r.resolucao}</span>}
                      </th>
                      <td className={`${td} hidden text-pequeno text-ink-2 lg:table-cell`}>
                        <Codigo className="block">{r.eventoCodigo}</Codigo>
                        <span className="line-clamp-2 text-muted" title={r.eventoNome}>
                          {r.eventoNome}
                        </span>
                      </td>
                      <td className={`${td} hidden text-pequeno text-ink-2 xl:table-cell`}>{r.area}</td>
                      <td className={`${td} text-pequeno text-ink-2`}>
                        {r.por ?? "—"}
                        <span className="numero block text-rotulo text-meta">{diaMesHora(r.criadoEm)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao {...pagResolvidas} hrefPagina={hrefPagina} />
          </>
        )}
      </div>
    </>
  );
}
