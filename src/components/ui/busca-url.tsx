"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";

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
      className={cn("h-[34px] w-full min-w-0 rounded-controle border border-line-control bg-surface px-3 text-corpo text-ink placeholder:text-meta focus:border-accent focus:outline-none sm:w-[var(--busca-largura)] sm:shrink-0", className)}
      style={{ "--busca-largura": `${largura}px` } as React.CSSProperties}
    />
  );
}
