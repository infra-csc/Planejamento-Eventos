import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissao } from "@/server/auth/session";
import { obterEvento, obterLinhasAta, opcoesReferencias } from "@/server/services/eventos";
import { listarSolicitacoes, obterSolicitacao, descricaoItem } from "@/server/services/solicitacoes";
import { listarAreas } from "@/server/services/admin";
import { Notice, Panel } from "@/components/ui/layout";
import { ItemStatusBadge, SolicitacaoStatusBadge } from "@/components/ui/badge";
import { AtaTabela } from "@/components/eventos/ata-tabela";
import { ResponderItemForm } from "@/components/solicitacoes/responder-item-form";
import { ObservacoesForm } from "@/components/eventos/observacoes-form";
import { formatarDataHora } from "@/lib/format";

export const metadata: Metadata = { title: "Consolidar ata" };

export default async function ReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("ata.consolidar");
  const { id } = await params;
  const ev = await obterEvento(usuario, id);
  const consolidavel = ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO";

  const [lista, linhas, opcoes, areas] = await Promise.all([listarSolicitacoes(usuario, { eventoId: id }), obterLinhasAta(id), opcoesReferencias(), listarAreas()]);
  const pre = lista.filter((s) => s.tipo === "PRE_REUNIAO" && s.status !== "RASCUNHO" && s.status !== "CANCELADA");
  const detalhes = await Promise.all(pre.map((s) => obterSolicitacao(usuario, s.id)));
  const pendentes = detalhes.flatMap((s) => s.itens.filter((i) => i.status === "EM_ANALISE" && (s.status === "ENVIADA" || s.status === "EM_ANALISE"))).length;
  const areasSemEnvio = areas.filter((a) => a.nome !== "Logística" && !pre.some((s) => s.areaId === a.id));

  return (
    <div className="space-y-4">
      {!consolidavel && (
        <Notice tone="warning" title="A ata deste evento já foi fechada">
          Ajustes agora acontecem na{" "}
          <Link href={`/eventos/${id}/ata`} className="underline">
            aba Ata
          </Link>{" "}
          (com justificativa) ou por solicitações de alteração.
        </Notice>
      )}
      {consolidavel && (
        <Notice tone={pendentes > 0 ? "info" : "success"} title={pendentes > 0 ? `${pendentes} item(ns) aguardando resposta` : "Todos os itens enviados foram respondidos"}>
          {pendentes > 0
            ? "Responda cada item: atendido entra na ata com a quantidade pedida; parcial entra com a quantidade atendida; não atendido não entra. Parcial e não atendido exigem observação."
            : ev.status === "EM_REUNIAO"
              ? "Revise as linhas da ata e use “Fechar ata” no topo para gerar a OS."
              : "Use “Iniciar reunião” no topo quando a reunião começar; depois, feche a ata."}
          {areasSemEnvio.length > 0 && <span className="block mt-1">Sem envio: {areasSemEnvio.map((a) => a.nome).join(", ")}.</span>}
        </Notice>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <h2 className="text-sm font-semibold text-ink">Necessidades enviadas pelas áreas</h2>
          {detalhes.length === 0 && (
            <Panel>
              <p className="text-sm text-ink-muted">Nenhuma área enviou necessidades ainda. Você pode incluir linhas diretamente na ata.</p>
            </Panel>
          )}
          {detalhes.map((s) => (
            <Panel
              key={s.id}
              title={
                <span className="flex items-center gap-2">
                  {s.area.nome} <span className="font-normal text-ink-muted">· {s.codigo}</span> <SolicitacaoStatusBadge status={s.status} />
                </span>
              }
              description={`${s.titulo ? `${s.titulo} · ` : ""}enviada ${formatarDataHora(s.enviadaEm)} por ${s.criadoPor.nome}${s.observacao ? ` — ${s.observacao}` : ""}`}
              actions={
                <Link href={`/solicitacoes/${s.id}`} className="text-xs text-info hover:underline">
                  Abrir
                </Link>
              }
              padded={false}
            >
              <ul className="divide-y divide-line">
                {s.itens.map((i) => {
                  const desc = descricaoItem(i);
                  return (
                    <li key={i.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {desc} <span className="text-ink-muted">× {i.quantidadeSolicitada}</span>
                          </p>
                          <p className="text-xs text-ink-muted">
                            {i.destino ? `Destino: ${i.destino}` : ""}
                            {i.destino && i.justificativa ? " · " : ""}
                            {i.justificativa ?? ""}
                          </p>
                        </div>
                        <ItemStatusBadge status={i.status} />
                      </div>
                      {i.status === "EM_ANALISE" && consolidavel && (s.status === "ENVIADA" || s.status === "EM_ANALISE") ? (
                        <div className="mt-2">
                          <ResponderItemForm
                            modo="responder"
                            item={{ id: i.id, descricao: desc, operacao: i.operacao, quantidadeSolicitada: i.quantidadeSolicitada, status: i.status, quantidadeAtendida: i.quantidadeAtendida, observacaoLogistica: i.observacaoLogistica, pendenciaCompra: i.pendenciaCompra }}
                          />
                        </div>
                      ) : (
                        i.status !== "EM_ANALISE" && (
                          <p className="mt-1 text-[13px] text-ink-secondary">
                            {i.quantidadeAtendida}/{i.quantidadeSolicitada}
                            {i.observacaoLogistica ? ` — ${i.observacaoLogistica}` : ""} <span className="text-ink-muted">· {i.respondidoPor?.nome}</span>
                          </p>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>

        <div className="space-y-4 xl:col-span-2">
          <h2 className="text-sm font-semibold text-ink">Ata (linhas consolidadas)</h2>
          <Panel padded={false}>
            <AtaTabela
              eventoId={id}
              status={ev.status}
              podeEditar
              compacta
              opcoes={opcoes}
              areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
              linhas={linhas.map((l) => ({
                id: l.id,
                tipo: l.tipo,
                descricao: l.descricao,
                quantidade: l.quantidade,
                destino: l.destino,
                areaNome: l.areaNome,
                origem: l.registro.origem,
                versaoDefasada: l.versaoDefasada,
                versao: l.projeto?.versao ?? null,
                setor: l.peca?.setor ?? null,
              }))}
            />
          </Panel>
          <Panel title="Observações da reunião" description="Decisões, participantes, combinados. Entram na ata congelada.">
            <ObservacoesForm eventoId={id} valor={ev.observacoesReuniao ?? ""} disabled={!consolidavel} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
