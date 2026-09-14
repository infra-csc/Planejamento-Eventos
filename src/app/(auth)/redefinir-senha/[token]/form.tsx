"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useActionState } from "react";
import { redefinirSenhaAction } from "../../actions";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { ESTADO_INICIAL } from "@/lib/action";

export function RedefinirForm({ token }: { token: string }) {
  const [state, action] = useActionState(redefinirSenhaAction, ESTADO_INICIAL);
  const campos = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <div>
        <h2 className="text-base font-semibold text-ink">Nova senha</h2>
        <p className="text-[13px] text-ink-muted">Mínimo de 8 caracteres.</p>
      </div>
      <Field label="Nova senha" htmlFor="senha" error={campos?.senha}>
        <Input id="senha" name="senha" type="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Field label="Confirmar senha" htmlFor="confirmacao" error={campos?.confirmacao}>
        <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
      </Field>
      <FormError message={!state.ok ? state.erro : null} />
      <SubmitButton className="w-full">Salvar nova senha</SubmitButton>
    </ActionForm>
  );
}
