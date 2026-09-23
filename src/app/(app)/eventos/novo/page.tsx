import type { Metadata } from "next";
import { requirePermissao } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/layout";
import { EventoForm } from "@/components/eventos/evento-form";

export const metadata: Metadata = { title: "Novo evento" };

export default async function NovoEventoPage() {
  await requirePermissao("evento.criar");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo evento" description="Nasce em preparação: as áreas enviam necessidades até a reunião de OS." divisor breadcrumbs={[{ label: "Eventos", href: "/eventos" }, { label: "Novo" }]} />
      <EventoForm valores={{}} cancelarHref="/eventos" />
    </div>
  );
}
