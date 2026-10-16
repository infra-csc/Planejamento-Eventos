import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { pode } from "@/domain/permissions";
import { listarCarga } from "@/server/services/carga-descarga";
import { hojeISO } from "@/lib/format";
import { CadastroCarga } from "@/components/carga/cadastro-carga";

export const metadata: Metadata = { title: "Cadastro · Carga e descarga" };

/** Eventos e os veículos de cada um: escolhe o evento na lista e cadastra a ida e a volta. */
export default async function CadastroCargaPage({ searchParams }: { searchParams: Promise<{ evento?: string }> }) {
  const usuario = await requirePermissao("carga.ver");
  const [{ veiculos, eventos, podeEditar }, sp] = await Promise.all([listarCarga(usuario), searchParams]);
  return <CadastroCarga eventos={eventos} veiculos={veiculos} podeEditar={podeEditar} podeCriarEvento={pode(usuario, "evento.criar")} hoje={hojeISO()} eventoInicial={sp.evento ?? null} />;
}
