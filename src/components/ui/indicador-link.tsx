"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/cn";
import { Spinner } from "./icons";
import { useSinalizarNavegacao } from "./navegacao";

/**
 * Indicador de carregamento para usar DENTRO de um <Link> (aba, pílula, página, cabeçalho ordenável).
 * Aparece só se a navegação passar de ~100 ms e nunca muda o tamanho do link (sem pulo de layout).
 * Também alimenta a barra global do topo (navegacao.ts).
 *
 *  - `ao-lado`     spinner de 12 px num espaço fixo (o link reserva o espaço).
 *  - `sobre`       véu claro + spinner por cima do conteúdo; o link precisa de `relative`.
 *  - `sublinhado`  traço pulsando na base (abas); o link precisa de `relative`.
 */
export function IndicadorLink({ className, lugar = "ao-lado", fundo = "bg-white/75" }: { className?: string; lugar?: "ao-lado" | "sobre" | "sublinhado"; /** Véu do modo `sobre` (classe de fundo). */ fundo?: string }) {
  const { pending } = useLinkStatus();
  useSinalizarNavegacao(pending);
  const visivel = pending ? "opacity-100 delay-100" : "opacity-0";
  if (lugar === "sublinhado") return <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 bg-accent transition-opacity duration-150", pending && "animate-esqueleto", visivel, className)} />;
  if (lugar === "sobre")
    return (
      <span aria-hidden className={cn("pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] text-ink-2 transition-opacity duration-150", fundo, visivel, className)}>
        {pending && <Spinner tamanho={12} />}
      </span>
    );
  return (
    <span aria-hidden className={cn("inline-grid size-3 shrink-0 place-items-center transition-opacity duration-150", visivel, className)}>
      {pending && <Spinner tamanho={12} />}
    </span>
  );
}

/** Mesmo sinal, sem nada visível: o link só alimenta a barra global do topo. */
export function SinalLink() {
  const { pending } = useLinkStatus();
  useSinalizarNavegacao(pending);
  return null;
}
