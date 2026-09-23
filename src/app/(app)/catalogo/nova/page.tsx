import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/layout";
import { PecaForm } from "@/components/catalogo/peca-form";

export const metadata: Metadata = { title: "Nova peça" };

export default async function NovaPecaPage() {
  await requirePermissao("catalogo.gerenciar");
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Biblioteca · catálogo de peças"
        title="Nova peça"
        description="Peças do catálogo entram nos projetos padrão, nas solicitações e nas OS de cada setor."
        breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca?aba=pecas" }, { label: "Nova" }]}
      />
      <PecaForm valores={{}} cancelarHref="/biblioteca?aba=pecas" />
    </div>
  );
}
