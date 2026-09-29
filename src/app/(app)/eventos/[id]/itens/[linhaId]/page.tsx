import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { obterEventoCache } from "@/server/cache";
import { detalheLinha } from "@/server/services/linha-do-tempo";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";
import { NaoEncontradoError } from "@/domain/errors";
import { daMinhaArea, pode } from "@/domain/permissions";
import { obterConferencia } from "@/server/services/conferencia";
import { MesmoItemNoEvento, type LinhaMesmoItem } from "@/components/eventos/mesmo-item-no-evento";
import { aguardaReuniao, SOLICITACAO_TIPO_LABEL } from "@/domain/solicitacao";
import { diaMesHora } from "@/lib/format";
import { Aviso, ListaDados, Section } from "@/components/ui/layout";
import { ItemStatusBadge, Tag } from "@/components/ui/badge";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { Icone } from "@/components/ui/icons";
import { Codigo, Numero } from "@/components/ui/numero";
import { iconeHistorico, LinhaTempoAgrupada, type TomEntrada } from "@/components/eventos/linha-tempo-agrupada";
import type { TomLinhaTempo } from "@/server/services/linha-do-tempo";
import { PecasProjeto } from "@/components/eventos/pecas-projeto";
import { VincularCatalogo } from "@/components/eventos/vincular-catalogo";

const TIPO = { PROJETO: "projeto padrão", PECA: "peça do catálogo", AVULSO: "fora do catálogo" } as const;
const TOM: Record<TomLinhaTempo, TomEntrada> = { neutro: "neutro", info: "info", ok: "success", atencao: "warning", perigo: "danger" };

/** `generateMetadata` e a página pedem o mesmo item: a leitura acontece uma vez por requisição. */
const detalheLinhaCache = cache(detalheLinha);

