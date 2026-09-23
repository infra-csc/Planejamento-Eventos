import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarCalendario, type ItemCalendario, type TipoCalendario } from "@/server/services/calendario";
import { hojeISO } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { IconLink } from "@/components/ui/icon-button";
import { Icone } from "@/components/ui/icons";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { FiltroEvento } from "@/components/ui/filtro-evento";

export const metadata: Metadata = { title: "Calendário" };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/**
 * Cor e rótulo de cada tipo, pelos tons semânticos do design system (o vinho fica só para "hoje"):
 * evento = faixa neutra; reunião de OS = info; prazo de resposta = erro; fim da janela = atenção;
 * montagem = sucesso; carga = escuro (neutro de peso).
 */
const TIPO: Record<TipoCalendario, { rotulo: string; ponto: string; fundo: string; texto: string }> = {
  evento: { rotulo: "Evento", ponto: "bg-ink-3", fundo: "bg-control", texto: "text-ink" },
  reuniao: { rotulo: "Reunião de OS", ponto: "bg-info", fundo: "bg-info-bg", texto: "text-info" },
  prazo: { rotulo: "Prazo de resposta", ponto: "bg-danger", fundo: "bg-danger-bg", texto: "text-danger" },
  janela: { rotulo: "Fim da janela de alterações", ponto: "bg-warning", fundo: "bg-warning-bg", texto: "text-warning" },
  montagem: { rotulo: "Montagem", ponto: "bg-success", fundo: "bg-success-bg", texto: "text-success" },
  carga: { rotulo: "Carga do caminhão", ponto: "bg-dark", fundo: "bg-neutral-bg", texto: "text-ink" },
};
const ORDEM_TIPOS = Object.keys(TIPO) as TipoCalendario[];

const pad = (n: number) => String(n).padStart(2, "0");
const addMes = (ano: number, mes: number, n: number) => {
  const d = new Date(Date.UTC(ano, mes - 1 + n, 1));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
};
const semPrefixo = (titulo: string) => titulo.replace(/^(Reunião de OS|Prazo de resposta|Fim da janela de alterações|Montagem|Carga do caminhão) · /, "");

function Compromisso({ i, compacto }: { i: ItemCalendario; compacto?: boolean }) {
  const t = TIPO[i.tipo];
  const dica = `${t.rotulo}: ${i.titulo}${i.detalhe ? ` · ${i.detalhe}` : ""}`;
  if (i.tipo === "evento") {
    const continuacao = !i.faixa?.inicio && !compacto;
    return (
      <Link
        href={i.href}
        title={dica}
        // Continuação da faixa (dias 2..n): repete o mesmo link sem texto — fora do Tab e do leitor de tela.
        {...(continuacao ? { tabIndex: -1, "aria-hidden": true } : {})}
        className={cn("block truncate px-1.5 py-0.5 text-rotulo font-medium no-underline transition-colors hover:bg-line-strong", t.fundo, t.texto, i.faixa?.inicio ? "ml-1 rounded-l-chip" : "-ml-px", i.faixa?.fim ? "mr-1 rounded-r-chip" : "-mr-px")}
      >
        {continuacao ? " " : i.titulo}
      </Link>
    );
  }
  return (
    <Link href={i.href} title={dica} className="mx-1 flex min-w-0 items-center gap-1.5 rounded-chip px-1 py-0.5 text-rotulo text-ink-2 no-underline transition-colors hover:bg-subtle">
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", t.ponto)} />
      {i.hora && <span className="numero shrink-0 text-ink-3">{i.hora}</span>}
      <span className="min-w-0 truncate">{semPrefixo(i.titulo)}</span>
      <span className="sr-only"> · {t.rotulo}</span>
    </Link>
  );
}

/** Linha de lista por dia (agenda lateral e lista do mês no celular). */
function LinhaAgenda({ it, comFaixa }: { it: ItemCalendario; comFaixa?: boolean }) {
  const detalhe = [TIPO[it.tipo].rotulo, comFaixa && it.faixa && it.faixa.total > 1 ? `dia ${it.faixa.dia} de ${it.faixa.total}` : null, it.detalhe].filter(Boolean).join(" · ");
  return (
    <Link href={it.href} className="flex min-h-11 items-start gap-3 px-cartao py-2 no-underline hover:bg-subtle">
      <span className="numero w-11 shrink-0 pt-px text-pequeno text-ink-3">{it.hora ?? ""}</span>
      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", TIPO[it.tipo].ponto)} />
      <span className="min-w-0 flex-1">
        <span className="block text-corpo text-ink">{it.tipo === "evento" ? it.titulo : semPrefixo(it.titulo)}</span>
        <span className="block truncate text-pequeno text-muted">{detalhe}</span>
      </span>
    </Link>
  );
}

