"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { recuperarSenhaAction } from "../actions";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { Aviso } from "@/components/ui/layout";
import type { ActionResult } from "@/lib/action";

export default function RecuperarSenhaPage() {
  const [state, action] = useActionState(recuperarSenhaAction, { ok: true } as ActionResult<{ link: string | null }>);
  const enviado = state.ok && state.mensagem;
  return (
    <>
      <h2 className="mb-1.5 mt-0 text-[24px] font-semibold tracking-[-0.02em]">Recuperar acesso</h2>
      <p className="mb-7 mt-0 text-[14px] text-ink-3">Informe seu e-mail para gerar um link de definição de senha.</p>
      {enviado ? (
        <div className="flex flex-col gap-3">
          <Aviso tom="success">{state.mensagem}</Aviso>
          {state.dados?.link && (
            <Aviso titulo="Ambiente sem envio de e-mail">
              O link foi registrado no log do servidor. Para testar agora,{" "}
              <a href={state.dados.link} className="link">
                abra o link de definição de senha
              </a>
              .
            </Aviso>
          )}
        </div>
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
            className="h-[42px] w-full rounded-lg border border-line-strong bg-surface px-3 text-[14.5px] text-ink focus:border-accent focus:outline-none"
          />
          {!state.ok && state.campos?.email && <span className="mt-[5px] block text-[12px] text-danger">{state.campos.email}</span>}
          <div className="mt-5 flex flex-col gap-3">
            <FormError message={!state.ok && !state.campos ? state.erro : null} />
            <SubmitButton size="full">Gerar link</SubmitButton>
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
