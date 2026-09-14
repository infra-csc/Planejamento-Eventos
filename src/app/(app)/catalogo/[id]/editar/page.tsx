import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterPeca } from "@/server/services/catalogo";
import { NaoEncontradoError } from "@/domain/errors";
import { PageHeader } from "@/components/ui/layout";
import { PecaForm } from "@/components/catalogo/peca-form";

export const metadata: Metadata = { title: "Editar peça" };

export default async function EditarPecaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requirePermissao("catalogo.gerenciar");
  const { id } = await params;
  const p = await obterPeca(usuario, id).catch((e) => {
    if (e instanceof NaoEncontradoError) notFound();
    throw e;
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`${p.codigo} · ${p.nome}`} breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca?aba=pecas" }, { label: p.codigo }]} />
      <PecaForm valores={p} usos={p.usos} cancelarHref="/biblioteca?aba=pecas" />
    </div>
  );
}
