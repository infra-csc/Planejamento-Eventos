import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { FiltroEvento } from "@/components/ui/filtro-evento";
import { eventosComSolicitacoes, FILTROS_LISTA, paginarSolicitacoes, primeiraDaFila, REUNIOES_LISTA, type FiltroLista, type ReuniaoLista } from "@/server/services/solicitacoes";
import { listarAreas } from "@/server/services/admin";
import { FiltroSelectUrl } from "@/components/ui/filtro-select-url";
import { diaMes, diaMesHora, hora, isoSP } from "@/lib/format";
import { pode } from "@/domain/permissions";
import { aguardaReuniao } from "@/domain/solicitacao";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { hrefCom, proximaOrdem } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { ForaJanelaTag, SolicitacaoStatusTexto } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { BuscaUrl } from "@/components/ui/busca-url";
import { TabsNav } from "@/components/ui/tabs-nav";
import { CaptionOculta, Paginacao, Th, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";
import { IndicadorLink } from "@/components/ui/indicador-link";
import { Codigo } from "@/components/ui/numero";
import { Icone } from "@/components/ui/icons";
import { AvisoExcluido } from "@/components/solicitacoes/aviso-excluido";
import { Suspense } from "react";
import { ContagemAoVivo } from "@/components/ui/contagem-ao-vivo";

export const metadata: Metadata = { title: "Solicitações" };

const POR_PAGINA = 25;

const ROTULO_FILTRO: Record<FiltroLista, string> = {
  NA_ATA: "Na ata",
  ABERTAS: "Aguardando resposta",
  ATRASADAS: "Atrasadas",
  RASCUNHO: "Rascunhos e devolvidas",
  RESPONDIDA: "Respondidas",
  TODAS: "Todas",
};

const diaBrasilia = isoSP;

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; ordem?: string; dir?: string; pagina?: string; evento?: string; q?: string; area?: string; tipo?: string; reuniao?: string; excluido?: string }>;
}) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const agora = new Date();
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  const ehLogistica = pode(usuario, "solicitacao.responder");
  const podeCriar = pode(usuario, "solicitacao.criar");
  // "Todas" é a porta de entrada das áreas. Quem responde abre em "Aguardando resposta", ordenada por prazo: em
  // "Todas" a única atrasada ficava no fim da lista (auditoria 28/10, nº 25).
  const filtroPadrao: FiltroLista = ehLogistica ? "ABERTAS" : "TODAS";
  const filtro: FiltroLista = (FILTROS_LISTA as readonly string[]).includes(sp.filtro ?? "") ? (sp.filtro as FiltroLista) : filtroPadrao;
  const eventoId = sp.evento && /^[\w-]{1,64}$/.test(sp.evento) ? sp.evento : null;
  const busca = sp.q?.trim().slice(0, 80) || null;
  // `\w`: o id da área é um UUID (letras, números e hífen); com `[w-]` o filtro de área nunca valia.
  const areaId = veTodas && sp.area && /^[\w-]{1,64}$/.test(sp.area) ? sp.area : null;
  const tipo = sp.tipo === "PRE_REUNIAO" || sp.tipo === "ALTERACAO" ? sp.tipo : null;
  const reuniao = (REUNIOES_LISTA as readonly string[]).includes(sp.reuniao ?? "") ? (sp.reuniao as ReuniaoLista) : null;
  const [pag, primeiraFila, eventosFiltro, areasFiltro] = await Promise.all([
    paginarSolicitacoes(usuario, { filtro, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina, porPagina: POR_PAGINA, eventoId, busca, areaId, tipo, reuniao }),
    ehLogistica ? primeiraDaFila(usuario) : Promise.resolve(null),
    eventosComSolicitacoes(usuario),
    veTodas ? listarAreas() : Promise.resolve([]),
  ]);
  const params = { filtro: sp.filtro, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina, evento: sp.evento, q: sp.q, area: sp.area, tipo: sp.tipo, reuniao: sp.reuniao };
  const comFiltro = Boolean(eventoId || busca || areaId || tipo || reuniao);
  // Pedido pré-reunião: o que importa é a reunião em que a logística confere ("hoje 14:00", "amanhã 14:00").
  const hojeBr = diaBrasilia(agora);
  const amanhaBr = diaBrasilia(new Date(agora.getTime() + 24 * 60 * 60 * 1000));
  /** Coluna Itens: o que está na ata conta itens; alteração conta quantos a logística já respondeu. */
  const textoItens = (x: { tipo: "PRE_REUNIAO" | "ALTERACAO"; evento: { status: Parameters<typeof aguardaReuniao>[1] }; totalItens: number; itensRespondidos: number }) =>
    aguardaReuniao(x.tipo, x.evento.status) ? `${x.totalItens} ${x.totalItens === 1 ? "item" : "itens"}` : `${x.itensRespondidos}/${x.totalItens} respondidos`;
  // Reunião marcada que passou e o evento segue em preparação: a conferência não aconteceu no sistema.
  const reuniaoPassou = (x: { evento: { status: string; dataReuniao: Date } }) => x.evento.status === "PREPARACAO" && x.evento.dataReuniao.getTime() < agora.getTime() && diaBrasilia(x.evento.dataReuniao) !== hojeBr;
  const rotuloReuniao = (d: Date) => (diaBrasilia(d) === hojeBr ? `hoje ${hora(d)}` : diaBrasilia(d) === amanhaBr ? `amanhã ${hora(d)}` : diaMesHora(d));
  /**
   * Prazo ou reunião numa linha só (antes, duas: "25/09 14:00" e "reunião não iniciada" embaixo). Pré-reunião
   * fala da reunião em que a logística confere; alteração aberta, do prazo de resposta; o resto não tem prazo.
   */
  const prazoDaLinha = (s: (typeof pag.itens)[number]): { texto: string; cor: string; pulsar?: boolean; title?: string } => {
    if (aguardaReuniao(s.tipo, s.evento.status)) {
      if (s.evento.status === "EM_REUNIAO") return { texto: "em reunião", cor: "var(--color-info)", title: `Reunião marcada ${rotuloReuniao(s.evento.dataReuniao)}` };
      if (reuniaoPassou(s)) return { texto: `não iniciada · ${diaMes(s.evento.dataReuniao)}`, cor: "var(--color-warning)", title: `Reunião de OS marcada ${diaMesHora(s.evento.dataReuniao)} e ainda não iniciada` };
      return { texto: `reunião ${rotuloReuniao(s.evento.dataReuniao)}`, cor: diaBrasilia(s.evento.dataReuniao) === hojeBr ? "var(--color-info)" : "var(--color-ink-2)" };
    }
    const pi = prazoInfo(s, agora);
    if (pi.label === "—" || pi.label === "rascunho" || pi.label === "sem prazo") return { texto: "—", cor: "var(--color-line-strong)", title: "Sem prazo correndo" };
    if (pi.vencido) return { texto: `atrasada ${pi.sub}`, cor: COR_TOM[pi.tom], pulsar: true };
    return { texto: `até ${pi.sub}`, cor: COR_TOM[pi.tom], title: `Prazo de resposta ${pi.label}` };
  };
  const prazo = (s: (typeof pag.itens)[number]) => {
    const p = prazoDaLinha(s);
    return (
      <span className="numero inline-flex items-center gap-1.5 whitespace-nowrap text-pequeno" style={{ color: p.cor }} title={p.title}>
        {p.pulsar && <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full" style={{ background: p.cor }} />}
        {p.texto === "—" ? <span aria-label="sem prazo correndo">—</span> : p.texto}
      </span>
    );
  };

  const th = (chave: string, label: string, largura?: number, alinhar?: "left" | "right", className?: string) => {
    const prox = proximaOrdem(sp.ordem, sp.dir, chave);
    return (
      <ThOrdenavel
        label={label}
        ativo={sp.ordem === chave}
        dir={sp.ordem === chave ? (sp.dir === "desc" ? "desc" : "asc") : undefined}
        href={hrefCom("/solicitacoes", params, { ordem: prox.ordem, dir: prox.dir, pagina: null })}
        largura={largura}
        alinhar={alinhar}
        className={className}
      />
    );
  };

  const vazio = {
    NA_ATA: ["Nenhuma solicitação na ata", "Solicitações pré-reunião enviadas ficam aqui até a reunião de OS do evento."],
    ABERTAS: ["Nada aguardando resposta", veTodas ? "Quando uma área enviar uma solicitação, ela entra aqui ordenada por prazo." : "O que sua área enviar aparece aqui até a logística responder."],
    ATRASADAS: ["Nenhuma solicitação atrasada", "Solicitações abertas que passarem do prazo aparecem aqui."],
    RASCUNHO: ["Nenhum rascunho ou devolução", "Rascunhos salvos e solicitações devolvidas para ajuste aparecem aqui."],
    RESPONDIDA: ["Nenhuma solicitação respondida", "Quando todos os itens de uma solicitação forem respondidos, ela aparece aqui."],
    TODAS: ["Nenhuma solicitação", podeCriar ? "Envie as necessidades da sua área para um evento em preparação." : "As solicitações das áreas aparecem aqui."],
  }[filtro];

  return (
    <>
      {sp.excluido && /^SOL-\d{1,8}$/.test(sp.excluido) && (
        <Suspense fallback={null}>
          <AvisoExcluido codigo={sp.excluido} />
        </Suspense>
      )}
      <PageHeader
        title="Solicitações"
        divisor
        actions={
          <>
            {primeiraFila && (
              <ButtonLink href={`/solicitacoes/${primeiraFila}?fila=1`} variant="secondary" size="lg" className="no-underline">
                Responder em sequência
              </ButtonLink>
            )}
            {podeCriar && (
              <ButtonLink href="/solicitacoes/nova" variant="primary" size="lg" className="no-underline">
                {/* Com "+", como no painel (auditoria 28/10, nº 115). */}
                <Icone nome="mais" />
                Nova solicitação
              </ButtonLink>
            )}
          </>
        }
      />

      {/* Barra de filtros compacta (template de pedidos): busca, situação e evento na mesma linha.
          Celular: busca e evento na linha toda; tipo e reunião lado a lado (antes, cinco campos empilhados). */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
        <BuscaUrl placeholder="Buscar código ou título" ariaLabel="Buscar solicitação por código ou título" largura={240} className="col-span-2" />
        {/* Campo com busca: aguenta centenas de eventos. */}
        {eventosFiltro.length > 1 && <FiltroEvento eventos={eventosFiltro} rotuloOculto fluido className="col-span-2" />}
        {areasFiltro.length > 1 && <FiltroSelectUrl param="area" rotulo="Área" todas="Todas as áreas" opcoes={areasFiltro.map((a) => ({ value: a.id, label: a.nome })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))} className="col-span-2" />}
        <FiltroSelectUrl
          param="tipo"
          rotulo="Tipo"
          todas="Todos os tipos"
          opcoes={[
            { value: "PRE_REUNIAO", label: "Pré-reunião" },
            { value: "ALTERACAO", label: "Alteração" },
          ]}
        />
        <FiltroSelectUrl
          param="reuniao"
          rotulo="Data da reunião"
          todas="Qualquer reunião"
          opcoes={[
            { value: "hoje", label: "Reunião hoje" },
            { value: "amanha", label: "Reunião amanhã" },
            { value: "7dias", label: "Próximos 7 dias" },
          ]}
        />
        {comFiltro && (
          <Link href="/solicitacoes" className="col-span-2 text-pequeno font-medium text-accent no-underline hover:underline">
            Limpar filtros
          </Link>
        )}
        {pag.contagens.ATRASADAS > 0 && filtro !== "ATRASADAS" && (
          <Link href={hrefCom("/solicitacoes", params, { filtro: "ATRASADAS", pagina: null })} className="col-span-2 inline-flex items-center gap-1.5 text-pequeno font-medium text-danger no-underline hover:underline sm:ml-auto">
            <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full bg-danger" />
            {pag.contagens.ATRASADAS} {pag.contagens.ATRASADAS === 1 ? "atrasada" : "atrasadas"}
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        <ContagemAoVivo oculto n={pag.total} singular="solicitação" plural="solicitações" complemento={busca ? `${ROTULO_FILTRO[filtro]} · busca “${busca}”` : comFiltro ? `${ROTULO_FILTRO[filtro]} · com filtros` : ROTULO_FILTRO[filtro]} />
        {/* Situações como abas com contagem sempre à vista (a logística olha os números o tempo todo). */}
        <TabsNav
          rotulo="Situação das solicitações"
          className="mb-0 px-2 pt-1"
          tabs={FILTROS_LISTA.map((v) => ({ href: hrefCom("/solicitacoes", params, { filtro: v === filtroPadrao ? null : v, pagina: null }), label: ROTULO_FILTRO[v], n: pag.contagens[v], ativo: filtro === v }))}
        />
        {pag.total === 0 ? (
          <EmptyState
            title={busca ? `Nada encontrado para “${busca}”` : comFiltro ? "Nada com estes filtros" : vazio[0]}
            description={busca ? "Confira o código ou tente outra palavra do título." : comFiltro ? "Tire um filtro ou troque a aba." : vazio[1]}
            icone={busca || comFiltro ? "busca" : undefined}
            action={
              busca || comFiltro ? (
                <Link href={filtro === filtroPadrao ? "/solicitacoes" : `/solicitacoes?filtro=${filtro}`} className="link text-corpo">
                  Limpar filtros
                </Link>
              ) : filtro === "ABERTAS" && pag.contagens.RASCUNHO > 0 ? (
                <Link href="/solicitacoes?filtro=RASCUNHO" className="link text-corpo">
                  {pag.contagens.RASCUNHO} {pag.contagens.RASCUNHO === 1 ? "rascunho ou devolvida esperando você" : "rascunhos ou devolvidas esperando você"}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Celular: duas linhas por solicitação — o quê e o estado; de onde e o prazo. */}
            <ul className="m-0 list-none p-0 md:hidden">
              {pag.itens.map((s) => (
                <li key={s.id} className="border-b border-line-row last:border-b-0">
                  <Link href={`/solicitacoes/${s.id}`} className="relative block px-cartao py-3 no-underline transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <Codigo className="shrink-0 text-pequeno text-ink-3">{s.codigo}</Codigo>
                        {/* Até 2 linhas: numa só, o título ficava com 10–15 letras e o toque não tem title (auditoria 28/10, nº 24). */}
                        <span className="line-clamp-2 break-words text-corpo font-medium text-ink">{s.titulo || "sem título"}</span>
                      </span>
                      <SolicitacaoStatusTexto status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
                    </span>
                    <span className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-pequeno text-muted">{[veTodas ? s.area.nome : null, s.evento.nome].filter(Boolean).join(" · ")}</span>
                      {s.foraDaJanela ? <ForaJanelaTag className="shrink-0" /> : prazoDaLinha(s).texto !== "—" && prazo(s)}
                    </span>
                    <IndicadorLink lugar="sobre" />
                  </Link>
                </li>
              ))}
            </ul>
            {/* Uma linha por solicitação, uma informação por coluna. O tipo saiu da linha (filtro "Tipo" e a página
                da solicitação dizem); "por fulano" também (a área já diz de onde veio). */}
            <div className="hidden overflow-x-auto md:block">
              <table data-responsiva className="w-full table-fixed border-collapse">
                <CaptionOculta>{`Solicitações · ${ROTULO_FILTRO[filtro]}`}</CaptionOculta>
                <thead>
                  <tr className="bg-subtle">
                    {th("codigo", "Código", 96)}
                    {th("titulo", "Solicitação")}
                    <Th className="hidden lg:table-cell lg:w-[24%]">Evento</Th>
                    {/* Requisitante só vê a própria área: a coluna repetiria o mesmo nome em todas as linhas. */}
                    {veTodas && <Th className="hidden xl:table-cell xl:w-[120px]">Área</Th>}
                    <Th alinhar="right" className="hidden xl:table-cell xl:w-[72px]">
                      Itens
                    </Th>
                    {th("status", "Status", 128)}
                    {th(filtro === "NA_ATA" ? "reuniao" : "prazo", "Prazo / reunião", 176, "right")}
                  </tr>
                </thead>
                <tbody>
                  {pag.itens.map((s) => (
                    <LinhaLink key={s.id} href={`/solicitacoes/${s.id}`} rotulo={`Abrir ${s.codigo} — ${s.titulo || "sem título"}`}>
                      <td className="border-b border-line-row px-3 py-2.5 text-pequeno text-ink-3">
                        <Codigo>{s.codigo}</Codigo>
                      </td>
                      <th scope="row" className="max-w-0 border-b border-line-row px-3 py-2.5 text-left font-normal">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-corpo font-medium text-ink" title={`${s.titulo || "sem título"} · ${s.tipo === "PRE_REUNIAO" ? "pré-reunião" : "alteração"} · por ${s.criadoPor.nome}`}>
                            {s.titulo || "sem título"}
                          </span>
                        </span>
                        {/* Tela estreita: evento e área (colunas que sumiram) embaixo do título. */}
                        <span className="mt-0.5 block truncate text-pequeno text-muted xl:hidden">
                          {veTodas && s.area.nome}
                          <span className="lg:hidden">
                            {veTodas ? " · " : ""}
                            {s.evento.nome}
                          </span>
                        </span>
                      </th>
                      <td className="hidden max-w-0 border-b border-line-row px-3 py-2.5 lg:table-cell">
                        <span className="block truncate text-pequeno text-ink-2" title={s.evento.nome}>
                          {s.evento.nome}
                        </span>
                      </td>
                      {veTodas && <td className="hidden max-w-0 truncate border-b border-line-row px-3 py-2.5 text-pequeno text-ink-2 xl:table-cell">{s.area.nome}</td>}
                      <td className="numero hidden border-b border-line-row px-3 py-2.5 text-right text-pequeno text-ink-2 xl:table-cell" title={textoItens(s)}>
                        {aguardaReuniao(s.tipo, s.evento.status) || s.itensRespondidos === s.totalItens || s.itensRespondidos === 0 ? s.totalItens : `${s.itensRespondidos}/${s.totalItens}`}
                      </td>
                      <td className="border-b border-line-row px-3 py-2.5">
                        <SolicitacaoStatusTexto status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
                      </td>
                      {/* "Fora da janela" no lugar do prazo, como no celular: ao lado do título, espremia o nome até sumir. */}
                      <td className="border-b border-line-row py-2.5 pl-3 pr-cartao text-right">{s.foraDaJanela ? <ForaJanelaTag className="shrink-0" /> : prazo(s)}</td>
                    </LinhaLink>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao {...pag} hrefPagina={(p) => hrefCom("/solicitacoes", params, { pagina: p === 1 ? null : p })} />
          </>
        )}
      </div>
    </>
  );
}
