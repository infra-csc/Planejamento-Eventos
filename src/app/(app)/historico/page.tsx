import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { listarHistoricoGeral, resumoHistorico, type RegistroHistorico } from "@/server/services/historico-geral";
import { CATEGORIAS, CATEGORIAS_HISTORICO, PERIODOS_HISTORICO, diferencas, ehCategoria, ehPeriodo, hrefHistorico, rotuloAcao, type PeriodoHistorico } from "@/domain/historico-geral";
import { PERFIL_LABEL } from "@/domain/permissions";
import { diaMesHora, formatarDataHora, tempoRelativo } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";
import { EmptyState, Metric, MetricStrip, PageHeader } from "@/components/ui/layout";
import { Badge, Tag } from "@/components/ui/badge";
import { Codigo } from "@/components/ui/numero";
import { BuscaUrl } from "@/components/ui/busca-url";
import { ContagemAoVivo } from "@/components/ui/contagem-ao-vivo";
import { FiltroEvento } from "@/components/ui/filtro-evento";
import { FiltroPessoa } from "@/components/historico/filtro-pessoa";
import { Pills } from "@/components/ui/pills";
import { TabsNav } from "@/components/ui/tabs-nav";
import { CaptionOculta, Paginacao, Th } from "@/components/ui/tabela";

export const metadata: Metadata = { title: "Histórico" };

type SP = { cat?: string; periodo?: string; evento?: string; quem?: string; q?: string; pagina?: string };

const td = "border-b border-line-row px-3 py-2.5 align-top";

/**
 * Log geral do sistema (logística, gestão, administração): tudo que o app registrou, do mais
 * recente para o mais antigo, com quem fez, quando, em que evento e o que mudou. Filtros na URL:
 * categoria (abas), período (pílulas), evento, pessoa e texto; exporta CSV com os mesmos filtros.
 */
