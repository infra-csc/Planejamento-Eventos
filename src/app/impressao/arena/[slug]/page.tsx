import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissao } from "@/server/auth/session";
import { obterArenaBase } from "@/server/services/arenas";
import { listarPosicoesArena } from "@/server/services/arena";
import { aplicarPosicoes } from "@/domain/arena/posicoes";
import { ImpressaoArena } from "@/components/arena/impressao-arena";
import { ImprimirBotao } from "./imprimir-botao";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  await requirePermissao("arena.ver");
  const { slug } = await params;
  const carregada = await obterArenaBase(slug).catch(() => null);
  // Vira o nome sugerido do PDF ao imprimir.
  return { title: carregada ? `Mapa de montagem · ${carregada.arena.evento.nome}` : "Mapa de montagem" };
}

/** Mapa da arena para impressão/PDF (A4 paisagem): planta numerada, lista de pontos e o que ficou sem posição. */
export default async function ImpressaoArenaPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePermissao("arena.ver");
  const { slug } = await params;
  const carregada = await obterArenaBase(slug);
  if (!carregada) notFound();
  // Mesma arena da tela: planta importada + posições editadas pela logística. Sem a tabela de
  // posições (migração pendente), imprime a planta original em vez de derrubar a página.
  const posicoes = await listarPosicoesArena(slug).catch((e: unknown) => {
    console.error("Impressão da arena: não foi possível ler as posições editadas.", e);
    return [];
  });
  const arena = aplicarPosicoes(carregada.arena, posicoes);

  return (
    <div className="mx-auto w-[297mm] max-w-full bg-white p-[10mm] print:w-auto print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <ImprimirBotao />
      </div>
      <ImpressaoArena arena={arena} slug={slug} temPlanta={carregada.temPlanta} geradoEm={new Date()} />
    </div>
  );
}
