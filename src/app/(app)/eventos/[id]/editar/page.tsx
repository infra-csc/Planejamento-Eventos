import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterEvento } from "@/server/services/eventos";
import { listarUsuariosPorPerfil } from "@/server/services/admin";
import { PageHeader, Notice } from "@/components/ui/layout";
import { EventoForm } from "@/components/eventos/evento-form";
import { toDateTimeLocal } from "@/lib/format";
import { NaoEncontradoError } from "@/domain/errors";

export const metadata: Metadata = { title: "Editar evento" };

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("evento.editar");
  const { id } = await params;
  const ev = await obterEvento(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  const responsaveis = await listarUsuariosPorPerfil(["LOGISTICA"]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Editar ${ev.codigo}`} breadcrumbs={[{ label: "Eventos", href: "/eventos" }, { label: ev.nome, href: `/eventos/${ev.id}` }, { label: "Editar" }]} />
      {ev.status === "CANCELADO" && <Notice tone="danger" className="mb-4">Evento cancelado não pode ser editado.</Notice>}
      <EventoForm
        valores={{
          id: ev.id,
          nome: ev.nome,
          cliente: ev.cliente,
          local: ev.local,
          dataMontagem: ev.dataMontagem,
          dataInicio: ev.dataInicio,
          dataFim: ev.dataFim,
          dataDesmontagem: ev.dataDesmontagem,
          dataReuniao: toDateTimeLocal(ev.dataReuniao),
          dataCarga: ev.dataCarga,
          responsavelId: ev.responsavelId,
        }}
        responsaveis={responsaveis}
        cancelarHref={`/eventos/${ev.id}`}
      />
    </div>
  );
}
