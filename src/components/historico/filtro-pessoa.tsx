"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ComboBox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { useSinalizarNavegacao } from "@/components/ui/navegacao";

/** Filtro "quem fez" do histórico: campo com busca por nome, escreve `?quem=` e zera a paginação. */
export function FiltroPessoa({ pessoas }: { pessoas: Array<{ id: string; nome: string; perfil: string; n: number }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  useSinalizarNavegacao(pendente);
  const atual = sp.get("quem");

  const ir = (id: string | null) => {
    const q = new URLSearchParams(sp.toString());
    if (id) q.set("quem", id);
    else q.delete("quem");
    q.delete("pagina");
    const s = q.toString();
    iniciar(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto" aria-busy={pendente || undefined}>
      <label htmlFor="filtro-pessoa" className="sr-only">
        Quem fez
      </label>
      <ComboBox
        id="filtro-pessoa"
        value={atual}
        onChange={(v) => ir(v)}
        placeholder="Todas as pessoas — buscar por nome"
        className="w-full min-w-0 flex-1 sm:w-[300px] sm:flex-none"
        opcoes={pessoas.map((p) => ({ value: p.id, label: p.nome, descricao: p.perfil, selo: String(p.n), seloTom: "muted" as const }))}
      />
      {atual && (
        <Button variant="link" size="sm" onClick={() => ir(null)}>
          Limpar
        </Button>
      )}
    </div>
  );
}
