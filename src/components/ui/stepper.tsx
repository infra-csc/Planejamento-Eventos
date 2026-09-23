"use client";

import { cn } from "@/lib/cn";
import { Icone } from "./icons";

/**
 * Campo numérico com − e + (quantidades). Um só desenho para pedido, conferência e ajuste de peça.
 * `min` 0 permite "retirar"; quem usa decide o significado.
 */
export function Stepper({
  id,
  valor,
  onChange,
  min = 0,
  max = 1_000_000,
  tamanho = "md",
  label,
  autoFocus,
  disabled,
  className,
}: {
  id?: string;
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  tamanho?: "sm" | "md";
  /** aria-label do campo quando não há <label htmlFor>. */
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const fixar = (n: number) => Math.max(min, Math.min(max, Math.floor(Number.isFinite(n) ? n : min)));
  const sm = tamanho === "sm";
  /* 30/34 px no desktop; 40 px abaixo de md (alvo de toque). */
  const btn = cn(
    "flex shrink-0 cursor-pointer items-center justify-center border-0 bg-subtle text-ink-2 transition-colors duration-150 hover:bg-control hover:text-ink active:bg-line disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent max-md:size-10",
    sm ? "size-[30px]" : "size-[34px]",
  );
  return (
    <div className={cn("inline-flex items-center overflow-hidden rounded-controle border border-line-control bg-surface transition-colors duration-150 focus-within:border-accent", disabled && "opacity-60", className)}>
      <button type="button" aria-label="Diminuir" disabled={disabled || valor <= min} onClick={() => onChange(fixar(valor - 1))} className={btn}>
        <Icone nome="menos" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={valor}
        aria-label={label}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(fixar(Number(e.target.value)))}
        onFocus={(e) => e.target.select()}
        className={cn("numero border-0 bg-surface text-center text-corpo font-medium text-ink focus:outline-none max-md:h-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", sm ? "h-[30px] w-12" : "h-[34px] w-16")}
      />
      <button type="button" aria-label="Aumentar" disabled={disabled || valor >= max} onClick={() => onChange(fixar(valor + 1))} className={btn}>
        <Icone nome="mais" />
      </button>
    </div>
  );
}
