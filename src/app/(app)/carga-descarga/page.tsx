import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { listarCarga } from "@/server/services/carga-descarga";
import { hojeISO } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { CalendarioCarga } from "@/components/carga/calendario-carga";
import type { DiaPlanilha } from "@/domain/carga-descarga";
import planilha from "@/data/planilha-carga-2026.json";

export const metadata: Metadata = { title: "Carga e descarga" };

/**
 * Carga e descarga do galpão (logística e administrador): o calendário semanal do que sai e volta,
 * com o cadastro dos veículos de cada evento. Substitui a planilha "Resumo semanal de carga e descarga";
 * os itens da planilha 2026 seguem visíveis (somente leitura) até o evento ganhar veículos aqui.
 */
export default async function CargaDescargaPage() {
  const usuario = await requirePermissao("carga.ver");
  const { veiculos, eventos, podeEditar } = await listarCarga(usuario);
  return (
    <>
      <PageHeader title="Carga e descarga" description="O que sai do galpão, o que volta e quando, em quantos veículos. Clique num card para ver a ida e a volta completas." divisor />
      <CalendarioCarga eventos={eventos} veiculos={veiculos} planilha={planilha as DiaPlanilha[]} podeEditar={podeEditar} hoje={hojeISO()} usuarioId={usuario.id} />
    </>
  );
}
