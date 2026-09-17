import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { opcoesReferenciasResumidas } from "@/server/services/eventos";
import { obterEventoCache } from "@/server/cache";
import { obterConferencia } from "@/server/services/conferencia";
import { listarAreas } from "@/server/services/admin";
import { NaoEncontradoError } from "@/domain/errors";
import { pode } from "@/domain/permissions";
import { diaMesHora, periodoCurto } from "@/lib/format";
import { EventoStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DefinirTrilha } from "@/components/shell/trilha";
import { BannerReuniao } from "@/components/eventos/banner-reuniao";
import { ConferenciaAta } from "@/components/eventos/conferencia-ata";
import { PainelReuniao } from "@/components/eventos/painel-reuniao";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const usuario = await requirePermissao("ata.consolidar");
  const { id } = await params;
  const ev = await obterEventoCache(usuario, id).catch(() => null);
  return { title: ev ? `Conferência da ata · ${ev.codigo} ${ev.nome}` : "Conferência da ata" };
}

/**
 * Tela própria da reunião de OS: só a ata para conferir, em tela cheia, com os dados da reunião
 * num painel lateral que abre quando precisa. Fora das abas do evento para ganhar espaço.
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

  const [linhas, opcoes, areas] = await Promise.all([obterConferencia(id), opcoesReferenciasResumidas(), listarAreas()]);
  const conferidas = linhas.filter((l) => l.conferidoEm).length;

  return (
    <div className="-mt-2 flex flex-col gap-4">
      <DefinirTrilha itens={[{ label: "Eventos", href: "/eventos" }, { label: `${ev.codigo} · ${ev.nome}`, href: `/eventos/${id}` }, { label: "Conferência da ata" }]} />

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <Link href={`/eventos/${id}`} className="font-mono text-ink-2 no-underline hover:underline">
              {ev.codigo}
            </Link>
            <EventoStatusBadge status={ev.status} />
            <span>evento {periodoCurto(ev.dataInicio, ev.dataFim)}</span>
            <span>· reunião {diaMesHora(ev.dataReuniao)}</span>
          </p>
          <h1 className="mb-0 mt-0.5 text-[22px] font-semibold leading-[1.2] tracking-[-0.02em]">Conferência da ata · {ev.nome}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/eventos/${id}/os`} variant="secondary" size="md" className="no-underline">
            Prévia da OS
          </ButtonLink>
          <ButtonLink href={`/impressao/ata/${id}`} target="_blank" variant="secondary" size="md" className="no-underline">
            Imprimir ata
          </ButtonLink>
          <ButtonLink href={`/eventos/${id}`} variant="ghost" size="md" className="no-underline">
            Voltar ao evento
          </ButtonLink>
        </div>
      </header>

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

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start">
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
