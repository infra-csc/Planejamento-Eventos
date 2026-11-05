import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pode } from "@/domain/permissions";
import { requirePermissao } from "@/server/auth/session";
import { listarCarga } from "@/server/services/carga-descarga";
import { CargaDoEvento } from "@/components/carga/carga-evento";
import { EstimativaVeiculos } from "@/components/logistica/estimativa-veiculos";
import { estimativaDoEvento } from "@/server/services/projecao";

export const metadata: Metadata = { title: "Carga" };

/** Aba Carga do evento: os veículos de carga e descarga deste evento (logística e administrador). */
export default async function CargaEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("carga.ver");
  const { id } = await params;
  const { eventos, veiculos, podeEditar } = await listarCarga(usuario, { eventoId: id });
  const evento = eventos.find((e) => e.id === id);
  if (!evento) notFound();
  const estimativa = pode(usuario, "projecao.ver") ? await estimativaDoEvento(id) : null;
  return (
    <div className="flex flex-col gap-4">
      {estimativa && <EstimativaVeiculos estimativa={estimativa} />}
      <CargaDoEvento evento={evento} eventos={eventos} veiculos={veiculos} podeEditar={podeEditar} />
    </div>
  );
}
