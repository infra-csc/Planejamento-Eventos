"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { salvarObservacoesAction } from "@/app/(app)/eventos/actions";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";

export function ObservacoesForm({ eventoId, valor, disabled }: { eventoId: string; valor: string; disabled?: boolean }) {
  const [state, action] = useActionState(salvarObservacoesAction, ESTADO_INICIAL);
  useActionFeedback(state);
  return (
    <ActionForm action={action} className="space-y-2">
      <input type="hidden" name="eventoId" value={eventoId} />
      <Textarea name="observacoes" defaultValue={valor} disabled={disabled} className="min-h-28" placeholder="Ex.: Participaram produção, cenografia e ativação. Pórtico principal fica na entrada norte." aria-label="Observações da reunião" />
      {!disabled && (
        <div className="flex justify-end">
          <SubmitButton size="sm" variant="secondary">
            Salvar observações
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
