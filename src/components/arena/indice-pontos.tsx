"use client";

import type { Arena, CategoriaPonto } from "@/domain/arena/tipos";
import { CATEGORIAS, type Camada } from "@/domain/arena/categorias";
import { cn } from "@/lib/cn";
import { ChipMono } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { IconeFechar } from "@/components/ui/icons";

const ORDEM: CategoriaPonto[] = ["largada", "atleta", "medico", "hidratacao", "estrutura", "patrocinio", "cenografia", "operacao", "obstaculo"];

/** Índice navegável: responde "como encontro um ponto?" sem precisar saber o nome. */
export function IndicePontos({
  arena,
  camadas,
  selecionado,
  onEscolher,
  onFechar,
}: {
  arena: Arena;
  camadas: Record<Camada, boolean>;
  selecionado: string | null;
  onEscolher: (id: string) => void;
  onFechar: () => void;
}) {
  const grupos = ORDEM.map((c) => ({ categoria: c, pontos: arena.pontos.filter((p) => p.categoria === c) })).filter((g) => g.pontos.length);
  return (
    <nav aria-label="Pontos da arena" className="pointer-events-auto absolute bottom-3 left-3 top-[60px] z-20 flex w-[300px] flex-col overflow-hidden rounded-modal border border-line bg-surface shadow-popover animate-fade-up-rapido">
      <header className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
        <h2 className="m-0 flex flex-1 items-center gap-2 text-secao font-semibold text-ink">
          Pontos da arena <ChipMono tom="control">{arena.pontos.length}</ChipMono>
        </h2>
        <IconButton label="Fechar índice" onClick={onFechar}>
          <IconeFechar />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {grupos.map(({ categoria, pontos }) => {
          const cat = CATEGORIAS[categoria];
          const oculta = !camadas[cat.camada];
          return (
            <section key={categoria} className="px-2 pb-1 pt-2">
              <h3 className="m-0 flex items-center gap-2 px-2 pb-1 text-rotulo font-medium uppercase tracking-[0.08em] text-muted">
                <span aria-hidden className="block size-2 rounded-full" style={{ background: cat.cor }} />
                {cat.rotulo}
                {oculta && <span className="ml-auto normal-case tracking-normal text-meta">camada desligada</span>}
              </h3>
              <ul className="m-0 list-none p-0">
                {pontos.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-current={p.id === selecionado ? "true" : undefined}
                      onClick={() => onEscolher(p.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-baseline gap-2 rounded-controle border-0 bg-transparent px-2 py-1.5 text-left hover:bg-subtle",
                        p.id === selecionado && "bg-accent-bg hover:bg-accent-bg",
                        oculta && "opacity-60",
                      )}
                    >
                      <span className="numero w-12 shrink-0 text-rotulo text-meta">{p.legenda?.split(" ")[0] ?? "—"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-corpo text-ink">{p.nome}</span>
                        <span className="block truncate text-rotulo text-muted">{p.tipo}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="m-0 border-t border-line-soft bg-subtle px-4 py-2 text-rotulo text-muted">Clique para aproximar e abrir as informações.</p>
    </nav>
  );
}
