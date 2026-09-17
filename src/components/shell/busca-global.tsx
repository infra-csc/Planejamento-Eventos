"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChipMono } from "@/components/ui/badge";
import { IconeLupa } from "@/components/ui/icons";
import { EmptyState, Kbd } from "@/components/ui/layout";
import type { ResultadoBusca } from "@/server/services/busca";

let aberto = false;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

export function abrirBuscaGlobal() {
  aberto = true;
  emitir();
}
function definirAberto(v: boolean) {
  aberto = v;
  emitir();
}

/**
 * Busca global ⌘K (handoff §5.16): resultados agrupados, ↑ ↓ navegar, ↵ abrir, esc fechar.
 * Os resultados vêm do servidor já filtrados pelas permissões do usuário.
 */
export function BuscaGlobal() {
  const router = useRouter();
  const estaAberto = useSyncExternalStore(
    assinar,
    () => aberto,
    () => false,
  );
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [sel, setSel] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        definirAberto(!aberto);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!estaAberto) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/busca?q=${encodeURIComponent(termo)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { resultados: [] }))
        .then((d: { resultados: ResultadoBusca[] }) => {
          setResultados(d.resultados);
          setCarregado(true);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [termo, estaAberto]);

  const fechar = () => {
    definirAberto(false);
    setTermo("");
    setSel(0);
    setCarregado(false);
  };

  const abrir = (r: ResultadoBusca | undefined) => {
    if (!r) return;
    fechar();
    router.push(r.href);
  };

  const indice = Math.min(sel, Math.max(0, resultados.length - 1));

  return (
    <DialogPrimitive.Root open={estaAberto} onOpenChange={(o) => (o ? definirAberto(true) : fechar())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-busca)] bg-black/40" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[14vh] z-[calc(var(--z-busca)+1)] w-[min(620px,92vw)] -translate-x-1/2 animate-fade-up-rapido overflow-hidden rounded-modal border border-line-strong bg-surface shadow-popover focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel(resultados.length ? (indice + 1) % resultados.length : 0);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel(resultados.length ? (indice - 1 + resultados.length) % resultados.length : 0);
            } else if (e.key === "Enter") {
              e.preventDefault();
              abrir(resultados[indice]);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Buscar ou executar</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Busque eventos, solicitações, peças e projetos, ou execute uma ação.</DialogPrimitive.Description>
          <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3.5">
            <IconeLupa size={16} className="shrink-0 text-muted" />
            <input
              autoFocus
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setSel(0);
              }}
              placeholder="Buscar eventos, solicitações, peças, projetos — ou executar uma ação"
              aria-label="Buscar"
              aria-controls="busca-resultados"
              className="flex-1 border-0 bg-transparent text-destaque text-ink outline-none placeholder:text-meta focus-visible:outline-none"
            />
            <Kbd>esc</Kbd>
          </div>
          <div className="flex gap-4 border-b border-line-row px-4 py-[7px] text-rotulo text-meta">
            <span>
              <span className="font-mono">↑ ↓</span> navegar
            </span>
            <span>
              <span className="font-mono">↵</span> abrir
            </span>
            <span>
              <span className="font-mono">esc</span> fechar
            </span>
          </div>
          <div id="busca-resultados" ref={listaRef} role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
            {resultados.map((r, i) => {
              const novoGrupo = i === 0 || resultados[i - 1].grupo !== r.grupo;
              const ativo = i === indice;
              return (
                <div key={`${r.href}-${i}`}>
                  {novoGrupo && <span className="block px-2.5 pb-1 pt-[9px] text-micro font-semibold uppercase tracking-[0.1em] text-meta">{r.grupo}</span>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    onClick={() => abrir(r)}
                    onMouseEnter={() => setSel(i)}
                    className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 px-2.5 py-[9px] text-left", ativo ? "bg-accent-bg" : "bg-transparent")}
                  >
                    <ChipMono tom={r.tag === "ação" ? "accent" : "control"} className="shrink-0 uppercase tracking-wider">
                      {r.tag}
                    </ChipMono>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-corpo font-medium text-ink">{r.titulo}</span>
                      <span className="block truncate text-pequeno text-muted">{r.sub}</span>
                    </span>
                    <span className="font-mono text-rotulo text-meta">{ativo ? "↵" : r.atalho ?? ""}</span>
                  </button>
                </div>
              );
            })}
            {carregado && termo.trim() && resultados.length === 0 && <EmptyState compact title={`Nada encontrado para “${termo.trim()}”.`} />}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
