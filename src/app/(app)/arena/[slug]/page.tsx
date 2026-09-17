import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUsuario } from "@/server/auth/session";
import { obterArenaPorSlug } from "@/domain/arena/eco-run-sp-2026";
import { aplicarPosicoes } from "@/domain/arena/posicoes";
import { pode } from "@/domain/permissions";
import { listarPosicoesArena } from "@/server/services/arena";
import { ArenaExperiencia } from "@/components/arena/arena-experiencia";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const arena = obterArenaPorSlug(slug);
  return { title: arena ? `Arena 3D · ${arena.evento.nome}` : "Arena 3D" };
}

export default async function ArenaPage({ params }: { params: Promise<{ slug: string }> }) {
  const usuario = await requireUsuario();
  const { slug } = await params;
  const base = obterArenaPorSlug(slug);
  if (!base) notFound();
  // Planta importada + posições editadas pela logística (arrastadas ou itens que não tinham lugar).
  const posicoes = await listarPosicoesArena(slug);
  const arena = aplicarPosicoes(base, posicoes);
  return <ArenaExperiencia arena={arena} podeEditar={pode(usuario, "ata.consolidar")} editadas={posicoes.map((p) => p.chave)} />;
}
