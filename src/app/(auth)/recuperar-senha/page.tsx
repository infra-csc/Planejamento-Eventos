"use client";

import { ActionForm } from "@/components/ui/action-form";
import Link from "next/link";
import { useActionState } from "react";
import { recuperarSenhaAction } from "../actions";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/layout";
import type { ActionResult } from "@/lib/action";

export default function RecuperarSenhaPage() {
  const [state, action] = useActionState(recuperarSenhaAction, { ok: true } as ActionResult<{ link: string | null }>);
  const enviado = state.ok && state.mensagem;
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <div>
        <h2 className="text-base font-semibold text-ink">Recuperar acesso</h2>
        <p className="text-[13px] text-ink-muted">Informe seu e-mail para gerar um link de redefinição de senha.</p>
      </div>
      {enviado ? (
        <div className="space-y-3">
          <Notice tone="success">{state.mensagem}</Notice>
          {state.dados?.link && (
            <Notice tone="info" title="Ambiente sem envio de e-mail">
              O link foi registrado no log do servidor. Para testar agora:{" "}
              <a href={state.dados.link} className="underline break-all">
                abrir link de redefinição
              </a>
              .
            </Notice>
          )}
        </div>
      ) : (
        <>
          <Field label="E-mail" htmlFor="email" error={!state.ok ? state.campos?.email : undefined}>
            <Input id="email" name="email" type="email" required autoFocus />
          </Field>
          <FormError message={!state.ok ? state.erro : null} />
          <SubmitButton className="w-full">Gerar link</SubmitButton>
        </>
      )}
      <p className="text-center text-[13px]">
        <Link href="/login" className="text-info hover:underline">
          Voltar para o login
        </Link>
      </p>
    </ActionForm>
  );
}
