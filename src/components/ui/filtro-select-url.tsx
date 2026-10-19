"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { Select, type OpcaoSelect } from "./select";
import { useSinalizarNavegacao } from "./navegacao";

/**
 * Filtro de lista que grava `?param=` na URL (área, tipo, data da reunião…) e zera a paginação, como o
 * filtro de evento. A primeira opção, de valor vazio, tira o filtro ("Todas as áreas").
 */
export function FiltroSelectUrl({ param, opcoes, rotulo, todas, className }: { param: string; opcoes: OpcaoSelect[]; rotulo: string; todas: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  useSinalizarNavegacao(pendente);
  const atual = sp.get(param) ?? "";

  const ir = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(param, v);
    else q.delete(param);
    q.delete("pagina");
    const s = q.toString();
    iniciar(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  return (
    <div className={cn("w-full sm:w-[168px] sm:shrink-0", className)} aria-busy={pendente || undefined}>
      <Select
        value={opcoes.some((o) => o.value === atual) ? atual : ""}
        onValueChange={ir}
        aria-label={rotulo}
        ordenarAlfabetico={false}
        className={cn(atual && "border-accent text-accent")}
        opcoes={[{ value: "", label: todas }, ...opcoes]}
      />
    </div>
  );
}
