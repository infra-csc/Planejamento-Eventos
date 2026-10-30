import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarEventos, type EventoLista } from "@/server/services/eventos";
import { pode } from "@/domain/permissions";
import { EVENTO_STATUS_LABEL, statusExibicao } from "@/domain/evento";
import { addDiasISO, diaMesHora, diaMesISO, hojeISO, hora, isoSP, periodoCurto } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FiltroSelectUrl } from "@/components/ui/filtro-select-url";
import { hrefCom, ordenar, paginar, proximaOrdem } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EventoStatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { BuscaUrl } from "@/components/ui/busca-url";
import { ContagemAoVivo } from "@/components/ui/contagem-ao-vivo";
import { TabsNav } from "@/components/ui/tabs-nav";
import { CaptionOculta, Paginacao, Th, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { BarrasFase } from "@/components/eventos/fases";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { listarAreasCache } from "@/server/cache";

export const metadata: Metadata = { title: "Eventos" };

const POR_PAGINA = 25;

const FASES = [
  ["TODOS", "Todos"],
  ["PREPARACAO", "Preparação"],
  ["EM_REUNIAO", "Em reunião"],
  ["ABERTO", "Aberto"],
  ["ENCERRADO", "Encerrado"],
  ["REALIZADO", "Realizados"],
  ["CANCELADO", "Cancelado"],
] as const;
type Fase = (typeof FASES)[number][0];

/** Ordem das fases para ordenar a coluna "Fase" (a mesma das abas). */
const ORDEM_FASE: Record<Exclude<Fase, "TODOS">, number> = { PREPARACAO: 0, EM_REUNIAO: 1, ABERTO: 2, ENCERRADO: 3, REALIZADO: 4, CANCELADO: 5 };

/** "em 3 dias", "hoje", "há 2 dias": quando o evento acontece, em relação a hoje. */
function quando(dataInicio: string, hoje: string) {
  const d = Math.round((Date.parse(`${dataInicio}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
  return d === 0 ? "evento hoje" : d > 0 ? `em ${d} ${d === 1 ? "dia" : "dias"}` : `há ${-d} ${-d === 1 ? "dia" : "dias"}`;
}

/**
 * O próximo marco do evento, com tom: reunião hoje/amanhã em destaque; reunião que passou sem começar em
 * amarelo ("reunião não iniciada"); reunião aberta de outro dia não é "agora" (é ata por fechar).
 */
function marco(e: EventoLista, hoje: string): { texto: string; tom?: "info" | "warning" } {
  const diaReuniao = isoSP(e.dataReuniao);
  if (e.status === "PREPARACAO") {
    if (diaReuniao === hoje) return { texto: `reunião hoje ${hora(e.dataReuniao)}`, tom: "info" };
    if (diaReuniao === addDiasISO(hoje, 1)) return { texto: `reunião amanhã ${hora(e.dataReuniao)}`, tom: "info" };
    if (diaReuniao < hoje) return { texto: `não iniciada · ${diaMesHora(e.dataReuniao)}`, tom: "warning" };
    return { texto: `reunião ${diaMesHora(e.dataReuniao)}` };
  }
  if (e.status === "EM_REUNIAO") return diaReuniao < hoje ? { texto: "ata por fechar", tom: "warning" } : { texto: "em reunião agora", tom: "info" };
  // Sem janela, "aberto a alterações" só repetia a fase ao lado: mostra quando o evento acontece.
  if (e.status === "ABERTO") return { texto: e.janelaAlteracoesAte ? `alterações até ${diaMesISO(e.janelaAlteracoesAte)}` : quando(e.dataInicio, hoje) };
  if (e.status === "CANCELADO") return { texto: "cancelado" };
  return { texto: e.versaoOs ? `OS final v${e.versaoOs}` : "sem OS" };
}
// Reunião hoje/amanhã/agora é estado (em andamento): azul de informação; o vinho é só para "aja aqui".
const COR_MARCO = { info: "font-medium text-info", warning: "font-medium text-warning" } as const;

/** Recortes pela reunião de OS (em preparação ou em reunião) e pela data do evento. */
const REUNIOES = [
  { value: "hoje", label: "Reunião hoje" },
  { value: "amanha", label: "Reunião amanhã" },
  { value: "7dias", label: "Reunião em 7 dias" },
  { value: "atrasada", label: "Reunião não iniciada" },
] as const;
const PERIODOS = [
  { value: "7dias", label: "Evento em 7 dias" },
  { value: "30dias", label: "Evento em 30 dias" },
  { value: "passados", label: "Eventos que já passaram" },
] as const;

/** O que exige ação agora (antes era o primeiro grupo da lista): reunião acontecendo ou solicitação esperando a logística. */
const exigeAcao = (e: EventoLista) => e.status === "EM_REUNIAO" || (e.solicitacoesAbertas > 0 && e.status !== "CANCELADO");
/** Sem ordenação escolhida, a lista mantém a prioridade dos antigos grupos: ação agora, em andamento, encerrados e cancelados. */
const prioridade = (e: EventoLista) => (exigeAcao(e) ? 0 : e.status === "PREPARACAO" || e.status === "ABERTO" ? 1 : 2);

/** Selos das áreas: cheio = já enviou pedido para o evento; apagado = ainda não. */
/**
 * Quem já pediu para o evento, de relance: as áreas que pediram em destaque; as que faltam viram um
 * "faltam N" discreto (nomes no título). Antes, todas as áreas apareciam em toda linha e o útil se perdia.
 */
function AreasQuePediram({ areas, pediram }: { areas: Array<{ id: string; nome: string }>; pediram: string[] }) {
  if (areas.length === 0) return null;
  const ja = areas.filter((a) => pediram.includes(a.id));
  const faltam = areas.filter((a) => !pediram.includes(a.id));
  if (ja.length === 0) return <span className="text-pequeno text-meta" title={`Nenhuma área pediu ainda: ${faltam.map((a) => a.nome).join(", ")}`}>nenhuma ainda</span>;
  return (
    <span className="flex flex-wrap items-center gap-1" aria-label={`${ja.length} de ${areas.length} áreas já pediram`}>
      {ja.map((a) => (
        <span key={a.id} title={`${a.nome}: já pediu`} className="inline-flex items-center gap-1 rounded-chip border border-success-border bg-success-bg px-1.5 py-px text-rotulo font-medium text-success">
          <Icone nome="check" className="size-3" />
          {a.nome}
        </span>
      ))}
      {faltam.length > 0 ? (
        <span className="text-rotulo text-muted" title={`Ainda não pediram: ${faltam.map((a) => a.nome).join(", ")}`}>
          faltam {faltam.length}
        </span>
      ) : (
        <span className="text-rotulo font-medium text-success">todas</span>
      )}
    </span>
  );
}

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fase?: string; acao?: string; ordem?: string; dir?: string; pagina?: string; reuniao?: string; resp?: string; periodo?: string }>;
}) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const hoje = hojeISO();
  const busca = sp.q?.trim().slice(0, 80) || null;
  // Busca por nome/código/cliente/local no banco; fase "Realizado" depende de hoje, então as abas contam em memória.
  const [encontrados, todasAreas] = await Promise.all([listarEventos(usuario, busca ? { busca } : {}), listarAreasCache()]);
  // Áreas que pedem (a logística responde, não pede): cada evento mostra quais já enviaram pedido.
  const areasQuePedem = todasAreas.filter((a) => a.nome.toLowerCase() !== "logística").map((a) => ({ id: a.id, nome: a.nome }));
  const fase: Fase = FASES.find(([v]) => v === sp.fase)?.[0] ?? "TODOS";
  const faseDe = (e: EventoLista) => statusExibicao(e.status, e.dataFim, hoje);
  const ehLogistica = pode(usuario, "solicitacao.responder");

  const nAcao = encontrados.filter(exigeAcao).length;
  const soAcao = sp.acao === "1";
  // Filtros de reunião, responsável e data do evento valem para a lista e para a contagem das abas.
  const reuniao = REUNIOES.find((r) => r.value === sp.reuniao)?.value ?? null;
  const periodo = PERIODOS.find((p) => p.value === sp.periodo)?.value ?? null;
  const responsaveis = [...new Map(encontrados.map((e) => [e.responsavel.id, e.responsavel.nome])).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const resp = responsaveis.some((r) => r.value === sp.resp) ? sp.resp! : null;
  const naReuniao = (e: EventoLista) => {
    if (!reuniao) return true;
    if (e.status !== "PREPARACAO" && e.status !== "EM_REUNIAO") return false;
    const d = isoSP(e.dataReuniao);
    if (reuniao === "hoje") return d === hoje;
    if (reuniao === "amanha") return d === addDiasISO(hoje, 1);
    if (reuniao === "7dias") return d >= hoje && d <= addDiasISO(hoje, 7);
    return d < hoje;
  };
  const noPeriodo = (e: EventoLista) => (!periodo ? true : periodo === "passados" ? e.dataFim < hoje : e.dataInicio >= hoje && e.dataInicio <= addDiasISO(hoje, periodo === "7dias" ? 7 : 30));
  const comFiltro = Boolean(reuniao || periodo || resp);
  const base = (soAcao ? encontrados.filter(exigeAcao) : encontrados).filter((e) => naReuniao(e) && noPeriodo(e) && (!resp || e.responsavel.id === resp));
  const contagem = (v: Fase) => (v === "TODOS" ? base.length : base.filter((e) => faseDe(e) === v).length);
  const filtrados = fase === "TODOS" ? base : base.filter((e) => faseDe(e) === fase);

  const acessores: Record<string, (e: EventoLista) => string | number> = {
    codigo: (e) => e.codigo,
    nome: (e) => e.nome.toLocaleLowerCase("pt-BR"),
    fase: (e) => ORDEM_FASE[faseDe(e)],
    periodo: (e) => e.dataInicio,
    pendencias: (e) => e.solicitacoesAbertas,
  };
  // `hasOwn`: a chave vem da URL ("__proto__" acharia Object.prototype).
  const ordem = sp.ordem && Object.hasOwn(acessores, sp.ordem) ? sp.ordem : undefined;
  // Sem ordem escolhida: prioridade (ação agora, em andamento, o resto) e, dentro dela, o evento mais próximo.
  const ordenados = ordem ? ordenar(filtrados, acessores, ordem, sp.dir) : [...filtrados].sort((a, b) => prioridade(a) - prioridade(b) || a.dataInicio.localeCompare(b.dataInicio));
  const pag = paginar(ordenados, sp.pagina, POR_PAGINA);

  const params = { q: sp.q, fase: sp.fase, acao: sp.acao, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina, reuniao: sp.reuniao, resp: sp.resp, periodo: sp.periodo };
  const rotuloFase = FASES.find(([v]) => v === fase)?.[1] ?? "Todos";
  const rotuloAcao = ehLogistica ? "exige ação agora" : "aguardando a logística";

  const th = (chave: string, label: string, largura?: number | string, alinhar?: "left" | "right", className?: string) => {
    const prox = proximaOrdem(sp.ordem, sp.dir, chave);
    return (
      <ThOrdenavel
        label={label}
        ativo={sp.ordem === chave}
        dir={sp.ordem === chave ? (sp.dir === "desc" ? "desc" : "asc") : undefined}
        href={hrefCom("/eventos", params, { ordem: prox.ordem, dir: prox.dir, pagina: null })}
        largura={largura}
        alinhar={alinhar}
        className={className}
      />
    );
  };

  const semFiltro = !busca && !soAcao && !comFiltro && fase === "TODOS";

  return (
    <>
      <PageHeader
        title="Eventos"
        divisor
        actions={
          pode(usuario, "evento.criar") && (
            <ButtonLink href="/eventos/novo" variant="primary" size="lg" className="no-underline">
              <Icone nome="mais" />
              Novo evento
            </ButtonLink>
          )
        }
      />

      {/* Barra de filtros compacta (template de pedidos): busca à esquerda, o que é urgente à direita.
          Celular: busca na linha toda e as listas curtas aos pares (antes eram 4 campos empilhados antes da lista). */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
        <BuscaUrl largura={300} className="col-span-2" placeholder="Buscar evento, cliente ou local" ariaLabel="Buscar evento por nome, código, cliente ou local" />
        <FiltroSelectUrl param="reuniao" rotulo="Reunião de OS" todas="Qualquer reunião" opcoes={[...REUNIOES]} className="sm:w-[190px]" />
        <FiltroSelectUrl param="periodo" rotulo="Data do evento" todas="Qualquer data" opcoes={[...PERIODOS]} className="sm:w-[190px]" />
        {responsaveis.length > 1 && <FiltroSelectUrl param="resp" rotulo="Responsável" todas="Todos os responsáveis" opcoes={responsaveis} className="col-span-2 sm:w-[210px]" />}
        {comFiltro && (
          <Link href={hrefCom("/eventos", params, { reuniao: null, periodo: null, resp: null, pagina: null })} className="col-span-2 text-pequeno font-medium text-accent no-underline hover:underline">
            Limpar filtros
          </Link>
        )}
        {soAcao ? (
          <Link href={hrefCom("/eventos", params, { acao: null, pagina: null })} className="col-span-2 inline-flex items-center gap-1.5 text-pequeno font-medium text-warning no-underline hover:underline sm:ml-auto">
            Mostrando só o que {ehLogistica ? "exige ação agora" : "aguarda a logística"} · ver todos
          </Link>
        ) : (
          nAcao > 0 && (
            <Link href={hrefCom("/eventos", params, { acao: "1", pagina: null })} className="col-span-2 inline-flex items-center gap-1.5 text-pequeno font-medium text-warning no-underline hover:underline sm:ml-auto">
              <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full bg-warning" />
              {nAcao} {nAcao === 1 ? "evento" : "eventos"} {ehLogistica ? (nAcao === 1 ? "exige ação agora" : "exigem ação agora") : rotuloAcao}
            </Link>
          )
        )}
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <ContagemAoVivo oculto n={pag.total} singular="evento" plural="eventos" complemento={[rotuloFase, soAcao ? rotuloAcao : null, busca ? `busca “${busca}”` : null].filter(Boolean).join(" · ")} />
        <TabsNav
          rotulo="Fase dos eventos"
          className="mb-0 px-2 pt-1"
          tabs={FASES.map(([v, label]) => ({ href: hrefCom("/eventos", params, { fase: v === "TODOS" ? null : v, pagina: null }), label, n: contagem(v), ativo: fase === v }))}
        />
        {pag.total === 0 ? (
          <EmptyState
            title={busca ? `Nada encontrado para “${busca}”` : semFiltro ? "Nenhum evento cadastrado" : "Nenhum evento corresponde aos filtros"}
            description={busca ? "Confira o código ou tente outra palavra do nome, do cliente ou do local." : semFiltro ? "Quando a logística criar um evento, ele aparece aqui." : "Tire um filtro, volte para todas as fases ou mostre todos os eventos."}
            icone={busca ? "busca" : semFiltro ? "eventos" : undefined}
            action={
              busca ? (
                <Link href={hrefCom("/eventos", params, { q: null, pagina: null })} className="link text-corpo">
                  Limpar busca
                </Link>
              ) : comFiltro ? (
                <Link href={hrefCom("/eventos", params, { reuniao: null, periodo: null, resp: null, pagina: null })} className="link text-corpo">
                  Limpar filtros
                </Link>
              ) : semFiltro && pode(usuario, "evento.criar") ? (
                <ButtonLink href="/eventos/novo" variant="primary" size="md" className="no-underline">
                  <Icone nome="mais" />
                  Novo evento
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table data-responsiva className="w-full border-collapse max-sm:[overflow-wrap:anywhere] sm:min-w-[640px]">
                <CaptionOculta>{`Eventos · ${rotuloFase}${soAcao ? ` · ${rotuloAcao}` : ""}`}</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    {th("codigo", "Código", 100, "left", "hidden sm:table-cell")}
                    {th("nome", "Evento")}
                    {th("fase", "Fase", 150, "left", "hidden sm:table-cell")}
                    <th scope="col" aria-sort={sp.ordem === "periodo" ? (sp.dir === "desc" ? "descending" : "ascending") : "none"} className="hidden border-b border-line-soft bg-subtle p-0 font-medium lg:table-cell" style={{ width: 160 }}>
                      <Link
                        href={hrefCom("/eventos", params, { ...proximaOrdem(sp.ordem, sp.dir, "periodo"), pagina: null })}
                        scroll={false}
                        className={`flex w-full items-center gap-[5px] whitespace-nowrap px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.06em] no-underline ${sp.ordem === "periodo" ? "text-ink" : "text-muted hover:text-ink"}`}
                      >
                        Período
                        {sp.ordem === "periodo" && <Icone nome={sp.dir === "desc" ? "seta-baixo" : "seta-cima"} className="size-3.5" />}
                      </Link>
                    </th>
                    <Th className="hidden xl:table-cell" largura={240}>
                      Áreas que pediram
                    </Th>
                    {th("pendencias", "Pendências", 140, "right", "hidden sm:table-cell")}
                    <Th largura={44}>
                      <span className="sr-only">Abrir</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {pag.itens.map((e) => {
                    const st = faseDe(e);
                    // Só junta o que existe: sem cliente/local não sobra "·" solto. O responsável vem junto (antes ficava
                    // embaixo de "em dia", na coluna de pendências, e parecia uma pendência).
                    const onde = [e.cliente, e.local, `resp. ${e.responsavel.nome}`].filter(Boolean).join(" · ");
                    const m = marco(e, hoje);
                    return (
                      <LinhaLink key={e.id} href={`/eventos/${e.id}`} rotulo={`Abrir ${e.codigo} — ${e.nome}`}>
                        <td className="hidden border-b border-line-row px-3 py-3 text-pequeno text-ink-3 sm:table-cell">
                          <Codigo>{e.codigo}</Codigo>
                        </td>
                        <th scope="row" className="border-b border-line-row px-3 py-3 text-left font-normal">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:min-w-[220px]">
                            <Codigo className="text-rotulo text-ink-3 sm:hidden">{e.codigo}</Codigo>
                            <span className="text-corpo font-medium text-ink">{e.nome}</span>
                            {e.reabertoVezes > 0 && <Badge tom="warning">reaberto {e.reabertoVezes}×</Badge>}
                          </span>
                          {/* Local em até 2 linhas (1 no desktop); endereço longo não estica a linha. */}
                          {onde && (
                            <span title={onde} className="mt-0.5 line-clamp-2 text-pequeno text-muted lg:line-clamp-1">
                              {onde}
                            </span>
                          )}
                          {/* Período sai da coluna em telas menores e desce para cá, sempre inteiro. */}
                          <span className="mt-0.5 block text-pequeno text-muted lg:hidden">
                            <span className="numero">{periodoCurto(e.dataInicio, e.dataFim)}</span> · <span className={m.tom ? COR_MARCO[m.tom] : undefined}>{m.texto}</span>
                          </span>
                          {/* Celular: fase e pendência dentro da célula do evento. */}
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:hidden">
                            <EventoStatusBadge status={st} />
                            {e.solicitacoesAbertas > 0 && (
                              <span className="inline-flex items-center gap-1.5 text-pequeno font-medium text-warning">
                                <span aria-hidden className="block size-1.5 rounded-full bg-warning" />
                                {e.solicitacoesAbertas} aguardando
                              </span>
                            )}
                          </span>
                        </th>
                        <td className="hidden border-b border-line-row px-3 py-3 sm:table-cell">
                          <EventoStatusBadge status={st} />
                          <span className="mt-1.5 block max-w-[112px]">
                            <BarrasFase status={e.status} rotuloStatus={st === "REALIZADO" ? "Realizado" : EVENTO_STATUS_LABEL[st]} />
                          </span>
                        </td>
                        <td className="hidden border-b border-line-row px-3 py-3 lg:table-cell">
                          <span className="numero block text-pequeno text-ink">{periodoCurto(e.dataInicio, e.dataFim)}</span>
                          <span className={cn("block text-rotulo", m.tom ? COR_MARCO[m.tom] : "text-muted")}>{m.texto}</span>
                        </td>
                        <td className="hidden border-b border-line-row px-3 py-3 xl:table-cell">
                          <AreasQuePediram areas={areasQuePedem} pediram={e.areasQuePediram} />
                        </td>
                        <td className="hidden border-b border-line-row px-3 py-3 text-right sm:table-cell">
                          {e.solicitacoesAbertas > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-pequeno font-medium text-warning">
                              <span aria-hidden className="block size-1.5 rounded-full bg-warning" />
                              {e.solicitacoesAbertas} aguardando
                            </span>
                          ) : (
                            <span className="block text-pequeno text-meta">em dia</span>
                          )}
                        </td>
                        <td className="border-b border-line-row py-3 pl-1 pr-cartao text-right text-ink-3">
                          <Icone nome="chevron-direita" className="inline-block" />
                        </td>
                      </LinhaLink>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginacao {...pag} hrefPagina={(p) => hrefCom("/eventos", params, { pagina: p === 1 ? null : p })} />
          </>
        )}
      </div>
    </>
  );
}
