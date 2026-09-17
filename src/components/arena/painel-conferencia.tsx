"use client";

import type { Arena, Divergencia } from "@/domain/arena/tipos";
import { CATEGORIAS, type Camada } from "@/domain/arena/categorias";
import { TAG_DIVERGENCIA } from "@/domain/arena/conferencia";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { IconeFechar } from "@/components/ui/icons";

/**
 * Conferência planta × ata: uma linha por divergência, planta e ata lado a lado.
 * Clicar realça no mapa e detalha aqui mesmo (não abre segunda gaveta); "Ver ficha" sai do modo.
 */
export function PainelConferencia({
  arena,
  divergencias,
  camadas,
  foco,
  onFocar,
  onVerFicha,
  onFechar,
}: {
  arena: Arena;
  divergencias: Divergencia[];
  camadas: Record<Camada, boolean>;
  foco: string | null;
  onFocar: (id: string) => void;
  onVerFicha: (pontoId: string) => void;
  onFechar: () => void;
}) {
  const nomes = new Map(arena.pontos.map((p) => [p.id, p]));
  const n = divergencias.length;
  return (
    <aside aria-labelledby="conferencia-titulo" className="pointer-events-auto absolute bottom-3 left-3 top-[60px] z-[22] flex w-[352px] flex-col overflow-hidden rounded-modal border border-warning-border bg-surface shadow-popover animate-fade-up-rapido">
      <header className="border-b border-line-soft bg-warning-bg px-4 py-[13px]">
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 id="conferencia-titulo" className="m-0 text-destaque font-semibold text-ink">
              Conferência planta × ata
            </h2>
            <p role="status" className="m-0 mt-[3px] text-pequeno leading-[1.45] text-warning">
              As duas fontes do evento discordam em {n} {n === 1 ? "ponto" : "pontos"}. Confirme antes de fechar a carga.
            </p>
          </div>
          <IconButton label="Fechar conferência" onClick={onFechar} className="text-warning">
            <IconeFechar />
          </IconButton>
        </div>
      </header>

      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {divergencias.map((d) => {
          const tag = TAG_DIVERGENCIA[d.tipo];
          const ativo = d.id === foco;
          const pontos = d.pontoIds.map((id) => nomes.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
          const camadaDesligada = pontos.length > 0 && pontos.every((p) => !camadas[CATEGORIAS[p.categoria].camada]);
          return (
            <li key={d.id} className={cn("border-b border-line-row", ativo ? "bg-selected shadow-[inset_3px_0_0_var(--color-accent)]" : "bg-surface")}>
              <button type="button" aria-pressed={ativo} onClick={() => onFocar(d.id)} className="block w-full cursor-pointer border-0 bg-transparent px-4 pb-2 pt-3 text-left hover:bg-subtle/60">
                <span className="flex items-baseline gap-2">
                  <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-chip px-1.5 py-px text-micro font-medium leading-[1.5]" style={{ background: tag.fundo, color: tag.cor }}>
                    {tag.rotulo}
                  </span>
                  <span className="min-w-0 flex-1 text-corpo font-medium text-ink">{d.titulo}</span>
                  {camadaDesligada && <span className="shrink-0 text-rotulo text-meta">camada desligada</span>}
                </span>
                <span className="mt-2 flex items-stretch overflow-hidden rounded-controle border border-line-soft">
                  <span className="min-w-0 flex-1 bg-subtle px-[9px] py-1.5">
                    <span className="block text-micro uppercase tracking-[0.06em] text-muted">{arena.fonte.rotuloPlanta}</span>
                    <span className="block font-mono text-corpo font-medium text-ink">{d.planta}</span>
                  </span>
                  <span aria-hidden className="w-px bg-line-soft" />
                  <span className="min-w-0 flex-1 bg-surface px-[9px] py-1.5">
                    <span className="block text-micro uppercase tracking-[0.06em] text-muted">{arena.fonte.rotuloAta}</span>
                    <span className="block font-mono text-corpo font-medium text-warning">{d.ata}</span>
                  </span>
                </span>
                <span className="mt-1.5 block text-pequeno leading-[1.45] text-ink-2">{d.texto}</span>
              </button>
              {ativo && (
                <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 px-4 pb-3">
                  {pontos.map((p) => (
                    <Button key={p.id} variant="link" size="sm" onClick={() => onVerFicha(p.id)}>
                      {pontos.length === 1 ? "Ver ficha completa do ponto" : `Ficha: ${p.nome}`}
                    </Button>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="m-0 border-t border-line-soft bg-subtle px-4 py-[9px] text-rotulo leading-[1.45] text-muted">Nada foi corrigido automaticamente. Resolver exige decidir qual fonte vale — planta ou ata.</p>
    </aside>
  );
}
