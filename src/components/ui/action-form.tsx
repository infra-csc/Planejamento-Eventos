"use client";

import { createContext, useContext, useEffect, useRef, useTransition, type FormHTMLAttributes } from "react";

export const FormPendingContext = createContext<boolean | null>(null);

export function useFormPending() {
  return useContext(FormPendingContext);
}

/**
 * Formulário ligado a uma action de useActionState.
 *
 * Submete via transição em vez do atributo `action`, para que o React NÃO
 * reinicie os campos depois de uma resposta de erro (validação no servidor):
 * o usuário mantém o que digitou e vê a mensagem no campo.
 */
export function ActionForm({
  action,
  children,
  ref,
  ...rest
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & { action: (formData: FormData) => void; ref?: React.Ref<HTMLFormElement> }) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const botaoRef = useRef<HTMLElement | null>(null);
  const enviou = useRef(false);

  // Resposta do servidor: o botão ficou desabilitado durante o envio e o foco caía no <body>, e o leitor de tela
  // não ouvia o erro. Vai para o primeiro campo com erro; sem erro de campo, volta ao botão (auditoria 30/10, B-08).
  useEffect(() => {
    if (pending) {
      enviou.current = true;
      return;
    }
    if (!enviou.current) return;
    enviou.current = false;
    const form = formRef.current;
    if (!form?.isConnected) return;
    const comErro = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (comErro) comErro.focus();
    else if (!document.activeElement || document.activeElement === document.body) botaoRef.current?.focus();
  }, [pending]);

  const juntarRef = (el: HTMLFormElement | null) => {
    formRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  return (
    <FormPendingContext.Provider value={pending}>
      <form
        {...rest}
        ref={juntarRef}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          botaoRef.current = submitter;
          const fd = new FormData(e.currentTarget, submitter);
          start(() => action(fd));
        }}
        aria-busy={pending || undefined}
      >
        {children}
      </form>
    </FormPendingContext.Provider>
  );
}
