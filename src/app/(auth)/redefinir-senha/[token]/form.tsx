"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { redefinirSenhaAction } from "../../actions";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { ESTADO_INICIAL } from "@/lib/action";

const campo = "h-[42px] w-full rounded-lg border border-line-strong bg-surface px-3 text-[14.5px] text-ink focus:border-accent focus:outline-none aria-[invalid=true]:border-danger-input";

export function RedefinirForm({ token }: { token: string }) {
  const [state, action] = useActionState(redefinirSenhaAction, ESTADO_INICIAL);
  const campos = !state.ok ? state.campos : undefined;
  return (
    <>
      <h2 className="mb-1.5 mt-0 text-[24px] font-semibold tracking-[-0.02em]">Defina sua senha</h2>
      <p className="mb-7 mt-0 text-[14px] text-ink-3">Mínimo de 8 caracteres. O link vale uma única vez.</p>
      <ActionForm action={action} noValidate>
        <input type="hidden" name="token" value={token} />
        <label htmlFor="senha" className="mb-1.5 block text-[13px] font-medium text-ink-2">
          Nova senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" required autoFocus aria-invalid={Boolean(campos?.senha)} className={campo} />
        {campos?.senha && <span className="mt-[5px] block text-[12px] text-danger">{campos.senha}</span>}
        <label htmlFor="confirmacao" className="mb-1.5 mt-4 block text-[13px] font-medium text-ink-2">
          Confirmar senha
        </label>
        <input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required aria-invalid={Boolean(campos?.confirmacao)} className={campo} />
        {campos?.confirmacao && <span className="mt-[5px] block text-[12px] text-danger">{campos.confirmacao}</span>}
        <div className="mt-5 flex flex-col gap-3">
          <FormError message={!state.ok && !campos ? state.erro : null} />
          <SubmitButton size="full">Salvar senha</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
