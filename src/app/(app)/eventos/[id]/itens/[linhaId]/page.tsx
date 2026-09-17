import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { obterEventoCache } from "@/server/cache";
import { detalheLinha } from "@/server/services/linha-do-tempo";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";
import { NaoEncontradoError } from "@/domain/errors";
import { pode } from "@/domain/permissions";
import { aguardaReuniao, SOLICITACAO_TIPO_LABEL } from "@/domain/solicitacao";
import { diaMesHora } from "@/lib/format";
import { Aviso, ListaDados, Section } from "@/components/ui/layout";
import { ItemStatusBadge, Tag } from "@/components/ui/badge";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { LinhaDoTempo } from "@/components/ui/linha-do-tempo";
import { PecasProjeto } from "@/components/eventos/pecas-projeto";
import { VincularCatalogo } from "@/components/eventos/vincular-catalogo";

const TIPO = { PROJETO: "projeto padrão", PECA: "peça do catálogo", AVULSO: "fora do catálogo" } as const;

/**
 * Detalhe de um item da ata/OS: o que é, quem pediu, a resposta, as peças (editáveis uma a uma
 * quando é projeto) e tudo o que aconteceu com ele, do rascunho até a OS.
 */
export default async function ItemEventoPage({ params }: { params: Promise<{ id: string; linhaId: string }> }) {
  const usuario = await requireUsuario();
  const { id, linhaId } = await params;
  const [ev, d] = await Promise.all([
    obterEventoCache(usuario, id),
    detalheLinha(usuario, id, linhaId).catch((e) => {
      if (e instanceof NaoEncontradoError) notFound();
      throw e;
    }),
  ]);
  const antesDaAta = ev.status === "PREPARACAO" || ev.status === "EM_REUNIAO";
  const editavel = pode(usuario, "ata.consolidar") && (antesDaAta || (ev.status === "ABERTO" && pode(usuario, "ata.ajustar")));
  const opcoes = editavel ? await opcoesReferenciasResumidas() : null;
  const voltar = antesDaAta && pode(usuario, "ata.consolidar") ? { href: `/eventos/${id}/reuniao`, rotulo: "Conferência da ata" } : pode(usuario, "os.ver") && !antesDaAta ? { href: `/eventos/${id}/os?visao=composicao`, rotulo: "Itens da OS" } : { href: `/eventos/${id}/ata`, rotulo: "Ata" };
  const naAta = d.origem ? aguardaReuniao(d.origem.tipo, ev.status) : false;

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-[12.5px] text-muted">
        <Link href={voltar.href} className="link">
          ← {voltar.rotulo}
        </Link>
      </nav>

      <section className="flex flex-wrap items-center gap-4 rounded-[10px] border border-line bg-surface px-[18px] py-3.5">
        {d.capaId && <ImagemZoom src={`/api/anexos/${d.capaId}`} alt={d.nome} className="h-14 w-[76px] shrink-0 overflow-hidden rounded-[7px] border border-line" />}
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-semibold text-ink">{d.nome}</span>
            <Tag tom={d.tipo === "AVULSO" ? "warning" : "muted"}>{TIPO[d.tipo]}</Tag>
            {d.posAta && <Tag tom="accent">entrou depois da ata</Tag>}
            {d.conferidoEm && <Tag tom="success">conferido</Tag>}
          </p>
          <p className="mb-0 mt-1 text-[12.5px] text-ink-3">
            {[d.codigo ? `${d.codigo}${d.versao ? ` · v${d.versao}` : ""}` : null, d.destino ? `Destino: ${d.destino}` : null, d.area ?? "Logística", d.origemLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <span className="block font-mono text-[26px] font-medium leading-none tracking-[-0.02em] text-ink">{d.quantidade}</span>
          <span className="text-[11.5px] text-muted">{d.origem && d.origem.quantidadeSolicitada !== d.quantidade ? `pedido ${d.origem.quantidadeSolicitada}` : "na ata/OS"}</span>
        </div>
        {d.tipo === "AVULSO" && editavel && opcoes && (
          <VincularCatalogo linha={{ linhaId: d.id, descricao: d.descricaoOriginal ?? d.nome, quantidade: d.quantidade }} opcoes={opcoes} podeCadastrar={pode(usuario, "catalogo.gerenciar")} />
        )}
      </section>

      {d.restrito && <Aviso>Este item é de outra área: você vê o que está na ata e os ajustes, sem as observações internas da solicitação.</Aviso>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {d.tipo === "PROJETO" && (
            <Section titulo="Peças deste projeto" sub={editavel ? "Ajuste peça a peça quando a reunião decidir (só neste evento). Cada ajuste pede motivo." : "Lista de peças que este projeto leva no evento."}>
              <PecasProjeto eventoId={id} linhaId={d.id} quantidadeProjeto={d.quantidade} pecas={d.pecasDoProjeto} editavel={editavel} opcoesPecas={opcoes?.pecas ?? []} depoisDaAta={!antesDaAta} />
            </Section>
          )}
          <Section titulo="Linha do tempo" sub={`${d.linhaDoTempo.length} ${d.linhaDoTempo.length === 1 ? "registro" : "registros"} · do pedido até a OS`}>
            <LinhaDoTempo entradas={d.linhaDoTempo} vazio="Sem registros para este item." />
          </Section>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-[76px]">
          <Section
            titulo="Quem pediu"
            acoes={
              d.origem ? (
                <Link href={`/solicitacoes/${d.origem.solicitacaoId}`} className="link text-[12.5px]">
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
                  <div className="border-t border-line-faint px-[18px] py-3 text-[12.5px] leading-[1.5] text-ink-2">
                    {d.origem.titulo && <p className="m-0 font-medium text-ink">{d.origem.titulo}</p>}
                    {d.origem.observacaoSolicitante && <p className="mb-0 mt-1 italic">“{d.origem.observacaoSolicitante}”</p>}
                    {d.origem.observacaoSolicitacao && <p className="mb-0 mt-1 text-ink-3">{d.origem.observacaoSolicitacao}</p>}
                    {d.origem.ajustes && <p className="mb-0 mt-1 text-ink-3">Peças ajustadas no pedido: {d.origem.ajustes}</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="m-0 px-[18px] py-3.5 text-[12.5px] text-muted">Incluído direto pela logística ({d.origemLabel.toLowerCase()}), sem solicitação de área.</p>
            )}
          </Section>

          {d.origem && (
            <Section titulo="Resposta da logística">
              <div className="flex items-center justify-between gap-3 px-[18px] pt-3">
                <ItemStatusBadge status={d.origem.status} naAta={naAta} />
                <span className="font-mono text-[13px] text-ink-2">
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
              {d.origem.respostaLogistica && <p className="m-0 border-t border-line-faint px-[18px] py-3 text-[12.5px] leading-[1.5] text-ink-2">{d.origem.respostaLogistica}</p>}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