function rotuloDia(d: string) {
  const dt = new Date(`${d}T12:00:00Z`);
  return `${DIAS[(dt.getUTCDay() + 6) % 7]}, ${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}`;
}

/** Cabeçalho de um dia nas listas: mesmo estilo na agenda lateral e na lista do celular. */
function CabecalhoDia({ dia, hoje, as: Tag = "h3" }: { dia: string; hoje: string; as?: "h2" | "h3" }) {
  const ehHoje = dia === hoje;
  return (
    <Tag className={cn("m-0 flex items-center gap-2 border-b border-line-row bg-subtle px-cartao py-1.5 text-pequeno font-medium", ehHoje ? "text-accent" : "text-ink-2")}>
      <span className="numero">{rotuloDia(dia)}</span>
      {ehHoje && <span className="text-rotulo font-medium">hoje</span>}
    </Tag>
  );
}

function Legenda({ tipos }: { tipos: TipoCalendario[] }) {
  if (tipos.length === 0) return null;
  return (
    <ul aria-label="Legenda" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-rotulo text-ink-3">
      {tipos.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("shrink-0", t === "evento" ? "h-2 w-3 rounded-xs" : "size-2 rounded-full", TIPO[t].ponto)} />
          {TIPO[t].rotulo}
        </li>
      ))}
    </ul>
  );
}

/**
 * Calendário mensal: dias de evento (faixa), reunião de OS, fim da janela de alterações, montagem,
 * carga do caminhão e prazos de resposta (logística e gestão). Ao lado, a agenda dos próximos dias.
 */
