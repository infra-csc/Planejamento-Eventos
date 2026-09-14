"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { useFormPending } from "./action-form";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-classes";

export { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-classes";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant, size, loading, className, children, disabled, type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {children}
      {loading && <span aria-hidden className="inline-block size-[6px] animate-pulse-dot rounded-full bg-current" />}
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
