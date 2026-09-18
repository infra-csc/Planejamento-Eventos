import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { listarEventos, type EventoLista } from "@/server/services/eventos";
import { pode } from "@/domain/permissions";
import { EVENTO_STATUS_LABEL, statusExibicao } from "@/domain/evento";
import { diaMesHora, diaMesISO, hojeISO, periodoCurto } from "@/lib/format";
import { hrefCom, ordenar, paginar, proximaOrdem } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EventoStatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { BuscaUrl } from "@/components/ui/busca-url";
import { TabsNav } from "@/components/ui/tabs-nav";
import { CaptionOculta, Paginacao, Th, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { BarrasFase } from "@/components/eventos/fases";

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

function marco(e: EventoLista) {
  if (e.status === "PREPARACAO") return `reunião ${diaMesHora(e.dataReuniao)}`;
  if (e.status === "EM_REUNIAO") return "reunião agora";
  if (e.status === "ABERTO") return e.janelaAlteracoesAte ? `alterações até ${diaMesISO(e.janelaAlteracoesAte)}` : "aberto a alterações";
  if (e.status === "CANCELADO") return "cancelado";
  return e.versaoOs ? `OS final v${e.versaoOs}` : "sem OS";
}

/** O que exige ação agora (antes era o primeiro grupo da lista): reunião acontecendo ou solicitação esperando a logística. */
const exigeAcao = (e: EventoLista) => e.status === "EM_REUNIAO" || (e.solicitacoesAbertas > 0 && e.status !== "CANCELADO");
/** Sem ordenação escolhida, a lista mantém a prioridade dos antigos grupos: ação agora, em andamento, encerrados e cancelados. */
const prioridade = (e: EventoLista) => (exigeAcao(e) ? 0 : e.status === "PREPARACAO" || e.status === "ABERTO" ? 1 : 2);

export default async function EventosPage({ searchParams }: { searchParams: Promise<{ q?: string; fase?: string; acao?: string; ordem?: string; dir?: string; pagina?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const hoje = hojeISO();
  const busca = sp.q?.trim().slice(0, 80) || null;
  // Busca por nome/código/cliente/local no banco; fase "Realizado" depende de hoje, então as abas contam em memória.
  const encontrados = await listarEventos(usuario, busca ? { busca } : {});
  const fase: Fase = FASES.find(([v]) => v === sp.fase)?.[0] ?? "TODOS";
  const faseDe = (e: EventoLista) => statusExibicao(e.status, e.dataFim, hoje);
  const ehLogistica = pode(usuario, "solicitacao.responder");

  const nAcao = encontrados.filter(exigeAcao).length;
  const soAcao = sp.acao === "1";
  const base = soAcao ? encontrados.filter(exigeAcao) : encontrados;
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
  const ordenados = ordem ? ordenar(filtrados, acessores, ordem, sp.dir) : [...filtrados].sort((a, b) => prioridade(a) - prioridade(b));
  const pag = paginar(ordenados, sp.pagina, POR_PAGINA);

  const params = { q: sp.q, fase: sp.fase, acao: sp.acao, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina };
  const rotuloFase = FASES.find(([v]) => v === fase)?.[1] ?? "Todos";
  const rotuloAcao = ehLogistica ? "exige ação agora" : "aguardando a logística";

  const th = (chave: string, label: string, largura?: number | string, alinhar?: "left" | "right") => {
    const prox = proximaOrdem(sp.ordem, sp.dir, chave);
    return (
      <ThOrdenavel
        label={label}
        ativo={sp.ordem === chave}
        dir={sp.ordem === chave ? (sp.dir === "desc" ? "desc" : "asc") : undefined}
        href={hrefCom("/eventos", params, { ordem: prox.ordem, dir: prox.dir, pagina: null })}
        largura={largura}
        alinhar={alinhar}
      />
    );
  };

  const semFiltro = !busca && !soAcao && fase === "TODOS";

  return (
    <>
      <PageHeader
        title="Eventos"
        divisor
        actions={
          pode(usuario, "evento.criar") && (
            <ButtonLink href="/eventos/novo" variant="primary" size="lg" className="no-underline">
              Novo evento
            </ButtonLink>
          )
        }
      />

      {/* Barra de filtros compacta (template de pedidos): busca à esquerda, o que é urgente à direita. */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <BuscaUrl placeholder="Buscar por nome, código, cliente ou local" ariaLabel="Buscar evento por nome, código, cliente ou local" />
        {soAcao ? (
          <Link href={hrefCom("/eventos", params, { acao: null, pagina: null })} className="inline-flex items-center gap-1.5 text-pequeno font-medium text-warning no-underline hover:underline sm:ml-auto">
            Mostrando só o que {ehLogistica ? "exige ação agora" : "aguarda a logística"} · ver todos
          </Link>
        ) : (
          nAcao > 0 && (
            <Link href={hrefCom("/eventos", params, { acao: "1", pagina: null })} className="inline-flex items-center gap-1.5 text-pequeno font-medium text-warning no-underline hover:underline sm:ml-auto">
              <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full bg-warning" />
              {nAcao} {nAcao === 1 ? "evento" : "eventos"} {ehLogistica ? (nAcao === 1 ? "exige ação agora" : "exigem ação agora") : rotuloAcao}
            </Link>
          )
        )}
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <TabsNav
          rotulo="Fase dos eventos"
          className="mb-0 px-2 pt-1"
          tabs={FASES.map(([v, label]) => ({ href: hrefCom("/eventos", params, { fase: v === "TODOS" ? null : v, pagina: null }), label, n: contagem(v), ativo: fase === v }))}
        />
        {pag.total === 0 ? (
          <EmptyState
            title={busca ? `Nada encontrado para “${busca}”` : semFiltro ? "Nenhum evento cadastrado" : "Nenhum evento corresponde aos filtros"}
            description={busca ? "Confira o código ou tente outra palavra do nome, do cliente ou do local." : semFiltro ? "Quando a logística criar um evento, ele aparece aqui." : "Volte para todas as fases ou mostre todos os eventos."}
            action={
              semFiltro && pode(usuario, "evento.criar") ? (
                <ButtonLink href="/eventos/novo" variant="primary" size="md" className="no-underline">
                  Novo evento
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <CaptionOculta>{`Eventos · ${rotuloFase}${soAcao ? ` · ${rotuloAcao}` : ""}`}</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    {th("codigo", "Código", 100)}
                    {th("nome", "Evento")}
                    {th("fase", "Fase", 150)}
                    <th scope="col" aria-sort={sp.ordem === "periodo" ? (sp.dir === "desc" ? "descending" : "ascending") : "none"} className="hidden border-b border-line-soft bg-subtle p-0 font-medium lg:table-cell" style={{ width: 160 }}>
                      <Link
                        href={hrefCom("/eventos", params, { ...proximaOrdem(sp.ordem, sp.dir, "periodo"), pagina: null })}
                        scroll={false}
                        className={`flex w-full items-center gap-[5px] whitespace-nowrap px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.06em] no-underline ${sp.ordem === "periodo" ? "text-ink" : "text-muted hover:text-ink"}`}
                      >
                        Período
                        <span className="font-mono">{sp.ordem === "periodo" ? (sp.dir === "desc" ? "↓" : "↑") : ""}</span>
                      </Link>
                    </th>
                    {th("pendencias", "Pendências", 140, "right")}
                    <Th largura={44}>
                      <span className="sr-only">Abrir</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {pag.itens.map((e) => {
                    const st = faseDe(e);
                    // Só junta o que existe: sem cliente/local não sobra "·" solto.
                    const onde = [e.cliente, e.local].filter(Boolean).join(" · ");
                    return (
                      <LinhaLink key={e.id} href={`/eventos/${e.id}`} rotulo={`Abrir ${e.codigo} — ${e.nome}`}>
                        <td className="border-b border-line-row px-3 py-3 font-mono text-pequeno text-ink-3">{e.codigo}</td>
                        <th scope="row" className="border-b border-line-row px-3 py-3 text-left font-normal">
                          <span className="flex min-w-[220px] flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-corpo font-medium text-ink">{e.nome}</span>
                            {e.reabertoVezes > 0 && <Badge tom="warning">reaberto {e.reabertoVezes}×</Badge>}
                          </span>
                          <span className={onde ? "mt-0.5 block text-pequeno text-muted" : "mt-0.5 block text-pequeno text-muted lg:hidden"}>
                            {onde}
                            {/* Período sai da coluna em telas menores e desce para cá. */}
                            <span className="lg:hidden">
                              {onde && " · "}
                              <span className="font-mono">{periodoCurto(e.dataInicio, e.dataFim)}</span> · {marco(e)}
                            </span>
                          </span>
                        </th>
                        <td className="border-b border-line-row px-3 py-3">
                          <EventoStatusBadge status={st} />
                          <span className="mt-1.5 block max-w-[112px]">
                            <BarrasFase status={e.status} rotuloStatus={st === "REALIZADO" ? "Realizado" : EVENTO_STATUS_LABEL[st]} />
                          </span>
                        </td>
                        <td className="hidden border-b border-line-row px-3 py-3 lg:table-cell">
                          <span className="block font-mono text-pequeno text-ink">{periodoCurto(e.dataInicio, e.dataFim)}</span>
                          <span className="block text-rotulo text-muted">{marco(e)}</span>
                        </td>
                        <td className="border-b border-line-row px-3 py-3 text-right">
                          <span className={e.solicitacoesAbertas > 0 ? "block text-pequeno font-medium text-warning" : "block text-pequeno font-medium text-meta"}>
                            {e.solicitacoesAbertas > 0 ? `${e.solicitacoesAbertas} aguardando` : "—"}
                          </span>
                          <span className="block text-rotulo text-meta">{e.responsavel.nome}</span>
                        </td>
                        <td className="border-b border-line-row py-3 pl-1 pr-cartao text-right text-ink-3">
                          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                            <path d="M9 6l6 6-6 6" />
                          </svg>
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
