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
import { DiaBotao, MaisDoDia } from "@/components/calendario/dia-modal";
import { DIAS, MESES, ORDEM_TIPOS, pad, rotuloDia, semPrefixo, TIPO } from "@/components/calendario/tipos";

export const metadata: Metadata = { title: "Calendário" };

const addMes = (ano: number, mes: number, n: number) => {
  const d = new Date(Date.UTC(ano, mes - 1 + n, 1));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
};

function Compromisso({ i, compacto, coluna = 0 }: { i: ItemCalendario; compacto?: boolean; coluna?: number }) {
  const t = TIPO[i.tipo];
  const dica = `${t.rotulo}: ${i.titulo}${i.detalhe ? ` · ${i.detalhe}` : ""}`;
  if (i.tipo === "evento") {
    // O nome aparece na primeira célula da faixa em cada semana (início do evento ou segunda-feira)
    // e atravessa as células seguintes da mesma semana, que só repetem o fundo.
    const rotulado = compacto || Boolean(i.faixa?.inicio) || coluna === 0;
    const continuacao = !rotulado;
    const diasNaLinha = i.faixa && !compacto ? Math.min(i.faixa.total - i.faixa.dia + 1, 7 - coluna) : 1;
    const fimNaLinha = !i.faixa || i.faixa.dia + diasNaLinha - 1 >= i.faixa.total;
    const margens = (i.faixa?.inicio ? 4 : -1) + (fimNaLinha ? 4 : -1);
    const atravessa = rotulado && diasNaLinha > 1;
    return (
      <Link
        href={i.href}
        title={dica}
        // Continuação da faixa (dias 2..n): repete o mesmo link sem texto — fora do Tab e do leitor de tela.
        {...(continuacao ? { tabIndex: -1, "aria-hidden": true } : {})}
        style={atravessa ? { width: `calc(${diasNaLinha * 100}% + ${diasNaLinha - 1}px - ${margens}px)` } : undefined}
        className={cn("px-1.5 py-0.5 text-rotulo font-medium no-underline transition-colors hover:bg-line-strong", atravessa || continuacao || (i.faixa && i.faixa.total > 1) ? "block h-5 truncate leading-5" : "block leading-snug [overflow-wrap:anywhere]", t.fundo, t.texto, i.faixa?.inicio ? "ml-1 rounded-l-chip" : "-ml-px", i.faixa?.fim ? "mr-1 rounded-r-chip" : "-mr-px", atravessa ? "relative z-10" : "relative z-[1]")}
      >
        {continuacao ? " " : i.titulo}
      </Link>
    );
  }
  return (
    <Link href={i.href} title={dica} className={cn("relative z-[1] mx-1 block rounded-chip px-1.5 py-0.5 text-rotulo leading-snug no-underline transition-[filter] duration-150 [overflow-wrap:anywhere] hover:brightness-95", t.fundo, t.texto)}>
      {i.hora ? <span className="numero mr-1 font-semibold">{i.hora}</span> : <span aria-hidden className={cn("mr-1 inline-block size-1.5 rounded-full align-middle", t.ponto)} />}
      {semPrefixo(i.titulo)}
      <span className="sr-only"> · {t.rotulo}</span>
    </Link>
  );
}

/**
 * Faixa fixa de cada evento de vários dias dentro da semana: o mesmo evento fica na mesma altura em todos
 * os dias que ocupa (com espaço vazio onde o dia não tem aquele evento). Sem isso, cada dia empilhava na
 * própria ordem e a barra de um evento passava por cima do que estava no dia seguinte.
 */
function faixasDaSemana(dias: string[], porDia: Map<string, ItemCalendario[]>) {
  const ordem: string[] = [];
  const inicio = new Map<string, number>();
  const duracao = new Map<string, number>();
  dias.forEach((d, col) => {
    for (const it of porDia.get(d) ?? []) {
      if (it.tipo !== "evento" || !it.faixa || it.faixa.total < 2) continue;
      if (!inicio.has(it.href)) {
        inicio.set(it.href, col);
        duracao.set(it.href, Math.min(it.faixa.total - it.faixa.dia + 1, 7 - col));
        ordem.push(it.href);
      }
    }
  });
  // Primeiro quem começa antes; no empate, o mais longo por cima.
  ordem.sort((a, b) => inicio.get(a)! - inicio.get(b)! || duracao.get(b)! - duracao.get(a)!);
  const faixa = new Map<string, number>();
  const ocupadaAte: number[] = [];
  for (const h of ordem) {
    const ini = inicio.get(h)!;
    let k = ocupadaAte.findIndex((fim) => fim < ini);
    if (k < 0) k = ocupadaAte.length;
    ocupadaAte[k] = ini + duracao.get(h)! - 1;
    faixa.set(h, k);
  }
  return { faixa, n: ocupadaAte.length };
}

