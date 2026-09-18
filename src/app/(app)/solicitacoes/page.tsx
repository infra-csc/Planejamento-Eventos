import type { Metadata } from "next";
import Link from "next/link";
import { requireUsuario } from "@/server/auth/session";
import { FiltroEvento } from "@/components/ui/filtro-evento";
import { eventosComSolicitacoes, FILTROS_LISTA, paginarSolicitacoes, primeiraDaFila, type FiltroLista } from "@/server/services/solicitacoes";
import { pode } from "@/domain/permissions";
import { aguardaReuniao } from "@/domain/solicitacao";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { hrefCom, proximaOrdem } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { ForaJanelaTag, SolicitacaoStatusBadge, TipoSolicitacaoTag } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { CaptionOculta, Paginacao, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";

export const metadata: Metadata = { title: "Solicitações" };

const POR_PAGINA = 25;

const ROTULO_FILTRO: Record<FiltroLista, string> = {
  ABERTAS: "Aguardando resposta",
  ATRASADAS: "Atrasadas",
  RASCUNHO: "Rascunhos e devolvidas",
  RESPONDIDA: "Respondidas",
  TODAS: "Todas",
};

export default async function SolicitacoesPage({ searchParams }: { searchParams: Promise<{ filtro?: string; ordem?: string; dir?: string; pagina?: string; evento?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const agora = new Date();
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  const ehLogistica = pode(usuario, "solicitacao.responder");
  const podeCriar = pode(usuario, "solicitacao.criar");
  // "Todas" é a porta de entrada: o resto são recortes dela.
  const filtro: FiltroLista = (FILTROS_LISTA as readonly string[]).includes(sp.filtro ?? "") ? (sp.filtro as FiltroLista) : "TODAS";
  const eventoId = sp.evento && /^[\w-]{1,64}$/.test(sp.evento) ? sp.evento : null;
  const [pag, primeiraFila, eventosFiltro] = await Promise.all([
    paginarSolicitacoes(usuario, { filtro, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina, porPagina: POR_PAGINA, eventoId }),
    ehLogistica ? primeiraDaFila(usuario) : Promise.resolve(null),
    eventosComSolicitacoes(usuario),
  ]);
  const params = { filtro: sp.filtro, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina, evento: sp.evento };

  const th = (chave: string, label: string, largura?: number, alinhar?: "left" | "right") => {
    const prox = proximaOrdem(sp.ordem, sp.dir, chave);
    return (
      <ThOrdenavel
        label={label}
        ativo={sp.ordem === chave}
        dir={sp.ordem === chave ? (sp.dir === "desc" ? "desc" : "asc") : undefined}
        href={hrefCom("/solicitacoes", params, { ordem: prox.ordem, dir: prox.dir, pagina: null })}
        largura={largura}
        alinhar={alinhar}
      />
    );
  };

  const vazio = {
    ABERTAS: ["Nada aguardando resposta", veTodas ? "Quando uma área enviar uma solicitação, ela entra aqui ordenada por prazo." : "O que sua área enviar aparece aqui até a logística responder."],
    ATRASADAS: ["Nenhuma solicitação com prazo vencido", "Solicitações abertas que passarem do prazo aparecem aqui."],
    RASCUNHO: ["Nenhum rascunho ou devolução", "Rascunhos salvos e solicitações devolvidas para ajuste aparecem aqui."],
    RESPONDIDA: ["Nenhuma solicitação respondida", "Quando todos os itens de uma solicitação forem respondidos, ela aparece aqui."],
    TODAS: ["Nenhuma solicitação", podeCriar ? "Envie as necessidades da sua área para um evento em preparação." : "As solicitações das áreas aparecem aqui."],
  }[filtro];

  return (
    <>
      <PageHeader
        title="Solicitações"
        description={veTodas ? "Necessidades pré-reunião e alterações pós-ata de todas as áreas. Cada item recebe resposta própria." : `O que a área ${usuario.areaNome ?? ""} enviou, o que voltou para ajuste e o que já foi respondido.`}
        actions={
          <>
            {primeiraFila && (
              <ButtonLink href={`/solicitacoes/${primeiraFila}?fila=1`} variant="secondary" size="lg" className="no-underline">
                Responder em sequência
              </ButtonLink>
            )}
            {podeCriar && (
              <ButtonLink href="/solicitacoes/nova" variant="primary" size="lg" className="no-underline">
                Nova solicitação
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="mb-[18px] flex flex-col gap-2.5">
        <Pills
          rotulo="Filtrar solicitações"
          itens={FILTROS_LISTA.map((v) => ({
            label: ROTULO_FILTRO[v],
            n: pag.contagens[v],
            href: hrefCom("/solicitacoes", params, { filtro: v === "TODAS" ? null : v, pagina: null }),
            ativo: filtro === v,
          }))}
        />
        {/* Campo com busca: aguenta centenas de eventos (pílulas não). */}
        {eventosFiltro.length > 1 && <FiltroEvento eventos={eventosFiltro} />}
      </div>

      <div className="overflow-hidden rounded-cartao border border-line bg-surface">
        {pag.total === 0 ? (
          <EmptyState
            title={vazio[0]}
            description={vazio[1]}
            action={
              filtro === "ABERTAS" && pag.contagens.RASCUNHO > 0 ? (
                <Link href="/solicitacoes?filtro=RASCUNHO" className="link text-corpo">
                  Você tem {pag.contagens.RASCUNHO} {pag.contagens.RASCUNHO === 1 ? "rascunho ou devolvida" : "rascunhos ou devolvidas"} esperando você
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <table className="w-full border-collapse">
              <CaptionOculta>{`Solicitações · ${ROTULO_FILTRO[filtro]}`}</CaptionOculta>
              <thead>
                <tr className="bg-subtle">
                  {th("codigo", "Código", 110)}
                  {th("titulo", "Solicitação")}
                  {th("itens", "Itens", 90)}
                  {th("status", "Status", 130)}
                  {th("prazo", "Prazo", 130, "right")}
                </tr>
              </thead>
              <tbody>
                {pag.itens.map((s) => {
                  const pi = prazoInfo(s, agora);
                  return (
                    <LinhaLink key={s.id} href={`/solicitacoes/${s.id}`} rotulo={`Abrir ${s.codigo} — ${s.titulo || "sem título"}`}>
                      <td className="border-b border-line-row px-[18px] py-3 font-mono text-pequeno font-medium text-ink">{s.codigo}</td>
                      <th scope="row" className="border-b border-line-row px-2.5 py-3 text-left font-normal">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-corpo font-medium text-ink">{s.titulo || "sem título"}</span>
                          <TipoSolicitacaoTag tipo={s.tipo} />
                          {s.foraDaJanela && <ForaJanelaTag />}
                        </span>
                        <span className="mt-0.5 block text-pequeno text-muted">
                          {s.area.nome} · {s.evento.nome} · {s.criadoPor.nome}
                        </span>
                      </th>
                      <td className="border-b border-line-row px-2.5 py-3 font-mono text-pequeno text-ink-3">
                        {s.itensRespondidos}/{s.totalItens}
                      </td>
                      <td className="border-b border-line-row px-2.5 py-3">
                        <SolicitacaoStatusBadge status={s.status} naAta={aguardaReuniao(s.tipo, s.evento.status)} />
                      </td>
                      <td className="border-b border-line-row py-3 pl-2.5 pr-[18px] text-right">
                        <span className="flex items-center justify-end gap-1.5 font-mono text-pequeno font-medium" style={{ color: COR_TOM[pi.tom] }}>
                          {pi.vencido && <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full" style={{ background: COR_TOM[pi.tom] }} />}
                          {pi.label}
                        </span>
                        <span className="block text-rotulo text-meta">{pi.sub}</span>
                      </td>
                    </LinhaLink>
                  );
                })}
              </tbody>
            </table>
            <Paginacao {...pag} hrefPagina={(p) => hrefCom("/solicitacoes", params, { pagina: p === 1 ? null : p })} />
          </>
        )}
      </div>
    </>
  );
}
