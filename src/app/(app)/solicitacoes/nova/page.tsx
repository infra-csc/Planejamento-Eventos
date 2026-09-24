import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { linhasAtaResumidas, listarEventosAceitando, opcoesReferencias } from "@/server/services/eventos";
import { obterSolicitacao } from "@/server/services/solicitacoes";
import { obterConfiguracoes } from "@/server/services/support";
import { getDb } from "@/server/db";
import { pode, podeEditarSolicitacao } from "@/domain/permissions";
import { podeEnviar } from "@/domain/solicitacao";
import { DomainError, NaoEncontradoError } from "@/domain/errors";
import { diaMes, diaMesHora, periodoCurto } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { NovaSolicitacaoForm, type EventoOpcao, type ItemNovo } from "@/components/solicitacoes/nova-solicitacao-form";
import { descricaoItem } from "@/server/services/solicitacoes";
import { extrasPermitidosTenda } from "@/domain/tendas";
import { descricoesEsperadas } from "@/domain/descricoes-itens";
import { listarAreasCache } from "@/server/cache";

export const metadata: Metadata = { title: "Nova solicitação" };

export default async function NovaSolicitacaoPage({ searchParams }: { searchParams: Promise<{ evento?: string; rascunho?: string }> }) {
  const usuario = await requirePermissao("solicitacao.criar");
  const sp = await searchParams;

  const rascunho = sp.rascunho
    ? await obterSolicitacao(usuario, sp.rascunho).catch((e) => {
        if (e instanceof NaoEncontradoError) notFound();
        if (e instanceof DomainError && e.code === "SEM_PERMISSAO") redirect("/sem-permissao");
        throw e;
      })
    : null;
  if (rascunho && !(podeEnviar(rascunho.status) && podeEditarSolicitacao(usuario, rascunho))) redirect(`/solicitacoes/${rascunho.id}`);

  const [{ aceitando, linhasTodas }, opcoes, config, todasAreas] = await Promise.all([
    // Linhas da ata de todos os eventos abertos numa consulta só, encadeada aos eventos e em paralelo com o resto.
    // Filtro de status no banco, sem as contagens da lista de eventos.
    listarEventosAceitando(usuario, rascunho?.eventoId).then(async (aceitando) => {
      const linhasTodas = await linhasAtaResumidas(aceitando.filter((e) => e.status === "ABERTO").map((e) => e.id));
      return { aceitando, linhasTodas };
    }),
    opcoesReferencias(),
    getDb().then(obterConfiguracoes),
    usuario.perfil === "ADMIN" ? listarAreasCache() : Promise.resolve(null),
  ]);
  // Administrador pede em nome de uma área: escolhe qual no formulário.
  const areasAdmin = todasAreas?.map((a) => ({ id: a.id, nome: a.nome })) ?? null;
  // Alterar ou remover linha da ata: só o que a própria área pediu (ou o que a logística incluiu).
  const veTodasAsAreas = pode(usuario, "solicitacao.ver_todas");
  const linhasPorEvento = Object.fromEntries(Object.entries(linhasTodas).map(([id, ls]) => [id, ls.filter((l) => veTodasAsAreas || l.areaId == null || l.areaId === usuario.areaId)]));

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
      descricoes: i.descricoes ?? [],
      locais: Array.from({ length: descricoesEsperadas(i.operacao, i.quantidadeSolicitada) }, () => i.destino ?? ""),
      ajustes: Object.fromEntries((i.ajustesBom ?? []).map((a) => [a.pecaId, a.quantidade])),
      rotulo: descricaoItem(i),
      meta: i.projeto ? `${i.projeto.codigo} · projeto padrão` : i.peca ? `${i.peca.codigo} · peça` : i.eventoItemId ? "linha da ata" : "fora do catálogo",
    })) ?? [];

  // Tenda: fechamento e calha não estão no padrão do projeto, mas podem ser pedidos como ajuste (por local).
  const pecaPorCodigo = new Map(opcoes.pecas.map((p) => [p.codigo, p]));
  const extrasDe = (bom: Array<{ codigo: string }>) =>
    extrasPermitidosTenda(bom.map((b) => b.codigo))
      .map((c) => pecaPorCodigo.get(c))
      .filter((p) => p !== undefined)
      .map((p) => ({ pecaId: p.id, codigo: p.codigo, nome: p.nome, unidade: p.unidade, quantidade: 0 }));

  // Um só evento aceitando pedidos: já vem escolhido (a pessoa ainda pode ver os dados dele no passo 1).
  const aceitando1 = eventos.filter((e) => e.aceita);
  const eventoInicial = rascunho?.eventoId ?? (eventos.some((e) => e.id === sp.evento && e.aceita) ? sp.evento! : aceitando1.length === 1 ? aceitando1[0].id : null);

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
        projetos={opcoes.projetos.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome, descricao: p.descricao, meta: [p.categoria, `v${p.versaoAtual}`, `${p.totalPecas} peças`].filter(Boolean).join(" · "), bom: p.bom, extras: extrasDe(p.bom), capaId: p.capaId }))}
        pecas={opcoes.pecas.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome, meta: [p.familia, p.estoqueProprio > 0 ? `estoque ${p.estoqueProprio} ${p.unidade}` : null].filter(Boolean).join(" · ") }))}
        linhasPorEvento={linhasPorEvento}
        slaHoras={Number(config.sla_resposta_horas)}
      />
    </div>
  );
}
