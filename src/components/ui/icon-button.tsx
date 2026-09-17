"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Botão redondo só com ícone (lápis, seta, fechar). `label` é obrigatório: vira aria-label e title. */
const classes = (tamanho: "sm" | "md", className?: string) =>
  cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent bg-transparent text-ink-3 no-underline transition-colors hover:border-line hover:bg-surface hover:text-accent disabled:cursor-not-allowed disabled:opacity-50",
    tamanho === "sm" ? "size-6" : "size-7",
    className,
  );

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> & { label: string; tamanho?: "sm" | "md" };

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton({ label, tamanho = "md", className, type = "button", children, ...rest }, ref) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={classes(tamanho, className)} {...rest}>
      {children}
    </button>
  );
});

export function IconLink({ label, tamanho = "md", className, children, ...rest }: Omit<ComponentProps<typeof Link>, "aria-label" | "title"> & { label: string; tamanho?: "sm" | "md" }) {
  return (
    <Link aria-label={label} title={label} className={classes(tamanho, className)} {...rest}>
      {children}
    </Link>
  );
}
