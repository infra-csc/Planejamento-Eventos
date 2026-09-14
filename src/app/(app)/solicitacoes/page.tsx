import type { Metadata } from "next";
import { requireUsuario } from "@/server/auth/session";
import { listarFila, listarSolicitacoes, type SolicitacaoLista } from "@/server/services/solicitacoes";
import { pode } from "@/domain/permissions";
import { estaAtrasada } from "@/domain/solicitacao";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { hrefCom, ordenar, paginar, proximaOrdem } from "@/lib/url";
import { ButtonLink } from "@/components/ui/button";
import { SolicitacaoStatusBadge, TipoSolicitacaoTag } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/layout";
import { Pills } from "@/components/ui/pills";
import { CaptionOculta, Paginacao, ThOrdenavel } from "@/components/ui/tabela";
import { LinhaLink } from "@/components/ui/linha-link";

export const metadata: Metadata = { title: "Solicitações" };

const POR_PAGINA = 8;

const FILTROS = [
  ["ABERTAS", "Aguardando resposta"],
  ["ATRASADAS", "Atrasadas"],
  ["RASCUNHO", "Rascunhos e devolvidas"],
  ["RESPONDIDA", "Respondidas"],
  ["TODAS", "Todas"],
] as const;
type Filtro = (typeof FILTROS)[number][0];

function passa(s: SolicitacaoLista, f: Filtro, agora: Date) {
  if (f === "ABERTAS") return s.status === "ENVIADA" || s.status === "EM_ANALISE";
  if (f === "ATRASADAS") return estaAtrasada(s.status, s.prazoRespostaEm, agora);
  if (f === "RASCUNHO") return s.status === "RASCUNHO" || s.status === "DEVOLVIDA";
  if (f === "RESPONDIDA") return s.status === "RESPONDIDA";
  return true;
}

const ORDEM_STATUS = { DEVOLVIDA: 0, RASCUNHO: 1, ENVIADA: 2, EM_ANALISE: 3, RESPONDIDA: 4, CANCELADA: 5 } as const;

export default async function SolicitacoesPage({ searchParams }: { searchParams: Promise<{ filtro?: string; ordem?: string; dir?: string; pagina?: string }> }) {
  const usuario = await requireUsuario();
  const sp = await searchParams;
  const agora = new Date();
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  const ehLogistica = pode(usuario, "solicitacao.responder");
  const podeCriar = pode(usuario, "solicitacao.criar");
  const [todas, fila] = await Promise.all([listarSolicitacoes(usuario), ehLogistica ? listarFila(usuario) : Promise.resolve([])]);

  const filtro: Filtro = FILTROS.some(([v]) => v === sp.filtro) ? (sp.filtro as Filtro) : "ABERTAS";
  const filtradas = todas.filter((s) => passa(s, filtro, agora));
  const padrao = [...filtradas].sort((a, b) => (a.prazoRespostaEm?.getTime() ?? Infinity) - (b.prazoRespostaEm?.getTime() ?? Infinity) || b.atualizadoEm.getTime() - a.atualizadoEm.getTime());
  const ordenadas = ordenar(
    padrao,
    {
      codigo: (s) => s.codigo,
      titulo: (s) => (s.titulo ?? "").toLowerCase(),
      itens: (s) => s.totalItens,
      status: (s) => ORDEM_STATUS[s.status],
      prazo: (s) => s.prazoRespostaEm?.getTime() ?? Number.MAX_SAFE_INTEGER,
    },
    sp.ordem,
    sp.dir,
  );
  const pag = paginar(ordenadas, sp.pagina, POR_PAGINA);
  const params = { filtro: sp.filtro, ordem: sp.ordem, dir: sp.dir, pagina: sp.pagina };

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
            {ehLogistica && fila.length > 0 && (
              <ButtonLink href={`/solicitacoes/${fila[0].id}?fila=1`} variant="secondary" size="lg" className="no-underline">
                Responder em fila
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

      <div className="mb-[18px]">
        <Pills
          rotulo="Filtrar solicitações"
          itens={FILTROS.map(([v, label]) => ({
            label,
            n: todas.filter((s) => passa(s, v, agora)).length,
            href: hrefCom("/solicitacoes", params, { filtro: v === "ABERTAS" ? null : v, pagina: null }),
            ativo: filtro === v,
          }))}
        />
      </div>

      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        {pag.total === 0 ? (
          <div className="px-[18px] py-14 text-center">
            <p className="m-0 text-[14px] font-medium">{vazio[0]}</p>
            <p className="mt-[5px] text-[13px] text-muted">{vazio[1]}</p>
          </div>
        ) : (
          <>
            <table className="w-full border-collapse">
              <CaptionOculta>{`Solicitações · ${FILTROS.find(([v]) => v === filtro)![1]}`}</CaptionOculta>
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
                      <td className="border-b border-line-row px-[18px] py-3 font-mono text-[12.5px] font-medium text-ink">{s.codigo}</td>
                      <th scope="row" className="border-b border-line-row px-2.5 py-3 text-left font-normal">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] text-ink">{s.titulo || "sem título"}</span>
                          <TipoSolicitacaoTag tipo={s.tipo} />
                        </span>
                        <span className="mt-0.5 block text-[12px] text-muted">
                          {s.area.nome} · {s.evento.nome} · {s.criadoPor.nome}
                        </span>
                      </th>
                      <td className="border-b border-line-row px-2.5 py-3 font-mono text-[12.5px] text-ink-3">
                        {s.itensRespondidos}/{s.totalItens}
                      </td>
                      <td className="border-b border-line-row px-2.5 py-3">
                        <SolicitacaoStatusBadge status={s.status} />
                      </td>
                      <td className="border-b border-line-row py-3 pl-2.5 pr-[18px] text-right">
                        <span className="flex items-center justify-end gap-1.5 font-mono text-[12.5px] font-medium" style={{ color: COR_TOM[pi.tom] }}>
                          {pi.vencido && <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full" style={{ background: COR_TOM[pi.tom] }} />}
                          {pi.label}
                        </span>
                        <span className="block text-[11.5px] text-meta">{pi.sub}</span>
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
