"use client";

import { ActionForm } from "@/components/ui/action-form";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "../actions";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/layout";
import { ESTADO_INICIAL } from "@/lib/action";

export function LoginForm({ next, redefinida }: { next: string; redefinida: boolean }) {
  const [state, action] = useActionState(loginAction, ESTADO_INICIAL);
  const campos = !state.ok ? state.campos : undefined;
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <h2 className="text-base font-semibold text-ink">Entrar</h2>
        <p className="text-[13px] text-ink-muted">Use o e-mail e a senha cadastrados pelo administrador.</p>
      </div>
      {redefinida && <Notice tone="success">Senha redefinida. Entre com a nova senha.</Notice>}
      <Field label="E-mail" htmlFor="email" error={campos?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="voce@nortemkt.com.br" />
      </Field>
      <Field label="Senha" htmlFor="senha" error={campos?.senha}>
        <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </Field>
      <FormError message={!state.ok ? state.erro : null} />
      <SubmitButton className="w-full">Entrar</SubmitButton>
      <p className="text-center text-[13px]">
        <Link href="/recuperar-senha" className="text-info hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </ActionForm>
  );
}
