import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { descricaoItem, listarFila, obterSolicitacao } from "@/server/services/solicitacoes";
import { resumirAjustes } from "@/domain/os";
import { DomainError, NaoEncontradoError } from "@/domain/errors";
import { pode, podeEditarSolicitacao } from "@/domain/permissions";
import { aceitaSolicitacao } from "@/domain/evento";
import { podeCancelar, podeCorrigirResposta, podeDevolver, podeEnviar, podeResponder, podeResponderNaFase, aguardaReuniao } from "@/domain/solicitacao";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { diaMesHora } from "@/lib/format";
import { Aviso, ListaDados, Section } from "@/components/ui/layout";
import { ForaJanelaTag, SolicitacaoStatusBadge } from "@/components/ui/badge";
import { DefinirTrilha } from "@/components/shell/trilha";
import { DicaAtalhos, ItemResposta, RespostaProvider, type ItemParaResposta } from "@/components/solicitacoes/item-resposta";
import { AcoesSolicitacao } from "@/components/solicitacoes/acoes-solicitacao";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const s = await obterSolicitacao(usuario, id).catch(() => null);
  return { title: s ? `${s.codigo} · ${s.titulo || s.evento.nome}` : "Solicitação" };
}

export default async function SolicitacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fila?: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const s = await obterSolicitacao(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    if (e instanceof DomainError && e.code === "SEM_PERMISSAO") redirect("/sem-permissao");
    throw e;
  });

  const agora = new Date();
  const ehLogistica = pode(usuario, "solicitacao.responder");
  const faseOk = podeResponderNaFase(s.tipo, s.evento.status);
  const naAta = aguardaReuniao(s.tipo, s.evento.status);
  const respondivel = ehLogistica && podeResponder(s.status) && faseOk;
  const corrigivel = ehLogistica && (podeCorrigirResposta(s.status) || s.status === "EM_ANALISE") && faseOk;
  const algumRespondido = s.itens.some((i) => i.status !== "EM_ANALISE");
  const pendentes = s.itens.filter((i) => i.status === "EM_ANALISE").length;
  const dono = podeEditarSolicitacao(usuario, s);
  const editavel = dono && podeEnviar(s.status);
  const sufixo = s.tipo === "ALTERACAO" ? "OS regerada" : "ata atualizada";

  const modoFila = sp.fila === "1" && ehLogistica;
  const fila = modoFila ? await listarFila(usuario) : [];
  const idx = fila.findIndex((f) => f.id === s.id);
  const proxima = idx >= 0 ? fila[idx + 1] : fila.find((f) => f.id !== s.id);
  const anterior = idx > 0 ? fila[idx - 1] : null;
  const proximaHref = modoFila && proxima ? `/solicitacoes/${proxima.id}?fila=1` : null;

  const pi = prazoInfo(s, agora);
  const itens: ItemParaResposta[] = s.itens.map((i) => ({
    id: i.id,
    descricao: descricaoItem(i),
    operacao: i.operacao,
    quantidadeSolicitada: i.quantidadeSolicitada,
    quantidadeAtual: i.quantidadeAnterior ?? i.eventoItem?.quantidade ?? null,
    destino: i.destino,
    justificativa: i.justificativa,
    ajustes: resumirAjustes(i.ajustesBom),
    status: i.status,
    quantidadeAtendida: i.quantidadeAtendida,
    observacaoLogistica: i.observacaoLogistica,
    pendenciaCompra: i.pendenciaCompra,
    respondivel,
    corrigivel: corrigivel && i.status !== "EM_ANALISE",
    aguardandoReuniao: naAta,
  }));
  // Rascunho e devolvida ainda não estão na fila: o status do item não faz sentido antes do envio.
  const semStatus = s.status === "RASCUNHO" || s.status === "DEVOLVIDA";

  return (
    <div className="max-w-[1080px]">
      <DefinirTrilha itens={[{ label: "Solicitações", href: "/solicitacoes" }, { label: s.codigo }]} />

      {modoFila && (
        <div className="mb-[18px] flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[10px] bg-dark px-[18px] py-3">
          <span className="text-[13.5px] font-semibold text-white">Respondendo em sequência</span>
          <span className="font-mono text-[12.5px] text-on-dark-2">{idx >= 0 ? `${idx + 1} de ${fila.length}` : `${fila.length} ${fila.length === 1 ? "restante" : "restantes"}`}</span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-on-dark-3">ordenada por prazo · atalhos A, P e N no item selecionado</span>
          {anterior ? (
            <Link href={`/solicitacoes/${anterior.id}?fila=1`} className="h-[30px] rounded-[7px] border border-dark-4 px-3 text-[12.5px] leading-[28px] text-on-dark-2 no-underline hover:text-white">
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="h-[30px] cursor-not-allowed rounded-[7px] border border-dark-3 px-3 text-[12.5px] leading-[28px] text-muted">
              Anterior
            </span>
          )}
          {proxima ? (
            <Link href={`/solicitacoes/${proxima.id}?fila=1`} className="h-[30px] rounded-[7px] bg-accent-light px-3 text-[12.5px] font-medium leading-[30px] text-dark no-underline hover:brightness-105">
              Próxima
            </Link>
          ) : (
            <span aria-disabled="true" className="h-[30px] cursor-not-allowed rounded-[7px] bg-dark-3 px-3 text-[12.5px] leading-[30px] text-muted">
              Fila zerada
            </span>
          )}
          <Link href={`/solicitacoes/${s.id}`} className="text-[12.5px] text-on-dark-3 no-underline hover:text-white">
            Sair
          </Link>
        </div>
      )}

      <div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[15px] font-medium">{s.codigo}</span>
            <SolicitacaoStatusBadge status={s.status} naAta={naAta} />
            {s.foraDaJanela && <ForaJanelaTag />}
            {pi.vencido && <span className="text-[12.5px] font-medium text-danger">atrasada {pi.sub}</span>}
          </div>
          <h1 className="mb-0 mt-1 text-[22px] font-semibold leading-[1.25] tracking-[-0.02em]">{s.titulo || "Solicitação sem título"}</h1>
          <p className="mb-0 mt-1.5 text-[13px] text-ink-2">
            {s.tipo === "PRE_REUNIAO" ? "Necessidade pré-reunião" : "Alteração pós-ata"} ·{" "}
            <Link href={`/eventos/${s.eventoId}`} className="link">
              {s.evento.codigo} {s.evento.nome}
            </Link>{" "}
            · {s.area.nome} · {s.criadoPor.nome}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <AcoesSolicitacao
            id={s.id}
            codigo={s.codigo}
            podeDevolver={ehLogistica && faseOk && podeDevolver(s.status, algumRespondido)}
            podeAtenderTudo={respondivel && pendentes > 0}
            pendentes={pendentes}
            podeEditar={editavel && s.evento.status !== "CANCELADO" && s.evento.status !== "ENCERRADO"}
            podeEnviar={editavel && s.itens.length > 0 && Boolean(s.titulo?.trim()) && aceitaSolicitacao(s.evento.status, s.tipo)}
            podeCancelar={dono && podeCancelar(s.status, algumRespondido) && s.status !== "RASCUNHO"}
            podeExcluir={dono && s.status === "RASCUNHO"}
            proximaHref={proximaHref}
            sufixo={sufixo}
          />
        </div>
      </div>

      {s.foraDaJanela && (s.status === "ENVIADA" || s.status === "EM_ANALISE") && (
        <Aviso tom="danger" titulo="Enviada fora da janela de alterações" className="mb-[18px]">
          {ehLogistica
            ? "A janela definida para este evento já terminou. Decida item a item: atender, atender parcialmente ou não atender, com o motivo."
            : "A janela de alterações deste evento já terminou. A logística vai avaliar se ainda dá para atender."}
        </Aviso>
      )}
      {s.status === "DEVOLVIDA" && (
        <Aviso tom="warning" titulo="Devolvida pela logística" className="mb-[18px]">
          {s.devolvidaMotivo}. Corrija e reenvie.
        </Aviso>
      )}
      {s.status === "CANCELADA" && (
        <Aviso tom="danger" titulo="Solicitação cancelada" className="mb-[18px]">
          {s.canceladaMotivo || "Sem motivo registrado."}
        </Aviso>
      )}
      {editavel && aceitaSolicitacao(s.evento.status, s.tipo) && (s.itens.length === 0 || !s.titulo?.trim()) && (
        <Aviso className="mb-[18px]" titulo="Falta preencher antes de enviar">
          {s.itens.length === 0 ? "Adicione ao menos um item" : "Dê um título para a logística identificar a solicitação na fila"} em{" "}
          <Link href={`/solicitacoes/nova?rascunho=${s.id}`} className="link">
            Editar itens
          </Link>
          .
        </Aviso>
      )}
      {editavel && !aceitaSolicitacao(s.evento.status, s.tipo) && (
        <Aviso tom="warning" titulo="O evento não aceita este envio agora" className="mb-[18px]">
          O rascunho continua salvo. {s.tipo === "PRE_REUNIAO" ? "Necessidades só entram com o evento em preparação." : "Alterações só entram com o evento aberto."}
        </Aviso>
      )}
      {respondivel && s.tipo === "PRE_REUNIAO" && (
        <Aviso className="mb-[18px]">
          Estes itens já estão na ata. A logística confere e ajusta na{" "}
          <Link href={`/eventos/${s.eventoId}/reuniao`} className="link">
            conferência da ata
          </Link>{" "}
          do evento.
        </Aviso>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="flex flex-col gap-5">
          {s.observacao && (
            <Section titulo="Observação do solicitante">
              <p className="m-0 whitespace-pre-wrap px-[18px] py-3.5 text-[13.5px] leading-[1.55] text-ink-2">{s.observacao}</p>
            </Section>
          )}
          <RespostaProvider itens={itens} sufixoToast={sufixo}>
            <Section titulo={`Itens · ${s.itens.length}`} sub={respondivel ? "Cada item recebe resposta própria. Parcial e não atendido exigem motivo." : undefined} acoes={respondivel && pendentes > 0 ? <DicaAtalhos /> : undefined}>
              {itens.length === 0 ? <p className="m-0 px-[18px] py-8 text-center text-[12.5px] text-muted">Nenhum item adicionado.</p> : itens.map((i) => <ItemResposta key={i.id} item={i} semStatus={semStatus} />)}
            </Section>
          </RespostaProvider>
        </div>
        <Section titulo="Dados">
          <ListaDados
            itens={[
              { label: "Criada em", valor: diaMesHora(s.criadoEm) },
              { label: "Enviada em", valor: s.enviadaEm ? diaMesHora(s.enviadaEm) : "—" },
              ...(naAta
                ? [
                    { label: "Reunião de OS", valor: diaMesHora(s.evento.dataReuniao) },
                    { label: "Situação", valor: "na ata, aguarda conferência" },
                    { label: "Itens na ata", valor: `${s.itens.filter((i) => i.status === "ATENDIDO" || i.status === "PARCIAL").length} de ${s.itens.length}`, forte: true },
                  ]
                : [
                    {
                      label: "Prazo de resposta",
                      valor: s.prazoRespostaEm ? <span style={{ color: COR_TOM[pi.tom] }}>{diaMesHora(s.prazoRespostaEm)}</span> : "—",
                      alerta: pi.vencido,
                    },
                    { label: "Respondida em", valor: s.respondidaEm ? diaMesHora(s.respondidaEm) : "—" },
                    { label: "Itens respondidos", valor: `${s.itens.length - pendentes} de ${s.itens.length}`, forte: true },
                  ]),
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
