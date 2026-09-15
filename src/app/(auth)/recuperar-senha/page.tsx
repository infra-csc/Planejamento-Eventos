"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { recuperarSenhaAction } from "../actions";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { Aviso } from "@/components/ui/layout";
import { ESTADO_INICIAL } from "@/lib/action";

export default function RecuperarSenhaPage() {
  const [state, action] = useActionState(recuperarSenhaAction, ESTADO_INICIAL);
  const enviado = state.ok && state.mensagem;
  const erroEmail = !state.ok ? state.campos?.email : undefined;
  return (
    <>
      <title>Recuperar acesso · Norte Mkt</title>
      <h2 className="mb-1.5 mt-0 text-[24px] font-semibold tracking-[-0.02em]">Recuperar acesso</h2>
      <p className="mb-7 mt-0 text-[14px] text-ink-3">Informe seu e-mail. O administrador do sistema recebe o pedido e envia um novo link de acesso para você.</p>
      {enviado ? (
        <Aviso tom="success">{state.mensagem}</Aviso>
      ) : (
        <ActionForm action={action} noValidate>
          <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink-2">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            aria-invalid={Boolean(erroEmail)}
            aria-describedby={erroEmail ? "erro-email" : undefined}
            className="h-[42px] w-full rounded-lg border border-line-control bg-surface px-3 text-[14.5px] text-ink focus:border-accent focus:outline-none aria-[invalid=true]:border-danger-input"
          />
          {erroEmail && (
            <span id="erro-email" className="mt-[5px] block text-[12px] text-danger">
              {erroEmail}
            </span>
          )}
          <div className="mt-5 flex flex-col gap-3">
            <FormError message={!state.ok && !state.campos ? state.erro : null} />
            <SubmitButton size="full">Pedir novo acesso</SubmitButton>
          </div>
        </ActionForm>
      )}
      <p className="mb-0 mt-4 text-center text-[13.5px]">
        <Link href="/login" className="link">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
