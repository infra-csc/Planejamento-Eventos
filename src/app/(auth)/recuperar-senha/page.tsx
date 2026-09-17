"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { recuperarSenhaAction } from "../actions";
import { Field, FormError, Input } from "@/components/ui/field";
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
      <h2 className="mb-1.5 mt-0 text-pagina font-semibold tracking-[-0.02em]">Recuperar acesso</h2>
      <p className="mb-7 mt-0 text-secao text-ink-3">Informe seu e-mail. O administrador do sistema recebe o pedido e envia um novo link de acesso para você.</p>
      {enviado ? (
        <Aviso tom="success">{state.mensagem}</Aviso>
      ) : (
        <ActionForm action={action} noValidate>
          <Field label="E-mail" htmlFor="email" error={erroEmail}>
            <Input id="email" name="email" type="email" required autoFocus />
          </Field>
          <div className="mt-5 flex flex-col gap-3">
            <FormError message={!state.ok && !state.campos ? state.erro : null} />
            <SubmitButton size="full">Pedir novo acesso</SubmitButton>
          </div>
        </ActionForm>
      )}
      <p className="mb-0 mt-4 text-center text-corpo">
        <Link href="/login" className="link">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
