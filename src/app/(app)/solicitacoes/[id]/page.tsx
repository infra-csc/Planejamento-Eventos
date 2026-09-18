import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { descricaoItem, listarFila } from "@/server/services/solicitacoes";
import { obterSolicitacaoCache } from "@/server/cache";
import { resumirAjustes } from "@/domain/os";
import { DomainError, NaoEncontradoError } from "@/domain/errors";
import { pode, podeEditarSolicitacao } from "@/domain/permissions";
import { aceitaSolicitacao } from "@/domain/evento";
import { podeCancelar, podeCorrigirResposta, podeDevolver, podeEnviar, podeResponder, podeResponderNaFase, aguardaReuniao } from "@/domain/solicitacao";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { diaMesHora } from "@/lib/format";
import { Aviso, BannerEscuro, EmptyState, ListaDados, PageHeader, Section } from "@/components/ui/layout";
import { ChipMono, ForaJanelaTag, SolicitacaoStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { DicaAtalhos, ItemResposta, RespostaProvider, type ItemParaResposta } from "@/components/solicitacoes/item-resposta";
import { AcoesSolicitacao } from "@/components/solicitacoes/acoes-solicitacao";
import { VincularCatalogo } from "@/components/eventos/vincular-catalogo";
import { LinhaDoTempo } from "@/components/ui/linha-do-tempo";
import { linhaDoTempoSolicitacao } from "@/server/services/linha-do-tempo";
import { obterEventoCache } from "@/server/cache";
import { listarOsResumo } from "@/server/services/os";
import { EventoStatusBadge } from "@/components/ui/badge";
import { diaMesISO, periodoCurto } from "@/lib/format";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const s = await obterSolicitacaoCache(usuario, id).catch(() => null);
  return { title: s ? `${s.codigo} · ${s.titulo || s.evento.nome}` : "Solicitação" };
}

