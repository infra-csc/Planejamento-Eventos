"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ComboBox } from "./combobox";
import { Button } from "./button";

/**
 * Filtro por evento que aguenta centenas de eventos: campo com busca (nome ou código) em vez de
 * uma fileira de pílulas. Escreve `?evento=` na URL e zera a paginação; "Limpar" tira o filtro.
 */
export function FiltroEvento({ eventos, param = "evento", rotulo = "Evento", rotuloOculto = false }: { eventos: Array<{ id: string; codigo: string; nome: string; n?: number }>; param?: string; rotulo?: string; rotuloOculto?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const atual = sp.get(param);

  const ir = (id: string | null) => {
    const q = new URLSearchParams(sp.toString());
    if (id) q.set(param, id);
    else q.delete(param);
    q.delete("pagina");
    const s = q.toString();
    iniciar(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto" aria-busy={pendente || undefined}>
      <label htmlFor="filtro-evento" className={rotuloOculto ? "sr-only" : "shrink-0 text-pequeno text-ink-3"}>
        {rotulo}
      </label>
      <ComboBox
        id="filtro-evento"
        value={atual}
        onChange={(v) => ir(v)}
        placeholder="Todos os eventos — buscar por nome ou código"
        className="w-full min-w-0 flex-1 sm:w-[420px] sm:flex-none"
        opcoes={eventos.map((e) => ({ value: e.id, label: e.nome, descricao: e.codigo, selo: e.n != null ? String(e.n) : undefined, seloTom: "muted" as const }))}
      />
      {atual && (
        <Button variant="link" size="sm" onClick={() => ir(null)}>
          Limpar
        </Button>
      )}
    </div>
  );
}
