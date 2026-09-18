"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Filtro em lista suspensa que grava a escolha na URL (e volta para a primeira página).
 * O primeiro item é o "tudo": escolhê-lo tira o parâmetro da URL.
 */
export function SelectUrl({ param, opcoes, rotulo, className }: { param: string; opcoes: Array<{ value: string; label: string }>; rotulo: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const padrao = opcoes[0]?.value ?? "";
  const atual = sp.get(param) ?? padrao;

  const ir = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v && v !== padrao) q.set(param, v);
    else q.delete(param);
    q.delete("pagina");
    const s = q.toString();
    iniciar(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  return (
    <span className={cn("relative block w-full sm:w-auto", className)} aria-busy={pendente || undefined}>
      <select
        aria-label={rotulo}
        value={atual}
        onChange={(e) => ir(e.target.value)}
        className="h-[34px] w-full cursor-pointer appearance-none rounded-controle border border-line-control bg-surface pl-3 pr-9 text-corpo text-ink focus:border-accent focus:outline-none sm:min-w-[210px]"
      >
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}
