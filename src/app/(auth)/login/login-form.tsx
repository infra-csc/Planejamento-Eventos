"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { loginAction } from "../actions";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { Aviso } from "@/components/ui/layout";
import { ESTADO_INICIAL } from "@/lib/action";

const PERFIS_DEMO = [
  { nome: "Marina Castro", perfil: "Logística", email: "marina.castro@nortemkt.com.br" },
  { nome: "Paulo Ribeiro", perfil: "Requisitante", email: "paulo.ribeiro@nortemkt.com.br" },
  { nome: "Helena Prado", perfil: "Gestão", email: "helena.prado@nortemkt.com.br" },
  { nome: "Bruno Tavares", perfil: "Cenografia", email: "bruno.tavares@nortemkt.com.br" },
  { nome: "Administrador do Sistema", perfil: "Administrador", email: "admin@nortemkt.com.br" },
];

const campo = "h-[42px] w-full rounded-lg border border-line-control bg-surface px-3 text-[14.5px] text-ink placeholder:text-meta focus:border-accent focus:outline-none aria-[invalid=true]:border-danger-input";

export function LoginForm({ next, redefinida, demo }: { next: string; redefinida: boolean; demo: boolean }) {
  const [state, action] = useActionState(loginAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const campos = !state.ok ? state.campos : undefined;

  const entrarComo = (email: string) => {
    if (!emailRef.current || !senhaRef.current) return;
    emailRef.current.value = email;
    senhaRef.current.value = "norte1234";
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <h2 className="mb-1.5 mt-0 text-[24px] font-semibold tracking-[-0.02em]">Entrar</h2>
      <p className="mb-7 mt-0 text-[14px] text-ink-3">Use o e-mail e a senha cadastrados pelo administrador.</p>
      {redefinida && (
        <Aviso tom="success" className="mb-4">
          Senha definida. Entre com a nova senha.
        </Aviso>
      )}
      <ActionForm ref={formRef} action={action} noValidate>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink-2">
          E-mail
        </label>
        <input ref={emailRef} id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="voce@nortemkt.com.br" aria-invalid={Boolean(campos?.email)} className={campo} />
        {campos?.email && <span className="mt-[5px] block text-[12px] text-danger">{campos.email}</span>}
        <label htmlFor="senha" className="mb-1.5 mt-4 block text-[13px] font-medium text-ink-2">
          Senha
        </label>
        <input ref={senhaRef} id="senha" name="senha" type="password" autoComplete="current-password" required aria-invalid={Boolean(campos?.senha)} className={campo} />
        {campos?.senha && <span className="mt-[5px] block text-[12px] text-danger">{campos.senha}</span>}
        <div className="mt-5 flex flex-col gap-3">
          <FormError message={!state.ok && !campos ? state.erro : null} />
          <SubmitButton size="full">Entrar</SubmitButton>
        </div>
      </ActionForm>
      <p className="mb-0 mt-4 text-center text-[13.5px]">
        <Link href="/recuperar-senha" className="link">
          Esqueci minha senha
        </Link>
      </p>
      {demo && (
        <div className="mt-8 border-t border-line pt-5">
          <p className="mb-2.5 mt-0 text-[12px] uppercase tracking-[0.08em] text-muted">Demonstração — entrar como</p>
          <div className="flex flex-col gap-1.5">
            {PERFIS_DEMO.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => entrarComo(p.email)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-[9px] text-left hover:bg-subtle"
              >
                <span className="text-[13.5px] font-medium text-ink">{p.nome}</span>
                <span className="text-[12px] text-ink-3">{p.perfil}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