export default async function SolicitacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fila?: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const s = await obterSolicitacaoCache(usuario, id).catch((e) => {
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
  const sufixo = s.tipo === "ALTERACAO" ? "nova versão da OS" : "item entrou na ata";

  const modoFila = sp.fila === "1" && ehLogistica;

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
  // "Outro item (descrever)": fora do catálogo até a logística cadastrar ou vincular.
  const foraCatalogo = s.itens.filter((i) => i.operacao === "ADICIONAR" && !i.projetoId && !i.pecaId && i.descricaoLivre);
  const enviada = s.status !== "RASCUNHO" && s.status !== "DEVOLVIDA" && s.status !== "CANCELADA";
  const eventoAtivo = s.evento.status !== "ENCERRADO" && s.evento.status !== "CANCELADO";
  const logisticaVincula = pode(usuario, "ata.consolidar") && enviada && eventoAtivo && foraCatalogo.length > 0;
  const [opcoesVinculo, historicoSolicitacao, evento, versoesOs, fila] = await Promise.all([
    logisticaVincula ? opcoesReferenciasResumidas() : Promise.resolve(null),
    linhaDoTempoSolicitacao(usuario, s.id),
    obterEventoCache(usuario, s.eventoId),
    listarOsResumo(s.eventoId),
    modoFila ? listarFila(usuario) : Promise.resolve([]),
  ]);
  const idx = fila.findIndex((f) => f.id === s.id);
  const proxima = idx >= 0 ? fila[idx + 1] : fila.find((f) => f.id !== s.id);
  const anterior = idx > 0 ? fila[idx - 1] : null;
  const proximaHref = modoFila && proxima ? `/solicitacoes/${proxima.id}?fila=1` : null;
  const rotuloItem = (itemId: string) => {
    const i = s.itens.find((x) => x.id === itemId);
    return i ? descricaoItem(i) : null;
  };
  // Rascunho e devolvida ainda não estão na fila: o status do item não faz sentido antes do envio.
  const semStatus = s.status === "RASCUNHO" || s.status === "DEVOLVIDA";

  return (
    <div className="max-w-[1080px]">
      {modoFila && (
        <BannerEscuro
          titulo="Respondendo em sequência"
          className="mb-cartao"
          acoes={
            <>
              {anterior ? (
                <ButtonLink href={`/solicitacoes/${anterior.id}?fila=1`} variant="onDark" size="sm" className="no-underline">
                  Anterior
                </ButtonLink>
              ) : (
                <span aria-disabled="true" className={buttonClasses({ variant: "bloqueado", size: "sm" })}>
                  Anterior
                </span>
              )}
              {proxima ? (
                <ButtonLink href={`/solicitacoes/${proxima.id}?fila=1`} variant="pink" size="sm" className="no-underline">
                  Próxima
                </ButtonLink>
              ) : (
                <span aria-disabled="true" className={buttonClasses({ variant: "bloqueado", size: "sm" })}>
                  Fila zerada
                </span>
              )}
              <Link href={`/solicitacoes/${s.id}`} className="text-pequeno text-on-dark-3 no-underline hover:text-white">
                Sair
              </Link>
            </>
          }
        >
          <span className="font-mono text-on-dark-2">{idx >= 0 ? `${idx + 1} de ${fila.length}` : `${fila.length} ${fila.length === 1 ? "restante" : "restantes"}`}</span> · ordenada por prazo · atalhos A, P e N no item selecionado
        </BannerEscuro>
      )}

      <PageHeader
        tamanho="sm"
        breadcrumbs={[{ label: "Solicitações", href: "/solicitacoes" }, { label: s.codigo }]}
        eyebrow={
          <>
            <span className="font-mono font-medium text-ink">{s.codigo}</span>
            <SolicitacaoStatusBadge status={s.status} naAta={naAta} />
            {s.foraDaJanela && <ForaJanelaTag />}
            {pi.vencido && <span className="font-medium text-danger">Atrasada {pi.sub}</span>}
          </>
        }
        title={s.titulo || "Solicitação sem título"}
        description={
          <>
            {s.tipo === "PRE_REUNIAO" ? "Necessidade pré-reunião" : "Alteração pós-ata"} ·{" "}
            <Link href={`/eventos/${s.eventoId}`} className="link">
              {s.evento.codigo} {s.evento.nome}
            </Link>{" "}
            · {s.area.nome} · {s.criadoPor.nome}
          </>
        }
        actions={
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
        }
      />

      {s.foraDaJanela && (s.status === "ENVIADA" || s.status === "EM_ANALISE") && (
        <Aviso tom="danger" titulo="Enviada fora da janela de alterações" className="mb-cartao">
          {ehLogistica
            ? "A janela definida para este evento já terminou. Decida item a item: atender, atender parcialmente ou não atender, com o motivo."
            : "A janela de alterações deste evento já terminou. A logística vai avaliar se ainda dá para atender."}
        </Aviso>
      )}
      {s.status === "DEVOLVIDA" && (
        <Aviso tom="warning" titulo="Devolvida pela logística" className="mb-cartao">
          {s.devolvidaMotivo ? `${/[.!?…]$/.test(s.devolvidaMotivo.trim()) ? s.devolvidaMotivo.trim() : `${s.devolvidaMotivo.trim()}.`} ` : ""}Corrija e reenvie.
        </Aviso>
      )}
      {s.status === "CANCELADA" && (
        <Aviso tom="danger" titulo="Solicitação cancelada" className="mb-cartao">
          {s.canceladaMotivo || "Sem motivo registrado."}
        </Aviso>
      )}
      {editavel && aceitaSolicitacao(s.evento.status, s.tipo) && (s.itens.length === 0 || !s.titulo?.trim()) && (
        <Aviso className="mb-cartao" titulo="Falta preencher antes de enviar">
          {s.itens.length === 0 ? "Adicione ao menos um item" : "Dê um título para a logística identificar a solicitação na fila"} em{" "}
          <Link href={`/solicitacoes/nova?rascunho=${s.id}`} className="link">
            Editar itens
          </Link>
          .
        </Aviso>
      )}
      {editavel && !aceitaSolicitacao(s.evento.status, s.tipo) && (
        <Aviso tom="warning" titulo="O evento não aceita este envio agora" className="mb-cartao">
          O rascunho continua salvo. {s.tipo === "PRE_REUNIAO" ? "Necessidades só entram com o evento em preparação." : "Alterações só entram com o evento aberto."}
        </Aviso>
      )}
      {ehLogistica && naAta && (
        <Aviso className="mb-cartao">
          Estes itens já estão na ata. A logística confere e ajusta na{" "}
          <Link href={`/conferencia/${s.eventoId}`} className="link">
            conferência da ata
          </Link>{" "}
          do evento.
        </Aviso>
      )}

      {logisticaVincula && opcoesVinculo && (
        <Section titulo={foraCatalogo.length === 1 ? "1 item fora do catálogo" : `${foraCatalogo.length} itens fora do catálogo`} className="mb-cartao border-warning-border">
          <div className="px-cartao py-3.5">
            <Aviso tom="warning">A área descreveu à mão. Vincule a uma peça ou projeto que já existe (talvez não tenha achado) ou cadastre a peça nova. Enquanto isso, o item não soma peças na OS.</Aviso>
          </div>
          <ul className="m-0 list-none p-0">
            {foraCatalogo.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-row px-cartao py-2.5">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-corpo text-ink">
                  “{i.descricaoLivre}” <ChipMono tom="control">× {i.quantidadeSolicitada}</ChipMono>
                  {i.destino ? <span className="text-pequeno text-muted">· {i.destino}</span> : null}
                </span>
                <VincularCatalogo linha={{ solicitacaoItemId: i.id, descricao: i.descricaoLivre ?? "", quantidade: i.quantidadeSolicitada }} opcoes={opcoesVinculo} podeCadastrar={pode(usuario, "catalogo.gerenciar")} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {!pode(usuario, "ata.consolidar") && enviada && foraCatalogo.length > 0 && (
        <Aviso className="mb-cartao">
          {foraCatalogo.length === 1 ? "Um item foi descrito à mão" : `${foraCatalogo.length} itens foram descritos à mão`}. A logística vai vincular ao catálogo ou cadastrar a peça, e você será avisado.
        </Aviso>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex flex-col gap-5">
          {s.observacao && (
            <Section titulo="Observação do solicitante">
              <p className="m-0 whitespace-pre-wrap px-cartao py-3.5 text-corpo leading-[1.55] text-ink-2">{s.observacao}</p>
            </Section>
          )}
          <RespostaProvider itens={itens} sufixoToast={sufixo}>
            <Section titulo={`Itens · ${s.itens.length}`} sub={respondivel ? "Cada item recebe resposta própria. Parcial e não atendido exigem motivo." : undefined} acoes={respondivel && pendentes > 0 ? <DicaAtalhos /> : undefined}>
              {itens.length === 0 ? <EmptyState compact title="Nenhum item adicionado" /> : itens.map((i) => <ItemResposta key={i.id} item={i} semStatus={semStatus} />)}
            </Section>
          </RespostaProvider>
          <Section titulo="Histórico" sub={`${historicoSolicitacao.length} ${historicoSolicitacao.length === 1 ? "registro" : "registros"} · quem pediu, quem respondeu, conferência, ajustes e vínculos`}>
            <LinhaDoTempo entradas={historicoSolicitacao} rotuloItem={rotuloItem} />
          </Section>
        </div>
        <div className="flex flex-col gap-5 lg:sticky lg:top-topo-fixo">
        <Section titulo="Dados">
          <ListaDados
            itens={[
              { label: "Solicitante", valor: s.criadoPor.nome },
              { label: "Área", valor: s.area.nome },
              { label: "Criada em", valor: diaMesHora(s.criadoEm) },
              { label: "Enviada em", valor: s.enviadaEm ? diaMesHora(s.enviadaEm) : "—" },
              ...(naAta
                ? [
                    { label: "Reunião de OS", valor: diaMesHora(s.evento.dataReuniao) },
                    { label: "Situação", valor: `na ata · a logística confirma na reunião de ${diaMesHora(s.evento.dataReuniao)}` },
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
        <Section
          titulo="Evento"
          sub={`${evento.codigo} · ${evento.nome}`}
          acoes={
            <Link href={`/eventos/${evento.id}`} className="link text-pequeno">
              Abrir
            </Link>
          }
        >
          <ListaDados
            itens={[
              { label: "Situação", valor: <EventoStatusBadge status={evento.status} /> },
              { label: "Cliente", valor: evento.cliente || "—" },
              { label: "Local", valor: evento.local || "—" },
              { label: "Data do evento", valor: periodoCurto(evento.dataInicio, evento.dataFim), forte: true },
              { label: "Reunião de OS", valor: diaMesHora(evento.dataReuniao) },
              { label: "Alterações até", valor: evento.janelaAlteracoesAte ? diaMesISO(evento.janelaAlteracoesAte) : "até encerrar" },
              { label: "Ata fechada", valor: evento.ataFechadaEm ? diaMesHora(evento.ataFechadaEm) : "ainda não" },
              ...(pode(usuario, "os.ver") ? [{ label: "OS atual", valor: versoesOs[0] ? `v${versoesOs[0].numero}` : "não gerada" }] : []),
              { label: "Responsável", valor: evento.responsavel.nome },
            ]}
          />
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line-faint px-cartao py-2.5 text-pequeno">
            <Link href={`/eventos/${evento.id}/ata`} className="link">
              Ata
            </Link>
            {pode(usuario, "os.ver") && (
              <Link href={`/eventos/${evento.id}/os`} className="link">
                Ordem de serviço
              </Link>
            )}
            <Link href={`/eventos/${evento.id}/solicitacoes`} className="link">
              Solicitações do evento
            </Link>
            <Link href={`/eventos/${evento.id}/historico`} className="link">
              Histórico do evento
            </Link>
          </div>
        </Section>
        </div>
      </div>
    </div>
  );
}
