"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { salvarConfigAction } from "@/app/(app)/admin/actions";
import { SubmitButton } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/layout";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";

export function ConfigForm({ valores }: { valores: { sla_resposta_horas: string; lembrete_reuniao_dias: string; bloquear_encerramento_com_pendentes: string } }) {
  const [state, action] = useActionState(salvarConfigAction, ESTADO_INICIAL);
  useActionFeedback(state);
  const c = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} className="mx-auto max-w-2xl space-y-4" noValidate>
      <Panel title="Prazos" description="Decisões marcadas como REGRA A VALIDAR na especificação; ajuste conforme o time decidir.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prazo de resposta a solicitações (horas corridas)" htmlFor="sla" error={c?.sla_resposta_horas} hint="Slide 12 sugere 48 h (RV-16).">
            <Input id="sla" name="sla_resposta_horas" type="number" min={1} max={720} defaultValue={valores.sla_resposta_horas} />
          </Field>
          <Field label="Lembrete de reunião (dias antes)" htmlFor="lembrete" error={c?.lembrete_reuniao_dias} hint="Áreas que ainda não enviaram necessidades são avisadas.">
            <Input id="lembrete" name="lembrete_reuniao_dias" type="number" min={0} max={30} defaultValue={valores.lembrete_reuniao_dias} />
          </Field>
        </div>
      </Panel>
      <Panel title="Encerramento">
        <Checkbox
          id="bloquear"
          name="bloquear_encerramento_com_pendentes"
          label="Bloquear encerramento com solicitações sem resposta"
          description="RV-13. Desmarcado, a logística pode encerrar mesmo com itens em análise (eles ficam pendentes para sempre — não recomendado)."
          defaultChecked={valores.bloquear_encerramento_com_pendentes === "true"}
        />
      </Panel>
      <FormError message={!state.ok ? state.erro : null} />
      <div className="flex justify-end">
        <SubmitButton>Salvar configurações</SubmitButton>
      </div>
    </ActionForm>
  );
}
