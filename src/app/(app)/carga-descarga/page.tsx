import type { Metadata } from "next";
import { pode } from "@/domain/permissions";
import { requirePermissao } from "@/server/auth/session";
import { EstimativasProximas } from "@/components/logistica/estimativa-veiculos";
import { estimativasProximas } from "@/server/services/projecao";
import { listarCarga } from "@/server/services/carga-descarga";
import { hojeISO } from "@/lib/format";
import { CalendarioCarga } from "@/components/carga/calendario-carga";
import type { DiaPlanilha } from "@/domain/carga-descarga";
import planilha from "@/data/planilha-carga-2026.json";

export const metadata: Metadata = { title: "Carga e descarga" };

/**
 * Calendário semanal do galpão. Os itens da planilha 2026 seguem visíveis (somente leitura) até o
 * evento ganhar veículos aqui.
 */
export default async function CargaDescargaPage() {
  const usuario = await requirePermissao("carga.ver");
  const { veiculos, eventos, podeEditar } = await listarCarga(usuario);
  const estimativas = pode(usuario, "projecao.ver") ? await estimativasProximas(hojeISO()) : [];
  const calendario = <CalendarioCarga eventos={eventos} veiculos={veiculos} planilha={planilha as DiaPlanilha[]} podeEditar={podeEditar} hoje={hojeISO()} usuarioId={usuario.id} />;
  return estimativas.length ? (
    <div className="flex flex-col gap-4">
      {calendario}
      <EstimativasProximas lista={estimativas} />
    </div>
  ) : (
    calendario
  );
}
