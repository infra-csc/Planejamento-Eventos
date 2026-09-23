"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Botão redondo só com ícone (lápis, seta, fechar). `label` é obrigatório: vira aria-label e title.
 * 24/28 px no desktop; 40 px abaixo de md (alvo de toque). Use <Icone tamanho={16}> dentro.
 */
const classes = (tamanho: "sm" | "md", className?: string) =>
  cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent bg-transparent text-ink-3 no-underline transition-colors duration-150 hover:border-line hover:bg-surface hover:text-ink active:bg-subtle",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    tamanho === "sm" ? "size-6" : "size-7",
    "max-md:size-10",
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