/** Linha de lista por dia (agenda lateral e lista do mês no celular). */
/** Detalhe que ajuda na agenda: local do evento/montagem; nas reuniões e prazos, o rótulo do tipo basta. */
const detalheUtil = (it: ItemCalendario) => (it.tipo === "evento" || it.tipo === "montagem" ? it.detalhe : null);

function LinhaAgenda({ it, comFaixa, colunaHora = true }: { it: ItemCalendario; comFaixa?: boolean; colunaHora?: boolean }) {
  const t = TIPO[it.tipo];
  const detalhe = [t.rotulo, comFaixa && it.faixa && it.faixa.total > 1 ? `dia ${it.faixa.dia} de ${it.faixa.total}` : null, detalheUtil(it)].filter(Boolean).join(" · ");
  return (
    <Link href={it.href} className="flex min-h-11 items-start gap-2.5 px-cartao py-2 no-underline transition-colors duration-150 hover:bg-subtle">
      {/* Hora alinhada numa coluna; sem hora, o ponto do tipo ocupa o mesmo lugar. */}
      <span className={cn("flex shrink-0 items-center gap-1.5 pt-px", colunaHora ? "w-10" : "w-2.5")}>
        {it.hora ? <span className={cn("numero text-pequeno font-semibold", t.texto === "text-ink" ? "text-ink-2" : t.texto)}>{it.hora}</span> : <span aria-hidden className={cn("ml-0.5 mt-1.5 size-2 rounded-full", t.ponto)} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-corpo text-ink">{it.tipo === "evento" ? it.titulo : semPrefixo(it.titulo)}</span>
        <span className="mt-px block truncate text-pequeno text-muted" title={detalhe}>
          {detalhe}
        </span>
      </span>
    </Link>
  );
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
  const agendaTemHora = agenda.some((i) => i.hora);
  const mesTemHora = visiveis.some((i) => i.hora);
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
        {/* Celular: as pílulas rolam de lado numa linha só, em vez de quebrar a trilha. */}
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Pills
          rotulo="Filtrar por tipo"
          className="max-md:flex-nowrap"
          itens={[
            { label: "Tudo", n: itensMes.filter(doEvento).length, href: query(m, null, eventoFiltro), ativo: !filtro },
            ...tiposPresentes.map((t) => ({ label: TIPO[t].rotulo, n: itensMes.filter((i) => i.tipo === t && doEvento(i)).length, href: query(m, t, eventoFiltro), ativo: filtro === t })),
          ]}
        />
        </div>
        {eventosDoMes.length > 1 && <FiltroEvento eventos={eventosDoMes.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome, n: itensMes.filter((i) => i.evento.id === e.id).length }))} rotuloOculto />}
      </div>

      {/* A grade ocupa a largura toda (com a agenda ao lado, cada dia ficava estreito e os nomes cortavam); a agenda vem embaixo. */}
      <div className="flex flex-col gap-5">
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
            (() => {
              // Mês atual: os dias que já passaram ficam recolhidos; a lista começa em hoje.
              // Evento longo (7+ dias) aparece uma vez por bloco, no primeiro dia listado: repetido em todo dia, escondia o resto.
              const semRepetir = (dias: typeof diasComItens) => {
                const vistos = new Set<string>();
                return dias
                  .map(([dia, its]) => [dia, its.filter((it) => !(it.tipo === "evento" && it.faixa && it.faixa.total >= 7) || (!vistos.has(it.href) && vistos.add(it.href)))] as const)
                  .filter(([, its]) => its.length > 0);
              };
              const passados = semRepetir(diasComItens.filter(([dia]) => dia < hoje));
              const proximos = semRepetir(diasComItens.filter(([dia]) => dia >= hoje));
              const blocoDia = ([dia, itens]: (typeof diasComItens)[number]) => (
                <div key={dia} className="border-b border-line-row last:border-b-0">
                  <CabecalhoDia dia={dia} hoje={hoje} as="h2" />
                  <div className="py-1">
                    {itens.map((it) => (
                      <LinhaAgenda key={it.chave} it={it} comFaixa colunaHora={mesTemHora} />
                    ))}
                  </div>
                </div>
              );
              if (passados.length === 0 || proximos.length === 0) return semRepetir(diasComItens).map(blocoDia);
              return (
                <>
                  <details className="group border-b border-line-row">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-cartao py-2.5 text-pequeno text-ink-3 [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="numero">{passados.length}</span> {passados.length === 1 ? "dia anterior" : "dias anteriores"} neste mês
                      </span>
                      <Icone nome="chevron-baixo" className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-line-row">{passados.map(blocoDia)}</div>
                  </details>
                  {proximos.map(blocoDia)}
                </>
              );
            })()
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
              const semana = faixasDaSemana(celulas.slice(i - (i % 7), i - (i % 7) + 7).map((x) => x.dia), porDia);
              // Eventos de vários dias na faixa da semana; o resto (reunião, montagem, evento de 1 dia) vem embaixo.
              const naFaixa = (it: ItemCalendario) => it.tipo === "evento" && semana.faixa.has(it.href);
              const faixas = Array.from({ length: semana.n }, (_, k) => itens.find((it) => naFaixa(it) && semana.faixa.get(it.href) === k) ?? null);
              const soltos = itens.filter((it) => !naFaixa(it));
              const ehHoje = c.dia === hoje;
              const fimDeSemana = i % 7 >= 5;
              // Até 3 linhas por dia (faixas de eventos longos contam); o resto abre o resumo do dia.
              const mostrar = 3;
              return (
                <div
                  key={c.dia}
                  aria-label={`${rotuloDia(c.dia)}${ehHoje ? ", hoje" : ""}${itens.length ? `, ${itens.length} ${itens.length === 1 ? "compromisso" : "compromissos"}` : ""}`}
                  role="group"
                  className={cn("relative flex min-h-[7.25rem] min-w-0 cursor-pointer flex-col border-b border-r border-line-row transition-colors duration-150 hover:bg-subtle/60 [&:nth-child(7n)]:border-r-0", !c.doMes ? "bg-subtle" : fimDeSemana && "bg-subtle/50", ehHoje && "bg-selected")}
                >
                  <div className="flex items-center px-1.5 pt-1.5">
                    <DiaBotao dia={c.dia} numero={c.numero} hoje={hoje} doMes={c.doMes} itens={itens} />
                  </div>
                  <div className="mt-1 flex min-w-0 flex-col gap-0.5 pb-1.5">
                    {faixas.map((it, k) => (it ? <Compromisso key={it.chave} i={it} coluna={i % 7} /> : <span key={`vazio-${k}`} aria-hidden className="block h-5" />))}
                    {soltos.slice(0, Math.max(1, mostrar - faixas.length)).map((it) => (
                      <Compromisso key={it.chave} i={it} coluna={i % 7} />
                    ))}
                    {soltos.length > Math.max(1, mostrar - faixas.length) && <MaisDoDia dia={c.dia} hoje={hoje} itens={itens} n={soltos.length - Math.max(1, mostrar - faixas.length)} />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* No celular a lista do mês já mostra os mesmos compromissos: a agenda só a partir do tablet. */}
        <aside aria-labelledby="calendario-agenda" className="overflow-hidden rounded-cartao border border-line bg-surface max-md:hidden">
          <div className="border-b border-line-soft px-cartao py-3.5">
            <h2 id="calendario-agenda" className="m-0 text-secao font-semibold tracking-[-0.01em]">
              Próximos 21 dias
            </h2>
            <p className="mb-0 mt-0.5 text-pequeno text-muted">A partir de hoje, em qualquer mês. Clique para abrir.</p>
          </div>
          {agenda.length === 0 ? (
            <EmptyState compact title="Nada nas próximas três semanas" />
          ) : (
            // Dias em colunas que fluem (cada dia inteiro numa coluna): a agenda larga não vira uma lista comprida.
            <div className="gap-0 lg:columns-2 2xl:columns-3 [&>div]:break-inside-avoid lg:[column-rule:1px_solid_var(--color-line-row)]">
            {[...agendaPorDia.entries()].map(([dia, itens]) => {
              const linhas = itens.filter((it) => it.tipo !== "evento" || it.faixa?.inicio);
              if (linhas.length === 0) return null;
              return (
                <div key={dia} className="border-b border-line-row">
                  <CabecalhoDia dia={dia} hoje={hoje} />
                  <div className="py-1">
                    {linhas.map((it) => (
                      <LinhaAgenda key={it.chave} it={it} colunaHora={agendaTemHora} />
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
