"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { limparCliqueNavegacao, marcarCliqueNavegacao, useNavegacaoPendente } from "@/components/ui/navegacao";

/** Link interno que leva a outra página/URL (nem nova aba, nem download, nem só âncora, nem /api). */
function linkNavegavel(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement)) return false;
  if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * Barra fina no topo durante navegações (docs/design-system.md § Carregamento).
 * Liga com: clique em link interno (capturado aqui) e as fontes registradas em navegacao.ts
 * (abas, pílulas, paginação, ordenação, linha clicável, busca e filtro na URL).
 * Desliga quando a URL muda. Só aparece se passar de 120 ms, para não piscar em navegação rápida.
 */
export function BarraNavegacao() {
  const pathname = usePathname();
  const params = useSearchParams();
  const chave = `${pathname}?${params.toString()}`;
  const pendente = useNavegacaoPendente();
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    limparCliqueNavegacao();
  }, [chave]);

  useEffect(() => {
    // Fase de captura: o <Link> do Next cancela o evento (navegação no cliente) antes de chegar à bolha.
    const aoClicar = (e: MouseEvent) => {
      if (linkNavegavel(e)) marcarCliqueNavegacao();
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setVisivel(pendente), pendente ? 120 : 0);
    return () => clearTimeout(t);
  }, [pendente]);

  return (
    <div aria-hidden className={cn("no-print pointer-events-none fixed inset-x-0 top-0 z-[var(--z-progresso)] h-0.5 overflow-hidden transition-opacity duration-150", visivel ? "opacity-100" : "opacity-0")}>
      <div className={cn("h-full w-2/5 bg-accent motion-reduce:w-full motion-reduce:opacity-60", visivel && "animate-progresso motion-reduce:animate-none")} />
    </div>
  );
}
