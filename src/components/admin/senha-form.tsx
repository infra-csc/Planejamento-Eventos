"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState, useRef } from "react";
import { alterarSenhaAction } from "@/app/(app)/perfil/actions";
import { SubmitButton } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { useActionFeedback } from "@/components/ui/use-action-feedback";
import { ESTADO_INICIAL } from "@/lib/action";

export function SenhaForm() {
  const [state, action] = useActionState(alterarSenhaAction, ESTADO_INICIAL);
  const ref = useRef<HTMLFormElement>(null);
  useActionFeedback(state, () => ref.current?.reset());
  const c = !state.ok ? state.campos : undefined;
  return (
    <ActionForm ref={ref} action={action} className="max-w-sm space-y-4" noValidate>
      <Field label="Senha atual" htmlFor="senhaAtual" error={c?.senhaAtual}>
        <Input id="senhaAtual" name="senhaAtual" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Nova senha" htmlFor="senha" error={c?.senha} hint="Mínimo de 8 caracteres.">
        <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="confirmacao" error={c?.confirmacao}>
        <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
      </Field>
      <FormError message={!state.ok && !c ? state.erro : null} />
      <SubmitButton>Alterar senha</SubmitButton>
    </ActionForm>
  );
}
