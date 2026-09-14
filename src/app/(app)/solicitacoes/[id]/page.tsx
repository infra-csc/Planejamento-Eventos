import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual, requireUsuario } from "@/server/auth/session";
import { descricaoItem, obterSolicitacao } from "@/server/services/solicitacoes";
import { obterLinhasAta, opcoesReferencias } from "@/server/services/eventos";
import { DomainError, NaoEncontradoError } from "@/domain/errors";
import { pode, podeEditarSolicitacao } from "@/domain/permissions";
import { aceitaSolicitacao, EVENTO_STATUS_LABEL } from "@/domain/evento";
import { estaAtrasada, podeCancelar, podeCorrigirResposta, podeDevolver, podeEnviar, podeResponder, SOLICITACAO_TIPO_LABEL } from "@/domain/solicitacao";
import { KeyValue, Notice, PageHeader, Panel } from "@/components/ui/layout";
import { SolicitacaoStatusBadge } from "@/components/ui/badge";
import { SolicitacaoEditor } from "@/components/solicitacoes/solicitacao-editor";
import { SolicitacaoDetalhe } from "@/components/solicitacoes/solicitacao-detalhe";
import { formatarDataHora, tempoRelativo } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return {};
  const { id } = await params;
  const s = await obterSolicitacao(usuario, id).catch(() => null);
  return { title: s ? `${s.codigo} · ${s.evento.nome}` : "Solicitação" };
}

export default async function SolicitacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUsuario();
  const { id } = await params;
  const s = await obterSolicitacao(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    if (e instanceof DomainError && e.code === "SEM_PERMISSAO") redirect("/sem-permissao");
    throw e;
  });

  const editavel = podeEnviar(s.status) && podeEditarSolicitacao(usuario, s);
  const agora = new Date();
  const atrasada = estaAtrasada(s.status, s.prazoRespostaEm, agora);
  const algumRespondido = s.itens.some((i) => i.status !== "EM_ANALISE");
  const itensView = s.itens.map((i) => ({
    id: i.id,
    descricao: descricaoItem(i),
    operacao: i.operacao,
    referenciaTipo: (i.projetoId ? "PROJETO" : i.pecaId ? "PECA" : "AVULSO") as "PROJETO" | "PECA" | "AVULSO",
    projetoId: i.projetoId,
    pecaId: i.pecaId,
    descricaoLivre: i.descricaoLivre,
    eventoItemId: i.eventoItemId,
    quantidadeSolicitada: i.quantidadeSolicitada,
    quantidadeAtual: i.eventoItem?.quantidade ?? null,
    destino: i.destino,
    justificativa: i.justificativa,
    status: i.status,
    quantidadeAtendida: i.quantidadeAtendida,
    observacaoLogistica: i.observacaoLogistica,
    pendenciaCompra: i.pendenciaCompra,
    respondidoPor: i.respondidoPor?.nome ?? null,
    respondidoEm: i.respondidoEm,
  }));

  const header = (
    <PageHeader
      breadcrumbs={[{ label: "Solicitações", href: "/solicitacoes" }, { label: s.codigo }]}
      title={
        <>
          {s.codigo}
          <SolicitacaoStatusBadge status={s.status} atrasada={atrasada} />
        </>
      }
      description={
        <>
          {SOLICITACAO_TIPO_LABEL[s.tipo]} · evento{" "}
          <Link href={`/eventos/${s.eventoId}`} className="text-info hover:underline">
            {s.evento.nome}
          </Link>{" "}
          ({EVENTO_STATUS_LABEL[s.evento.status]}) · área {s.area.nome}
        </>
      }
    />
  );

  if (editavel) {
    const aceita = aceitaSolicitacao(s.evento.status, s.tipo);
    const [opcoes, linhasAta] = await Promise.all([opcoesReferencias(), s.tipo === "ALTERACAO" ? obterLinhasAta(s.eventoId) : Promise.resolve([])]);
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        {s.status === "DEVOLVIDA" && (
          <Notice tone="danger" title="Devolvida pela logística para ajuste" className="mb-4">
            {s.devolvidaMotivo}. Corrija e reenvie.
          </Notice>
        )}
        {!aceita && (
          <Notice tone="warning" title="O evento não está aceitando este tipo de solicitação agora" className="mb-4">
            O rascunho fica salvo. {s.evento.status === "ENCERRADO" ? "O evento foi encerrado para alterações." : `Estado atual: ${EVENTO_STATUS_LABEL[s.evento.status]}.`}
          </Notice>
        )}
        <SolicitacaoEditor
          solicitacao={{ id: s.id, eventoId: s.eventoId, tipo: s.tipo, status: s.status, titulo: s.titulo, observacao: s.observacao, codigo: s.codigo }}
          itens={itensView}
          opcoes={opcoes}
          linhasAta={linhasAta.map((l) => ({ id: l.id, descricao: l.descricao, quantidade: l.quantidade, destino: l.destino }))}
          podeEnviar={aceita}
        />
      </div>
    );
  }

  const ehLogistica = pode(usuario, "solicitacao.responder");
  const podeResp = ehLogistica && podeResponder(s.status) && (s.tipo === "PRE_REUNIAO" ? s.evento.status === "PREPARACAO" || s.evento.status === "EM_REUNIAO" : s.evento.status === "ABERTO");
  const podeCorrigir = ehLogistica && (podeCorrigirResposta(s.status) || s.status === "EM_ANALISE") && (s.tipo === "PRE_REUNIAO" ? s.evento.status === "PREPARACAO" || s.evento.status === "EM_REUNIAO" : s.evento.status === "ABERTO");

  return (
    <div className="mx-auto max-w-4xl">
      {header}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {s.status === "CANCELADA" && <Notice tone="danger">Cancelada{s.canceladaMotivo ? `: ${s.canceladaMotivo}` : ""}.</Notice>}
          {podeResp && !algumRespondido && s.tipo === "PRE_REUNIAO" && s.evento.status === "PREPARACAO" && (
            <Notice tone="info">Você pode responder agora ou durante a reunião, pela tela “Consolidar ata” do evento.</Notice>
          )}
          <SolicitacaoDetalhe
            solicitacao={{ id: s.id, eventoId: s.eventoId, status: s.status, tipo: s.tipo, observacao: s.observacao, titulo: s.titulo }}
            itens={itensView}
            podeResponder={podeResp}
            podeCorrigir={podeCorrigir}
            podeDevolver={ehLogistica && podeDevolver(s.status, algumRespondido)}
            podeCancelar={podeEditarSolicitacao(usuario, s) && podeCancelar(s.status, algumRespondido)}
          />
        </div>
        <div className="space-y-4">
          <Panel title="Dados">
            <KeyValue
              columns={1}
              items={[
                { label: "Título", value: s.titulo || "—" },
                { label: "Criada por", value: `${s.criadoPor.nome} · ${formatarDataHora(s.criadoEm)}` },
                { label: "Enviada em", value: s.enviadaEm ? formatarDataHora(s.enviadaEm) : "—" },
                {
                  label: "Prazo de resposta",
                  value: s.prazoRespostaEm ? (
                    <span className={atrasada ? "text-danger font-medium" : ""}>
                      {formatarDataHora(s.prazoRespostaEm)} ({tempoRelativo(s.prazoRespostaEm, agora)})
                    </span>
                  ) : (
                    "—"
                  ),
                },
                { label: "Respondida em", value: s.respondidaEm ? formatarDataHora(s.respondidaEm) : "—" },
                { label: "Itens respondidos", value: `${s.itens.filter((i) => i.status !== "EM_ANALISE").length} de ${s.itens.length}` },
              ]}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
