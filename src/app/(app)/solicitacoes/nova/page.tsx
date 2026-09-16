import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { linhasAtaResumidas, listarEventos, opcoesReferencias } from "@/server/services/eventos";
import { obterSolicitacao } from "@/server/services/solicitacoes";
import { obterConfiguracoes } from "@/server/services/support";
import { listarAreas } from "@/server/services/admin";
import { getDb } from "@/server/db";
import { podeEditarSolicitacao } from "@/domain/permissions";
import { podeEnviar } from "@/domain/solicitacao";
import { NaoEncontradoError } from "@/domain/errors";
import { diaMes, diaMesHora, periodoCurto } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { NovaSolicitacaoForm, type EventoOpcao, type ItemNovo } from "@/components/solicitacoes/nova-solicitacao-form";
import { descricaoItem } from "@/server/services/solicitacoes";

export const metadata: Metadata = { title: "Nova solicitação" };

export default async function NovaSolicitacaoPage({ searchParams }: { searchParams: Promise<{ evento?: string; rascunho?: string }> }) {
  const usuario = await requirePermissao("solicitacao.criar");
  const sp = await searchParams;

  const rascunho = sp.rascunho
    ? await obterSolicitacao(usuario, sp.rascunho).catch((e) => {
        if (e instanceof NaoEncontradoError) notFound();
        throw e;
      })
    : null;
  if (rascunho && !(podeEnviar(rascunho.status) && podeEditarSolicitacao(usuario, rascunho))) redirect(`/solicitacoes/${rascunho.id}`);

  const [todos, opcoes, config, todasAreas] = await Promise.all([listarEventos(usuario), opcoesReferencias(), obterConfiguracoes(await getDb()), usuario.perfil === "ADMIN" ? listarAreas() : Promise.resolve(null)]);
  // Administrador pede em nome de uma área: escolhe qual no formulário.
  const areasAdmin = todasAreas?.map((a) => ({ id: a.id, nome: a.nome })) ?? null;
  const aceitando = todos.filter((e) => e.status === "PREPARACAO" || e.status === "ABERTO" || e.id === rascunho?.eventoId);
  // Linhas da ata de todos os eventos abertos numa consulta só.
  const linhasPorEvento = await linhasAtaResumidas(aceitando.filter((e) => e.status === "ABERTO").map((e) => e.id));

  const eventos: EventoOpcao[] = aceitando.map((e) => ({
    id: e.id,
    codigo: e.codigo,
    nome: e.nome,
    cliente: e.cliente,
    periodo: periodoCurto(e.dataInicio, e.dataFim),
    marco: e.status === "PREPARACAO" ? `reunião ${diaMesHora(e.dataReuniao)}` : e.ataFechadaEm ? `ata fechada ${diaMes(e.ataFechadaEm)}` : e.status,
    tipo: e.status === "PREPARACAO" || (e.status !== "ABERTO" && rascunho?.tipo === "PRE_REUNIAO") ? "PRE_REUNIAO" : "ALTERACAO",
    aceita: e.status === "PREPARACAO" || e.status === "ABERTO",
  }));

  const itensIniciais: ItemNovo[] =
    rascunho?.itens.map((i, n) => ({
      chave: `r${n}`,
      operacao: i.operacao,
      projetoId: i.projetoId,
      pecaId: i.pecaId,
      eventoItemId: i.eventoItemId,
      descricaoLivre: i.descricaoLivre,
      quantidade: i.quantidadeSolicitada,
      quantidadeAtual: i.eventoItem?.quantidade ?? null,
      destino: i.destino ?? "",
      justificativa: i.justificativa ?? "",
      ajustes: Object.fromEntries((i.ajustesBom ?? []).map((a) => [a.pecaId, a.quantidade])),
      rotulo: descricaoItem(i),
      meta: i.projeto ? `${i.projeto.codigo} · projeto padrão` : i.peca ? `${i.peca.codigo} · peça` : i.eventoItemId ? "linha da ata" : "item avulso",
    })) ?? [];

  const eventoInicial = rascunho?.eventoId ?? (eventos.some((e) => e.id === sp.evento && e.aceita) ? sp.evento! : null);

  return (
    <div>
      <PageHeader
        title={rascunho ? `Editar ${rascunho.codigo}` : "Nova solicitação"}
        description="Escolha o evento, adicione o que a sua área precisa e envie. A logística responde item por item."
        breadcrumbs={[{ label: "Solicitações", href: "/solicitacoes" }, { label: rascunho ? rascunho.codigo : "Nova" }]}
      />
      <NovaSolicitacaoForm
        rascunho={rascunho ? { id: rascunho.id, codigo: rascunho.codigo, titulo: rascunho.titulo ?? "", observacao: rascunho.observacao ?? "", eventoId: rascunho.eventoId, devolvidaMotivo: rascunho.status === "DEVOLVIDA" ? rascunho.devolvidaMotivo : null } : null}
        eventos={eventos}
        areas={areasAdmin}
        areaInicial={rascunho?.areaId ?? null}
        eventoInicial={eventoInicial}
        itensIniciais={itensIniciais}
        projetos={opcoes.projetos.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome, meta: [p.categoria, `v${p.versaoAtual}`, `${p.totalPecas} peças`].filter(Boolean).join(" · "), bom: p.bom, capaId: p.capaId }))}
        pecas={opcoes.pecas.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome, meta: [p.familia, p.estoqueProprio > 0 ? `estoque ${p.estoqueProprio} ${p.unidade}` : null].filter(Boolean).join(" · ") }))}
        linhasPorEvento={linhasPorEvento}
        slaHoras={Number(config.sla_resposta_horas)}
      />
    </div>
  );
}
