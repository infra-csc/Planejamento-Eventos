import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { listarGruposProjetos } from "@/server/services/projetos";
import { PageHeader } from "@/components/ui/layout";
import { PecaForm } from "@/components/catalogo/peca-form";

export const metadata: Metadata = { title: "Nova peça" };

export default async function NovaPecaPage() {
  const usuario = await requirePermissao("catalogo.gerenciar");
  const grupos = await listarGruposProjetos(usuario);
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Biblioteca · catálogo de peças"
        title="Nova peça"
        description="Peças do catálogo entram nos projetos padrão, nas solicitações e nas OS de cada setor. Depois de cadastrar, você inclui as fotos e os anexos."
        breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca?aba=pecas" }, { label: "Nova" }]}
      />
      <PecaForm valores={{}} grupos={grupos} cancelarHref="/biblioteca?aba=pecas" />
    </div>
  );
}
