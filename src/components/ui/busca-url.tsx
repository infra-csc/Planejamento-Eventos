"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Icone, Spinner } from "./icons";
import { useSinalizarNavegacao } from "./navegacao";

/**
 * Campo de busca que grava o termo na URL (com debounce) e volta para a primeira página.
 * Assim a busca sobrevive a recarregar a página e pode ser compartilhada por link.
 */
export function BuscaUrl({ param = "q", placeholder, ariaLabel, className, largura = 280 }: { param?: string; placeholder: string; ariaLabel?: string; className?: string; largura?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [valor, setValor] = useState(params.get(param) ?? "");
  const [pendente, iniciar] = useTransition();
  useSinalizarNavegacao(pendente);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sai da tela antes do debounce vencer: não navega depois de desmontado.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const aplicar = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v.trim()) next.set(param, v.trim());
    else next.delete(param);
    next.delete("pagina");
    const qs = next.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div className={cn("relative w-full min-w-0 sm:w-[var(--busca-largura)] sm:shrink-0", className)} style={{ "--busca-largura": `${largura}px` } as React.CSSProperties}>
      <Icone nome="busca" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={valor}
        aria-label={ariaLabel ?? placeholder}
        aria-busy={pendente || undefined}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setValor(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => aplicar(v), 280);
        }}
        className="h-[34px] w-full min-w-0 rounded-controle border border-line-control bg-surface pl-9 pr-8 text-corpo text-ink transition-colors duration-150 placeholder:text-meta hover:border-ink-3 focus:border-accent focus:outline-none max-md:h-10 [&::-webkit-search-cancel-button]:cursor-pointer"
      />
      {/* Enquanto a lista filtrada carrega. */}
      <span aria-hidden className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 transition-opacity duration-150", pendente ? "opacity-100 delay-100" : "opacity-0")}>
        <Spinner tamanho={14} />
      </span>
    </div>
  );
}
