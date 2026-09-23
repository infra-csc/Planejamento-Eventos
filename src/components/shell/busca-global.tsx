"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChipMono } from "@/components/ui/badge";
import { Icone, Spinner } from "@/components/ui/icons";
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
  const [buscando, setBuscando] = useState(false);
  const [sel, setSel] = useState(0);
  const uid = useId();
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
      setBuscando(true);
      fetch(`/api/busca?q=${encodeURIComponent(termo)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { resultados: [] }))
        .then((d: { resultados: ResultadoBusca[] }) => {
          setResultados(d.resultados);
          setCarregado(true);
          setBuscando(false);
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
    setBuscando(false);
  };

  const abrir = (r: ResultadoBusca | undefined) => {
    if (!r) return;
    fechar();
    router.push(r.href);
  };

  const indice = Math.min(sel, Math.max(0, resultados.length - 1));
  const idOpcao = (i: number) => `${uid}-opcao-${i}`;

  // ↑ ↓ mudam o item ativo e o trazem para a área visível da lista (o mouse não rola nada).
  const mover = (novo: number) => {
    setSel(novo);
    requestAnimationFrame(() => listaRef.current?.querySelector<HTMLElement>(`[id="${idOpcao(novo)}"]`)?.scrollIntoView({ block: "nearest" }));
  };

  // Resultados em blocos contíguos por grupo, cada um com seu título (role="group" + aria-labelledby).
  const grupos: Array<{ nome: string; itens: Array<{ r: ResultadoBusca; i: number }> }> = [];
  resultados.forEach((r, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nome === r.grupo) ultimo.itens.push({ r, i });
    else grupos.push({ nome: r.grupo, itens: [{ r, i }] });
  });

  return (
    <DialogPrimitive.Root open={estaAberto} onOpenChange={(o) => (o ? definirAberto(true) : fechar())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-busca)] bg-scrim" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[14vh] z-[calc(var(--z-busca)+1)] w-[min(620px,92vw)] -translate-x-1/2 animate-fade-up-rapido overflow-hidden rounded-modal border border-line-strong bg-surface shadow-popover focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              mover(resultados.length ? (indice + 1) % resultados.length : 0);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              mover(resultados.length ? (indice - 1 + resultados.length) % resultados.length : 0);
            } else if (e.key === "Enter") {
              e.preventDefault();
              abrir(resultados[indice]);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Buscar ou executar</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Busque eventos, solicitações, peças e projetos, ou execute uma ação.</DialogPrimitive.Description>
          <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3.5">
            <Icone nome="busca" className="text-ink-3" />
            <input
              autoFocus
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setSel(0);
              }}
              placeholder="Buscar eventos, solicitações, peças, projetos — ou executar uma ação"
              aria-label="Buscar"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={resultados.length > 0}
              aria-controls={`${uid}-resultados`}
              aria-activedescendant={resultados.length > 0 ? idOpcao(indice) : undefined}
              className="flex-1 border-0 bg-transparent text-destaque text-ink outline-none placeholder:text-meta focus-visible:outline-none"
            />
            <span aria-hidden className={cn("text-ink-3 transition-opacity duration-150", buscando ? "opacity-100" : "opacity-0")}>
              <Spinner tamanho={14} />
            </span>
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
          <div id={`${uid}-resultados`} ref={listaRef} role="listbox" aria-label="Resultados da busca" className="max-h-[52vh] overflow-y-auto p-1.5">
            {grupos.map((g, gi) => (
              <div key={`${g.nome}-${gi}`} role="group" aria-labelledby={`${uid}-grupo-${gi}`}>
                <span id={`${uid}-grupo-${gi}`} className="block px-2.5 pb-1 pt-[9px] text-micro font-semibold uppercase tracking-[0.1em] text-meta">
                  {g.nome}
                </span>
                {g.itens.map(({ r, i }) => {
                  const ativo = i === indice;
                  return (
                    <button
                      key={`${r.href}-${i}`}
                      id={idOpcao(i)}
                      type="button"
                      role="option"
                      aria-selected={ativo}
                      // O foco fica no campo (aria-activedescendant); as opções não entram no Tab.
                      tabIndex={-1}
                      onClick={() => abrir(r)}
                      onMouseEnter={() => setSel(i)}
                      className={cn("flex w-full cursor-pointer items-center gap-3 rounded-controle border-0 px-2.5 py-[9px] text-left max-md:min-h-11", ativo ? "bg-accent-bg" : "bg-transparent")}
                    >
                      <ChipMono tom={r.tag === "ação" ? "accent" : "control"} className="shrink-0 uppercase tracking-wider">
                        {r.tag}
                      </ChipMono>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-corpo font-medium text-ink">{r.titulo}</span>
                        <span className="block truncate text-pequeno text-muted">{r.sub}</span>
                      </span>
                      <span aria-hidden className="font-mono text-rotulo text-meta">
                        {ativo ? "↵" : (r.atalho ?? "")}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {carregado && termo.trim() && resultados.length === 0 && <EmptyState compact title={`Nada encontrado para “${termo.trim()}”`} description="Tente o código (SOL-0001, EVT-0002) ou outra palavra do nome." />}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
