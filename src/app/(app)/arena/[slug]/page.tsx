import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { obterArenaPorSlug } from "@/domain/arena/eco-run-sp-2026";
import { ArenaExperiencia } from "@/components/arena/arena-experiencia";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const arena = obterArenaPorSlug(slug);
  return { title: arena ? `Arena 3D · ${arena.evento.nome}` : "Arena 3D" };
}

export default async function ArenaPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUsuario();
  const { slug } = await params;
  const arena = obterArenaPorSlug(slug);
  if (!arena) notFound();
  return <ArenaExperiencia arena={arena} />;
}
