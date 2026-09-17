"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { DadosReuniaoForm, type DadosReuniaoValores } from "./dados-reuniao-form";
import { ObservacoesAutosave } from "./observacoes-autosave";

/**
 * Painel lateral da conferência: dados da reunião (presentes, público, carga) e observações.
 * Em telas largas fica fixo ao lado; nas demais vira um bloco recolhível abaixo da ata.
 */
export function PainelReuniao({ eventoId, resumo, presentesOk, valores, observacoes }: { eventoId: string; resumo: string; presentesOk: boolean; valores: DadosReuniaoValores; observacoes: string }) {
  const [aberto, setAberto] = useState<"dados" | "obs">("dados");
  return (
    <aside className="overflow-hidden rounded-[10px] border border-line bg-surface 2xl:sticky 2xl:top-[76px]">
      <div className="flex border-b border-line-soft" role="tablist" aria-label="Painel da reunião">
        {(
          [
            ["dados", presentesOk ? "Dados da reunião" : "Dados da reunião · falta presentes"],
            ["obs", "Observações"],
          ] as const
        ).map(([k, rotulo]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={aberto === k}
            onClick={() => setAberto(k)}
            className={cn("-mb-px flex-1 cursor-pointer border-0 border-b-2 bg-transparent px-3 py-2.5 text-[13px]", aberto === k ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink", k === "dados" && !presentesOk && aberto !== k && "text-warning")}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {aberto === "dados" ? (
        <>
          <p className="m-0 px-[18px] pt-3 text-[12.5px] text-muted">{resumo}</p>
          <DadosReuniaoForm eventoId={eventoId} valores={valores} editavel />
        </>
      ) : (
        <div className="px-[18px] py-3.5">
          <ObservacoesAutosave eventoId={eventoId} valor={observacoes} />
        </div>
      )}
    </aside>
  );
}
