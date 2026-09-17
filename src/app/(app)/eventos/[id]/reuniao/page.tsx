import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { listarSolicitacoes } from "@/server/services/solicitacoes";
import { obterConferencia } from "@/server/services/conferencia";
import { listarAreas } from "@/server/services/admin";
import { diaMesHora } from "@/lib/format";
import { pode } from "@/domain/permissions";
import { Section } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { BannerReuniao } from "@/components/eventos/banner-reuniao";
import { ConferenciaAta } from "@/components/eventos/conferencia-ata";
import { DadosReuniaoForm } from "@/components/eventos/dados-reuniao-form";
import { ObservacoesAutosave } from "@/components/eventos/observacoes-autosave";

/**
 * Reunião de OS: a ata inteira aberta para conferência item a item (quem pediu, observações,
 * ajustes com motivo) e, ao lado, os dados da reunião que vão para a ata.
 */
export default async function ReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("ata.consolidar");
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id);
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") redirect(`/eventos/${id}/ata`);

  const [linhas, lista, opcoes, areas] = await Promise.all([obterConferencia(id), listarSolicitacoes(usuario, { eventoId: id }), opcoesReferenciasResumidas(), listarAreas()]);
  const pre = lista.filter((s) => s.tipo === "PRE_REUNIAO" && s.status !== "RASCUNHO" && s.status !== "CANCELADA" && s.status !== "DEVOLVIDA");
  const comEnvio = new Set(pre.map((s) => s.areaId));
  const semEnvio = areas.filter((a) => a.ativo !== false && a.nome !== "Logística" && !comEnvio.has(a.id));
  const conferidas = linhas.filter((l) => l.conferidoEm).length;

  return (
    <>
      <BannerReuniao
        eventoId={id}
        nome={ev.nome}
        codigo={ev.codigo}
        status={ev.status}
        conferidas={conferidas}
        total={linhas.length}
        presentesOk={Boolean(ev.reuniaoPresentes?.trim())}
        iniciadaEm={ev.reuniaoIniciadaEm ? diaMesHora(ev.reuniaoIniciadaEm) : null}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-3.5">
          <ConferenciaAta eventoId={id} linhas={linhas} editavel opcoes={opcoes} areas={areas.map((a) => ({ id: a.id, nome: a.nome }))} podeCadastrar={pode(usuario, "catalogo.gerenciar")} />
          {semEnvio.length > 0 && (
            <div className="rounded-[10px] border border-dashed border-line-strong px-[18px] py-3 text-[12.5px] text-ink-3">
              Sem necessidades enviadas: <span className="text-ink-2">{semEnvio.map((a) => a.nome).join(", ")}</span>. Se algo dessas áreas foi decidido na reunião, use “Incluir linha”.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5 xl:sticky xl:top-[76px]">
          <Section titulo="Dados da reunião" sub={ev.status === "EM_REUNIAO" && ev.reuniaoIniciadaEm ? `Iniciada ${diaMesHora(ev.reuniaoIniciadaEm)} · ${ev.responsavel.nome}` : `Marcada para ${diaMesHora(ev.dataReuniao)} · ${ev.responsavel.nome}`}>
            <DadosReuniaoForm
              eventoId={id}
              editavel
              valores={{
                reuniaoPresentes: ev.reuniaoPresentes,
                publicoEsperado: ev.publicoEsperado,
                caminhaoCarrega: ev.caminhaoCarrega,
                caminhaoSai: ev.caminhaoSai,
                arenaDescarrega: ev.arenaDescarrega,
                kitDescarrega: ev.kitDescarrega,
              }}
            />
          </Section>
          <Section titulo="Observações da reunião">
            <div className="px-[18px] py-3.5">
              <ObservacoesAutosave eventoId={id} valor={ev.observacoesReuniao ?? ""} />
            </div>
          </Section>
          <Section titulo="Antes de fechar">
            <div className="flex flex-col gap-2 px-[18px] py-3.5">
              <ButtonLink href={`/eventos/${id}/os`} variant="secondary" size="sm" className="no-underline">
                Ver prévia da OS
              </ButtonLink>
              <ButtonLink href={`/impressao/ata/${id}`} target="_blank" variant="secondary" size="sm" className="no-underline">
                Imprimir ata em construção
              </ButtonLink>
              <p className="mb-0 mt-1 text-[12px] text-muted">
                {pre.length} {pre.length === 1 ? "solicitação enviada" : "solicitações enviadas"} pelas áreas.{" "}
                <Link href={`/eventos/${id}/solicitacoes`} className="link">
                  Ver solicitações
                </Link>
              </p>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
