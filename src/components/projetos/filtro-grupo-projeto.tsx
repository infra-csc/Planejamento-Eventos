"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { useSinalizarNavegacao } from "@/components/ui/navegacao";
import type { GrupoProjetoOpcao } from "./grupo-projeto-field";

export function FiltroGrupoProjeto({ grupos }: { grupos: GrupoProjetoOpcao[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  useSinalizarNavegacao(pendente);
  const valor = sp.get("grupo") ?? "";
  const ir = (grupo: string) => {
    const q = new URLSearchParams(sp.toString());
    if (grupo) q.set("grupo", grupo);
    else q.delete("grupo");
    q.delete("pagina");
    q.delete("p");
    const s = q.toString();
    iniciar(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto" aria-busy={pendente || undefined}>
      <label htmlFor="filtro-grupo-projeto" className="sr-only">Filtrar por grupo da biblioteca</label>
      <Select
        id="filtro-grupo-projeto"
        aria-label="Filtrar por grupo da biblioteca"
        value={valor}
        onValueChange={ir}
        ordenarAlfabetico={false}
        className="w-full min-w-[190px] sm:w-[230px]"
        opcoes={[
          { value: "", label: "Todos os grupos" },
          { value: "padrao", label: "Padrão" },
          ...grupos.map((g) => ({ value: g.id, label: g.nome })),
        ]}
      />
    </div>
  );
}
