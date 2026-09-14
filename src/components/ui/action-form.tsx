"use client";

import { createContext, useContext, useTransition, type FormHTMLAttributes } from "react";

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
  ...rest
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & { action: (formData: FormData) => void; ref?: React.Ref<HTMLFormElement> }) {
  const [pending, start] = useTransition();
  return (
    <FormPendingContext.Provider value={pending}>
      <form
        {...rest}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
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
