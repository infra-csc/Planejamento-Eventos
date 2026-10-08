import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { listarHistoricoGeral, resumoHistorico, type RegistroHistorico } from "@/server/services/historico-geral";
import { CATEGORIAS, CATEGORIAS_HISTORICO, PERIODOS_HISTORICO, diferencas, ehCategoria, ehPeriodo, hrefHistorico, rotuloAcao, type PeriodoHistorico } from "@/domain/historico-geral";
import { PERFIL_LABEL } from "@/domain/permissions";
import { addDiasISO, diaMes, diaSemanaCurto, formatarDataHora, hojeISO, hora, isoSP, tempoRelativo } from "@/lib/format";
import { hrefCom } from "@/lib/url";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";
import { EmptyState, Metric, MetricStrip, PageHeader } from "@/components/ui/layout";
import { Tag } from "@/components/ui/badge";
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
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <Pills rotulo="Período" itens={(Object.keys(PERIODOS_HISTORICO) as PeriodoHistorico[]).map((p) => ({ label: PERIODOS_HISTORICO[p].rotulo, href: hrefCom("/historico", params, { periodo: p === "30" ? null : p, pagina: null }), ativo: periodo === p }))} />
        <BuscaUrl placeholder="Buscar no registro" ariaLabel="Buscar no histórico" largura={240} />
        {lista.eventos.length > 0 && <FiltroEvento eventos={lista.eventos.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome, n: e.n }))} rotuloOculto fluido />}
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
              <table data-responsiva className="w-full border-collapse max-lg:[overflow-wrap:anywhere] lg:min-w-[760px]">
                <CaptionOculta>Registros do histórico, do mais recente para o mais antigo</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    <Th largura={72}>Hora</Th>
                    <Th className="hidden md:table-cell" largura={190}>
                      Quem
                    </Th>
                    <Th>O que aconteceu</Th>
                    <Th className="hidden lg:table-cell" largura={210}>
                      Evento
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {porDia(lista.itens).map((d) => (
                    <Fragment key={d.dia}>
                      <tr>
                        <th scope="rowgroup" colSpan={4} className="border-b border-line-row bg-subtle/70 px-cartao py-1.5 text-left text-rotulo font-semibold uppercase tracking-[0.06em] text-ink-3">
                          {rotuloDia(d.dia)}
                        </th>
                      </tr>
                      {d.blocos.map((b) => (b.length === 1 ? <Linha key={b[0].id} h={b[0]} agora={agora} /> : <LinhaSequencia key={b[0].id} hs={b} />))}
                    </Fragment>
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
          {hora(h.em)}
        </time>
        {isoSP(h.em) === isoSP(agora) && <span className="block text-rotulo text-meta">{tempoRelativo(h.em, agora)}</span>}
      </td>
      <td className={cn(td, "hidden text-pequeno md:table-cell")}>
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
          <Tag tom={TOM_CATEGORIA(h.categoria)}>{cat}</Tag>
          <span className="font-medium">{rotuloAcao(h.acao)}</span>
        </div>
        <p className="m-0 mt-1 whitespace-pre-line text-ink-2">{href ? <Link href={href} className="text-ink-2 no-underline decoration-line-strong underline-offset-2 hover:text-accent hover:underline">{h.descricao}</Link> : h.descricao}</p>
        {dif.length > 0 && (
          <details className="mt-1 text-rotulo">
            <summary className="cursor-pointer list-none text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              {h.dadosAntes ? `${dif.length} ${dif.length === 1 ? "campo alterado" : "campos alterados"}` : "ver dados"}
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
        <span className="mt-1 block text-rotulo text-muted lg:hidden">
          <span className="md:hidden">{h.autor?.nome ?? "sistema"}</span>
          {h.evento && (
            <>
              <span className="md:hidden"> · </span>
              <Codigo>{h.evento.codigo}</Codigo>
            </>
          )}
        </span>
      </td>
      <td className={cn(td, "hidden pr-cartao text-pequeno lg:table-cell")}>
        {h.evento && h.eventoId ? (
          <Link href={`/eventos/${h.eventoId}`} className="link block truncate" title={h.evento.nome}>
            <Codigo>{h.evento.codigo}</Codigo> {h.evento.nome}
          </Link>
        ) : (
          <span className="text-meta">—</span>
        )}
      </td>
    </tr>
  );
}

const TOM_CATEGORIA = (c: RegistroHistorico["categoria"]) => (c === "acesso" ? "muted" : c === "admin" ? "warning" : c === "solicitacoes" ? "accent" : c === "biblioteca" ? "success" : "info");

/** "Hoje · seg 06/10", "Ontem · dom 05/10", "ter 29/09". */
function rotuloDia(dia: string): string {
  const hoje = hojeISO();
  const d = new Date(`${dia}T12:00:00-03:00`);
  const base = `${diaSemanaCurto(d)} ${diaMes(d)}`;
  if (dia === hoje) return `Hoje · ${base}`;
  if (dia === addDiasISO(hoje, -1)) return `Ontem · ${base}`;
  return base;
}

/**
 * Registros da página agrupados por dia e, dentro do dia, sequências repetidas (3+ seguidas, mesma ação,
 * mesma pessoa, mesmo evento, até 10 min entre uma e outra) num bloco só: a reunião que inclui 40 linhas
 * vira uma entrada, e o "Ata fechada" logo depois não se perde no meio.
 */
function porDia(itens: RegistroHistorico[]) {
  const dias: Array<{ dia: string; n: number; blocos: RegistroHistorico[][] }> = [];
  for (const h of itens) {
    const dia = isoSP(h.em);
    let d = dias.at(-1);
    if (!d || d.dia !== dia) dias.push((d = { dia, n: 0, blocos: [] }));
    d.n++;
    const ult = d.blocos.at(-1);
    const a = ult?.at(-1);
    if (ult && a && a.acao === h.acao && a.entidade === h.entidade && a.autor?.id === h.autor?.id && a.eventoId === h.eventoId && Math.abs(a.em.getTime() - h.em.getTime()) <= 10 * 60_000) ult.push(h);
    else d.blocos.push([h]);
  }
  // Sequências de 2 ficam como 2 linhas normais (agrupar não ajuda).
  for (const d of dias) d.blocos = d.blocos.flatMap((b) => (b.length >= 3 ? [b] : b.map((h) => [h])));
  return dias;
}

function LinhaSequencia({ hs }: { hs: RegistroHistorico[] }) {
  const h = hs[0];
  const fim = hs[hs.length - 1];
  const cat = h.categoria ? CATEGORIAS_HISTORICO[h.categoria].rotulo : h.entidade;
  const visiveis = 3;
  const item = (x: RegistroHistorico) => {
    const href = hrefHistorico(x);
    return (
      <li key={x.id} className="text-ink-2">
        {href ? (
          <Link href={href} className="text-ink-2 no-underline decoration-line-strong underline-offset-2 hover:text-accent hover:underline">
            {x.descricao}
          </Link>
        ) : (
          x.descricao
        )}
      </li>
    );
  };
  return (
    <tr className="hover:bg-subtle/60">
      <td className={cn(td, "numero whitespace-nowrap pl-cartao text-pequeno text-ink-2")}>
        <time dateTime={h.em.toISOString()} title={`${formatarDataHora(fim.em)} a ${formatarDataHora(h.em)}`}>
          {hora(h.em)}
        </time>
        {hora(fim.em) !== hora(h.em) && <span className="block text-rotulo text-meta">desde {hora(fim.em)}</span>}
      </td>
      <td className={cn(td, "hidden text-pequeno md:table-cell")}>
        {h.autor ? (
          <>
            <span className="block truncate text-ink" title={h.autor.nome}>
              {h.autor.nome}
            </span>
            <span className="block text-rotulo text-muted">{PERFIL_LABEL[h.autor.perfil]}</span>
          </>
        ) : (
          <span className="text-muted">sistema</span>
        )}
      </td>
      <td className={cn(td, "text-pequeno text-ink")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Tag tom={TOM_CATEGORIA(h.categoria)}>{cat}</Tag>
          <span className="font-medium">{rotuloAcao(h.acao)}</span>
          <span className="numero rounded-chip bg-control px-1.5 py-px text-rotulo text-ink-3">{hs.length} registros</span>
        </div>
        <ul className="m-0 mt-1 list-none space-y-0.5 p-0">{hs.slice(0, visiveis).map(item)}</ul>
        {hs.length > visiveis && (
          <details className="group mt-0.5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-0.5 text-rotulo text-accent hover:underline [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">mais {hs.length - visiveis}</span>
              <span className="hidden group-open:inline">recolher</span>
              <Icone nome="chevron-baixo" className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
            </summary>
            <ul className="m-0 mt-0.5 list-none space-y-0.5 p-0">{hs.slice(visiveis).map(item)}</ul>
          </details>
        )}
        <span className="mt-1 block text-rotulo text-muted lg:hidden">
          <span className="md:hidden">{h.autor?.nome ?? "sistema"}</span>
          {h.evento && (
            <>
              <span className="md:hidden"> · </span>
              <Codigo>{h.evento.codigo}</Codigo>
            </>
          )}
        </span>
      </td>
      <td className={cn(td, "hidden pr-cartao text-pequeno lg:table-cell")}>
        {h.evento && h.eventoId ? (
          <Link href={`/eventos/${h.eventoId}`} className="link block truncate" title={h.evento.nome}>
            <Codigo>{h.evento.codigo}</Codigo> {h.evento.nome}
          </Link>
        ) : (
          <span className="text-meta">—</span>
        )}
      </td>
    </tr>
  );
}
