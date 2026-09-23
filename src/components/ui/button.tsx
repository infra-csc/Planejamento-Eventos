"use client";

import Link from "next/link";
import { forwardRef, useId, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import { useFormPending } from "./action-form";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-classes";
import { Spinner } from "./icons";

export { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-classes";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra o spinner no lugar do conteúdo (a largura não muda) e bloqueia novos cliques. */
  loading?: boolean;
  /**
   * Por que o botão está indisponível. Com `disabled`, o botão continua focável (aria-disabled),
   * mostra o motivo no `title` e o leitor de tela o anuncia (aria-describedby).
   */
  motivoDesabilitado?: string;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant, size, loading, motivoDesabilitado, className, children, disabled, type = "button", onClick, title, "aria-describedby": describedBy, ...rest }, ref) {
  const idMotivo = useId();
  // Com motivo: aria-disabled em vez de disabled, para o foco e o title (tooltip) continuarem funcionando.
  const comMotivo = Boolean(disabled && motivoDesabilitado && !loading);
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={comMotivo ? undefined : disabled || loading}
      aria-disabled={comMotivo || undefined}
      aria-describedby={comMotivo ? cn(describedBy, idMotivo) : describedBy}
      title={comMotivo ? motivoDesabilitado : title}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (comMotivo) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      {/* `contents`: os filhos seguem como itens do flex do botão; no loading ficam transparentes (sem sair da árvore de acessibilidade). */}
      <span className={cn("contents", loading && "text-transparent [&>*]:opacity-0")}>{children}</span>
      {loading && (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <Spinner tamanho={size === "xs" || size === "sm" ? 12 : 14} />
        </span>
      )}
      {comMotivo && (
        <span id={idMotivo} className="sr-only">
          {motivoDesabilitado}
        </span>
      )}
    </button>
  );
});

/** Botão de submit que reflete o estado pendente do formulário. */
export function SubmitButton({ children, variant = "primary", ...rest }: Props) {
  const { pending: nativo } = useFormStatus();
  const ctx = useFormPending();
  const pending = ctx ?? nativo;
  return (
    <Button type="submit" variant={variant} loading={pending} {...rest}>
      {children}
    </Button>
  );
}

export function ButtonLink({ variant, size, className, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClasses({ variant, size, className })} {...rest} />;
}
