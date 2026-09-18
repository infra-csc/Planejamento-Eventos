import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
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
  const usuario = await requirePermissao("arena.ver");
  const { slug } = await params;
  const base = obterArenaPorSlug(slug);
  if (!base) notFound();
  // Planta importada + posições editadas pela logística (arrastadas ou itens que não tinham lugar).
  // Se a tabela de posições ainda não existir (migração pendente), a arena abre com a planta original
  // e o erro fica no log, em vez de derrubar a página inteira.
  const posicoes = await listarPosicoesArena(slug).catch((e: unknown) => {
    console.error("Arena: não foi possível ler as posições editadas (rode `npm run db:migrate`).", e);
    return [];
  });
  const arena = aplicarPosicoes(base, posicoes);
  return <ArenaExperiencia arena={arena} podeEditar={pode(usuario, "ata.consolidar")} editadas={posicoes.map((p) => p.chave)} />;
}
