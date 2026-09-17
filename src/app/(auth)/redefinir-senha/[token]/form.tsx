"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { redefinirSenhaAction } from "../../actions";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { ESTADO_INICIAL } from "@/lib/action";

export function RedefinirForm({ token }: { token: string }) {
  const [state, action] = useActionState(redefinirSenhaAction, ESTADO_INICIAL);
  const campos = !state.ok ? state.campos : undefined;
  return (
    <>
      <h2 className="mb-1.5 mt-0 text-pagina font-semibold tracking-[-0.02em]">Defina sua senha</h2>
      <p className="mb-7 mt-0 text-secao text-ink-3">Mínimo de 8 caracteres. O link vale uma única vez.</p>
      <ActionForm action={action} noValidate>
        <input type="hidden" name="token" value={token} />
        <Field label="Nova senha" htmlFor="senha" error={campos?.senha}>
          <Input id="senha" name="senha" type="password" autoComplete="new-password" required autoFocus />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirmacao" error={campos?.confirmacao} className="mt-4">
          <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
        </Field>
        <div className="mt-5 flex flex-col gap-3">
          <FormError message={!state.ok && !campos ? state.erro : null} />
          <SubmitButton size="full">Salvar senha</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
