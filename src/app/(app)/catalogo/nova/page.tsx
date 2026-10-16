import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { listarGruposProjetos } from "@/server/services/projetos";
import { PageHeader } from "@/components/ui/layout";
import { PecaForm } from "@/components/catalogo/peca-form";
import { voltaDaBiblioteca } from "@/lib/url";

export const metadata: Metadata = { title: "Nova peça" };

export default async function NovaPecaPage({ searchParams }: { searchParams: Promise<{ volta?: string }> }) {
  const usuario = await requirePermissao("catalogo.gerenciar");
  const [grupos, sp] = await Promise.all([listarGruposProjetos(usuario), searchParams]);
  const volta = voltaDaBiblioteca(sp.volta);
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Biblioteca · catálogo de peças"
        title="Nova peça"
        description="Peças do catálogo entram nos projetos padrão, nas solicitações e nas OS de cada setor. Depois de cadastrar, você inclui as fotos e os anexos."
        breadcrumbs={[{ label: "Biblioteca", href: volta }, { label: "Nova" }]}
      />
      <PecaForm valores={{}} grupos={grupos} cancelarHref={volta} />
    </div>
  );
}
