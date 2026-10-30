"use client";

import { useState } from "react";
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
  "aria-describedby": describedBy,
  "aria-invalid": invalido,
  "aria-required": obrigatorio,
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
  /* Vêm do <Field>: chegam ao campo de número, senão o erro e a dica não eram lidos (auditoria 28/10 nº 63). */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean;
}) {
  // Campo apagado para digitar outro número: fica vazio sem avisar ninguém. Antes Number("") virava 0 e o
  // estoque gravava 0 enquanto a pessoa pensava (auditoria 30/10, parte C N5). Ao sair vazio, volta o valor.
  const [rascunho, setRascunho] = useState<string | null>(null);
  const fixar = (n: number) => Math.max(min, Math.min(max, Math.floor(Number.isFinite(n) ? n : min)));
  const sm = tamanho === "sm";
  // "Aumentar" sozinho se repete em cada linha da lista: com o rótulo, o leitor de tela diz de qual quantidade é.
  const deQue = label ? ` ${label.charAt(0).toLocaleLowerCase("pt-BR")}${label.slice(1)}` : "";
  /* 30/34 px no desktop; 40 px abaixo de md (alvo de toque). */
  const btn = cn(
    "flex shrink-0 cursor-pointer items-center justify-center border-0 bg-subtle text-ink-2 transition-colors duration-150 hover:bg-control hover:text-ink active:bg-line disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent max-md:size-10",
    sm ? "size-[30px]" : "size-[34px]",
  );
  return (
    <div
      className={cn(
        // Foco: borda + anel da marca, como os outros campos (auditoria 28/10 nº 135).
        "inline-flex items-center overflow-hidden rounded-controle border border-line-control bg-surface transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent has-[input[aria-invalid=true]]:border-danger-input",
        disabled && "opacity-60",
        className,
      )}
    >
      <button type="button" aria-label={`Diminuir${deQue}`} disabled={disabled || valor <= min} onClick={() => onChange(fixar(valor - 1))} className={btn}>
        <Icone nome="menos" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={rascunho ?? valor}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalido || undefined}
        aria-required={obrigatorio || undefined}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value.trim() === "") return setRascunho("");
          setRascunho(null);
          onChange(fixar(Number(e.target.value)));
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() => setRascunho(null)}
        className={cn("numero border-0 bg-surface text-center text-corpo font-medium text-ink focus:outline-none max-md:h-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", sm ? "h-[30px] w-12" : "h-[34px] w-16")}
      />
      <button type="button" aria-label={`Aumentar${deQue}`} disabled={disabled || valor >= max} onClick={() => onChange(fixar(valor + 1))} className={btn}>
        <Icone nome="mais" />
      </button>
    </div>
  );
}
