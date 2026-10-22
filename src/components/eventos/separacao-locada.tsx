"use client";

import { useState, useTransition } from "react";
import { Section } from "@/components/ui/layout";
import { Checkbox } from "@/components/ui/field";
import { toastErro, toastSucesso } from "@/components/ui/toast";
import { salvarSeparacaoAction } from "@/app/(app)/eventos/actions";

/**
 * Folha de separação do evento (admin e logística): com a estrutura locada no local, box Q30, tendas e
 * estaiamento não saem na folha impressa; o box Q15 também, se marcado. A OS e os Excel continuam com tudo.
 */
export function SeparacaoLocada({ eventoId, inicial }: { eventoId: string; inicial: { locada: boolean; q15Locado: boolean } }) {
  const [valor, setValor] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  const salvar = (novo: { locada: boolean; q15Locado: boolean }) => {
    const antes = valor;
    setValor(novo);
    iniciar(async () => {
      const r = await salvarSeparacaoAction(eventoId, novo.locada, novo.locada && novo.q15Locado);
      if (!r.ok) {
        setValor(antes);
        return toastErro(r.erro);
      }
      toastSucesso(novo.locada ? `Folha sem box Q30, tendas e estaiamento${novo.q15Locado ? " e sem box Q15" : ""}` : "Folha volta a sair com toda a estrutura");
    });
  };
  return (
    <Section titulo="Folha de separação" sub="O que é locado no local não sai na folha impressa. A OS e os Excel continuam com tudo.">
      <div className="flex flex-col gap-1 px-cartao py-3" aria-busy={pendente || undefined}>
        <Checkbox
          id="estrutura-locada"
          label="Estrutura locada no local"
          description="Box truss Q30, peças de tenda e estaiamento não saem na folha."
          checked={valor.locada}
          onChange={(v) => salvar({ locada: v, q15Locado: v && valor.q15Locado })}
        />
        {valor.locada && (
          <div className="pl-6">
            <Checkbox id="q15-locado" label="Box Q15 também é locado" description="Sem marcar, o box Q15 continua na folha." checked={valor.q15Locado} onChange={(v) => salvar({ locada: true, q15Locado: v })} />
          </div>
        )}
      </div>
    </Section>
  );
}
