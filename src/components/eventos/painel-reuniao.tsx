"use client";

import { useEffect, useState } from "react";
import { EVENTO_REGISTRAR_PRESENTES } from "./conferencia-ata";
import { TabsControladas } from "@/components/ui/tabs-nav";
import { DadosReuniaoForm, type DadosReuniaoValores } from "./dados-reuniao-form";
import { ObservacoesAutosave } from "./observacoes-autosave";

/**
 * Painel da conferência: dados da reunião (presentes, público, carga) e observações.
 * Em telas largas fica fixo ao lado da ata; nas demais vem logo abaixo dela.
 */
export function PainelReuniao({ eventoId, resumo, presentesOk, valores, observacoes }: { eventoId: string; resumo: string; presentesOk: boolean; valores: DadosReuniaoValores; observacoes: string }) {
  const [aberto, setAberto] = useState<"dados" | "obs">("dados");
  // "Falta registrar os presentes": abre a aba de dados, rola até o campo e põe o foco nele.
  useEffect(() => {
    const ir = () => {
      setAberto("dados");
      requestAnimationFrame(() => {
        const campo = document.getElementById("reuniaoPresentes");
        if (!campo) return;
        campo.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        campo.focus({ preventScroll: true });
      });
    };
    window.addEventListener(EVENTO_REGISTRAR_PRESENTES, ir);
    return () => window.removeEventListener(EVENTO_REGISTRAR_PRESENTES, ir);
  }, []);
  return (
    <aside aria-label="Dados da reunião" className="overflow-hidden rounded-cartao border border-line bg-surface xl:sticky xl:top-topo-fixo">
      <TabsControladas
        rotulo="Painel da reunião"
        valor={aberto}
        onChange={setAberto}
        className="!mb-0 px-2"
        abas={[
          { chave: "dados", label: "Dados da reunião", tom: presentesOk ? undefined : "warning" },
          { chave: "obs", label: "Observações" },
        ]}
      />
      {aberto === "dados" ? (
        <>
          <p className="numero m-0 px-cartao pt-3 text-pequeno text-muted">{resumo}</p>
          <DadosReuniaoForm eventoId={eventoId} valores={valores} editavel />
        </>
      ) : (
        <div className="px-cartao py-3.5">
          <ObservacoesAutosave eventoId={eventoId} valor={observacoes} />
        </div>
      )}
    </aside>
  );
}
