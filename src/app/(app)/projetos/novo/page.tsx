import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { listarPecas } from "@/server/services/catalogo";
import { PageHeader } from "@/components/ui/layout";
import { ProjetoForm } from "@/components/projetos/projeto-form";

export const metadata: Metadata = { title: "Novo projeto padrão" };

export default async function NovoProjetoPage() {
  const usuario = await requirePermissao("projeto.gerenciar");
  const pecas = await listarPecas(usuario);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo projeto padrão" breadcrumbs={[{ label: "Biblioteca", href: "/biblioteca" }, { label: "Novo" }]} />
      <ProjetoForm valores={{ itens: [] }} pecas={pecas} cancelarHref="/biblioteca" />
    </div>
  );
}