export async function generateMetadata({ params }: { params: Promise<{ id: string; linhaId: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id, linhaId } = await params;
  const d = await detalheLinhaCache(usuario, id, linhaId).catch(() => null);
  return { title: d?.nome ?? "Item" };
}

/**
 * Detalhe de um item da ata/OS: o que é, quem pediu, a resposta, as peças (editáveis uma a uma
 * quando é projeto) e tudo o que aconteceu com ele, do rascunho até a OS.
 */
export default async function ItemEventoPage({ params }: { params: Promise<{ id: string; linhaId: string }> }) {
  const usuario = await requireUsuario();
  const { id, linhaId } = await params;
  const [ev, d, todasAsLinhas] = await Promise.all([
    obterEventoCache(usuario, id),
    detalheLinhaCache(usuario, id, linhaId).catch((e) => {
      if (e instanceof NaoEncontradoError) notFound();
      throw e;
    }),
    obterConferencia(id),
  ]);
  // Todas as linhas do mesmo projeto/peça no evento (ex.: todas as tendas pedidas), com o que cada área
  // escreveu. Dados do pedido de outra área (quem, código, descrição) só para quem vê todas as áreas.
  const veTodas = pode(usuario, "solicitacao.ver_todas");
  const mesmoItem: LinhaMesmoItem[] = todasAsLinhas
    .filter((l) => l.tipo === d.tipo && (d.tipo === "AVULSO" ? l.nome === d.nome : l.codigo === d.codigo))
    .map((l) => {
      const ve = veTodas || !l.origem || daMinhaArea(usuario, l.areaId);
      return {
        id: l.id,
        quantidade: l.quantidade,
        destino: l.destino,
        area: l.areaNome,
        solicitante: ve ? (l.origem?.solicitante ?? (l.incluidaPor ? `incluída por ${l.incluidaPor}` : null)) : null,
        codigo: ve ? (l.origem?.codigo ?? null) : null,
        descricao: ve ? (l.origem?.descricao ?? null) : null,
        observacao: ve ? (l.origem?.observacao ?? null) : null,
        conferidoEm: l.conferidoEm,
        conferidoPor: l.conferidoPor,
      };
    });
  const totalMesmoItem = mesmoItem.reduce((a, l) => a + l.quantidade, 0);
  const antesDaAta = ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO";
  const editavel = pode(usuario, "ata.consolidar") && (antesDaAta || (ev.status === "ABERTO" && pode(usuario, "ata.ajustar")));
  const opcoes = editavel ? await opcoesReferenciasResumidas() : null;
  const voltar = antesDaAta && pode(usuario, "ata.consolidar") ? { href: `/conferencia/${id}`, rotulo: "Conferência da ata" } : pode(usuario, "os.ver") && !antesDaAta ? { href: `/eventos/${id}/os?visao=composicao`, rotulo: "Itens da OS" } : { href: `/eventos/${id}/ata`, rotulo: "Ata" };
  const naAta = d.origem ? aguardaReuniao(d.origem.tipo, ev.status) : false;

  return (
    <div className="flex flex-col gap-4">
      {/* O layout do evento já tem o h1, as fases e as abas: aqui o item abre como seção (h2). */}
      <section aria-labelledby="titulo-item" className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
        <div className="flex min-w-0 items-start gap-3">
          {d.capaId && <ImagemZoom src={`/api/anexos/${d.capaId}`} alt={d.nome} className="h-14 w-[76px] shrink-0 overflow-hidden rounded-controle border border-line" />}
          <div className="min-w-0">
            <p className="m-0 mb-1 flex flex-wrap items-center gap-2 text-pequeno text-muted">
              <Link href={voltar.href} className="link inline-flex items-center gap-1 text-pequeno">
                <Icone nome="seta-esquerda" className="size-3.5" />
                {voltar.rotulo}
              </Link>
              <Tag tom={d.tipo === "AVULSO" ? "warning" : "muted"}>{TIPO[d.tipo]}</Tag>
              {d.posAta && <Tag tom="info">entrou depois da ata</Tag>}
              {d.conferidoEm && <Tag tom="success">conferido</Tag>}
            </p>
            <h2 id="titulo-item" className="m-0 text-titulo font-semibold tracking-[-0.01em]">
              {d.nome}
            </h2>
            <p className="mb-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-pequeno text-ink-3">
              {d.codigo && (
                <Codigo>
                  {d.codigo}
                  {d.versao ? ` · v${d.versao}` : ""}
                </Codigo>
              )}
              {[d.destino ? `Destino: ${d.destino}` : null, d.area ?? "Logística", d.origemLabel]
                .filter(Boolean)
                .map((m, i) => (
                  <span key={String(m)}>
                    {(i > 0 || d.codigo) && <span aria-hidden className="mr-2 text-meta">·</span>}
                    {m}
                  </span>
                ))}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <div className="text-right">
            <span className="numero block text-metrica font-semibold tracking-[-0.02em] text-ink">{d.quantidade}</span>
            <span className="text-rotulo text-muted">{d.origem && d.origem.quantidadeSolicitada !== d.quantidade ? `pedido ${d.origem.quantidadeSolicitada}` : "na ata/OS"}</span>
          </div>
          {d.tipo === "AVULSO" && editavel && opcoes && (
            <VincularCatalogo linha={{ linhaId: d.id, descricao: d.descricaoOriginal ?? d.nome, quantidade: d.quantidade }} opcoes={opcoes} podeCadastrar={pode(usuario, "catalogo.gerenciar")} />
          )}
        </div>
      </section>

      {d.restrito && <Aviso>Este item é de outra área: você vê o que está na ata e os ajustes, sem as observações internas da solicitação.</Aviso>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {mesmoItem.length > 0 && (
            <Section
              titulo={`${d.nome} no evento`}
              sub={
                <>
                  <Numero valor={totalMesmoItem} /> no total em {mesmoItem.length} {mesmoItem.length === 1 ? "linha" : "linhas"}
                  {pode(usuario, "ata.consolidar") && antesDaAta ? " · confira cada uma aqui ou na conferência" : ""}
                </>
              }
            >
              <MesmoItemNoEvento eventoId={id} atualId={d.id} linhas={mesmoItem} podeConferir={pode(usuario, "ata.consolidar") && antesDaAta} />
            </Section>
          )}
          {d.tipo === "PROJETO" && (
            <Section titulo="Peças deste projeto" sub={editavel ? "Ajuste peça a peça quando a reunião decidir (só neste evento). Cada ajuste pede motivo." : "Lista de peças que este projeto leva no evento."}>
              <PecasProjeto eventoId={id} linhaId={d.id} quantidadeProjeto={d.quantidade} pecas={d.pecasDoProjeto} editavel={editavel} opcoesPecas={opcoes?.pecas ?? []} depoisDaAta={!antesDaAta} />
            </Section>
          )}
          <Section titulo="Linha do tempo" sub={`${d.linhaDoTempo.length} ${d.linhaDoTempo.length === 1 ? "registro" : "registros"} · do pedido até a OS`}>
            <LinhaTempoAgrupada
              vazio={<p className="m-0 px-cartao py-6 text-center text-pequeno text-muted">Sem registros para este item.</p>}
              entradas={d.linhaDoTempo.map((e) => ({ id: e.id, em: e.em, titulo: e.titulo, detalhe: e.descricao || null, autor: e.por ? `${e.por.nome}${e.por.perfil ? ` · ${e.por.perfil}` : ""}` : null, icone: iconeHistorico(null, e.acao).icone, tom: TOM[e.tom] }))}
            />
          </Section>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-topo-fixo">
          <Section
            titulo="Quem pediu"
            acoes={
              d.origem && !d.restrito ? (
                <Link href={`/solicitacoes/${d.origem.solicitacaoId}`} className="link text-pequeno">
                  Abrir {d.origem.codigo}
                </Link>
              ) : undefined
            }
          >
            {d.origem ? (
              <>
                <ListaDados
                  itens={[
                    { label: "Solicitante", valor: d.origem.solicitante, forte: true },
                    { label: "Área", valor: d.origem.area },
                    { label: "Solicitação", valor: `${d.origem.codigo} · ${SOLICITACAO_TIPO_LABEL[d.origem.tipo].toLowerCase()}` },
                    { label: "Criada", valor: diaMesHora(d.origem.criadoEm) },
                    { label: "Enviada", valor: d.origem.enviadaEm ? diaMesHora(d.origem.enviadaEm) : "—" },
                    { label: "Pedido", valor: String(d.origem.quantidadeSolicitada), forte: true },
                  ]}
                />
                {(d.origem.titulo || d.origem.observacaoSolicitante || d.origem.observacaoSolicitacao || d.origem.ajustes) && (
                  <div className="border-t border-line-faint px-cartao py-3 text-pequeno text-ink-2">
                    {d.origem.titulo && <p className="m-0 font-medium text-ink">{d.origem.titulo}</p>}
                    {d.origem.observacaoSolicitante && <p className="mb-0 mt-1 italic">“{d.origem.observacaoSolicitante}”</p>}
                    {d.origem.observacaoSolicitacao && <p className="mb-0 mt-1 text-ink-3">{d.origem.observacaoSolicitacao}</p>}
                    {d.origem.ajustes && <p className="mb-0 mt-1 text-ink-3">Peças ajustadas no pedido: {d.origem.ajustes}</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="m-0 px-cartao py-3.5 text-pequeno text-muted">Incluído direto pela logística ({d.origemLabel.toLowerCase()}), sem solicitação de área.</p>
            )}
          </Section>

          {d.origem && (
            <Section titulo="Resposta da logística">
              <div className="flex items-center justify-between gap-3 px-cartao pt-3">
                <ItemStatusBadge status={d.origem.status} naAta={naAta} />
                <span className="numero text-corpo text-ink-2">
                  {d.origem.quantidadeAtendida ?? 0} de {d.origem.quantidadeSolicitada}
                </span>
              </div>
              <ListaDados
                itens={[
                  { label: "Respondido por", valor: naAta ? "entrou na ata sem avaliação" : (d.origem.respondidoPor ?? "—") },
                  { label: "Quando", valor: d.origem.respondidoEm ? diaMesHora(d.origem.respondidoEm) : "—" },
                  { label: "Conferido", valor: d.conferidoEm ? `${d.conferidoPor ?? ""} · ${diaMesHora(d.conferidoEm)}` : "ainda não" },
                ]}
              />
              {d.origem.respostaLogistica && <p className="m-0 border-t border-line-faint px-cartao py-3 text-pequeno text-ink-2">{d.origem.respostaLogistica}</p>}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
