"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { loginAction } from "../actions";
import { Field, FormError, Input } from "@/components/ui/field";
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

export function LoginForm({ next, redefinida, senhaDemo }: { next: string; redefinida: boolean; /** Só vem preenchida com a demonstração ligada: fora dela, a senha do seed não chega ao navegador. */ senhaDemo: string | null }) {
  const demo = Boolean(senhaDemo);
  const [state, action] = useActionState(loginAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const campos = !state.ok ? state.campos : undefined;

  const entrarComo = (email: string) => {
    if (!emailRef.current || !senhaRef.current) return;
    emailRef.current.value = email;
    senhaRef.current.value = senhaDemo ?? "";
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <h1 className="mb-1.5 mt-0 text-pagina font-semibold tracking-[-0.02em]">Entrar</h1>
      <p className="mb-7 mt-0 text-secao text-ink-3">Use o e-mail e a senha cadastrados pelo administrador.</p>
      {redefinida && (
        <Aviso tom="success" className="mb-4">
          Senha definida. Entre com a nova senha.
        </Aviso>
      )}
      <ActionForm ref={formRef} action={action} noValidate>
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail" htmlFor="email" error={campos?.email}>
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="voce@nortemkt.com.br" />
        </Field>
        <Field label="Senha" htmlFor="senha" error={campos?.senha} className="mt-4">
          <Input ref={senhaRef} id="senha" name="senha" type="password" autoComplete="current-password" required />
        </Field>
        <div className="mt-5 flex flex-col gap-3">
          <FormError message={!state.ok && !campos ? state.erro : null} />
          <SubmitButton size="full">Entrar</SubmitButton>
        </div>
      </ActionForm>
      <p className="mb-0 mt-4 text-center text-corpo">
        <Link href="/recuperar-senha" className="link">
          Esqueci minha senha
        </Link>
      </p>
      {demo && (
        <div className="mt-8 border-t border-line pt-5">
          <p className="mb-2.5 mt-0 text-pequeno uppercase tracking-[0.08em] text-muted">Demonstração — entrar como</p>
          <div className="flex flex-col gap-1.5">
            {PERFIS_DEMO.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => entrarComo(p.email)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-controle border border-line bg-surface px-3 py-[9px] text-left hover:bg-subtle"
              >
                <span className="text-corpo font-medium text-ink">{p.nome}</span>
                <span className="text-pequeno text-ink-3">{p.perfil}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
