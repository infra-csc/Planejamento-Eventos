import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { eventosSemArena, listarArenasResumo } from "@/server/services/arenas";
import { EVENTO_STATUS_LABEL } from "@/domain/evento";
import { periodoCurto } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { NovaArenaForm } from "./form";

export const metadata: Metadata = { title: "Nova arena" };

export default async function NovaArenaPage({ searchParams }: { searchParams: Promise<{ evento?: string }> }) {
  const usuario = await requirePermissao("arena.ver");
  const sp = await searchParams;
  const [eventos, arenas] = await Promise.all([eventosSemArena(usuario), listarArenasResumo()]);
  const eventoInicial = eventos.some((e) => e.id === sp.evento) ? (sp.evento ?? null) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nova arena"
        description="O mapa da arena de um evento. A ata do evento aparece dentro da arena e acompanha cada ajuste."
        breadcrumbs={[{ label: "Arena 3D", href: "/arena" }, { label: "Nova" }]}
      />
      <NovaArenaForm
        eventos={eventos.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome, descricao: [periodoCurto(e.dataInicio, e.dataFim), e.local].filter(Boolean).join(" · "), status: EVENTO_STATUS_LABEL[e.status] }))}
        arenas={arenas.map((a) => ({ slug: a.slug, nome: a.nome, pontos: a.pontos, evento: a.evento ? `${a.evento.codigo} · ${a.evento.nome}` : null }))}
        eventoInicial={eventoInicial}
      />
    </div>
  );
}
