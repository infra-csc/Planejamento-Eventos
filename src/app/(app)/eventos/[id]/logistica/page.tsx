import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requirePermissao } from "@/server/auth/session";
import { obterEventoCache } from "@/server/cache";
import { getDb } from "@/server/db";
import { eventos } from "@/server/db/schema";
import { GRUPO_LABEL, grupoDaLinha } from "@/domain/grupos-material";
import { atendimentoDaLinha } from "@/domain/logistica";
import { pode } from "@/domain/permissions";
import { buttonClasses } from "@/components/ui/button-classes";
import { Icone } from "@/components/ui/icons";
import { Section } from "@/components/ui/layout";
import { AtendePorEvento, DadosLogisticaEvento, EstruturaEvento } from "@/components/logistica/evento-logistica";
import { EstimativaVeiculos } from "@/components/logistica/estimativa-veiculos";
import { listarAlmoxarifados, listarEventosPai, listarTours } from "@/server/services/logistica";
import { montarLinhasAtaDeEventos } from "@/server/services/os";
import { datasDosEventos, documentoFornecedor, estimativaDoEvento } from "@/server/services/projecao";

export const metadata: Metadata = { title: "Logística do evento" };

/** Aba Logística: datas previstas, tour, Estrutura e "Atende por". Por enquanto, só o administrador. */
export default async function LogisticaEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("projecao.ver");
  const { id } = await params;
  await obterEventoCache(usuario, id);
  const db = await getDb();
  const ev = (await db.query.eventos.findFirst({ where: eq(eventos.id, id) }))!;
  const [datas, linhasMapa, almoxarifados, pais, listaTours, estimativa, doc] = await Promise.all([datasDosEventos(db, [ev]), montarLinhasAtaDeEventos(db, [id]), listarAlmoxarifados(db), listarEventosPai(), listarTours(), estimativaDoEvento(id, db), documentoFornecedor(id, db)]);
  const editavel = ev.status !== "CANCELADO";
  const linhas = (linhasMapa.get(id) ?? []).map((l) => {
    const reg = l.registro;
    const grupo = grupoDaLinha({ tipo: l.tipo, projeto: reg.projeto, peca: reg.peca });
    const a = atendimentoDaLinha({ atendePor: reg.atendePor, grupo }, ev.estrutura);
    return { id: l.id, nome: l.projeto?.nome ?? l.peca?.nome ?? l.descricaoLivre ?? "Item fora do catálogo", quantidade: l.quantidade, destino: l.destino, area: l.areaNome ?? "Logística", grupo: GRUPO_LABEL[grupo], projeto: l.projeto?.nome ?? null, ...a, almoxarifadoId: reg.almoxarifadoId, montador: reg.montador };
  });
  const temDocumento = doc.terceirizadas.length > 0 || doc.enviadoPelaNorte.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <DadosLogisticaEvento
          eventoId={id}
          podeEditar={editavel && pode(usuario, "evento.datas_previstas")}
          saidaEditada={ev.saidaPrevista}
          retornoEditado={ev.retornoPrevisto}
          datas={datas.get(id)!}
          eventoPaiId={ev.eventoPaiId}
          tourId={ev.tourId}
          eventosPai={pais.filter((p) => p.ativo || p.id === ev.eventoPaiId).map((p) => ({ value: p.id, label: p.nome }))}
          tours={listaTours.filter((t) => t.ativo || t.id === ev.tourId).map((t) => ({ value: t.id, label: t.nome }))}
        />
        <div className="flex flex-col gap-4">
          <EstruturaEvento eventoId={id} podeEditar={editavel && pode(usuario, "evento.estrutura")} estrutura={ev.estrutura} fornecedor={ev.fornecedorEstrutura} />
          <EstimativaVeiculos estimativa={estimativa} />
          <Section titulo="Documento técnico para o fornecedor" sub={temDocumento ? `${doc.terceirizadas.length} ${doc.terceirizadas.length === 1 ? "linha terceirizada" : "linhas terceirizadas"} e ${doc.enviadoPelaNorte.length} ${doc.enviadoPelaNorte.length === 1 ? "complemento" : "complementos"} ao montador.` : "Sai quando houver linha terceirizada ou complemento ao montador."} padded>
            {temDocumento && (
              <div className="flex flex-wrap gap-2">
                {/* Sem next/link: o prefetch geraria o arquivo a cada visita. */}
                <a href={`/api/eventos/${id}/fornecedor`} className={buttonClasses({ variant: "secondary", size: "md", className: "no-underline" })}>
                  <Icone nome="download" />
                  Excel
                </a>
                <a href={`/impressao/fornecedor/${id}`} className={buttonClasses({ variant: "secondary", size: "md", className: "no-underline" })}>
                  <Icone nome="imprimir" />
                  PDF
                </a>
              </div>
            )}
          </Section>
        </div>
      </div>
      <AtendePorEvento eventoId={id} podeEditar={editavel && pode(usuario, "evento.estrutura")} linhas={linhas} almoxarifados={almoxarifados.filter((a) => a.ativo).map((a) => ({ value: a.id, label: a.nome }))} />
    </div>
  );
}
