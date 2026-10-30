import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterArenaBase } from "@/server/services/arenas";
import { aplicarPosicoes } from "@/domain/arena/posicoes";
import { pode } from "@/domain/permissions";
import { listarPosicoesArena, secoesEditaveisArena } from "@/server/services/arena";
import { ArenaExperiencia } from "@/components/arena/arena-experiencia";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const carregada = await obterArenaBase(slug).catch(() => null);
  return { title: carregada ? `Arena 3D · ${carregada.arena.evento.nome}` : "Arena 3D" };
}

export default async function ArenaPage({ params }: { params: Promise<{ slug: string }> }) {
  const usuario = await requirePermissao("arena.ver");
  const { slug } = await params;
  // Arena, posições e seções editáveis não dependem umas das outras: as três leituras correm juntas
  // (antes uma esperava a outra; auditoria 28/10, nº 147).
  // Se a tabela de posições ainda não existir (migração pendente), a arena abre com a planta original
  // e o erro fica no log, em vez de derrubar a página inteira.
  const [carregada, posicoes, secoes] = await Promise.all([
    obterArenaBase(slug),
    listarPosicoesArena(slug).catch((e: unknown) => {
      console.error("Arena: não foi possível ler as posições editadas (rode `npm run db:migrate`).", e);
      return [];
    }),
    // Administrador mexe em tudo; numa arena de evento, cada área posiciona os itens que pediu.
    secoesEditaveisArena(usuario),
  ]);
  if (!carregada) notFound();
  // Planta importada + posições editadas (arrastadas ou itens que não tinham lugar).
  const arena = aplicarPosicoes(carregada.arena, posicoes);
  // A versão na URL troca quando a planta muda: o cache do navegador (5 min) não mostra a imagem antiga.
  const plantaImagemUrl = carregada.temPlanta ? `/api/arenas/${slug}/planta?v=${carregada.versao ?? 0}` : undefined;
  const podeEditar = pode(usuario, "arena.editar") || (carregada.origem === "evento" && (secoes?.length ?? 0) > 0);
  return <ArenaExperiencia arena={arena} podeEditar={podeEditar} secoesEditaveis={secoes} editadas={posicoes.map((p) => p.chave)} plantaImagemUrl={plantaImagemUrl} />;
}
