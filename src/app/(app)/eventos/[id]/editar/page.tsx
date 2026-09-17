import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterEvento } from "@/server/services/eventos";
import { toDateTimeLocal } from "@/lib/format";
import { NaoEncontradoError } from "@/domain/errors";
import { EventoForm } from "@/components/eventos/evento-form";
import { SituacaoEvento } from "@/components/eventos/situacao-evento";

export const metadata: Metadata = { title: "Editar evento" };

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("evento.editar");
  const { id } = await params;
  const ev = await obterEvento(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  if (ev.status === "CANCELADO") redirect(`/eventos/${id}`);
  return (
    <div className="flex max-w-[880px] flex-col gap-5">
      <EventoForm
        valores={{
          id: ev.id,
          nome: ev.nome,
          cliente: ev.cliente,
          local: ev.local,
          dataInicio: ev.dataInicio,
          dataReuniao: toDateTimeLocal(ev.dataReuniao),
          janelaAlteracoesAte: ev.janelaAlteracoesAte,
        }}
        cancelarHref={`/eventos/${ev.id}`}
      />
      <SituacaoEvento eventoId={ev.id} codigo={ev.codigo} status={ev.status} />
    </div>
  );
}
