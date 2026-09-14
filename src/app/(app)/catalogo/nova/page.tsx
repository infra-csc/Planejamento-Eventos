import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/layout";
import { PecaForm } from "@/components/catalogo/peca-form";

export const metadata: Metadata = { title: "Nova peça" };

export default async function NovaPecaPage() {
  await requirePermissao("catalogo.gerenciar");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nova peça" breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca?aba=pecas" }, { label: "Nova" }]} />
      <PecaForm valores={{}} cancelarHref="/biblioteca?aba=pecas" />
    </div>
  );
}