export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string; tipo?: string; evento?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const hoje = hojeISO();
  const m = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hoje.slice(0, 7);
  const ano = Number(m.slice(0, 4));
  const mes = Number(m.slice(5, 7));
  const filtro = sp.tipo && sp.tipo in TIPO ? (sp.tipo as TipoCalendario) : null;
  const eventoFiltro = sp.evento && /^[\w-]{1,64}$/.test(sp.evento) ? sp.evento : null;
  const query = (mesAlvo: string, tipo: TipoCalendario | null, evento: string | null) => `/calendario?mes=${mesAlvo}${tipo ? `&tipo=${tipo}` : ""}${evento ? `&evento=${evento}` : ""}`;

  // Grade de segunda a domingo, cobrindo o mês inteiro.
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const offset = (primeiro.getUTCDay() + 6) % 7;
  const inicioGrade = new Date(Date.UTC(ano, mes - 1, 1 - offset));
  const totalCelulas = Math.ceil((offset + diasNoMes) / 7) * 7;
  const celulas = Array.from({ length: totalCelulas }, (_, i) => {
    const d = new Date(inicioGrade);
    d.setUTCDate(d.getUTCDate() + i);
    return { dia: d.toISOString().slice(0, 10), numero: d.getUTCDate(), doMes: d.getUTCMonth() + 1 === mes };
  });

  const fimAgenda = new Date(Date.parse(`${hoje}T00:00:00Z`) + 21 * 86_400_000).toISOString().slice(0, 10);
  const iniGrade = celulas[0].dia;
  const fimGrade = celulas[celulas.length - 1].dia;
  // Grade e agenda se sobrepõem (mês atual): uma consulta só cobrindo os dois intervalos, separada em memória.
  // Os itens são por dia e a faixa do evento não depende do intervalo pedido, então o recorte é equivalente.
  const sobrepoe = iniGrade <= fimAgenda && hoje <= fimGrade;
  const [itensMes, agenda] = sobrepoe
    ? await listarCalendario(usuario, iniGrade < hoje ? iniGrade : hoje, fimGrade > fimAgenda ? fimGrade : fimAgenda).then((todos) => [todos.filter((i) => i.dia >= iniGrade && i.dia <= fimGrade), todos.filter((i) => i.dia >= hoje && i.dia <= fimAgenda)] as const)
    : await Promise.all([listarCalendario(usuario, iniGrade, fimGrade), listarCalendario(usuario, hoje, fimAgenda)]);
  const doEvento = (i: ItemCalendario) => !eventoFiltro || i.evento.id === eventoFiltro;
  const visiveis = itensMes.filter((i) => (!filtro || i.tipo === filtro) && doEvento(i));
  const porDia = new Map<string, ItemCalendario[]>();
  for (const i of visiveis) porDia.set(i.dia, [...(porDia.get(i.dia) ?? []), i]);
  const agendaPorDia = new Map<string, ItemCalendario[]>();
  for (const i of agenda) agendaPorDia.set(i.dia, [...(agendaPorDia.get(i.dia) ?? []), i]);

  const ant = addMes(ano, mes, -1);
  const prox = addMes(ano, mes, 1);
  const hrefMes = (a: number, me: number) => query(`${a}-${pad(me)}`, filtro, eventoFiltro);
  const tiposPresentes = ORDEM_TIPOS.filter((t) => itensMes.some((i) => i.tipo === t));
  // Eventos com algum compromisso no mês, para filtrar o calendário por um só.
  const eventosDoMes = [...new Map(itensMes.map((i) => [i.evento.id, i.evento])).values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const diasComItens = celulas.filter((c) => c.doMes && porDia.has(c.dia)).map((c) => [c.dia, porDia.get(c.dia)!] as const);
  const mesAtual = m === hoje.slice(0, 7);
  const filtrado = Boolean(filtro || eventoFiltro);
  const limparFiltros = (
    <Link href={query(m, null, null)} className="link text-corpo">
      Limpar filtros
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Calendário"
        divisor
        actions={
          <div className="flex items-center gap-2">
            {!mesAtual && (
              <ButtonLink href={hrefMes(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)))} variant="secondary" size="md" className="no-underline">
                Hoje
              </ButtonLink>
            )}
            <nav aria-label="Mês" className="flex items-center gap-0.5 rounded-controle border border-line bg-surface p-0.5">
              <IconLink href={hrefMes(ant.ano, ant.mes)} label="Mês anterior" scroll={false}>
                <Icone nome="chevron-esquerda" />
              </IconLink>
              <span aria-live="polite" className="min-w-36 text-center text-corpo font-medium capitalize text-ink">
                {MESES[mes - 1]} <span className="numero">{ano}</span>
              </span>
              <IconLink href={hrefMes(prox.ano, prox.mes)} label="Próximo mês" scroll={false}>
                <Icone nome="chevron-direita" />
              </IconLink>
            </nav>
          </div>
        }
      />

      {/* Filtros numa linha: tipo (pílulas com contagem) e evento. */}
      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <Pills
          rotulo="Filtrar por tipo"
          itens={[
            { label: "Tudo", n: itensMes.filter(doEvento).length, href: query(m, null, eventoFiltro), ativo: !filtro },
            ...tiposPresentes.map((t) => ({ label: TIPO[t].rotulo, n: itensMes.filter((i) => i.tipo === t && doEvento(i)).length, href: query(m, t, eventoFiltro), ativo: filtro === t })),
          ]}
        />
        {eventosDoMes.length > 1 && <FiltroEvento eventos={eventosDoMes.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome, n: itensMes.filter((i) => i.evento.id === e.id).length }))} rotuloOculto />}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        {/* Celular: a grade de 7 colunas fica ilegível; mostra os dias do mês que têm algo, em lista. */}
        <section aria-label={`Compromissos de ${MESES[mes - 1]} de ${ano}`} className="overflow-hidden rounded-cartao border border-line bg-surface md:hidden">
          {tiposPresentes.length > 0 && (
            <div className="border-b border-line-soft px-cartao py-2.5">
              <Legenda tipos={tiposPresentes} />
            </div>
          )}
          {diasComItens.length === 0 ? (
            <EmptyState compact title={filtrado ? "Nada com estes filtros" : "Nada marcado neste mês"} description={filtrado ? undefined : "Use as setas para ver outros meses."} action={filtrado ? limparFiltros : undefined} />
          ) : (
            diasComItens.map(([dia, itens]) => (
              <div key={dia} className="border-b border-line-row last:border-b-0">
                <CabecalhoDia dia={dia} hoje={hoje} as="h2" />
                <div className="py-1">
                  {itens.map((it) => (
                    <LinhaAgenda key={it.chave} it={it} comFaixa />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <section aria-label={`Grade de ${MESES[mes - 1]} de ${ano}`} className="hidden overflow-hidden rounded-cartao border border-line bg-surface md:block">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line-soft px-cartao py-2">
            <Legenda tipos={tiposPresentes} />
            {visiveis.length === 0 && (
              <span className="text-pequeno text-muted">
                {filtrado ? (
                  <>
                    Nada com estes filtros ·{" "}
                    <Link href={query(m, null, null)} className="link">
                      limpar
                    </Link>
                  </>
                ) : (
                  "Nada marcado neste mês"
                )}
              </span>
            )}
          </div>
          <div aria-hidden className="grid grid-cols-7 border-b border-line-soft bg-subtle">
            {DIAS.map((d, i) => (
              <div key={d} className={cn("px-2 py-1.5 text-micro font-semibold uppercase tracking-[0.06em]", i >= 5 ? "text-meta" : "text-muted")}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celulas.map((c, i) => {
              const itens = porDia.get(c.dia) ?? [];
              const ehHoje = c.dia === hoje;
              const fimDeSemana = i % 7 >= 5;
              const mostrar = itens.length > 4 ? 3 : 4;
              return (
                <div
                  key={c.dia}
                  aria-label={`${rotuloDia(c.dia)}${ehHoje ? ", hoje" : ""}${itens.length ? `, ${itens.length} ${itens.length === 1 ? "compromisso" : "compromissos"}` : ""}`}
                  role="group"
                  className={cn("flex min-h-28 min-w-0 flex-col border-b border-r border-line-row [&:nth-child(7n)]:border-r-0", !c.doMes ? "bg-subtle" : fimDeSemana && "bg-subtle/50", ehHoje && "bg-selected")}
                >
                  <div className="flex items-center px-1.5 pt-1.5">
                    <span className={cn("numero inline-flex size-6 items-center justify-center rounded-full text-pequeno", ehHoje ? "bg-accent font-semibold text-white" : c.doMes ? "font-medium text-ink" : "text-meta")}>{c.numero}</span>
                  </div>
                  <div className="mt-1 flex min-w-0 flex-col gap-0.5 pb-1.5">
                    {itens.slice(0, mostrar).map((it) => (
                      <Compromisso key={it.chave} i={it} />
                    ))}
                    {itens.length > 4 && (
                      <details className="group">
                        <summary className="mx-1 cursor-pointer list-none rounded-chip px-1 py-0.5 text-rotulo font-medium text-ink-3 hover:bg-subtle hover:text-ink group-open:mb-0.5 [&::-webkit-details-marker]:hidden">
                          <span className="numero group-open:hidden">+{itens.length - 3} mais</span>
                          <span className="hidden group-open:inline">mostrar menos</span>
                        </summary>
                        <div className="flex flex-col gap-0.5">
                          {itens.slice(3).map((it) => (
                            <Compromisso key={it.chave} i={it} compacto />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside aria-labelledby="calendario-agenda" className="overflow-hidden rounded-cartao border border-line bg-surface xl:sticky xl:top-topo-fixo">
          <div className="border-b border-line-soft px-cartao py-3.5">
            <h2 id="calendario-agenda" className="m-0 text-secao font-semibold tracking-[-0.01em]">
              Próximos 21 dias
            </h2>
          </div>
          {agenda.length === 0 ? (
            <EmptyState compact title="Nada nas próximas três semanas" />
          ) : (
            [...agendaPorDia.entries()].map(([dia, itens]) => {
              const linhas = itens.filter((it) => it.tipo !== "evento" || it.faixa?.inicio);
              if (linhas.length === 0) return null;
              return (
                <div key={dia} className="border-b border-line-row last:border-b-0">
                  <CabecalhoDia dia={dia} hoje={hoje} />
                  <div className="py-1">
                    {linhas.map((it) => (
                      <LinhaAgenda key={it.chave} it={it} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </aside>
      </div>
    </>
  );
}
