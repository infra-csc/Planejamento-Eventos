import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarCalendario, type ItemCalendario, type TipoCalendario } from "@/server/services/calendario";
import { hojeISO } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { IconLink } from "@/components/ui/icon-button";
import { IconeChevron } from "@/components/ui/icons";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";

export const metadata: Metadata = { title: "Calendário" };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Cor e rótulo de cada tipo de compromisso. Evento é a faixa; o resto são marcos pontuais. */
const TIPO: Record<TipoCalendario, { rotulo: string; ponto: string; fundo: string; texto: string }> = {
  evento: { rotulo: "Evento", ponto: "bg-dark", fundo: "bg-dark", texto: "text-white" },
  reuniao: { rotulo: "Reunião de OS", ponto: "bg-accent", fundo: "bg-accent-bg", texto: "text-accent" },
  prazo: { rotulo: "Prazo de resposta", ponto: "bg-danger", fundo: "bg-danger-bg", texto: "text-danger" },
  janela: { rotulo: "Fim da janela de alterações", ponto: "bg-warning", fundo: "bg-warning-bg", texto: "text-warning" },
  montagem: { rotulo: "Montagem", ponto: "bg-success", fundo: "bg-success-bg", texto: "text-success" },
  carga: { rotulo: "Carga do caminhão", ponto: "bg-info", fundo: "bg-info-bg", texto: "text-info" },
  desmontagem: { rotulo: "Desmontagem", ponto: "bg-muted", fundo: "bg-control", texto: "text-ink-3" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const addMes = (ano: number, mes: number, n: number) => {
  const d = new Date(Date.UTC(ano, mes - 1 + n, 1));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
};

function Compromisso({ i, compacto }: { i: ItemCalendario; compacto?: boolean }) {
  const t = TIPO[i.tipo];
  if (i.tipo === "evento") {
    return (
      <Link
        href={i.href}
        title={`${i.titulo}${i.detalhe ? ` · ${i.detalhe}` : ""}`}
        className={cn("block truncate px-1.5 py-[3px] text-rotulo font-medium no-underline hover:brightness-110", t.fundo, t.texto, i.faixa?.inicio ? "ml-0.5 rounded-l-chip" : "-ml-px", i.faixa?.fim ? "mr-0.5 rounded-r-chip" : "-mr-px")}
      >
        {i.faixa?.inicio || compacto ? i.titulo : " "}
      </Link>
    );
  }
  return (
    <Link href={i.href} title={`${i.titulo}${i.detalhe ? ` · ${i.detalhe}` : ""}`} className={cn("mx-0.5 flex items-center gap-1 truncate rounded-chip px-1.5 py-[3px] text-rotulo no-underline hover:brightness-95", t.fundo, t.texto)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", t.ponto)} />
      {i.hora && <span className="shrink-0 font-mono text-micro opacity-80">{i.hora}</span>}
      <span className="truncate">{i.titulo.replace(/^(Reunião de OS|Prazo de resposta|Fim da janela de alterações|Montagem|Desmontagem|Carga do caminhão) · /, "")}</span>
    </Link>
  );
}

/**
 * Calendário mensal de tudo que tem data: evento (faixa), reunião de OS, fim da janela, montagem,
 * desmontagem, carga e prazos de resposta (logística). Ao lado, a agenda dos próximos dias.
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
  const [itensMes, agenda] = await Promise.all([listarCalendario(usuario, celulas[0].dia, celulas[celulas.length - 1].dia), listarCalendario(usuario, hoje, fimAgenda)]);
  const visiveis = itensMes.filter((i) => (!filtro || i.tipo === filtro) && (!eventoFiltro || i.evento.id === eventoFiltro));
  const porDia = new Map<string, ItemCalendario[]>();
  for (const i of visiveis) porDia.set(i.dia, [...(porDia.get(i.dia) ?? []), i]);
  const agendaPorDia = new Map<string, ItemCalendario[]>();
  for (const i of agenda) agendaPorDia.set(i.dia, [...(agendaPorDia.get(i.dia) ?? []), i]);

  const ant = addMes(ano, mes, -1);
  const prox = addMes(ano, mes, 1);
  const hrefMes = (a: number, me: number) => query(`${a}-${pad(me)}`, filtro, eventoFiltro);
  const tiposPresentes = [...new Set(itensMes.map((i) => i.tipo))];
  // Eventos com algum compromisso no mês, para filtrar o calendário por um só.
  const eventosDoMes = [...new Map(itensMes.map((i) => [i.evento.id, i.evento])).values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const rotuloDia = (d: string) => {
    const dt = new Date(`${d}T12:00:00Z`);
    return `${DIAS[(dt.getUTCDay() + 6) % 7]} ${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}`;
  };

  return (
    <>
      <PageHeader
        title="Calendário"
        description="Reuniões de OS, dias de evento, janelas de alteração, montagem, carga e prazos, tudo no mesmo mês."
        actions={
          <div className="flex items-center gap-1 rounded-controle border border-line bg-surface p-1">
            <IconLink href={hrefMes(ant.ano, ant.mes)} label="Mês anterior">
              <IconeChevron direcao="esquerda" />
            </IconLink>
            <span className="min-w-[150px] text-center text-corpo font-medium capitalize text-ink">
              {MESES[mes - 1]} {ano}
            </span>
            <IconLink href={hrefMes(prox.ano, prox.mes)} label="Próximo mês">
              <IconeChevron direcao="direita" />
            </IconLink>
            {m !== hoje.slice(0, 7) && (
              <ButtonLink href={hrefMes(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)))} variant="ghost" size="sm" className="ml-1 text-accent no-underline">
                Hoje
              </ButtonLink>
            )}
          </div>
        }
      />

      <div className="mb-[18px] flex flex-col gap-2.5">
        <Pills
          rotulo="Filtrar por tipo"
          itens={[
            { label: "Tudo", n: itensMes.filter((i) => !eventoFiltro || i.evento.id === eventoFiltro).length, href: query(m, null, eventoFiltro), ativo: !filtro },
            ...(Object.keys(TIPO) as TipoCalendario[]).filter((t) => tiposPresentes.includes(t)).map((t) => ({ label: TIPO[t].rotulo, n: itensMes.filter((i) => i.tipo === t && (!eventoFiltro || i.evento.id === eventoFiltro)).length, href: query(m, t, eventoFiltro), ativo: filtro === t })),
          ]}
        />
        {eventosDoMes.length > 1 && (
          <Pills
            rotulo="Filtrar por evento"
            itens={[
              { label: "Todos os eventos", href: query(m, filtro, null), ativo: !eventoFiltro },
              ...eventosDoMes.map((e) => ({ label: e.nome, n: itensMes.filter((i) => i.evento.id === e.id).length, href: query(m, filtro, e.id), ativo: eventoFiltro === e.id })),
            ]}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="overflow-hidden rounded-cartao border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line-soft bg-subtle">
            {DIAS.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-rotulo font-medium text-muted">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celulas.map((c, i) => {
              const itens = porDia.get(c.dia) ?? [];
              const ehHoje = c.dia === hoje;
              const fimDeSemana = i % 7 >= 5;
              return (
                <div key={c.dia} className={cn("flex min-h-[112px] flex-col border-b border-r border-line-row [&:nth-child(7n)]:border-r-0", !c.doMes && "bg-subtle/60", fimDeSemana && c.doMes && "bg-subtle/30")}>
                  <div className="flex items-center justify-between px-2 pt-1.5">
                    <span className={cn("inline-flex size-6 items-center justify-center rounded-full font-mono text-pequeno", ehHoje ? "bg-accent font-semibold text-white" : c.doMes ? "text-ink" : "text-meta")}>{c.numero}</span>
                    {itens.length > 3 && <span className="text-micro text-meta">+{itens.length - 3}</span>}
                  </div>
                  <div className="mt-1 flex flex-col gap-[3px] pb-1.5">
                    {itens.slice(0, 3).map((it) => (
                      <Compromisso key={it.chave} i={it} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="overflow-hidden rounded-cartao border border-line bg-surface xl:sticky xl:top-[76px]">
          <div className="border-b border-line-soft px-[18px] py-3.5">
            <h2 className="m-0 text-secao font-semibold">Próximos 21 dias</h2>
            <p className="mb-0 mt-0.5 text-pequeno text-muted">A partir de hoje, em ordem.</p>
          </div>
          {agenda.length === 0 ? (
            <EmptyState compact title="Nada marcado nas próximas três semanas." />
          ) : (
            [...agendaPorDia.entries()].map(([dia, itens]) => (
              <div key={dia} className="border-b border-line-row last:border-b-0">
                <p className={cn("m-0 px-[18px] pb-0.5 pt-2.5 font-mono text-rotulo uppercase tracking-[0.05em]", dia === hoje ? "text-accent" : "text-muted")}>{dia === hoje ? `hoje · ${rotuloDia(dia)}` : rotuloDia(dia)}</p>
                {itens
                  .filter((it) => it.tipo !== "evento" || it.faixa?.inicio)
                  .map((it) => (
                    <Link key={it.chave} href={it.href} className="flex gap-2.5 px-[18px] py-1.5 no-underline hover:bg-subtle">
                      <span aria-hidden className={cn("mt-[7px] size-2 shrink-0 rounded-full", TIPO[it.tipo].ponto)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-corpo text-ink">
                          {it.hora && <span className="mr-1.5 font-mono text-pequeno text-ink-3">{it.hora}</span>}
                          {it.titulo}
                        </span>
                        {it.detalhe && <span className="block truncate text-rotulo text-muted">{it.detalhe}</span>}
                      </span>
                    </Link>
                  ))}
              </div>
            ))
          )}
        </aside>
      </div>
    </>
  );
}
