import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { obterConferencia } from "@/server/services/conferencia";
import { NaoEncontradoError } from "@/domain/errors";
import { pode } from "@/domain/permissions";
import { diaMesHora, periodoCurto } from "@/lib/format";
import { EventoStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icone } from "@/components/ui/icons";
import { Codigo } from "@/components/ui/numero";
import { PageHeader } from "@/components/ui/layout";
import { BannerReuniao } from "@/components/eventos/banner-reuniao";
import { ConferenciaAta } from "@/components/eventos/conferencia-ata";
import { PainelReuniao } from "@/components/eventos/painel-reuniao";
import { listarAreasCache } from "@/server/cache";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const usuario = await requirePermissao("ata.consolidar");
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch(() => null);
  return { title: ev ? `Conferência da ata · ${ev.codigo} ${ev.nome}` : "Conferência da ata" };
}

/**
 * Tela própria da reunião de OS: só a ata para conferir, com os dados da reunião num painel ao lado
 * (abaixo, em telas menores). Fora das abas do evento para ganhar espaço.
 */
export default async function ConferenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("ata.consolidar");
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  // Ata fechada: a conferência acabou. Quem acabou de fechar quer ver a OS que nasceu dela.
  if (ev.status !== "PREPARACAO" && ev.status !== "EM_REUNIAO") redirect(ev.status === "ABERTO" && pode(usuario, "os.ver") ? `/eventos/${id}/os` : `/eventos/${id}/ata`);

  const [linhas, opcoes, areas] = await Promise.all([obterConferencia(id), opcoesReferenciasResumidas(), listarAreasCache()]);
  const conferidas = linhas.filter((l) => l.conferidoEm).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="!mb-0"
        breadcrumbs={[{ label: "Eventos", href: "/eventos" }, { label: `${ev.codigo} · ${ev.nome}`, href: `/eventos/${id}` }, { label: "Conferência da ata" }]}
        eyebrow={
          <>
            <Link href={`/eventos/${id}`} className="text-ink-3 no-underline hover:text-ink hover:underline">
              <Codigo>{ev.codigo}</Codigo>
            </Link>
            <EventoStatusBadge status={ev.status} />
            <span className="numero">evento {periodoCurto(ev.dataInicio, ev.dataFim)}</span>
          </>
        }
        title={`Conferência · ${ev.nome}`}
        actions={
          <>
            <ButtonLink href={`/eventos/${id}`} variant="ghost" size="md" className="no-underline">
              <Icone nome="seta-esquerda" />
              Evento
            </ButtonLink>
            <ButtonLink href={`/impressao/ata/${id}`} target="_blank" variant="ghost" size="md" className="no-underline">
              <Icone nome="imprimir" />
              Imprimir
            </ButtonLink>
            <ButtonLink href={`/eventos/${id}/os`} variant="secondary" size="md" className="no-underline">
              Prévia da OS
            </ButtonLink>
          </>
        }
      />

      <BannerReuniao
        eventoId={id}
        nome={ev.nome}
        codigo={ev.codigo}
        status={ev.status}
        conferidas={conferidas}
        total={linhas.length}
        presentesOk={Boolean(ev.reuniaoPresentes?.trim())}
        iniciadaEm={ev.status === "EM_REUNIAO" && ev.reuniaoIniciadaEm ? diaMesHora(ev.reuniaoIniciadaEm) : null}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <ConferenciaAta eventoId={id} linhas={linhas} editavel opcoes={opcoes} areas={areas.map((a) => ({ id: a.id, nome: a.nome }))} podeCadastrar={pode(usuario, "catalogo.gerenciar")} />
        <PainelReuniao
          eventoId={id}
          resumo={ev.reuniaoIniciadaEm && ev.status === "EM_REUNIAO" ? `Iniciada ${diaMesHora(ev.reuniaoIniciadaEm)} · ${ev.responsavel.nome}` : `Marcada para ${diaMesHora(ev.dataReuniao)} · ${ev.responsavel.nome}`}
          presentesOk={Boolean(ev.reuniaoPresentes?.trim())}
          valores={{
            reuniaoPresentes: ev.reuniaoPresentes,
            publicoEsperado: ev.publicoEsperado,
            caminhaoCarrega: ev.caminhaoCarrega,
            caminhaoSai: ev.caminhaoSai,
            arenaDescarrega: ev.arenaDescarrega,
            kitDescarrega: ev.kitDescarrega,
          }}
          observacoes={ev.observacoesReuniao ?? ""}
        />
      </div>
    </div>
  );
}
