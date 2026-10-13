"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useSinalizarNavegacao } from "@/components/ui/navegacao";
import { OPCOES_ALTERACAO } from "@/lib/filtro-alteracao";

/** Troca parâmetros da URL, volta para a 1ª página e fecha o detalhe aberto. */
function useFiltroUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  useSinalizarNavegacao(pendente);
  const aplicar = (mudar: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(mudar)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.delete("pagina");
    q.delete("p");
    const s = q.toString();
    iniciar(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  return { sp, pendente, aplicar };
}

/** Filtro pela data da última alteração do cadastro (atalhos ou período de/até). */
export function FiltroAlteracao() {
  const { sp, pendente, aplicar } = useFiltroUrl();
  const atual = sp.get("alterado") ?? "";
  const [escolha, setEscolha] = useState(atual);
  const [de, setDe] = useState(sp.get("alteradoDe") ?? "");
  const [ate, setAte] = useState(sp.get("alteradoAte") ?? "");
  const periodo = escolha === "periodo";
  const periodoMudou = de !== (sp.get("alteradoDe") ?? "") || ate !== (sp.get("alteradoAte") ?? "") || atual !== "periodo";

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto" aria-busy={pendente || undefined}>
      <Select
        id="filtro-alteracao"
        aria-label="Filtrar por data de alteração"
        value={escolha}
        ordenarAlfabetico={false}
        className="w-full min-w-[190px] sm:w-[250px]"
        onValueChange={(v) => {
          setEscolha(v);
          if (v !== "periodo") aplicar({ alterado: v || null, alteradoDe: null, alteradoAte: null });
        }}
        opcoes={[{ value: "", label: "Alterados em qualquer data" }, ...OPCOES_ALTERACAO]}
      />
      {periodo && (
        <form
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            if (de || ate) aplicar({ alterado: "periodo", alteradoDe: de || null, alteradoAte: ate || null });
          }}
        >
          <label htmlFor="filtro-alterado-de" className="text-pequeno text-ink-3">De</label>
          <Input id="filtro-alterado-de" type="date" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} className="w-[150px]" />
          <label htmlFor="filtro-alterado-ate" className="text-pequeno text-ink-3">até</label>
          <Input id="filtro-alterado-ate" type="date" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} className="w-[150px]" />
          <Button type="submit" variant="secondary" size="sm" disabled={pendente || (!de && !ate) || !periodoMudou}>
            Aplicar
          </Button>
        </form>
      )}
    </div>
  );
}

/** Só para quem gerencia: por padrão a lista mostra só os ativos; dá para incluir ou ver só os inativos. */
export function FiltroSituacao({ feminino = false }: { feminino?: boolean }) {
  const { sp, pendente, aplicar } = useFiltroUrl();
  const sufixo = feminino ? "as" : "os";
  return (
    <div className="flex w-full min-w-0 items-center sm:w-auto" aria-busy={pendente || undefined}>
      <Select
        id="filtro-situacao"
        aria-label="Filtrar por situação"
        value={sp.get("situacao") === "todos" || sp.get("situacao") === "inativos" ? sp.get("situacao")! : ""}
        ordenarAlfabetico={false}
        className="w-full min-w-[170px] sm:w-[190px]"
        onValueChange={(v) => aplicar({ situacao: v || null })}
        opcoes={[
          { value: "", label: `Só ativ${sufixo}` },
          { value: "todos", label: `Ativ${sufixo} e inativ${sufixo}` },
          { value: "inativos", label: `Só inativ${sufixo}` },
        ]}
      />
    </div>
  );
}
