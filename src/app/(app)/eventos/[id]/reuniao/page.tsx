import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterEvento, obterLinhasAta, opcoesReferencias } from "@/server/services/eventos";
import { descricaoItem, listarSolicitacoes, obterSolicitacoes } from "@/server/services/solicitacoes";
import { listarAreas } from "@/server/services/admin";
import { podeCorrigirResposta, podeResponder, podeResponderNaFase } from "@/domain/solicitacao";
import { diaMesHora } from "@/lib/format";
import { Section } from "@/components/ui/layout";
import { SolicitacaoStatusBadge } from "@/components/ui/badge";
import { AtaLista } from "@/components/eventos/ata-lista";
import { BannerReuniao } from "@/components/eventos/banner-reuniao";
import { ObservacoesAutosave } from "@/components/eventos/observacoes-autosave";
import { DicaAtalhos, ItemResposta, RespostaProvider, type ItemParaResposta } from "@/components/solicitacoes/item-resposta";
import { paraView } from "@/components/eventos/ata-view";

export const metadata: Metadata = { title: "Consolidar ata" };

export default async function ReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("ata.consolidar");
  const { id } = await params;
  const ev = await obterEvento(usuario, id);
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") redirect(`/eventos/${id}/ata`);

  const [lista, linhas, opcoes, areas] = await Promise.all([listarSolicitacoes(usuario, { eventoId: id }), obterLinhasAta(id), opcoesReferencias(), listarAreas()]);
  const pre = lista.filter((s) => s.tipo === "PRE_REUNIAO" && s.status !== "RASCUNHO" && s.status !== "CANCELADA" && s.status !== "DEVOLVIDA").sort((a, b) => a.codigo.localeCompare(b.codigo));
  const detalhes = await obterSolicitacoes(
    usuario,
    pre.map((s) => s.id),
  );
  const faseOk = podeResponderNaFase("PRE_REUNIAO", ev.status);

  const porSolicitacao = detalhes.map((s) => ({
    s,
    itens: s.itens.map(
      (i): ItemParaResposta => ({
        id: i.id,
        descricao: descricaoItem(i),
        operacao: i.operacao,
        quantidadeSolicitada: i.quantidadeSolicitada,
        quantidadeAtual: i.quantidadeAnterior ?? i.eventoItem?.quantidade ?? null,
        destino: i.destino,
        justificativa: i.justificativa,
        status: i.status,
        quantidadeAtendida: i.quantidadeAtendida,
        observacaoLogistica: i.observacaoLogistica,
        pendenciaCompra: i.pendenciaCompra,
        respondivel: faseOk && podeResponder(s.status),
        corrigivel: faseOk && (podeCorrigirResposta(s.status) || s.status === "EM_ANALISE") && i.status !== "EM_ANALISE",
      }),
    ),
  }));
  const todos = porSolicitacao.flatMap((x) => x.itens);
  const respondidos = todos.filter((i) => i.status !== "EM_ANALISE").length;
  const comEnvio = new Set(pre.map((s) => s.areaId));
  const semEnvio = areas.filter((a) => a.nome !== "Logística" && !comEnvio.has(a.id));

  return (
    <>
      <BannerReuniao eventoId={id} nome={ev.nome} codigo={ev.codigo} status={ev.status} respondidos={respondidos} total={todos.length} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
        <RespostaProvider itens={todos} sufixoToast="ata atualizada">
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[14px] font-semibold">Necessidades enviadas pelas áreas</h2>
              {todos.length > 0 && <DicaAtalhos />}
            </div>

            {porSolicitacao.length === 0 && (
              <div className="rounded-[10px] border border-line bg-surface px-[18px] py-10 text-center">
                <p className="m-0 text-[13.5px] font-medium">Nenhuma necessidade enviada</p>
                <p className="mt-1 text-[12.5px] text-muted">Quando as áreas enviarem, os itens aparecem aqui para resposta.</p>
              </div>
            )}

            {porSolicitacao.map(({ s, itens }) => (
              <Section
                key={s.id}
                titulo={
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/solicitacoes/${s.id}`} className="font-mono text-[12.5px] font-medium text-ink no-underline hover:underline">
                      {s.codigo}
                    </Link>
                    <span>{s.area.nome}</span>
                    <SolicitacaoStatusBadge status={s.status} />
                  </span>
                }
                sub={`${s.titulo || "sem título"} · ${s.criadoPor.nome} · enviada ${diaMesHora(s.enviadaEm)}${s.observacao ? ` · ${s.observacao}` : ""}`}
              >
                {itens.map((i) => (
                  <ItemResposta key={i.id} item={i} />
                ))}
              </Section>
            ))}

            {semEnvio.length > 0 && (
              <div className="rounded-[10px] border border-dashed border-line-strong px-[18px] py-3.5 text-[12.5px] text-ink-3">
                Sem envio até agora: <span className="text-ink-2">{semEnvio.map((a) => a.nome).join(", ")}</span>. Você ainda pode incluir linhas direto na ata.
              </div>
            )}
          </div>
        </RespostaProvider>

        <div className="lg:sticky lg:top-[76px] flex flex-col gap-3.5">
          <Section titulo="Ata em construção" sub="Atualiza a cada resposta.">
            <AtaLista
              eventoId={id}
              status={ev.status}
              editavel
              compacta
              opcoes={opcoes}
              areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
              linhas={linhas.map(paraView)}
              dataReuniao={diaMesHora(ev.dataReuniao)}
            />
          </Section>
          <Section titulo="Observações da reunião">
            <div className="px-[18px] py-3.5">
              <ObservacoesAutosave eventoId={id} valor={ev.observacoesReuniao ?? ""} />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
