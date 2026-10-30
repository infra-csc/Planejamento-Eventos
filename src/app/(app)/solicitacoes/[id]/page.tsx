import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { descricaoItem, listarFila, padraoTendaPorVersao } from "@/server/services/solicitacoes";
import { obterSolicitacaoCache } from "@/server/cache";
import { resumirAjustes } from "@/domain/os";
import { agruparItensPedido, agruparLocaisTenda } from "@/domain/agrupamento-pedido";
import { DomainError, NaoEncontradoError } from "@/domain/errors";
import { pode, podeEditarSolicitacao } from "@/domain/permissions";
import { aceitaSolicitacao } from "@/domain/evento";
import { podeCancelar, podeCorrigirResposta, podeDevolver, podeEditarEnviada, podeEnviar, podeResponder, podeResponderNaFase, aguardaReuniao, STATUS_ABERTOS, STATUS_EDITAVEIS } from "@/domain/solicitacao";
import { prazoInfo, COR_TOM } from "@/lib/prazo";
import { diaMesHora } from "@/lib/format";
import { Aviso, BannerEscuro, EmptyState, Meta, PageHeader, Section } from "@/components/ui/layout";
import { ChipMono, ForaJanelaTag, SolicitacaoStatusBadge, Tag } from "@/components/ui/badge";
import { Codigo } from "@/components/ui/numero";
import { ButtonLink } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-classes";
import { DicaAtalhos, GrupoItens, ItemResposta, RespostaProvider, type ItemParaResposta } from "@/components/solicitacoes/item-resposta";
import { AcoesSolicitacao } from "@/components/solicitacoes/acoes-solicitacao";
import { VincularCatalogo } from "@/components/eventos/vincular-catalogo";
import { LinhaDoTempo } from "@/components/ui/linha-do-tempo";
import { linhaDoTempoSolicitacao } from "@/server/services/linha-do-tempo";
import { obterEventoCache } from "@/server/cache";
import { diaMesISO, hojeISO, periodoCurto } from "@/lib/format";
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
  const aberta = STATUS_ABERTOS.includes(s.status);
  // Tenda: o pedido guarda fechamentos e calhas como ajuste POR TENDA sobre a lista padrão da versão (a 5×5 v3
  // já traz 1 calha). A tela mostra o resultado — "Depósito · 1 tenda · 4 fechamentos · sem calha" — e não
  // "Peças ajustadas: +4 Fechamento lateral · −1 Calha de lona", que ninguém entendia.
  // Tenda pelas peças da versão (kitDaTenda), como na conferência e no quadro: "Kit tenda 5×5" também é tenda.
  const padraoTendas = await padraoTendaPorVersao([...new Set(s.itens.map((i) => i.projetoVersaoId).filter((v): v is string => Boolean(v)))]);
  const ehTendaItem = (i: (typeof s.itens)[number]) => Boolean(padraoTendas.get(i.projetoVersaoId ?? "")?.ehTenda);
  const porTenda = (i: (typeof s.itens)[number], sufixo: "-FECH" | "-CALHA") => {
    const padrao = padraoTendas.get(i.projetoVersaoId ?? "");
    const base = sufixo === "-FECH" ? (padrao?.fechamentos ?? 0) : (padrao?.calhas ?? 0);
    return Math.max(0, base + (i.ajustesBom ?? []).filter((a) => a.codigo.endsWith(sufixo)).reduce((t, a) => t + a.quantidade, 0));
  };
  const temCalha = (i: (typeof s.itens)[number]) => Boolean(padraoTendas.get(i.projetoVersaoId ?? "")?.temCalha || (i.ajustesBom ?? []).some((a) => a.codigo.endsWith("-CALHA")));
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const ajustesTenda = (i: (typeof s.itens)[number]) => {
    const outros = (i.ajustesBom ?? []).filter((a) => !a.codigo.endsWith("-FECH") && !a.codigo.endsWith("-CALHA"));
    const f = porTenda(i, "-FECH");
    const c = porTenda(i, "-CALHA");
    const partes = [`Por tenda: ${f ? plural(f, "fechamento", "fechamentos") : "sem fechamento"}${temCalha(i) ? ` · ${c ? plural(c, "calha", "calhas") : "sem calha"}` : ""}`, outros.length ? `outras peças: ${resumirAjustes(outros)}` : null].filter(Boolean);
    return partes.join(" · ");
  };
  const itens: ItemParaResposta[] = s.itens.map((i) => {
    const tenda = ehTendaItem(i);
    return {
    id: i.id,
    descricao: descricaoItem(i),
    tenda,
    pecasTenda: tenda ? { fechamentos: porTenda(i, "-FECH") * i.quantidadeSolicitada, calhas: porTenda(i, "-CALHA") * i.quantidadeSolicitada, temCalha: temCalha(i) } : undefined,
    operacao: i.operacao,
    quantidadeSolicitada: i.quantidadeSolicitada,
    quantidadeAtual: i.quantidadeAnterior ?? i.eventoItem?.quantidade ?? null,
    destino: i.destino,
    justificativa: i.justificativa?.trim() || null,
    descricoes: i.descricoes ?? null,
    ajustes: tenda ? ajustesTenda(i) : resumirAjustes(i.ajustesBom),
    status: i.status,
    quantidadeAtendida: i.quantidadeAtendida,
    observacaoLogistica: i.observacaoLogistica,
    pendenciaCompra: i.pendenciaCompra,
    respondivel,
    // Tenda na ata se ajusta na conferência (tendas, fechamentos e calhas por local), não por "parte" aqui.
    corrigivel: corrigivel && i.status !== "EM_ANALISE" && !(naAta && tenda),
    aguardandoReuniao: naAta,
  };
  });
  // O mesmo item pedido para vários locais vira um grupo (nome + total, uma linha por local), na ordem em
  // que aparece; a navegação por teclado segue a mesma ordem da tela.
  const gruposItens = agruparItensPedido(itens, (_item, n) => {
    const si = s.itens[n];
    return [si.operacao, si.projetoId ?? "", si.pecaId ?? "", si.eventoItemId ?? "", si.descricaoLivre ?? ""].join("|");
  });
  // "Na ata" conta como o título "Itens": a tenda em 4 locais é 1 item (antes, "Itens 20" e "Na ata 25 de 25").
  const gruposNaAta = gruposItens.filter((g) => g.every((i) => i.status === "ATENDIDO" || i.status === "PARCIAL")).length;
  const gruposRespondidos = gruposItens.filter((g) => g.every((i) => i.status !== "EM_ANALISE")).length;
  // Os atalhos acompanham a ordem visível: tipo de tenda → local → configuração original.
  const itensNaOrdem = gruposItens.flatMap((g) => g[0].tenda ? agruparLocaisTenda(g).flatMap((local) => local.itens) : g);
  // "Outro item (descrever)": fora do catálogo até a logística cadastrar ou vincular.
  const foraCatalogo = s.itens.filter((i) => i.operacao === "ADICIONAR" && !i.projetoId && !i.pecaId && i.descricaoLivre);
  const enviada = s.status !== "RASCUNHO" && s.status !== "DEVOLVIDA" && s.status !== "CANCELADA";
  const eventoAtivo = s.evento.status !== "ENCERRADO" && s.evento.status !== "CANCELADO";
  const logisticaVincula = pode(usuario, "ata.consolidar") && enviada && eventoAtivo && foraCatalogo.length > 0;
  const [opcoesVinculo, historicoSolicitacao, evento, fila] = await Promise.all([
    logisticaVincula ? opcoesReferenciasResumidas() : Promise.resolve(null),
    linhaDoTempoSolicitacao(usuario, s.id),
    obterEventoCache(usuario, s.eventoId),
    modoFila ? listarFila(usuario) : Promise.resolve([]),
  ]);
  // Item descrito à mão: "Vincular" no próprio item (antes, um quadro à parte acima da lista repetia o item).
  const extrasItens: Record<string, React.ReactNode> = {};
  if (logisticaVincula && opcoesVinculo) {
    for (const i of foraCatalogo) {
      extrasItens[i.id] = (
        <span className="inline-flex items-center gap-2">
          <span title="A área descreveu à mão. Enquanto não for vinculado a uma peça ou projeto, o item não soma peças na OS.">
            <Tag tom="warning">fora do catálogo</Tag>
          </span>
          <VincularCatalogo compacto linha={{ solicitacaoItemId: i.id, descricao: i.descricaoLivre ?? "", quantidade: i.quantidadeSolicitada }} opcoes={opcoesVinculo} podeCadastrar={pode(usuario, "catalogo.gerenciar")} />
        </span>
      );
    }
  }
  const idx = fila.findIndex((f) => f.id === s.id);
  const proxima = idx >= 0 ? fila[idx + 1] : fila.find((f) => f.id !== s.id);
  const anterior = idx > 0 ? fila[idx - 1] : null;
  const proximaHref = modoFila && proxima ? `/solicitacoes/${proxima.id}?fila=1` : null;
  const rotuloItem = (itemId: string) => {
    const i = s.itens.find((x) => x.id === itemId);
    return i ? descricaoItem(i) : null;
  };
  // Rascunho e devolvida ainda não estão na fila: o status do item não faz sentido antes do envio.
  const semStatus = STATUS_EDITAVEIS.includes(s.status);
  // Alteração dentro da janela: entrou direto na OS, sem avaliação (nenhum item tem quem respondeu).
  const entrouDireto = s.tipo === "ALTERACAO" && s.status === "RESPONDIDA" && s.itens.length > 0 && s.itens.every((i) => i.status === "ATENDIDO" && !i.respondidoPorId);
  const editavelNaJanela = dono && entrouDireto && podeEditarEnviada(s, s.evento, hojeISO());

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
          <span className="numero font-medium text-on-dark-2">{idx >= 0 ? `${idx + 1} de ${fila.length}` : `${fila.length} ${fila.length === 1 ? "restante" : "restantes"}`}</span> · ordenada por prazo
        </BannerEscuro>
      )}

      <PageHeader
        tamanho="sm"
        breadcrumbs={[{ label: "Solicitações", href: "/solicitacoes" }, { label: s.codigo }]}
        eyebrow={
          <>
            <Codigo className="font-medium text-ink">{s.codigo}</Codigo>
            <SolicitacaoStatusBadge status={s.status} naAta={naAta} naOs={entrouDireto} />
            {s.foraDaJanela && <ForaJanelaTag />}
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
        meta={
          <>
            {/* Prazo sempre à vista no topo: é o que a logística olha primeiro. */}
            {naAta ? (
              <Meta rotulo="Reunião de OS" valor={diaMesHora(s.evento.dataReuniao)} />
            ) : aberta && s.prazoRespostaEm ? (
              <Meta
                rotulo="Prazo de resposta"
                valor={
                  <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: COR_TOM[pi.tom] }}>
                    {pi.vencido && <span aria-hidden className="block size-1.5 animate-pulse-dot rounded-full" style={{ background: COR_TOM[pi.tom] }} />}
                    {pi.vencido ? `vencido ${pi.sub}` : `${pi.label} · ${pi.sub}`}
                  </span>
                }
              />
            ) : null}
            {/* O que o quadro "Dados" ao lado repetia (enviada, respondidos) e o que importava do quadro "Evento" (a data). */}
            {s.enviadaEm && <Meta rotulo="Enviada em" valor={diaMesHora(s.enviadaEm)} />}
            {!naAta && !(aberta && s.prazoRespostaEm) && s.respondidaEm && <Meta rotulo="Respondida em" valor={diaMesHora(s.respondidaEm)} />}
            {s.itens.length > 0 && !semStatus && <Meta rotulo={naAta ? "Na ata" : "Respondidos"} valor={naAta ? `${gruposNaAta} de ${gruposItens.length}` : `${gruposRespondidos} de ${gruposItens.length}`} />}
            <Meta rotulo="Evento" valor={periodoCurto(evento.dataInicio, evento.dataFim)} />
            {s.tipo === "ALTERACAO" && evento.janelaAlteracoesAte && <Meta rotulo="Alterações até" valor={diaMesISO(evento.janelaAlteracoesAte)} />}
          </>
        }
        actions={
          <AcoesSolicitacao
            eventoStatus={s.evento.status}
            id={s.id}
            codigo={s.codigo}
            podeDevolver={ehLogistica && faseOk && podeDevolver(s.status, algumRespondido)}
            podeAtenderTudo={respondivel && pendentes > 0}
            pendentes={pendentes}
            podeEditar={(editavel && s.evento.status !== "CANCELADO" && s.evento.status !== "ENCERRADO") || (dono && podeEditarEnviada(s, s.evento, hojeISO()))}
            podeEnviar={editavel && s.itens.length > 0 && Boolean(s.titulo?.trim()) && aceitaSolicitacao(s.evento.status, s.tipo)}
            podeCancelar={dono && podeCancelar(s.status, algumRespondido) && s.status !== "RASCUNHO"}
            podeExcluir={dono && s.status === "RASCUNHO"}
            proximaHref={proximaHref}
            sufixo={sufixo}
          />
        }
      />

      {s.foraDaJanela && STATUS_ABERTOS.includes(s.status) && (
        <Aviso tom="danger" titulo="Enviada fora da janela de alterações" className="mb-cartao">
          {ehLogistica
            ? "A janela definida para este evento já terminou. Decida item a item: atender, atender parcialmente ou não atender, com o motivo."
            : "A janela de alterações deste evento já terminou. A logística vai avaliar se ainda dá para atender."}
        </Aviso>
      )}
      {entrouDireto && (
        <Aviso tom="info" titulo="Entrou direto na OS" className="mb-cartao">
          {ehLogistica
            ? "Alteração enviada dentro da janela: entrou na OS sem avaliação e a logística foi avisada. Se precisar, corrija item a item."
            : editavelNaJanela
              ? `Enviada dentro da janela, então não precisou de aprovação: já está na OS e a logística foi avisada. Você pode incluir, tirar ou mudar itens enquanto a janela estiver aberta${s.evento.janelaAlteracoesAte ? ` (até ${diaMesISO(s.evento.janelaAlteracoesAte)})` : ""}.`
              : "Enviada dentro da janela, então não precisou de aprovação: já está na OS e a logística foi avisada."}
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

      {!pode(usuario, "ata.consolidar") && enviada && foraCatalogo.length > 0 && (
        <Aviso className="mb-cartao">
          {foraCatalogo.length === 1 ? "Um item foi descrito à mão" : `${foraCatalogo.length} itens foram descritos à mão`}. A logística vai vincular ao catálogo ou cadastrar a peça, e você será avisado.
        </Aviso>
      )}

      {/* Uma coluna só: os quadros "Dados" e "Evento" que ficavam ao lado repetiam o cabeçalho (solicitante, área,
          datas, respondidos) e a página do evento (cliente, local, responsável, OS, links das abas). */}
      <div className="flex flex-col gap-5">
          <RespostaProvider itens={itensNaOrdem} sufixoToast={sufixo} extras={extrasItens}>
            <Section
              titulo={
                <span className="inline-flex items-center gap-2">
                  Itens <ChipMono tom="control">{gruposItens.length}</ChipMono>
                </span>
              }
              acoes={
                respondivel && pendentes > 0 ? (
                  <DicaAtalhos />
                ) : naAta && ehLogistica && itens.some((i) => i.tenda) ? (
                  <Link href={`/conferencia/${s.evento.id}`} className="link text-pequeno">
                    Ajustar tendas na conferência
                  </Link>
                ) : undefined
              }
            >
              {/* A observação geral abre a lista de itens (antes, um cartão inteiro para uma frase). */}
              {s.observacao && (
                <p className="m-0 whitespace-pre-wrap border-b border-line-row px-cartao py-3 text-corpo text-ink-2">
                  <span className="text-muted">Observação de {s.criadoPor.nome.split(" ")[0]}: </span>
                  {s.observacao}
                </p>
              )}
              {itens.length === 0 ? <EmptyState compact title="Nenhum item adicionado" /> : gruposItens.map((g) => (g.length === 1 && !g[0].tenda ? <ItemResposta key={g[0].id} item={g[0]} semStatus={semStatus} /> : <GrupoItens key={g[0].id} itens={g} semStatus={semStatus} />))}
            </Section>
          </RespostaProvider>
          <Section
            titulo={
              <span className="inline-flex items-center gap-2">
                Histórico <ChipMono tom="control">{historicoSolicitacao.length}</ChipMono>
              </span>
            }
          >
            <LinhaDoTempo entradas={historicoSolicitacao} rotuloItem={rotuloItem} />
          </Section>
      </div>
    </div>
  );
}