export default async function HistoricoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const usuario = await requirePermissao("historico.ver_tudo");
  const sp = await searchParams;
  const categoria = ehCategoria(sp.cat) ? sp.cat : null;
  const periodo: PeriodoHistorico = ehPeriodo(sp.periodo) ? sp.periodo : "30";
  const eventoId = sp.evento && /^[\w-]{1,64}$/.test(sp.evento) ? sp.evento : null;
  const usuarioId = sp.quem && /^[\w-]{1,64}$/.test(sp.quem) ? sp.quem : null;
  const busca = sp.q?.trim().slice(0, 80) || null;
  const pagina = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);

  const [lista, resumo] = await Promise.all([listarHistoricoGeral(usuario, { categoria, periodo, eventoId, usuarioId, busca, pagina, porPagina: 50 }), resumoHistorico(usuario)]);
  const params = { cat: sp.cat, periodo: periodo === "30" ? undefined : periodo, evento: sp.evento, quem: sp.quem, q: sp.q, pagina: sp.pagina };
  const hrefPagina = (n: number) => hrefCom("/historico", params, { pagina: n === 1 ? null : n });
  const filtrado = Boolean(categoria || eventoId || usuarioId || busca || periodo !== "30");
  const limpar = filtrado ? hrefCom("/historico", {}, {}) : null;
  const agora = new Date();
  const totalAbas = Object.values(lista.porCategoria).reduce((a, b) => a + b, 0);
  const pessoa = usuarioId ? lista.pessoas.find((p) => p.id === usuarioId) : null;
  const evento = eventoId ? lista.eventos.find((e) => e.id === eventoId) : null;
  const complemento = [PERIODOS_HISTORICO[periodo].rotulo, categoria ? CATEGORIAS_HISTORICO[categoria].rotulo : null, evento?.codigo, pessoa?.nome, busca ? `busca “${busca}”` : null].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title="Histórico"
        divisor
        actions={
          <ButtonLink href={hrefCom("/api/historico/csv", params, { pagina: null })} variant="secondary" size="md" className="no-underline" prefetch={false}>
            <Icone nome="download" /> Exportar CSV
          </ButtonLink>
        }
      />

      <MetricStrip>
        <Metric label="Hoje" valor={resumo.hoje} hint="registros" href={hrefCom("/historico", {}, { periodo: "hoje" })} />
        <Metric label="Últimos 7 dias" valor={resumo.dias7} hint="registros" href={hrefCom("/historico", {}, { periodo: "7" })} />
        <Metric label="Últimos 30 dias" valor={resumo.dias30} hint="registros" href={hrefCom("/historico", {}, {})} />
        <Metric label="Pessoas ativas" valor={resumo.pessoas30} hint="nos últimos 30 dias" />
      </MetricStrip>

      {/* Filtros: período, texto, evento e pessoa numa barra só. */}
      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <Pills rotulo="Período" itens={(Object.keys(PERIODOS_HISTORICO) as PeriodoHistorico[]).map((p) => ({ label: PERIODOS_HISTORICO[p].rotulo, href: hrefCom("/historico", params, { periodo: p === "30" ? null : p, pagina: null }), ativo: periodo === p }))} />
        <BuscaUrl placeholder="Buscar no texto do registro" ariaLabel="Buscar no histórico" largura={260} />
        {lista.eventos.length > 0 && <FiltroEvento eventos={lista.eventos.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome, n: e.n }))} rotuloOculto />}
        {lista.pessoas.length > 0 && <FiltroPessoa pessoas={lista.pessoas.map((p) => ({ id: p.id, nome: p.nome, perfil: PERFIL_LABEL[p.perfil], n: p.n }))} />}
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <ContagemAoVivo oculto n={lista.total} singular="registro" plural="registros" complemento={complemento} />
        <TabsNav
          rotulo="Categoria do registro"
          className="mb-0 px-2 pt-1"
          tabs={[
            { href: hrefCom("/historico", params, { cat: null, pagina: null }), label: "Tudo", n: totalAbas, ativo: !categoria },
            ...CATEGORIAS.filter((c) => lista.porCategoria[c] > 0 || c === categoria).map((c) => ({ href: hrefCom("/historico", params, { cat: c, pagina: null }), label: CATEGORIAS_HISTORICO[c].rotulo, n: lista.porCategoria[c], ativo: categoria === c })),
          ]}
        />
        {lista.total === 0 ? (
          <EmptyState
            icone={busca ? "busca" : "relogio"}
            title={busca ? `Nada encontrado para “${busca}”` : filtrado ? "Nada com estes filtros" : "Nada registrado ainda"}
            description={busca ? "Tente outra palavra: a busca olha o texto do registro e o nome da ação." : filtrado ? "Amplie o período ou tire um dos filtros." : "Cada ação no app (eventos, solicitações, biblioteca, acessos) aparece aqui."}
            action={
              limpar ? (
                <Link href={limpar} className="link text-corpo">
                  Limpar filtros
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <CaptionOculta>Registros do histórico, do mais recente para o mais antigo</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    <Th largura={118}>Quando</Th>
                    <Th largura={190}>Quem</Th>
                    <Th>O que aconteceu</Th>
                    <Th className="hidden lg:table-cell" largura={210}>
                      Evento
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((h) => (
                    <Linha key={h.id} h={h} agora={agora} />
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao total={lista.total} pagina={lista.pagina} paginas={lista.paginas} de={(lista.pagina - 1) * lista.porPagina} porPagina={lista.porPagina} hrefPagina={hrefPagina} />
          </>
        )}
      </div>
    </>
  );
}

function Linha({ h, agora }: { h: RegistroHistorico; agora: Date }) {
  const href = hrefHistorico(h);
  const dif = diferencas(h.dadosAntes, h.dadosDepois);
  const cat = h.categoria ? CATEGORIAS_HISTORICO[h.categoria].rotulo : h.entidade;
  return (
    <tr className="hover:bg-subtle/60">
      <td className={cn(td, "numero whitespace-nowrap pl-cartao text-pequeno text-ink-2")}>
        <time dateTime={h.em.toISOString()} title={formatarDataHora(h.em)}>
          {diaMesHora(h.em)}
        </time>
        <span className="block text-rotulo text-meta">{tempoRelativo(h.em, agora)}</span>
      </td>
      <td className={cn(td, "text-pequeno")}>
        {h.autor ? (
          <>
            <span className="block truncate text-ink" title={h.autor.nome}>
              {h.autor.nome}
            </span>
            <span className="block text-rotulo text-muted">
              {PERFIL_LABEL[h.autor.perfil]}
              {h.verComo && <span title={`Vendo como ${h.verComo}`}> · como {h.verComo}</span>}
            </span>
          </>
        ) : (
          <span className="text-muted">{h.entidade === "acesso" ? "—" : "sistema"}</span>
        )}
      </td>
      <td className={cn(td, "text-pequeno text-ink")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Tag tom={h.categoria === "acesso" ? "muted" : h.categoria === "admin" ? "warning" : h.categoria === "solicitacoes" ? "accent" : h.categoria === "biblioteca" ? "success" : "info"}>{cat}</Tag>
          <span className="font-medium">{rotuloAcao(h.acao)}</span>
        </div>
        <p className="m-0 mt-1 whitespace-pre-line text-ink-2">{href ? <Link href={href} className="link">{h.descricao}</Link> : h.descricao}</p>
        {dif.length > 0 && (
          <details className="mt-1 text-rotulo">
            <summary className="cursor-pointer list-none text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              {h.dadosAntes ? `${dif.length} ${dif.length === 1 ? "campo alterado" : "campos alterados"}` : "dados gravados"}
            </summary>
            <dl className="m-0 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-controle bg-subtle px-2.5 py-1.5">
              {dif.map((d) => (
                <div key={d.campo} className="contents">
                  <dt className="numero text-muted">{d.campo}</dt>
                  <dd className="m-0 break-words text-ink-2">
                    {d.antes !== null && (
                      <>
                        <s className="text-meta">{d.antes}</s>{" "}
                      </>
                    )}
                    {d.depois ?? <span className="text-meta">(vazio)</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </td>
      <td className={cn(td, "hidden pr-cartao text-pequeno lg:table-cell")}>
        {h.evento && h.eventoId ? (
          <Link href={`/eventos/${h.eventoId}`} className="link block truncate" title={h.evento.nome}>
            <Codigo>{h.evento.codigo}</Codigo> {h.evento.nome}
          </Link>
        ) : (
          <span className="text-meta">—</span>
        )}
        {!h.evento && h.categoria && <Badge tom="muted" className="mt-0.5 hidden">{cat}</Badge>}
      </td>
    </tr>
  );
}
